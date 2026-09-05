<<<<<<< HEAD
# evergreen-store-ecommerce-platform
=======
# Evergreen Store

A production-style, full-stack ecommerce platform (storefront + customer account + admin console + REST API)
inspired by premium DTC brands. Original brand, product data and imagery.

> **Architecture note.** The specification targets a Spring Boot backend. This sandbox has no JVM, so the backend is
> implemented as a **modular monolith inside Next.js** (`/api/v1` route layer → services → Drizzle/PostgreSQL) with the
> exact same module boundaries, DTOs, RBAC, ledger-based inventory, payment/email/search/storage provider abstractions
> and response envelopes described in `docs/architecture.md`. Every storefront and admin action calls this real API.

## 1. Requirements
Node 22+, PostgreSQL 16 (or Docker). Optional: Redis, MinIO.

## 2. Installation
```bash
npm install
cp .env.example .env        # set DATABASE_URL / JWT_SECRET
```

## 3. Environment variables
See `.env.example`. Secrets (DB creds, JWT secret, provider keys) are **never** stored in the database or code.

## 4. Docker
```bash
cd infra && JWT_SECRET=$(openssl rand -hex 32) docker compose up --build
```
Starts Postgres, Redis, MinIO and the app (auto-migrates + seeds) on http://localhost:3000.

## 5. Database migration
```bash
npm run db:push            # drizzle-kit push (dev)   |  npx drizzle-kit generate → SQL migrations in drizzle/
```

## 6. Seed data
```bash
npm run db:seed            # 108 products · 2,750 variants · 5 warehouses · 13,750 inventory rows · 500 orders · 1,180+ items · 260 reviews · 20 coupons · 100 customers · 10 employees
```
Idempotent — skips if products exist.

## 7 & 8. Running frontend + backend
```bash
npm run dev                # http://localhost:3000 (storefront)  /admin (console)  /api/v1 (API)
```

## 9. Running tests
```bash
npm test                   # vitest: unit (payment provider, helpers) + integration (inventory ledger, coupons, catalog, order state machine)
```

## 10. API documentation
* Swagger UI: http://localhost:3000/api-docs
* OpenAPI JSON: `/api/v1/openapi.json`
* Spec: `docs/api.md`

## 11. Default accounts (development only — password `Password123!`)
| Email | Role |
|---|---|
| customer@example.com | CUSTOMER |
| employee@example.com | EMPLOYEE |
| manager@example.com | MANAGER |
| admin@example.com | ADMIN |
| superadmin@example.com | SUPER_ADMIN |

Mock payments: any card number succeeds except those ending in `0000` (declined) or `9995` (insufficient funds).
Promo codes to try: `WELCOME10`, `EVERGREEN20`, `FREESHIP`, `EXPIRED10` (expired), `MAXEDOUT` (exhausted).

## Project layout
```
src/app/(store)   storefront      src/app/admin   admin console     src/app/api/v1  REST router
src/server        core (auth, RBAC, audit, envelope) + services (auth, catalog, commerce, admin) + openapi
src/db            drizzle schema + seed        src/components  ui kit, store, admin      src/lib  api client, hooks
docs/             architecture, database, api, setup        infra/  docker-compose, Dockerfile      tests/  vitest
```
>>>>>>> bb60c26 (feat: initial commit + CI workflow (build, test, docker))
