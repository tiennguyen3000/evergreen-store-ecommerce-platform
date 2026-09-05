# Evergreen Store — System Architecture

## 1. System architecture

```
 Browser (Next.js App Router, React 19, Tailwind, TanStack Query, Zustand)
   │  server components call services directly (SSR/SEO)
   │  client components call REST  /api/v1/**
   ▼
 API layer (Next.js route handler router  src/app/api/v1/[[...path]]/route.ts)
   │  auth (JWT access + rotating refresh tokens), RBAC guard, validation (zod), envelope
   ▼
 Service layer  (src/server/services/*)  – business rules, transactions
   ▼
 Repository/Query layer (Drizzle ORM)   – typed SQL, indexes, no N+1
   ▼
 PostgreSQL 16   (+ Redis for carts/caching when RUN_MODE=docker)
```

Target production topology (the docker-compose in `infra/` describes it):

* `frontend`  – Next.js (this repo)
* `backend`   – the same modular monolith. The service modules are written so they can be
                lifted 1:1 into a Spring Boot (Java 21) application: each module exposes
                `Controller → Service → Repository` boundaries and DTO mappers.
* `postgres`  – primary datastore (Flyway-style migrations live in `drizzle/`)
* `redis`     – active cart cache, rate-limit counters, catalog cache
* `minio`     – S3-compatible object storage for media (metadata in `media` table)

## 2. Module architecture (modular monolith)

| Module        | Responsibilities |
|---------------|------------------|
| auth          | register, login, refresh rotation, logout, me, password hashing (bcrypt) |
| user          | users, roles, permissions, RBAC resolution |
| product       | products, variants, images, attributes, tags, brand |
| category      | categories, collections, membership |
| search        | `SearchProvider` abstraction → `PostgresSearchProvider` (tsvector / ILIKE) |
| cart          | carts, cart items, merge guest→user, stock guard |
| wishlist      | wishlist, wishlist items, price snapshot |
| order         | checkout, orders, order items, timeline, cancellation, reorder |
| payment       | `PaymentProvider` abstraction → `MockPaymentProvider` |
| inventory     | warehouse inventory, transactions (ledger), reservations, adjustments |
| warehouse     | warehouses, transfers with status machine |
| customer      | customer profile, addresses, LTV metrics |
| employee      | employees, role assignment, permissions |
| review        | reviews, moderation, verified purchase guard |
| promotion     | coupons, validation, usages |
| notification  | notification records, `EmailProvider` → `LoggingEmailProvider` |
| audit         | audit log writer for every sensitive admin operation |
| analytics     | dashboard + reports aggregations |
| settings      | database-backed store settings |
| media         | `StorageProvider` abstraction (local/minio/s3), media metadata |

Module rules: a module may only depend on another module's *service* API, never its
repository. Cross-cutting concerns (auth context, audit, notifications) are injected
through services.

## 3. Authentication / RBAC design

* Passwords hashed with bcrypt (cost 10).
* Access token: JWT (HS256, 15 min) carrying `sub`, `roles`, `permissions`.
* Refresh token: opaque random 256-bit value, stored hashed in `refresh_tokens`, rotated
  on every `/auth/refresh` (old token revoked, replaced_by pointer). Reuse of a revoked
  token revokes the whole family.
* Tokens are delivered as httpOnly, SameSite=Lax cookies (`eg_access`, `eg_refresh`) and
  also returned in the JSON body for non-browser clients.
* Roles: CUSTOMER, EMPLOYEE, MANAGER, ADMIN, SUPER_ADMIN.
* Permissions resolved from `role_permissions` on login and embedded in the access token;
  every `/api/v1/admin/**` handler calls `requirePermission(ctx, "ORDER_UPDATE")` etc.
* Ownership checks: orders/addresses/wishlists always filtered by the authenticated userId.
* Frontend never sends userId, prices, quantities of stock or discount amounts.

Role → permission matrix

| Permission          | EMPLOYEE | MANAGER | ADMIN | SUPER_ADMIN |
|---------------------|:--:|:--:|:--:|:--:|
| PRODUCT_VIEW        | ✓ | ✓ | ✓ | ✓ |
| PRODUCT_CREATE/UPDATE |   | ✓ | ✓ | ✓ |
| PRODUCT_DELETE      |   |   | ✓ | ✓ |
| ORDER_VIEW          | ✓ | ✓ | ✓ | ✓ |
| ORDER_UPDATE        | ✓ | ✓ | ✓ | ✓ |
| ORDER_REFUND        |   | ✓ | ✓ | ✓ |
| INVENTORY_VIEW      | ✓ | ✓ | ✓ | ✓ |
| INVENTORY_UPDATE    | ✓ | ✓ | ✓ | ✓ |
| INVENTORY_TRANSFER  |   | ✓ | ✓ | ✓ |
| CUSTOMER_VIEW       | ✓ | ✓ | ✓ | ✓ |
| CUSTOMER_UPDATE     |   | ✓ | ✓ | ✓ |
| EMPLOYEE_VIEW       |   | ✓ | ✓ | ✓ |
| EMPLOYEE_MANAGE     |   |   | ✓ | ✓ |
| REPORT_VIEW         |   | ✓ | ✓ | ✓ |
| AUDIT_VIEW          |   |   | ✓ | ✓ |
| SETTINGS_MANAGE     |   |   | ✓ | ✓ |

## 4. Inventory design

* `warehouse_inventory (variant_id, warehouse_id)` is the only stock table.
  `quantity_available = quantity_on_hand - quantity_reserved` (generated in queries).
* Stock is **never** written directly; `InventoryService.applyTransaction()` writes an
  `inventory_transactions` ledger row and updates the balance in the same DB transaction.
* Checkout: `SELECT ... FOR UPDATE` on the inventory rows → validate
  `requested <= available` → write `RESERVATION` transaction (+reserved).
* Payment success → `SALE` transaction (−on_hand, −reserved).
* Cancellation before shipment → `RELEASE` (−reserved) ; refund after shipment → `RETURN`.
* Admin adjustments → `ADJUSTMENT` / `DAMAGE` / `PURCHASE` with reason + actor.
* Transfers: `TRANSFER_OUT` at source when APPROVED→IN_TRANSIT, `TRANSFER_IN` at
  destination when COMPLETED.
* Low-stock = available <= reorder_level → `LOW_STOCK` notification for managers.

## 5. Order lifecycle

```
PENDING ──payment ok──▶ CONFIRMED ──▶ PROCESSING ──▶ PACKED ──▶ SHIPPED ──▶ DELIVERED
   │                         │             │            │
   └──payment failed──▶ CANCELLED ◀────────┴────────────┘ (cancel before ship: RELEASE stock)
                                                          DELIVERED/SHIPPED ──▶ REFUNDED (RETURN stock)
```
Every transition appends an `order_events` row (ORDER_CREATED, PAYMENT_CONFIRMED,
PAYMENT_FAILED, ORDER_PROCESSING, ORDER_PACKED, ORDER_SHIPPED, ORDER_DELIVERED,
ORDER_CANCELLED, REFUND_CREATED, NOTE_ADDED). Allowed transitions are enforced in
`OrderService.transition()`.

Payment: PENDING → AUTHORIZED → PAID | FAILED → REFUNDED.
Shipment: PENDING → PACKED → SHIPPED → IN_TRANSIT → DELIVERED | RETURNED.

## 6. Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| Overselling under concurrency | row locks (`FOR UPDATE`) + single transaction for reserve+order |
| Price tampering | all prices read from `product_variants` server-side |
| Token theft | short access TTL, rotating refresh tokens, httpOnly cookies |
| Large catalog performance | pagination everywhere, indexes on slug/sku/status/created_at, aggregated variant summary queries |
| Search scaling | `SearchProvider` interface; swap Postgres for OpenSearch |
| Payment vendor lock-in | `PaymentProvider` interface, Mock provider for dev |
