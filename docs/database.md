# Database design (PostgreSQL)

## ERD (condensed)

```
users 1─* user_roles *─1 roles 1─* role_permissions *─1 permissions
users 1─* refresh_tokens
users 1─* addresses
users 1─1 carts 1─* cart_items *─1 product_variants
users 1─1 wishlists 1─* wishlist_items *─1 products
users 1─* orders 1─* order_items *─1 product_variants
orders 1─* payments        orders 1─* shipments        orders 1─* order_events
orders *─1 coupons 1─* coupon_usages
brands 1─* products 1─* product_variants 1─* warehouse_inventory *─1 warehouses
products 1─* product_images      products *─* categories (product_categories)
products *─* collections (product_collections)   products 1─* product_attributes
products 1─* product_tags        products 1─* reviews *─1 users
warehouses 1─* inventory_transactions *─1 product_variants
warehouses 1─* inventory_transfers (from/to) 1─* inventory_transfer_items
users 1─* notifications      users 1─* audit_logs       media      store_settings
```

## Tables (see `src/db/schema.ts` for the authoritative definition)

users, roles, permissions, user_roles, role_permissions, refresh_tokens,
brands, categories, collections, products, product_variants, product_images,
product_attributes, product_tags, product_categories, product_collections,
warehouses, warehouse_inventory, inventory_transactions, inventory_transfers,
inventory_transfer_items, carts, cart_items, wishlists, wishlist_items, addresses,
orders, order_items, order_events, payments, shipments, reviews, coupons, coupon_usages,
notifications, audit_logs, media, store_settings, newsletter_subscribers, search_events.

## Indexes
slug (products, categories, collections – unique), sku (unique), email (unique),
order_number (unique), products.status, product_categories.category_id,
orders.created_at, orders.user_id, inventory(variant_id, warehouse_id) unique,
inventory_transactions(variant_id), reviews(product_id,status), audit_logs(created_at).

## Migrations
`npx drizzle-kit generate` writes SQL migrations into `drizzle/`; `npx drizzle-kit push`
applies the schema directly in development. Seed: `npm run db:seed`.
