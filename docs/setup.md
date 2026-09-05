# Setup & route maps

## Frontend route map (storefront)
`/`, `/collections/{slug}`, `/search`, `/products/{slug}`, `/cart`, `/checkout`,
`/orders/{orderNumber}`, `/login`, `/register`, `/account`, `/account/orders`,
`/account/orders/{id}`, `/account/profile`, `/account/addresses`, `/account/wishlist`,
`/account/reviews`, `/sustainability`

## Admin route map
`/admin`, `/admin/products`, `/admin/products/{id}`, `/admin/categories`,
`/admin/collections`, `/admin/orders`, `/admin/orders/{id}`, `/admin/customers`,
`/admin/customers/{id}`, `/admin/inventory`, `/admin/warehouses`, `/admin/promotions`,
`/admin/reviews`, `/admin/employees`, `/admin/reports`, `/admin/audit-logs`, `/admin/settings`

## Folder structure
```
src/app/(store)      storefront routes
src/app/(auth)       login/register
src/app/admin        admin dashboard
src/app/api/v1       REST API router
src/server/          modules: services, repositories, providers (payment, email, search, storage)
src/lib/             api client, auth utils, formatting, zod schemas
src/components/      ui primitives, store components, admin components
src/stores/          zustand stores
src/db/              drizzle schema + seed
infra/               docker-compose, Dockerfiles
docs/                architecture, database, api
```

## Implementation plan
1. Foundation: schema, migrations, auth, API router, envelope, RBAC
2. Catalog: products, variants, categories, collections, PLP, PDP, search
3. Shopping: cart, wishlist, checkout, mock payment, orders
4. Customer: profile, addresses, order history, reviews
5. Admin: dashboard, products, orders, customers, inventory, warehouses
6. Business: promotions, employees, RBAC UI, audit logs, notifications
7. Quality: tests, SEO (sitemap/robots/JSON-LD), docs, docker
