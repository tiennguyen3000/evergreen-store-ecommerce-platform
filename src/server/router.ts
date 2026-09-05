import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { ACCESS_COOKIE, ACCESS_TTL_SEC, CART_COOKIE, Ctx, REFRESH_COOKIE, REFRESH_TTL_SEC, audit, buildContext, created, errorResponse, notFound, ok, pageMeta, pagination, parseBody, requireAuth, requirePermission, badRequest } from "@/server/core";
import * as auth from "@/server/services/auth";
import * as catalog from "@/server/services/catalog";
import * as commerce from "@/server/services/commerce";
import * as admin from "@/server/services/admin";
import { openapi } from "@/server/openapi";

type Handler = (ctx: Ctx, params: Record<string, string>, sp: URLSearchParams) => Promise<NextResponse>;
const routes: { method: string; pattern: string[]; handler: Handler }[] = [];
const on = (method: string, path: string, handler: Handler) => routes.push({ method, pattern: path.split("/").filter(Boolean), handler });

const setAuthCookies = (res: NextResponse, t: auth.TokenPair) => {
  const secure = process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE === "true";
  res.cookies.set(ACCESS_COOKIE, t.accessToken, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: ACCESS_TTL_SEC });
  res.cookies.set(REFRESH_COOKIE, t.refreshToken, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: REFRESH_TTL_SEC });
  return res;
};
const withCart = (res: NextResponse, token: string) => { res.cookies.set(CART_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 60 }); return res; };
const list = (sp: URLSearchParams, k: string) => sp.getAll(k).flatMap((v) => v.split(",")).filter(Boolean);
const numOrNull = (v: string | null) => (v == null || v === "" ? null : Number(v));
const idParam = (v: string) => { const n = Number(v); if (!Number.isInteger(n)) throw badRequest("INVALID_ID", "Invalid id"); return n; };

const addressSchema = z.object({ firstName: z.string().min(1), lastName: z.string().min(1), line1: z.string().min(3), line2: z.string().nullish(), city: z.string().min(1), region: z.string().min(1), postalCode: z.string().min(3), country: z.string().length(2).default("US"), phone: z.string().nullish() });
const password = z.string().min(8, "Password must be at least 8 characters");

// ---------- Health & docs ----------
on("GET", "health", async () => { await db.execute(sql`select 1`); return ok({ status: "ok", service: "evergreen-api", time: new Date().toISOString() }); });
on("GET", "openapi.json", async () => NextResponse.json(openapi));

// ---------- Auth ----------
on("POST", "auth/register", async (ctx) => {
  const body = await parseBody(ctx.req, z.object({ email: z.string().email(), password, firstName: z.string().min(1).max(100), lastName: z.string().min(1).max(100), marketingOptIn: z.boolean().optional() }));
  const t = await auth.register(ctx, body);
  return setAuthCookies(created({ user: t.user, accessToken: t.accessToken, refreshToken: t.refreshToken }), t);
});
on("POST", "auth/login", async (ctx) => {
  const body = await parseBody(ctx.req, z.object({ email: z.string().email(), password: z.string().min(1) }));
  const t = await auth.login(ctx, body);
  return setAuthCookies(ok({ user: t.user, accessToken: t.accessToken, refreshToken: t.refreshToken }), t);
});
on("POST", "auth/refresh", async (ctx) => {
  const body = await ctx.req.json().catch(() => ({}));
  const t = await auth.refresh(ctx, body?.refreshToken ?? ctx.req.cookies.get(REFRESH_COOKIE)?.value);
  return setAuthCookies(ok({ user: t.user, accessToken: t.accessToken, refreshToken: t.refreshToken }), t);
});
on("POST", "auth/logout", async (ctx) => {
  await auth.logout(ctx.req.cookies.get(REFRESH_COOKIE)?.value);
  const res = ok({ loggedOut: true });
  res.cookies.set(ACCESS_COOKIE, "", { maxAge: 0, path: "/" });
  res.cookies.set(REFRESH_COOKIE, "", { maxAge: 0, path: "/" });
  return res;
});
on("GET", "auth/me", async (ctx) => ok(await auth.me(ctx)));

// ---------- Catalog ----------
const filtersFromQuery = (sp: URLSearchParams): catalog.ListFilters => ({
  category: sp.get("category"), collection: sp.get("collection"), size: list(sp, "size"), color: list(sp, "color"), minPrice: numOrNull(sp.get("minPrice")), maxPrice: numOrNull(sp.get("maxPrice")),
  inStock: sp.get("inStock") === "true", onSale: sp.get("onSale") === "true", gender: sp.get("gender"), productType: sp.get("type"), q: sp.get("q"), sort: sp.get("sort"), badge: sp.get("badge"), featured: sp.get("featured") === "true", bestSeller: sp.get("bestSeller") === "true",
});
on("GET", "products", async (_ctx, _p, sp) => {
  const { page, pageSize } = pagination(sp);
  const f = filtersFromQuery(sp);
  const [r, fc] = await Promise.all([catalog.listProducts(f, page, pageSize), sp.get("facets") === "false" ? null : catalog.facets(f)]);
  return ok(r.items, { ...pageMeta(page, pageSize, r.total), facets: fc });
});
on("GET", "products/:slug", async (_ctx, p) => ok(await catalog.getProductBySlug(p.slug)));
on("GET", "products/:slug/related", async (_ctx, p) => { const prod = await catalog.getProductBySlug(p.slug); return ok(await catalog.relatedProducts(prod.id, prod.primaryCategoryId)); });
on("GET", "products/:slug/reviews", async (_ctx, p, sp) => { const prod = await catalog.getProductBySlug(p.slug); const { page, pageSize } = pagination(sp, 10); const r = await commerce.listProductReviews(prod.id, page, pageSize); return ok(r.items, pageMeta(page, pageSize, r.total)); });
on("GET", "categories", async () => ok(await catalog.listCategories()));
on("GET", "categories/:slug", async (_ctx, p) => ok(await catalog.getCategory(p.slug)));
on("GET", "collections", async (_ctx, _p, sp) => ok(await catalog.listCollections(sp.get("featured") === "true")));
on("GET", "collections/:slug", async (_ctx, p) => ok(await catalog.getCollection(p.slug)));
on("GET", "search", async (_ctx, _p, sp) => {
  const q = (sp.get("q") ?? "").trim();
  const { page, pageSize } = pagination(sp);
  if (sp.get("suggest") === "true") return ok(q.length >= 2 ? await catalog.postgresSearchProvider.suggest(q) : { products: [], categories: [] }, { popular: await catalog.popularSearches() });
  if (!q) return ok([], { ...pageMeta(page, pageSize, 0), facets: null });
  const f = filtersFromQuery(sp);
  const [r, fc] = await Promise.all([catalog.postgresSearchProvider.search(q, f, page, pageSize), catalog.facets({ ...f, q })]);
  return ok(r.items, { ...pageMeta(page, pageSize, r.total), facets: fc, query: q });
});
on("POST", "newsletter", async (ctx) => { const { email } = await parseBody(ctx.req, z.object({ email: z.string().email() })); await db.insert(s.newsletterSubscribers).values({ email: email.toLowerCase() }).onConflictDoNothing(); return created({ subscribed: true }); });

// ---------- Cart ----------
on("GET", "cart", async (ctx) => { const c = await commerce.getCartView(ctx); return withCart(ok(c), c.token); });
on("POST", "cart/items", async (ctx) => { const b = await parseBody(ctx.req, z.object({ variantId: z.number().int(), quantity: z.number().int().min(1).max(10).default(1) })); const c = await commerce.addCartItem(ctx, b.variantId, b.quantity); return withCart(created(c), c.token); });
on("PATCH", "cart/items/:id", async (ctx, p) => { const b = await parseBody(ctx.req, z.object({ quantity: z.number().int().min(0).max(10).optional(), savedForLater: z.boolean().optional() })); const c = await commerce.updateCartItem(ctx, idParam(p.id), b); return withCart(ok(c), c.token); });
on("DELETE", "cart/items/:id", async (ctx, p) => { const c = await commerce.removeCartItem(ctx, idParam(p.id)); return withCart(ok(c), c.token); });
on("POST", "cart/coupon", async (ctx) => { const b = await parseBody(ctx.req, z.object({ code: z.string().min(1) })); const c = await commerce.applyCoupon(ctx, b.code); return withCart(ok(c), c.token); });
on("DELETE", "cart/coupon", async (ctx) => { const c = await commerce.applyCoupon(ctx, null); return withCart(ok(c), c.token); });

// ---------- Wishlist ----------
on("GET", "wishlist", async (ctx) => { const u = requireAuth(ctx); return ok(await commerce.getWishlist(u.id)); });
on("GET", "wishlist/ids", async (ctx) => (ctx.user ? ok(await commerce.wishlistProductIds(ctx.user.id)) : ok([])));
on("POST", "wishlist", async (ctx) => { const u = requireAuth(ctx); const b = await parseBody(ctx.req, z.object({ productId: z.number().int(), variantId: z.number().int().nullish() })); return ok(await commerce.toggleWishlist(u.id, b.productId, b.variantId)); });
on("DELETE", "wishlist/:productId", async (ctx, p) => { const u = requireAuth(ctx); await commerce.removeWishlist(u.id, idParam(p.productId)); return ok({ removed: true }); });

// ---------- Checkout & orders ----------
const checkoutSchema = z.object({
  email: z.string().email(), shippingAddress: addressSchema, billingAddress: addressSchema.nullish(), shippingMethod: z.string().default("standard"),
  payment: z.object({ method: z.enum(["card", "cash_on_delivery"]), card: z.object({ number: z.string().min(12), expMonth: z.string().min(1), expYear: z.string().min(2), cvc: z.string().min(3), name: z.string().min(1) }).optional() }),
  couponCode: z.string().nullish(), customerNote: z.string().max(500).nullish(), saveAddress: z.boolean().optional(),
});
on("POST", "checkout/quote", async (ctx) => { const b = await parseBody(ctx.req, z.object({ shippingMethod: z.string().default("standard"), couponCode: z.string().nullish() })); const cart = await commerce.getCartView(ctx); const items = cart.items.filter((i) => !i.savedForLater); return ok({ ...(await commerce.computeTotals(cart.subtotal, items, b.couponCode ?? cart.couponCode, b.shippingMethod, ctx.user?.id ?? null)), subtotal: cart.subtotal, itemCount: cart.itemCount }); });
on("POST", "checkout", async (ctx) => { const b = await parseBody(ctx.req, checkoutSchema); const order = await commerce.checkout(ctx, b); return created(order); });
on("GET", "orders", async (ctx, _p, sp) => { const u = requireAuth(ctx); const { page, pageSize } = pagination(sp, 10); const r = await commerce.listMyOrders(u.id, page, pageSize); return ok(r.items, pageMeta(page, pageSize, r.total)); });
on("GET", "orders/:number", async (ctx, p, sp) => ok(await commerce.getOrder(ctx, p.number, sp.get("token") ?? undefined)));
on("POST", "orders/:number/cancel", async (ctx, p, sp) => ok(await commerce.cancelMyOrder(ctx, p.number, sp.get("token") ?? undefined)));
on("POST", "orders/:number/reorder", async (ctx, p) => { requireAuth(ctx); const r = await commerce.reorder(ctx, p.number); return withCart(ok(r), r.cart.token); });

// ---------- Account ----------
on("GET", "account/profile", async (ctx) => { requireAuth(ctx); return ok(await auth.me(ctx)); });
on("PUT", "account/profile", async (ctx) => { const u = requireAuth(ctx); const b = await parseBody(ctx.req, z.object({ firstName: z.string().min(1).optional(), lastName: z.string().min(1).optional(), phone: z.string().nullish(), marketingOptIn: z.boolean().optional() })); return ok(await auth.updateProfile(u.id, b)); });
on("POST", "account/password", async (ctx) => { const u = requireAuth(ctx); const b = await parseBody(ctx.req, z.object({ currentPassword: z.string().min(1), newPassword: password })); await auth.changePassword(ctx, u.id, b.currentPassword, b.newPassword); return ok({ changed: true }); });
on("GET", "account/addresses", async (ctx) => { const u = requireAuth(ctx); return ok(await commerce.listAddresses(u.id)); });
on("POST", "account/addresses", async (ctx) => { const u = requireAuth(ctx); const b = await parseBody(ctx.req, addressSchema.extend({ label: z.string().nullish(), isDefault: z.boolean().optional() })); return created(await commerce.saveAddress(u.id, b)); });
on("PUT", "account/addresses/:id", async (ctx, p) => { const u = requireAuth(ctx); const b = await parseBody(ctx.req, addressSchema.extend({ label: z.string().nullish(), isDefault: z.boolean().optional() })); return ok(await commerce.saveAddress(u.id, b, idParam(p.id))); });
on("DELETE", "account/addresses/:id", async (ctx, p) => { const u = requireAuth(ctx); await commerce.deleteAddress(u.id, idParam(p.id)); return ok({ deleted: true }); });
on("GET", "account/reviews", async (ctx) => { const u = requireAuth(ctx); return ok(await commerce.listMyReviews(u.id)); });
on("GET", "account/notifications", async (ctx) => { const u = requireAuth(ctx); return ok(await db.select().from(s.notifications).where(sql`"notifications"."user_id" = ${u.id} and "notifications"."channel" = 'IN_APP'`).orderBy(sql`"notifications"."created_at" desc`).limit(30)); });
on("POST", "reviews", async (ctx) => { const u = requireAuth(ctx); const b = await parseBody(ctx.req, z.object({ productId: z.number().int(), orderItemId: z.number().int().nullish(), rating: z.number().int().min(1).max(5), title: z.string().max(160).optional(), comment: z.string().max(3000).optional(), images: z.array(z.string().url()).max(5).optional() })); return created(await commerce.createReview(u.id, b)); });

// ---------- Admin ----------
const A = (perm: string, h: Handler): Handler => async (ctx, p, sp) => { requirePermission(ctx, perm); return h(ctx, p, sp); };
on("GET", "admin/analytics", A("REPORT_VIEW", async (_c, _p, sp) => ok(await admin.analytics(sp.get("range") ?? "30d"))));
on("GET", "admin/reports", A("REPORT_VIEW", async (_c, _p, sp) => ok(await admin.analytics(sp.get("range") ?? "30d"))));
on("GET", "admin/products", A("PRODUCT_VIEW", async (_c, _p, sp) => { const { page, pageSize } = pagination(sp, 20); const r = await admin.adminListProducts(sp, page, pageSize); return ok(r.items, pageMeta(page, pageSize, r.total)); }));
on("GET", "admin/products/:id", A("PRODUCT_VIEW", async (_c, p) => ok(await catalog.getProductById(idParam(p.id)))));
const variantSchema = z.object({ id: z.number().int().optional(), sku: z.string().min(2), color: z.string().min(1), colorHex: z.string().optional(), size: z.string().min(1), price: z.number().min(0), compareAtPrice: z.number().min(0).nullish(), costPrice: z.number().min(0).nullish(), barcode: z.string().nullish(), weightGrams: z.number().int().nullish(), status: z.string().optional(), initialStock: z.number().int().min(0).optional() });
const productSchema = z.object({ name: z.string().min(2), slug: z.string().optional(), description: z.string().optional(), shortDescription: z.string().nullish(), status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(), productType: z.string().optional(), gender: z.string().optional(), primaryCategoryId: z.number().int().nullish(), material: z.string().nullish(), careInstructions: z.string().nullish(), sustainabilityDescription: z.string().nullish(), specifications: z.record(z.string(), z.string()).nullish(), seoTitle: z.string().nullish(), seoDescription: z.string().nullish(), weightGrams: z.number().int().nullish(), shippingClass: z.string().nullish(), isFeatured: z.boolean().optional(), isBestSeller: z.boolean().optional(), categoryIds: z.array(z.number().int()).optional(), collectionIds: z.array(z.number().int()).optional(), tags: z.array(z.string()).optional(), images: z.array(z.object({ url: z.string().min(1), altText: z.string().nullish(), color: z.string().nullish(), sortOrder: z.number().int().optional() })).optional(), variants: z.array(variantSchema).optional() });
on("POST", "admin/products", A("PRODUCT_CREATE", async (ctx) => created(await admin.createProduct(ctx, await parseBody(ctx.req, productSchema)))));
on("PUT", "admin/products/:id", A("PRODUCT_UPDATE", async (ctx, p) => ok(await admin.updateProduct(ctx, idParam(p.id), await parseBody(ctx.req, productSchema.partial())))));
on("DELETE", "admin/products/:id", A("PRODUCT_DELETE", async (ctx, p) => { await admin.deleteProduct(ctx, idParam(p.id)); return ok({ deleted: true }); }));
on("POST", "admin/products/:id/duplicate", A("PRODUCT_CREATE", async (ctx, p) => created(await admin.duplicateProduct(ctx, idParam(p.id)))));
on("POST", "admin/products/:id/publish", A("PRODUCT_UPDATE", async (ctx, p) => ok(await admin.setProductStatus(ctx, idParam(p.id), "ACTIVE"))));
on("POST", "admin/products/:id/unpublish", A("PRODUCT_UPDATE", async (ctx, p) => ok(await admin.setProductStatus(ctx, idParam(p.id), "DRAFT"))));
on("POST", "admin/products/:id/archive", A("PRODUCT_UPDATE", async (ctx, p) => ok(await admin.setProductStatus(ctx, idParam(p.id), "ARCHIVED"))));
on("POST", "admin/products/bulk", A("PRODUCT_UPDATE", async (ctx) => { const b = await parseBody(ctx.req, z.object({ ids: z.array(z.number().int()).min(1), action: z.enum(["publish", "unpublish", "archive", "delete"]) })); if (b.action === "delete") requirePermission(ctx, "PRODUCT_DELETE"); return ok(await admin.bulkProducts(ctx, b.ids, b.action)); }));
const categorySchema = z.object({ name: z.string().min(1), slug: z.string().optional(), description: z.string().nullish(), imageUrl: z.string().nullish(), parentId: z.number().int().nullish(), isActive: z.boolean().optional(), sortOrder: z.number().int().optional() });
on("GET", "admin/categories", A("PRODUCT_VIEW", async () => ok(await catalog.listCategories())));
on("POST", "admin/categories", A("PRODUCT_CREATE", async (ctx) => created(await admin.saveCategory(ctx, await parseBody(ctx.req, categorySchema)))));
on("PUT", "admin/categories/:id", A("PRODUCT_UPDATE", async (ctx, p) => ok(await admin.saveCategory(ctx, await parseBody(ctx.req, categorySchema), idParam(p.id)))));
on("DELETE", "admin/categories/:id", A("PRODUCT_DELETE", async (ctx, p) => { await admin.deleteCategory(ctx, idParam(p.id)); return ok({ deleted: true }); }));
const collectionSchema = z.object({ name: z.string().min(1), slug: z.string().optional(), description: z.string().nullish(), imageUrl: z.string().nullish(), isFeatured: z.boolean().optional(), isActive: z.boolean().optional(), sortOrder: z.number().int().optional(), productIds: z.array(z.number().int()).optional() });
on("GET", "admin/collections", A("PRODUCT_VIEW", async () => ok(await catalog.listCollections())));
on("POST", "admin/collections", A("PRODUCT_CREATE", async (ctx) => created(await admin.saveCollection(ctx, await parseBody(ctx.req, collectionSchema)))));
on("PUT", "admin/collections/:id", A("PRODUCT_UPDATE", async (ctx, p) => ok(await admin.saveCollection(ctx, await parseBody(ctx.req, collectionSchema), idParam(p.id)))));
on("DELETE", "admin/collections/:id", A("PRODUCT_DELETE", async (ctx, p) => { await admin.deleteCollection(ctx, idParam(p.id)); return ok({ deleted: true }); }));

on("GET", "admin/orders", A("ORDER_VIEW", async (_c, _p, sp) => { const { page, pageSize } = pagination(sp, 20); const r = await admin.adminListOrders(sp, page, pageSize); return ok(r.items, pageMeta(page, pageSize, r.total)); }));
on("GET", "admin/orders/:id", A("ORDER_VIEW", async (_c, p) => ok(await admin.adminGetOrder(idParam(p.id)))));
on("PATCH", "admin/orders/:id/status", A("ORDER_UPDATE", async (ctx, p) => { const b = await parseBody(ctx.req, z.object({ status: z.enum(["CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"]), note: z.string().max(500).optional(), carrier: z.string().optional(), trackingNumber: z.string().optional() })); if (b.status === "REFUNDED") requirePermission(ctx, "ORDER_REFUND"); return ok(await admin.adminUpdateOrderStatus(ctx, idParam(p.id), b.status, b.note, b)); }));
on("POST", "admin/orders/:id/refund", A("ORDER_REFUND", async (ctx, p) => { const b = await parseBody(ctx.req, z.object({ note: z.string().max(500).optional() })); return ok(await admin.adminUpdateOrderStatus(ctx, idParam(p.id), "REFUNDED", b.note ?? "Refund issued by staff")); }));
on("POST", "admin/orders/:id/cancel", A("ORDER_UPDATE", async (ctx, p) => { const b = await parseBody(ctx.req, z.object({ note: z.string().max(500).optional() })); return ok(await admin.adminUpdateOrderStatus(ctx, idParam(p.id), "CANCELLED", b.note ?? "Cancelled by staff")); }));
on("POST", "admin/orders/:id/notes", A("ORDER_UPDATE", async (ctx, p) => { const b = await parseBody(ctx.req, z.object({ message: z.string().min(1).max(1000) })); return ok(await admin.adminAddOrderNote(ctx, idParam(p.id), b.message)); }));

on("GET", "admin/inventory", A("INVENTORY_VIEW", async (_c, _p, sp) => { const { page, pageSize } = pagination(sp, 25); const r = await admin.adminInventory(sp, page, pageSize); return ok(r.items, { ...pageMeta(page, pageSize, r.total), summary: r.summary }); }));
on("GET", "admin/inventory/transactions", A("INVENTORY_VIEW", async (_c, _p, sp) => { const { page, pageSize } = pagination(sp, 25); const r = await admin.inventoryTransactions(sp, page, pageSize); return ok(r.items, pageMeta(page, pageSize, r.total)); }));
on("POST", "admin/inventory/adjustments", A("INVENTORY_UPDATE", async (ctx) => { const b = await parseBody(ctx.req, z.object({ variantId: z.number().int(), warehouseId: z.number().int(), type: z.enum(["PURCHASE", "RETURN", "ADJUSTMENT", "DAMAGE"]), quantity: z.number().int(), reason: z.string().min(2).max(300), reorderLevel: z.number().int().min(0).optional() })); return created(await admin.adminAdjustInventory(ctx, b)); }));
on("GET", "admin/warehouses", A("INVENTORY_VIEW", async () => ok(await admin.listWarehouses())));
const warehouseSchema = z.object({ code: z.string().min(2).max(20), name: z.string().min(2), status: z.enum(["ACTIVE", "INACTIVE"]).optional(), addressLine1: z.string().nullish(), city: z.string().nullish(), region: z.string().nullish(), postalCode: z.string().nullish(), country: z.string().length(2).optional(), isDefault: z.boolean().optional(), priority: z.number().int().optional() });
on("POST", "admin/warehouses", A("INVENTORY_TRANSFER", async (ctx) => created(await admin.saveWarehouse(ctx, await parseBody(ctx.req, warehouseSchema)))));
on("PUT", "admin/warehouses/:id", A("INVENTORY_TRANSFER", async (ctx, p) => ok(await admin.saveWarehouse(ctx, await parseBody(ctx.req, warehouseSchema), idParam(p.id)))));
on("GET", "admin/transfers", A("INVENTORY_VIEW", async () => ok(await admin.listTransfers())));
on("POST", "admin/transfers", A("INVENTORY_TRANSFER", async (ctx) => created(await admin.createTransfer(ctx, await parseBody(ctx.req, z.object({ fromWarehouseId: z.number().int(), toWarehouseId: z.number().int(), notes: z.string().optional(), items: z.array(z.object({ variantId: z.number().int().optional(), sku: z.string().optional(), quantity: z.number().int().min(1) })).min(1) }))))));
on("PATCH", "admin/transfers/:id/status", A("INVENTORY_TRANSFER", async (ctx, p) => ok(await admin.updateTransferStatus(ctx, idParam(p.id), (await parseBody(ctx.req, z.object({ status: z.enum(["APPROVED", "IN_TRANSIT", "COMPLETED", "CANCELLED"]) }))).status))));

on("GET", "admin/customers", A("CUSTOMER_VIEW", async (_c, _p, sp) => { const { page, pageSize } = pagination(sp, 20); const r = await admin.adminListCustomers(sp, page, pageSize); return ok(r.items, pageMeta(page, pageSize, r.total)); }));
on("GET", "admin/customers/:id", A("CUSTOMER_VIEW", async (_c, p) => ok(await admin.adminGetCustomer(idParam(p.id)))));
on("PATCH", "admin/customers/:id/status", A("CUSTOMER_UPDATE", async (ctx, p) => { const b = await parseBody(ctx.req, z.object({ status: z.enum(["ACTIVE", "DISABLED"]) })); await admin.adminSetUserStatus(ctx, idParam(p.id), b.status); return ok({ status: b.status }); }));
on("GET", "admin/employees", A("EMPLOYEE_VIEW", async () => ok(await admin.listEmployees())));
on("POST", "admin/employees", A("EMPLOYEE_MANAGE", async (ctx) => created({ id: await admin.createEmployee(ctx, await parseBody(ctx.req, z.object({ email: z.string().email(), firstName: z.string().min(1), lastName: z.string().min(1), password, role: z.enum(["EMPLOYEE", "MANAGER", "ADMIN", "SUPER_ADMIN"]), jobTitle: z.string().optional() }))) })));
on("PATCH", "admin/employees/:id", A("EMPLOYEE_MANAGE", async (ctx, p) => { await admin.updateEmployee(ctx, idParam(p.id), await parseBody(ctx.req, z.object({ role: z.enum(["EMPLOYEE", "MANAGER", "ADMIN", "SUPER_ADMIN"]).optional(), status: z.enum(["ACTIVE", "DISABLED"]).optional(), jobTitle: z.string().optional() }))); return ok({ updated: true }); }));

const couponSchema = z.object({ code: z.string().min(3).max(40), description: z.string().nullish(), type: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "FREE_SHIPPING"]), value: z.number().min(0), minimumOrderAmount: z.number().min(0).nullish(), usageLimit: z.number().int().min(1).nullish(), perCustomerLimit: z.number().int().min(1).nullish(), startsAt: z.string().nullish(), expiresAt: z.string().nullish(), isActive: z.boolean().optional(), appliesToProductType: z.string().nullish(), appliesToCategoryId: z.number().int().nullish() });
const couponVals = (b: z.infer<typeof couponSchema>) => ({ ...b, value: b.value.toFixed(2), minimumOrderAmount: b.minimumOrderAmount != null ? b.minimumOrderAmount.toFixed(2) : null, startsAt: b.startsAt ? new Date(b.startsAt) : null, expiresAt: b.expiresAt ? new Date(b.expiresAt) : null });
on("GET", "admin/promotions", A("PRODUCT_VIEW", async () => ok(await admin.listCoupons())));
on("POST", "admin/promotions", A("PRODUCT_UPDATE", async (ctx) => created(await admin.saveCoupon(ctx, couponVals(await parseBody(ctx.req, couponSchema))))));
on("PUT", "admin/promotions/:id", A("PRODUCT_UPDATE", async (ctx, p) => ok(await admin.saveCoupon(ctx, couponVals(await parseBody(ctx.req, couponSchema)), idParam(p.id)))));
on("PATCH", "admin/promotions/:id", A("PRODUCT_UPDATE", async (ctx, p) => { const b = await parseBody(ctx.req, z.object({ isActive: z.boolean() })); const [c] = await db.update(s.coupons).set({ isActive: b.isActive }).where(sql`"coupons"."id" = ${idParam(p.id)}`).returning(); await audit(ctx, b.isActive ? "COUPON_ACTIVATED" : "COUPON_DEACTIVATED", "Coupon", p.id, null, b); return ok(c); }));
on("GET", "admin/reviews", A("PRODUCT_VIEW", async (_c, _p, sp) => { const { page, pageSize } = pagination(sp, 20); const r = await admin.adminListReviews(sp, page, pageSize); return ok(r.items, pageMeta(page, pageSize, r.total)); }));
on("PATCH", "admin/reviews/:id", A("PRODUCT_UPDATE", async (ctx, p) => ok(await admin.moderateReview(ctx, idParam(p.id), (await parseBody(ctx.req, z.object({ status: z.enum(["APPROVED", "REJECTED"]) }))).status))));
on("DELETE", "admin/reviews/:id", A("PRODUCT_DELETE", async (ctx, p) => { await admin.deleteReview(ctx, idParam(p.id)); return ok({ deleted: true }); }));
on("GET", "admin/audit-logs", A("AUDIT_VIEW", async (_c, _p, sp) => { const { page, pageSize } = pagination(sp, 25); const r = await admin.auditLogs(sp, page, pageSize); return ok(r.items, pageMeta(page, pageSize, r.total)); }));
on("GET", "admin/settings", A("SETTINGS_MANAGE", async () => ok(await admin.listSettings())));
on("PUT", "admin/settings", A("SETTINGS_MANAGE", async (ctx) => ok(await admin.updateSettings(ctx, await parseBody(ctx.req, z.array(z.object({ key: z.string(), value: z.unknown() })))))));
on("GET", "admin/notifications", A("PRODUCT_VIEW", async (ctx) => ok(await db.select().from(s.notifications).where(sql`"notifications"."user_id" = ${ctx.user!.id} and "notifications"."channel" = 'IN_APP'`).orderBy(sql`"notifications"."created_at" desc`).limit(20))));

// ---------- Dispatcher ----------
function match(method: string, segments: string[]) {
  for (const r of routes) {
    if (r.method !== method || r.pattern.length !== segments.length) continue;
    const params: Record<string, string> = {};
    let okMatch = true;
    for (let i = 0; i < r.pattern.length; i++) {
      if (r.pattern[i].startsWith(":")) params[r.pattern[i].slice(1)] = decodeURIComponent(segments[i]);
      else if (r.pattern[i] !== segments[i]) { okMatch = false; break; }
    }
    if (okMatch) return { handler: r.handler, params };
  }
  return null;
}
export async function handle(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const ctx = await buildContext(req);
  const started = Date.now();
  try {
    const { path = [] } = await params;
    const m = match(req.method, path);
    if (!m) throw notFound("ROUTE_NOT_FOUND", `No route for ${req.method} /api/v1/${path.join("/")}`);
    const res = await m.handler(ctx, m.params, req.nextUrl.searchParams);
    res.headers.set("x-request-id", ctx.requestId);
    console.log(JSON.stringify({ level: "info", requestId: ctx.requestId, method: req.method, path: `/api/v1/${path.join("/")}`, status: res.status, ms: Date.now() - started, userId: ctx.user?.id ?? null }));
    return res;
  } catch (e) {
    const res = errorResponse(e, ctx.requestId);
    res.headers.set("x-request-id", ctx.requestId);
    return res;
  }
}
