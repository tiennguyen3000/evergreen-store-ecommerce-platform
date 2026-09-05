import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  numeric,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";

const ts = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const tsUpdated = () => timestamp("updated_at", { withTimezone: true }).defaultNow().notNull();
const money = (name: string) => numeric(name, { precision: 12, scale: 2 });

// ---------------- Identity & RBAC ----------------
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    phone: varchar("phone", { length: 40 }),
    status: varchar("status", { length: 20 }).notNull().default("ACTIVE"), // ACTIVE | DISABLED | PENDING_VERIFICATION
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    isStaff: boolean("is_staff").notNull().default(false),
    jobTitle: varchar("job_title", { length: 100 }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    marketingOptIn: boolean("marketing_opt_in").notNull().default(false),
    createdAt: ts(),
    updatedAt: tsUpdated(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email), index("users_is_staff_idx").on(t.isStaff)],
);

export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 40 }).notNull().unique(),
  description: text("description"),
});

export const permissions = pgTable("permissions", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 60 }).notNull().unique(),
  description: text("description"),
});

export const userRoles = pgTable(
  "user_roles",
  {
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    roleId: integer("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] })],
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: integer("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
    permissionId: integer("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    family: varchar("family", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    userAgent: text("user_agent"),
    ipAddress: varchar("ip_address", { length: 64 }),
    createdAt: ts(),
  },
  (t) => [uniqueIndex("refresh_tokens_hash_idx").on(t.tokenHash), index("refresh_tokens_user_idx").on(t.userId)],
);

// ---------------- Catalog ----------------
export const brands = pgTable("brands", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  slug: varchar("slug", { length: 140 }).notNull().unique(),
});

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    parentId: integer("parent_id"),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 140 }).notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: ts(),
  },
  (t) => [uniqueIndex("categories_slug_idx").on(t.slug)],
);

export const collections = pgTable(
  "collections",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 140 }).notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    isFeatured: boolean("is_featured").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    rules: jsonb("rules"), // e.g. { gender: "men" } | { onSale: true } | { newWithinDays: 30 }
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: ts(),
  },
  (t) => [uniqueIndex("collections_slug_idx").on(t.slug)],
);

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 160 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description").notNull().default(""),
    shortDescription: varchar("short_description", { length: 300 }),
    status: varchar("status", { length: 20 }).notNull().default("DRAFT"), // DRAFT | ACTIVE | ARCHIVED
    brandId: integer("brand_id").references(() => brands.id),
    primaryCategoryId: integer("primary_category_id").references(() => categories.id),
    productType: varchar("product_type", { length: 40 }).notNull().default("shoes"), // shoes | apparel | accessories
    gender: varchar("gender", { length: 20 }).notNull().default("unisex"), // men | women | unisex
    material: text("material"),
    careInstructions: text("care_instructions"),
    sustainabilityDescription: text("sustainability_description"),
    specifications: jsonb("specifications").$type<Record<string, string>>(),
    seoTitle: varchar("seo_title", { length: 160 }),
    seoDescription: varchar("seo_description", { length: 320 }),
    weightGrams: integer("weight_grams"),
    shippingClass: varchar("shipping_class", { length: 40 }).default("standard"),
    isFeatured: boolean("is_featured").notNull().default(false),
    isBestSeller: boolean("is_best_seller").notNull().default(false),
    ratingAvg: numeric("rating_avg", { precision: 3, scale: 2 }).notNull().default("0"),
    ratingCount: integer("rating_count").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: ts(),
    updatedAt: tsUpdated(),
  },
  (t) => [
    uniqueIndex("products_slug_idx").on(t.slug),
    index("products_status_idx").on(t.status),
    index("products_created_idx").on(t.createdAt),
    index("products_type_idx").on(t.productType),
  ],
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    sku: varchar("sku", { length: 64 }).notNull(),
    barcode: varchar("barcode", { length: 64 }),
    color: varchar("color", { length: 60 }).notNull(),
    colorHex: varchar("color_hex", { length: 9 }).notNull().default("#000000"),
    size: varchar("size", { length: 20 }).notNull(),
    price: money("price").notNull(),
    compareAtPrice: money("compare_at_price"),
    costPrice: money("cost_price"),
    weightGrams: integer("weight_grams"),
    status: varchar("status", { length: 20 }).notNull().default("ACTIVE"),
    createdAt: ts(),
  },
  (t) => [uniqueIndex("variants_sku_idx").on(t.sku), index("variants_product_idx").on(t.productId)],
);

export const productImages = pgTable(
  "product_images",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    altText: varchar("alt_text", { length: 200 }),
    color: varchar("color", { length: 60 }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("product_images_product_idx").on(t.productId)],
);

export const productAttributes = pgTable(
  "product_attributes",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    value: varchar("value", { length: 200 }).notNull(),
  },
  (t) => [index("product_attributes_product_idx").on(t.productId)],
);

export const productTags = pgTable(
  "product_tags",
  {
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    tag: varchar("tag", { length: 60 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.productId, t.tag] })],
);

export const productCategories = pgTable(
  "product_categories",
  {
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    categoryId: integer("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.productId, t.categoryId] }), index("product_categories_cat_idx").on(t.categoryId)],
);

export const productCollections = pgTable(
  "product_collections",
  {
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    collectionId: integer("collection_id").notNull().references(() => collections.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.productId, t.collectionId] }), index("product_collections_col_idx").on(t.collectionId)],
);

// ---------------- Inventory & Warehouses ----------------
export const warehouses = pgTable("warehouses", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("ACTIVE"),
  addressLine1: varchar("address_line1", { length: 200 }),
  city: varchar("city", { length: 100 }),
  region: varchar("region", { length: 100 }),
  postalCode: varchar("postal_code", { length: 20 }),
  country: varchar("country", { length: 2 }).notNull().default("US"),
  isDefault: boolean("is_default").notNull().default(false),
  priority: integer("priority").notNull().default(100),
  createdAt: ts(),
});

export const warehouseInventory = pgTable(
  "warehouse_inventory",
  {
    id: serial("id").primaryKey(),
    variantId: integer("variant_id").notNull().references(() => productVariants.id, { onDelete: "cascade" }),
    warehouseId: integer("warehouse_id").notNull().references(() => warehouses.id, { onDelete: "cascade" }),
    quantityOnHand: integer("quantity_on_hand").notNull().default(0),
    quantityReserved: integer("quantity_reserved").notNull().default(0),
    reorderLevel: integer("reorder_level").notNull().default(5),
    updatedAt: tsUpdated(),
  },
  (t) => [
    uniqueIndex("inventory_variant_warehouse_idx").on(t.variantId, t.warehouseId),
    index("inventory_warehouse_idx").on(t.warehouseId),
  ],
);

export const inventoryTransactions = pgTable(
  "inventory_transactions",
  {
    id: serial("id").primaryKey(),
    variantId: integer("variant_id").notNull().references(() => productVariants.id, { onDelete: "cascade" }),
    warehouseId: integer("warehouse_id").notNull().references(() => warehouses.id),
    type: varchar("type", { length: 20 }).notNull(),
    quantity: integer("quantity").notNull(),
    referenceType: varchar("reference_type", { length: 40 }),
    referenceId: varchar("reference_id", { length: 64 }),
    reason: text("reason"),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: ts(),
  },
  (t) => [index("inv_tx_variant_idx").on(t.variantId), index("inv_tx_created_idx").on(t.createdAt)],
);

export const inventoryTransfers = pgTable("inventory_transfers", {
  id: serial("id").primaryKey(),
  fromWarehouseId: integer("from_warehouse_id").notNull().references(() => warehouses.id),
  toWarehouseId: integer("to_warehouse_id").notNull().references(() => warehouses.id),
  status: varchar("status", { length: 20 }).notNull().default("REQUESTED"),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: ts(),
  updatedAt: tsUpdated(),
});

export const inventoryTransferItems = pgTable("inventory_transfer_items", {
  id: serial("id").primaryKey(),
  transferId: integer("transfer_id").notNull().references(() => inventoryTransfers.id, { onDelete: "cascade" }),
  variantId: integer("variant_id").notNull().references(() => productVariants.id),
  quantity: integer("quantity").notNull(),
});

// ---------------- Cart & Wishlist ----------------
export const carts = pgTable(
  "carts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 64 }).notNull(),
    couponCode: varchar("coupon_code", { length: 40 }),
    status: varchar("status", { length: 20 }).notNull().default("ACTIVE"),
    createdAt: ts(),
    updatedAt: tsUpdated(),
  },
  (t) => [uniqueIndex("carts_token_idx").on(t.token), index("carts_user_idx").on(t.userId)],
);

export const cartItems = pgTable(
  "cart_items",
  {
    id: serial("id").primaryKey(),
    cartId: integer("cart_id").notNull().references(() => carts.id, { onDelete: "cascade" }),
    variantId: integer("variant_id").notNull().references(() => productVariants.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    savedForLater: boolean("saved_for_later").notNull().default(false),
    createdAt: ts(),
  },
  (t) => [uniqueIndex("cart_items_cart_variant_idx").on(t.cartId, t.variantId)],
);

export const wishlists = pgTable("wishlists", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  createdAt: ts(),
});

export const wishlistItems = pgTable(
  "wishlist_items",
  {
    id: serial("id").primaryKey(),
    wishlistId: integer("wishlist_id").notNull().references(() => wishlists.id, { onDelete: "cascade" }),
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    variantId: integer("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    priceAtAdd: money("price_at_add"),
    createdAt: ts(),
  },
  (t) => [uniqueIndex("wishlist_items_unique_idx").on(t.wishlistId, t.productId)],
);

// ---------------- Addresses & Orders ----------------
export const addresses = pgTable(
  "addresses",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 60 }),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    line1: varchar("line1", { length: 200 }).notNull(),
    line2: varchar("line2", { length: 200 }),
    city: varchar("city", { length: 100 }).notNull(),
    region: varchar("region", { length: 100 }).notNull(),
    postalCode: varchar("postal_code", { length: 20 }).notNull(),
    country: varchar("country", { length: 2 }).notNull().default("US"),
    phone: varchar("phone", { length: 40 }),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: ts(),
  },
  (t) => [index("addresses_user_idx").on(t.userId)],
);

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    orderNumber: varchar("order_number", { length: 24 }).notNull(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    email: varchar("email", { length: 255 }).notNull(),
    guestToken: varchar("guest_token", { length: 64 }),
    status: varchar("status", { length: 20 }).notNull().default("PENDING"),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    subtotal: money("subtotal").notNull(),
    discountTotal: money("discount_total").notNull().default("0"),
    shippingTotal: money("shipping_total").notNull().default("0"),
    taxTotal: money("tax_total").notNull().default("0"),
    grandTotal: money("grand_total").notNull(),
    couponId: integer("coupon_id").references(() => coupons.id),
    couponCode: varchar("coupon_code", { length: 40 }),
    shippingMethod: varchar("shipping_method", { length: 40 }).notNull().default("standard"),
    shippingAddress: jsonb("shipping_address").notNull(),
    billingAddress: jsonb("billing_address"),
    warehouseId: integer("warehouse_id").references(() => warehouses.id),
    customerNote: text("customer_note"),
    placedAt: timestamp("placed_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: ts(),
    updatedAt: tsUpdated(),
  },
  (t) => [
    uniqueIndex("orders_number_idx").on(t.orderNumber),
    index("orders_user_idx").on(t.userId),
    index("orders_created_idx").on(t.createdAt),
    index("orders_status_idx").on(t.status),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    variantId: integer("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
    productName: varchar("product_name", { length: 160 }).notNull(),
    productSlug: varchar("product_slug", { length: 160 }),
    sku: varchar("sku", { length: 64 }).notNull(),
    color: varchar("color", { length: 60 }),
    size: varchar("size", { length: 20 }),
    imageUrl: text("image_url"),
    unitPrice: money("unit_price").notNull(),
    quantity: integer("quantity").notNull(),
    lineTotal: money("line_total").notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId), index("order_items_variant_idx").on(t.variantId)],
);

export const orderEvents = pgTable(
  "order_events",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 40 }).notNull(),
    message: text("message"),
    actorId: integer("actor_id").references(() => users.id),
    createdAt: ts(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId)],
);

export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 40 }).notNull().default("mock"),
    providerReference: varchar("provider_reference", { length: 100 }),
    method: varchar("method", { length: 40 }).notNull().default("card"),
    status: varchar("status", { length: 20 }).notNull().default("PENDING"),
    amount: money("amount").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    cardLast4: varchar("card_last4", { length: 4 }),
    failureReason: text("failure_reason"),
    refundedAmount: money("refunded_amount").notNull().default("0"),
    createdAt: ts(),
    updatedAt: tsUpdated(),
  },
  (t) => [index("payments_order_idx").on(t.orderId)],
);

export const shipments = pgTable(
  "shipments",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    warehouseId: integer("warehouse_id").references(() => warehouses.id),
    carrier: varchar("carrier", { length: 60 }),
    trackingNumber: varchar("tracking_number", { length: 100 }),
    status: varchar("status", { length: 20 }).notNull().default("PENDING"),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: ts(),
    updatedAt: tsUpdated(),
  },
  (t) => [index("shipments_order_idx").on(t.orderId)],
);

// ---------------- Reviews ----------------
export const reviews = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    orderItemId: integer("order_item_id").references(() => orderItems.id, { onDelete: "set null" }),
    rating: integer("rating").notNull(),
    title: varchar("title", { length: 160 }),
    comment: text("comment"),
    images: jsonb("images").$type<string[]>(),
    isVerifiedPurchase: boolean("is_verified_purchase").notNull().default(false),
    status: varchar("status", { length: 20 }).notNull().default("PENDING"), // PENDING | APPROVED | REJECTED
    moderatedBy: integer("moderated_by").references(() => users.id),
    createdAt: ts(),
  },
  (t) => [
    index("reviews_product_status_idx").on(t.productId, t.status),
    index("reviews_user_idx").on(t.userId),
    uniqueIndex("reviews_order_item_idx").on(t.orderItemId),
  ],
);

// ---------------- Promotions ----------------
export const coupons = pgTable(
  "coupons",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 40 }).notNull(),
    description: text("description"),
    type: varchar("type", { length: 20 }).notNull(), // PERCENTAGE | FIXED_AMOUNT | FREE_SHIPPING
    value: money("value").notNull(),
    minimumOrderAmount: money("minimum_order_amount"),
    usageLimit: integer("usage_limit"),
    usageCount: integer("usage_count").notNull().default(0),
    perCustomerLimit: integer("per_customer_limit"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    appliesToProductType: varchar("applies_to_product_type", { length: 40 }),
    appliesToCategoryId: integer("applies_to_category_id").references(() => categories.id),
    createdAt: ts(),
  },
  (t) => [uniqueIndex("coupons_code_idx").on(t.code)],
);

export const couponUsages = pgTable(
  "coupon_usages",
  {
    id: serial("id").primaryKey(),
    couponId: integer("coupon_id").notNull().references(() => coupons.id, { onDelete: "cascade" }),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    orderId: integer("order_id").references(() => orders.id, { onDelete: "cascade" }),
    discountAmount: money("discount_amount").notNull(),
    createdAt: ts(),
  },
  (t) => [index("coupon_usages_coupon_idx").on(t.couponId)],
);

// ---------------- Notifications, Audit, Media, Settings ----------------
export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 40 }).notNull(),
    channel: varchar("channel", { length: 20 }).notNull().default("IN_APP"),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body"),
    data: jsonb("data"),
    readAt: timestamp("read_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: ts(),
  },
  (t) => [index("notifications_user_idx").on(t.userId)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 60 }).notNull(),
    entityType: varchar("entity_type", { length: 60 }).notNull(),
    entityId: varchar("entity_id", { length: 64 }),
    oldValue: jsonb("old_value"),
    newValue: jsonb("new_value"),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    createdAt: ts(),
  },
  (t) => [index("audit_logs_created_idx").on(t.createdAt), index("audit_logs_entity_idx").on(t.entityType, t.entityId)],
);

export const media = pgTable("media", {
  id: serial("id").primaryKey(),
  storageKey: text("storage_key").notNull(),
  url: text("url").notNull(),
  mimeType: varchar("mime_type", { length: 80 }),
  sizeBytes: integer("size_bytes"),
  width: integer("width"),
  height: integer("height"),
  purpose: varchar("purpose", { length: 40 }).notNull().default("PRODUCT_IMAGE"),
  uploadedBy: integer("uploaded_by").references(() => users.id),
  createdAt: ts(),
});

export const storeSettings = pgTable("store_settings", {
  key: varchar("key", { length: 80 }).primaryKey(),
  value: jsonb("value").notNull(),
  group: varchar("group", { length: 40 }).notNull().default("store"),
  updatedAt: tsUpdated(),
});

export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  createdAt: ts(),
});

export const searchEvents = pgTable("search_events", {
  id: serial("id").primaryKey(),
  query: varchar("query", { length: 200 }).notNull(),
  resultCount: integer("result_count").notNull().default(0),
  userId: integer("user_id"),
  createdAt: ts(),
});
