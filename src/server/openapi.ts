/** OpenAPI 3 document for /api/v1 (served at /api/v1/openapi.json, UI at /api-docs). */
const env = (schema: object) => ({ type: "object", properties: { data: schema, meta: { type: "object" } } });
const err = { type: "object", properties: { error: { type: "object", properties: { code: { type: "string" }, message: { type: "string" }, details: { type: "object" } } } } };
const paged = (item: object) => env({ type: "array", items: item });
const ref = (n: string) => ({ $ref: `#/components/schemas/${n}` });
const op = (tag: string, summary: string, extra: Record<string, unknown> = {}) => ({ tags: [tag], summary, responses: { 200: { description: "OK" }, 400: { description: "Validation error", content: { "application/json": { schema: err } } }, 401: { description: "Unauthorized" }, 403: { description: "Forbidden" }, 404: { description: "Not found" } }, ...extra });
const body = (schema: object) => ({ requestBody: { required: true, content: { "application/json": { schema } } } });
const secured = { security: [{ bearerAuth: [] }, { cookieAuth: [] }] };
const P = (name: string, where = "path", type = "string") => ({ name, in: where, required: where === "path", schema: { type } });

export const openapi = {
  openapi: "3.0.3",
  info: { title: "Evergreen Store API", version: "1.0.0", description: "REST API for the Evergreen ecommerce platform. Responses use `{ data, meta }` envelopes; errors use `{ error: { code, message, details } }`." },
  servers: [{ url: "/api/v1" }],
  tags: ["Auth", "Products", "Categories", "Search", "Cart", "Wishlist", "Checkout", "Orders", "Account", "Reviews", "Admin", "Inventory", "Employees"].map((name) => ({ name })),
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" }, cookieAuth: { type: "apiKey", in: "cookie", name: "eg_access" } },
    schemas: {
      Address: { type: "object", required: ["firstName", "lastName", "line1", "city", "region", "postalCode", "country"], properties: { firstName: { type: "string" }, lastName: { type: "string" }, line1: { type: "string" }, line2: { type: "string" }, city: { type: "string" }, region: { type: "string" }, postalCode: { type: "string" }, country: { type: "string", example: "US" }, phone: { type: "string" } } },
      ProductCard: { type: "object", properties: { id: { type: "integer" }, slug: { type: "string" }, name: { type: "string" }, price: { type: "number" }, compareAtPrice: { type: "number", nullable: true }, images: { type: "array", items: { type: "string" } }, colors: { type: "array", items: { type: "object" } }, sizes: { type: "array", items: { type: "string" } }, badges: { type: "array", items: { type: "string" } }, available: { type: "integer" } } },
      Variant: { type: "object", properties: { sku: { type: "string" }, color: { type: "string" }, colorHex: { type: "string" }, size: { type: "string" }, price: { type: "number" }, compareAtPrice: { type: "number", nullable: true }, status: { type: "string" }, initialStock: { type: "integer" } } },
      ProductInput: { type: "object", required: ["name"], properties: { name: { type: "string" }, slug: { type: "string" }, description: { type: "string" }, status: { type: "string", enum: ["DRAFT", "ACTIVE", "ARCHIVED"] }, productType: { type: "string" }, gender: { type: "string" }, primaryCategoryId: { type: "integer" }, material: { type: "string" }, sustainabilityDescription: { type: "string" }, categoryIds: { type: "array", items: { type: "integer" } }, collectionIds: { type: "array", items: { type: "integer" } }, images: { type: "array", items: { type: "object", properties: { url: { type: "string" }, color: { type: "string" } } } }, variants: { type: "array", items: ref("Variant") } } },
      Checkout: { type: "object", required: ["email", "shippingAddress", "payment"], properties: { email: { type: "string" }, shippingAddress: ref("Address"), billingAddress: ref("Address"), shippingMethod: { type: "string", enum: ["standard", "express"] }, payment: { type: "object", properties: { method: { type: "string", enum: ["card", "cash_on_delivery"] }, card: { type: "object", properties: { number: { type: "string", example: "4242424242424242" }, expMonth: { type: "string" }, expYear: { type: "string" }, cvc: { type: "string" }, name: { type: "string" } } } } }, couponCode: { type: "string" }, customerNote: { type: "string" } } },
    },
  },
  paths: {
    "/health": { get: op("Admin", "Health check") },
    "/auth/register": { post: op("Auth", "Register a customer", body({ type: "object", required: ["email", "password", "firstName", "lastName"], properties: { email: { type: "string" }, password: { type: "string", minLength: 8 }, firstName: { type: "string" }, lastName: { type: "string" } } })) },
    "/auth/login": { post: op("Auth", "Login (sets httpOnly cookies and returns tokens)", body({ type: "object", properties: { email: { type: "string" }, password: { type: "string" } } })) },
    "/auth/refresh": { post: op("Auth", "Rotate refresh token") },
    "/auth/logout": { post: op("Auth", "Logout / revoke refresh token") },
    "/auth/me": { get: op("Auth", "Current user with roles & permissions", secured) },
    "/products": { get: op("Products", "List products with filters & facets", { parameters: ["category", "collection", "size", "color", "minPrice", "maxPrice", "inStock", "onSale", "gender", "type", "q", "sort", "page", "pageSize"].map((n) => P(n, "query")), responses: { 200: { description: "OK", content: { "application/json": { schema: paged(ref("ProductCard")) } } } } }) },
    "/products/{slug}": { get: op("Products", "Product detail with variants and stock", { parameters: [P("slug")] }) },
    "/products/{slug}/related": { get: op("Products", "Related products", { parameters: [P("slug")] }) },
    "/products/{slug}/reviews": { get: op("Reviews", "Approved reviews for a product", { parameters: [P("slug")] }) },
    "/categories": { get: op("Categories", "List categories") },
    "/collections": { get: op("Categories", "List collections") },
    "/search": { get: op("Search", "Full-text search (add suggest=true for suggestions)", { parameters: [P("q", "query"), P("suggest", "query")] }) },
    "/cart": { get: op("Cart", "Get current cart (guest via eg_cart cookie)") },
    "/cart/items": { post: op("Cart", "Add variant to cart (merges duplicates, checks stock)", body({ type: "object", required: ["variantId"], properties: { variantId: { type: "integer" }, quantity: { type: "integer" } } })) },
    "/cart/items/{id}": { patch: op("Cart", "Update quantity / save for later", { parameters: [P("id")], ...body({ type: "object", properties: { quantity: { type: "integer" }, savedForLater: { type: "boolean" } } }) }), delete: op("Cart", "Remove item", { parameters: [P("id")] }) },
    "/cart/coupon": { post: op("Cart", "Apply coupon", body({ type: "object", properties: { code: { type: "string" } } })), delete: op("Cart", "Remove coupon") },
    "/wishlist": { get: op("Wishlist", "Get wishlist", secured), post: op("Wishlist", "Toggle product", { ...secured, ...body({ type: "object", properties: { productId: { type: "integer" } } }) }) },
    "/checkout/quote": { post: op("Checkout", "Compute totals for shipping method / coupon") },
    "/checkout": { post: op("Checkout", "Place order: reserves stock, charges via PaymentProvider", { ...body(ref("Checkout")), responses: { 201: { description: "Order created" }, 402: { description: "Payment failed" }, 409: { description: "Insufficient stock" } } }) },
    "/orders": { get: op("Orders", "My orders", secured) },
    "/orders/{number}": { get: op("Orders", "Order by number (owner, guest token or staff)", { parameters: [P("number"), P("token", "query")] }) },
    "/orders/{number}/cancel": { post: op("Orders", "Cancel order (releases/returns stock, refunds)", { parameters: [P("number")] }) },
    "/orders/{number}/reorder": { post: op("Orders", "Add order items back to cart", { parameters: [P("number")], ...secured }) },
    "/account/profile": { get: op("Account", "Profile", secured), put: op("Account", "Update profile", secured) },
    "/account/password": { post: op("Account", "Change password", secured) },
    "/account/addresses": { get: op("Account", "Addresses", secured), post: op("Account", "Create address", { ...secured, ...body(ref("Address")) }) },
    "/reviews": { post: op("Reviews", "Create review (one per order item)", { ...secured, ...body({ type: "object", properties: { productId: { type: "integer" }, orderItemId: { type: "integer" }, rating: { type: "integer" }, title: { type: "string" }, comment: { type: "string" } } }) }) },
    "/admin/analytics": { get: op("Admin", "Dashboard KPIs [REPORT_VIEW]", { ...secured, parameters: [P("range", "query")] }) },
    "/admin/products": { get: op("Admin", "List products [PRODUCT_VIEW]", secured), post: op("Admin", "Create product [PRODUCT_CREATE]", { ...secured, ...body(ref("ProductInput")) }) },
    "/admin/products/{id}": { get: op("Admin", "Get product", { ...secured, parameters: [P("id")] }), put: op("Admin", "Update product [PRODUCT_UPDATE]", { ...secured, parameters: [P("id")], ...body(ref("ProductInput")) }), delete: op("Admin", "Delete product [PRODUCT_DELETE]", { ...secured, parameters: [P("id")] }) },
    "/admin/orders": { get: op("Admin", "List orders [ORDER_VIEW]", secured) },
    "/admin/orders/{id}/status": { patch: op("Admin", "Transition order status [ORDER_UPDATE]", { ...secured, parameters: [P("id")], ...body({ type: "object", properties: { status: { type: "string" }, note: { type: "string" } } }) }) },
    "/admin/inventory": { get: op("Inventory", "Inventory overview [INVENTORY_VIEW]", secured) },
    "/admin/inventory/adjustments": { post: op("Inventory", "Adjust stock via ledger [INVENTORY_UPDATE]", { ...secured, ...body({ type: "object", properties: { variantId: { type: "integer" }, warehouseId: { type: "integer" }, type: { type: "string", enum: ["PURCHASE", "RETURN", "ADJUSTMENT", "DAMAGE"] }, quantity: { type: "integer" }, reason: { type: "string" } } }) }) },
    "/admin/inventory/transactions": { get: op("Inventory", "Stock movement history", secured) },
    "/admin/warehouses": { get: op("Inventory", "Warehouses", secured), post: op("Inventory", "Create warehouse [INVENTORY_TRANSFER]", secured) },
    "/admin/transfers": { get: op("Inventory", "Transfers", secured), post: op("Inventory", "Create transfer", secured) },
    "/admin/customers": { get: op("Admin", "Customers [CUSTOMER_VIEW]", secured) },
    "/admin/employees": { get: op("Employees", "Employees [EMPLOYEE_VIEW]", secured), post: op("Employees", "Create employee [EMPLOYEE_MANAGE]", secured) },
    "/admin/promotions": { get: op("Admin", "Coupons", secured), post: op("Admin", "Create coupon", secured) },
    "/admin/reviews": { get: op("Admin", "Moderate reviews", secured) },
    "/admin/audit-logs": { get: op("Admin", "Audit logs [AUDIT_VIEW]", secured) },
    "/admin/settings": { get: op("Admin", "Settings [SETTINGS_MANAGE]", secured), put: op("Admin", "Update settings", secured) },
  },
};
