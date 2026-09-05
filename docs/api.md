# REST API specification — base `/api/v1`

Envelope: success `{ "data": ..., "meta": {...} }`, error
`{ "error": { "code", "message", "details" } }`. Pagination query: `page`, `pageSize`, `sort`.

## Public / customer
| Method | Path | Notes |
|---|---|---|
| GET | /health | liveness |
| POST | /auth/register | `{email,password,firstName,lastName}` |
| POST | /auth/login | sets cookies, returns tokens |
| POST | /auth/refresh | rotates refresh token |
| POST | /auth/logout | revokes refresh token |
| GET | /auth/me | current user + roles/permissions |
| GET | /products | filters: `category, collection, size, color, minPrice, maxPrice, inStock, onSale, badge, q, sort, page` |
| GET | /products/{slug} | detail incl. variants, images, inventory, reviews summary |
| GET | /products/{slug}/related | |
| GET | /categories, /categories/{slug} | |
| GET | /collections, /collections/{slug} | |
| GET | /search?q= | results + product/category suggestions |
| GET | /cart | guest cart via `eg_cart` cookie |
| POST | /cart/items | `{variantId, quantity}` — merges duplicate variants |
| PATCH | /cart/items/{id} | `{quantity}` or `{savedForLater}` |
| DELETE | /cart/items/{id} | |
| POST | /cart/coupon, DELETE /cart/coupon | validate + attach coupon |
| GET/POST | /wishlist, DELETE /wishlist/{productId} | auth |
| POST | /checkout/quote | shipping methods + totals |
| POST | /checkout | creates order, reserves inventory, runs payment provider |
| GET | /orders, /orders/{orderNumber} | auth or guest token |
| POST | /orders/{id}/cancel, /orders/{id}/reorder | |
| GET/PUT | /account/profile, POST /account/password | |
| GET/POST/PUT/DELETE | /account/addresses[/{id}] | |
| GET/POST | /reviews?productId=  /reviews | one review per order item |
| GET | /account/reviews, /account/notifications | |
| POST | /newsletter | |

## Admin (permission in brackets)
| Method | Path | Perm |
|---|---|---|
| GET | /admin/analytics?range=7d | REPORT_VIEW |
| GET | /admin/reports?range=30d | REPORT_VIEW |
| GET/POST | /admin/products | PRODUCT_VIEW / PRODUCT_CREATE |
| GET/PUT/DELETE | /admin/products/{id} | PRODUCT_VIEW/UPDATE/DELETE |
| POST | /admin/products/{id}/duplicate, /publish, /archive | PRODUCT_UPDATE |
| POST | /admin/products/bulk | PRODUCT_UPDATE |
| GET/POST/PUT/DELETE | /admin/categories, /admin/collections | PRODUCT_* |
| GET | /admin/orders, /admin/orders/{id} | ORDER_VIEW |
| PATCH | /admin/orders/{id}/status | ORDER_UPDATE |
| POST | /admin/orders/{id}/notes, /refund, /cancel | ORDER_UPDATE / ORDER_REFUND |
| GET | /admin/inventory, /admin/inventory/transactions | INVENTORY_VIEW |
| POST | /admin/inventory/adjustments | INVENTORY_UPDATE |
| GET/POST/PUT | /admin/warehouses | INVENTORY_VIEW / INVENTORY_TRANSFER |
| GET/POST/PATCH | /admin/transfers[/{id}/status] | INVENTORY_TRANSFER |
| GET | /admin/customers, /admin/customers/{id} | CUSTOMER_VIEW |
| PATCH | /admin/customers/{id}/status | CUSTOMER_UPDATE |
| GET/POST/PATCH | /admin/employees[/{id}] | EMPLOYEE_VIEW / EMPLOYEE_MANAGE |
| GET/POST/PATCH | /admin/promotions[/{id}] | PRODUCT_UPDATE |
| GET/PATCH/DELETE | /admin/reviews[/{id}] | PRODUCT_UPDATE |
| GET | /admin/audit-logs | AUDIT_VIEW |
| GET/PUT | /admin/settings | SETTINGS_MANAGE |

OpenAPI JSON is served at `/api/v1/openapi.json` and a Swagger UI at `/api-docs`.
