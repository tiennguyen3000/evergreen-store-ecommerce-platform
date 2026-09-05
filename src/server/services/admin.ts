import bcrypt from "bcryptjs";
import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql, SQL } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { ApiError, Ctx, audit, badRequest, invalidateSettings, notFound, notify, num } from "../core";
import { buildConditions, getProductById, hydrateCards, ListFilters } from "./catalog";
import { applyTransaction, hydrateOrder, InvTxType, recalcRating, transitionOrder } from "./commerce";

const slugify = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const rangeStart = (range: string) => {
  const d = new Date();
  if (range === "today") { d.setHours(0, 0, 0, 0); return d; }
  if (range === "this_year") return new Date(d.getFullYear(), 0, 1);
  const days = { "7d": 7, "30d": 30, "90d": 90, "12m": 365 }[range] ?? 30;
  d.setDate(d.getDate() - days);
  return d;
};
const revenueStatuses = ["CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "DELIVERED"];

// ---------------- Analytics ----------------
export async function analytics(range: string) {
  const start = rangeStart(range);
  const prevStart = new Date(start.getTime() - (Date.now() - start.getTime()));
  const rev = (from: Date, to?: Date) => db.select({ revenue: sql<string>`coalesce(sum(grand_total),0)`, orders: sql<number>`count(*)`, aov: sql<string>`coalesce(avg(grand_total),0)` }).from(s.orders).where(and(inArray(s.orders.status, revenueStatuses), gte(s.orders.createdAt, from), to ? lte(s.orders.createdAt, to) : undefined));
  const bucket = range === "today" ? "hour" : range === "12m" || range === "this_year" ? "week" : "day";
  const [[cur], [prev], [customers], [prevCustomers], [products], series, topProducts, recentOrders, lowStock, statusBreakdown, [units], inventoryValue, categorySales] = await Promise.all([
    rev(start), rev(prevStart, start),
    db.select({ c: sql<number>`count(*)` }).from(s.users).where(and(eq(s.users.isStaff, false), gte(s.users.createdAt, start))),
    db.select({ c: sql<number>`count(*)` }).from(s.users).where(and(eq(s.users.isStaff, false), gte(s.users.createdAt, prevStart), lte(s.users.createdAt, start))),
    db.select({ c: sql<number>`count(*)` }).from(s.products).where(eq(s.products.status, "ACTIVE")),
    db.execute(sql`select date_trunc(${bucket}, created_at) as bucket, coalesce(sum(grand_total),0)::float as revenue, count(*)::int as orders from orders where status in ('CONFIRMED','PROCESSING','PACKED','SHIPPED','DELIVERED') and created_at >= ${start} group by 1 order by 1`),
    db.execute(sql`select oi.product_id as "productId", oi.product_name as name, oi.product_slug as slug, oi.image_url as image, sum(oi.quantity)::int as units, sum(oi.line_total)::float as revenue from order_items oi join orders o on o.id = oi.order_id where o.status in ('CONFIRMED','PROCESSING','PACKED','SHIPPED','DELIVERED') and o.created_at >= ${start} group by 1,2,3,4 order by revenue desc limit 8`),
    db.select({ id: s.orders.id, orderNumber: s.orders.orderNumber, status: s.orders.status, grandTotal: s.orders.grandTotal, email: s.orders.email, createdAt: s.orders.createdAt, customer: sql<string>`coalesce("users"."first_name" || ' ' || "users"."last_name", "orders"."email")` }).from(s.orders).leftJoin(s.users, eq(s.users.id, s.orders.userId)).orderBy(desc(s.orders.createdAt)).limit(8),
    db.execute(sql`select pv.id as "variantId", pv.sku, p.name as "productName", p.slug, pv.color, pv.size, w.code as warehouse, wi.quantity_on_hand - wi.quantity_reserved as available, wi.reorder_level as "reorderLevel" from warehouse_inventory wi join product_variants pv on pv.id = wi.variant_id join products p on p.id = pv.product_id join warehouses w on w.id = wi.warehouse_id where w.status='ACTIVE' and p.status='ACTIVE' and wi.quantity_on_hand - wi.quantity_reserved <= wi.reorder_level order by available asc limit 10`),
    db.select({ status: s.orders.status, count: sql<number>`count(*)` }).from(s.orders).where(gte(s.orders.createdAt, start)).groupBy(s.orders.status),
    db.select({ u: sql<number>`coalesce(sum(oi.quantity),0)` }).from(s.orderItems).innerJoin(s.orders, eq(s.orders.id, s.orderItems.orderId)).where(and(inArray(s.orders.status, revenueStatuses), gte(s.orders.createdAt, start))),
    db.execute(sql`select coalesce(sum(wi.quantity_on_hand * coalesce(pv.cost_price, pv.price * 0.4)),0)::float as value, count(*) filter (where wi.quantity_on_hand - wi.quantity_reserved <= wi.reorder_level)::int as low, count(*) filter (where wi.quantity_on_hand - wi.quantity_reserved <= 0)::int as out from warehouse_inventory wi join product_variants pv on pv.id = wi.variant_id`),
    db.execute(sql`select c.name, sum(oi.line_total)::float as revenue, sum(oi.quantity)::int as units from order_items oi join orders o on o.id = oi.order_id join products p on p.id = oi.product_id join categories c on c.id = p.primary_category_id where o.status in ('CONFIRMED','PROCESSING','PACKED','SHIPPED','DELIVERED') and o.created_at >= ${start} group by 1 order by revenue desc limit 8`),
  ]);
  const pct = (a: number, b: number) => (b === 0 ? (a > 0 ? 100 : 0) : Math.round(((a - b) / b) * 1000) / 10);
  const invRow = rows<{ value: number; low: number; out: number }>(inventoryValue)[0];
  return {
    range,
    kpis: {
      revenue: { value: num(cur.revenue), change: pct(num(cur.revenue), num(prev.revenue)) },
      orders: { value: Number(cur.orders), change: pct(Number(cur.orders), Number(prev.orders)) },
      customers: { value: Number(customers.c), change: pct(Number(customers.c), Number(prevCustomers.c)) },
      aov: { value: num(cur.aov), change: pct(num(cur.aov), num(prev.aov)) },
      products: Number(products.c), unitsSold: Number(units.u), conversionRate: 2.4,
      inventoryValue: Number(invRow?.value ?? 0), lowStockCount: Number(invRow?.low ?? 0), outOfStockCount: Number(invRow?.out ?? 0),
    },
    series: rows(series), topProducts: rows(topProducts), categorySales: rows(categorySales),
    recentOrders: recentOrders.map((o) => ({ ...o, grandTotal: num(o.grandTotal) })), lowStock: rows(lowStock), statusBreakdown: statusBreakdown.map((x) => ({ ...x, count: Number(x.count) })),
  };
}
const rows = <T,>(r: unknown): T[] => ((r as { rows?: T[] }).rows ?? (r as T[])) as T[];

// ---------------- Products ----------------
export async function adminListProducts(sp: URLSearchParams, page: number, pageSize: number) {
  const f: ListFilters = { includeDraft: true, status: sp.get("status") || null, q: sp.get("q") || null, productType: sp.get("type") || null, category: sp.get("category") || null, sort: sp.get("sort") || "newest" };
  const where = and(...buildConditions(f));
  const [rowsP, [{ count }]] = await Promise.all([
    db.select().from(s.products).where(where).orderBy(f.sort === "name_asc" ? asc(s.products.name) : f.sort === "oldest" ? asc(s.products.createdAt) : desc(s.products.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)` }).from(s.products).where(where),
  ]);
  const cards = await hydrateCards(rowsP);
  const variantCounts = rowsP.length ? await db.select({ productId: s.productVariants.productId, c: sql<number>`count(*)` }).from(s.productVariants).where(inArray(s.productVariants.productId, rowsP.map((r) => r.id))).groupBy(s.productVariants.productId) : [];
  return { items: rowsP.map((p, i) => ({ ...cards[i], status: p.status, updatedAt: p.updatedAt, variantCount: Number(variantCounts.find((v) => v.productId === p.id)?.c ?? 0), isFeatured: p.isFeatured, isBestSeller: p.isBestSeller })), total: Number(count) };
}

export type ProductInput = {
  name: string; slug?: string; description?: string; shortDescription?: string | null; status?: string; productType?: string; gender?: string; primaryCategoryId?: number | null; material?: string | null; careInstructions?: string | null; sustainabilityDescription?: string | null;
  specifications?: Record<string, string> | null; seoTitle?: string | null; seoDescription?: string | null; weightGrams?: number | null; shippingClass?: string | null; isFeatured?: boolean; isBestSeller?: boolean; categoryIds?: number[]; collectionIds?: number[]; tags?: string[];
  images?: { url: string; altText?: string | null; color?: string | null; sortOrder?: number }[];
  variants?: { id?: number; sku: string; color: string; colorHex?: string; size: string; price: number; compareAtPrice?: number | null; costPrice?: number | null; barcode?: string | null; weightGrams?: number | null; status?: string; initialStock?: number }[];
};
export async function createProduct(ctx: Ctx, input: ProductInput) {
  const slug = slugify(input.slug || input.name);
  const [dup] = await db.select({ id: s.products.id }).from(s.products).where(eq(s.products.slug, slug));
  if (dup) throw new ApiError(409, "SLUG_TAKEN", "A product with this slug already exists");
  const id = await db.transaction(async (tx) => {
    const [brand] = await tx.select().from(s.brands).limit(1);
    const [p] = await tx.insert(s.products).values({ ...baseFields(input), slug, brandId: brand?.id, publishedAt: input.status === "ACTIVE" ? new Date() : null }).returning();
    await syncRelations(tx, p.id, input, ctx.user?.id ?? null);
    return p.id;
  });
  await audit(ctx, "PRODUCT_CREATED", "Product", id, null, { name: input.name, slug, status: input.status });
  return getProductById(id);
}
function baseFields(input: ProductInput) {
  return { name: input.name, description: input.description ?? "", shortDescription: input.shortDescription ?? null, status: input.status ?? "DRAFT", productType: input.productType ?? "shoes", gender: input.gender ?? "unisex", primaryCategoryId: input.primaryCategoryId ?? null, material: input.material ?? null, careInstructions: input.careInstructions ?? null, sustainabilityDescription: input.sustainabilityDescription ?? null, specifications: input.specifications ?? null, seoTitle: input.seoTitle ?? null, seoDescription: input.seoDescription ?? null, weightGrams: input.weightGrams ?? null, shippingClass: input.shippingClass ?? "standard", isFeatured: !!input.isFeatured, isBestSeller: !!input.isBestSeller, updatedAt: new Date() };
}
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function syncRelations(tx: Tx, productId: number, input: ProductInput, actorId: number | null) {
  if (input.categoryIds) {
    await tx.delete(s.productCategories).where(eq(s.productCategories.productId, productId));
    const ids = [...new Set([...(input.categoryIds ?? []), ...(input.primaryCategoryId ? [input.primaryCategoryId] : [])])];
    if (ids.length) await tx.insert(s.productCategories).values(ids.map((categoryId) => ({ productId, categoryId })));
  }
  if (input.collectionIds) {
    await tx.delete(s.productCollections).where(eq(s.productCollections.productId, productId));
    if (input.collectionIds.length) await tx.insert(s.productCollections).values(input.collectionIds.map((collectionId) => ({ productId, collectionId })));
  }
  if (input.tags) {
    await tx.delete(s.productTags).where(eq(s.productTags.productId, productId));
    if (input.tags.length) await tx.insert(s.productTags).values([...new Set(input.tags)].map((tag) => ({ productId, tag })));
  }
  if (input.images) {
    await tx.delete(s.productImages).where(eq(s.productImages.productId, productId));
    if (input.images.length) await tx.insert(s.productImages).values(input.images.map((im, i) => ({ productId, url: im.url, altText: im.altText ?? null, color: im.color ?? null, sortOrder: im.sortOrder ?? i })));
  }
  if (input.variants) {
    const existing = await tx.select().from(s.productVariants).where(eq(s.productVariants.productId, productId));
    const keep = new Set<number>();
    const [wh] = await tx.select().from(s.warehouses).where(eq(s.warehouses.isDefault, true));
    for (const v of input.variants) {
      const vals = { sku: v.sku.trim(), color: v.color, colorHex: v.colorHex ?? "#000000", size: v.size, price: v.price.toFixed(2), compareAtPrice: v.compareAtPrice != null ? v.compareAtPrice.toFixed(2) : null, costPrice: v.costPrice != null ? v.costPrice.toFixed(2) : null, barcode: v.barcode ?? null, weightGrams: v.weightGrams ?? null, status: v.status ?? "ACTIVE" };
      const found = v.id ? existing.find((e) => e.id === v.id) : existing.find((e) => e.sku === vals.sku);
      if (found) { await tx.update(s.productVariants).set(vals).where(eq(s.productVariants.id, found.id)); keep.add(found.id); }
      else {
        const [skuDup] = await tx.select({ id: s.productVariants.id }).from(s.productVariants).where(eq(s.productVariants.sku, vals.sku));
        if (skuDup) throw new ApiError(409, "SKU_TAKEN", `SKU ${vals.sku} already exists`);
        const [nv] = await tx.insert(s.productVariants).values({ ...vals, productId }).returning();
        keep.add(nv.id);
        if (wh && v.initialStock && v.initialStock > 0) await applyTransaction(tx, { variantId: nv.id, warehouseId: wh.id, type: "PURCHASE", quantity: v.initialStock, referenceType: "PRODUCT", referenceId: String(productId), reason: "Initial stock on variant creation", createdBy: actorId });
      }
    }
    for (const e of existing) if (!keep.has(e.id)) await tx.update(s.productVariants).set({ status: "INACTIVE" }).where(eq(s.productVariants.id, e.id));
  }
}
export async function updateProduct(ctx: Ctx, id: number, input: Partial<ProductInput>) {
  const before = await getProductById(id);
  await db.transaction(async (tx) => {
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const k of ["name", "description", "shortDescription", "status", "productType", "gender", "primaryCategoryId", "material", "careInstructions", "sustainabilityDescription", "specifications", "seoTitle", "seoDescription", "weightGrams", "shippingClass", "isFeatured", "isBestSeller"] as const) if (input[k] !== undefined) patch[k] = input[k];
    if (input.slug) patch.slug = slugify(input.slug);
    if (input.status === "ACTIVE" && !before.publishedAt) patch.publishedAt = new Date();
    await tx.update(s.products).set(patch).where(eq(s.products.id, id));
    await syncRelations(tx, id, input as ProductInput, ctx.user?.id ?? null);
  });
  const after = await getProductById(id);
  await audit(ctx, "PRODUCT_UPDATED", "Product", id, { name: before.name, status: before.status, variants: before.variants.length }, { name: after.name, status: after.status, variants: after.variants.length });
  return after;
}
export async function setProductStatus(ctx: Ctx, id: number, status: string) {
  const [before] = await db.select({ status: s.products.status }).from(s.products).where(eq(s.products.id, id));
  if (!before) throw notFound("PRODUCT_NOT_FOUND", "Product not found");
  await db.update(s.products).set({ status, updatedAt: new Date(), ...(status === "ACTIVE" ? { publishedAt: new Date() } : {}) }).where(eq(s.products.id, id));
  await audit(ctx, status === "ARCHIVED" ? "PRODUCT_ARCHIVED" : "PRODUCT_UPDATED", "Product", id, { status: before.status }, { status });
  return getProductById(id);
}
export async function deleteProduct(ctx: Ctx, id: number) {
  const p = await getProductById(id);
  await db.delete(s.products).where(eq(s.products.id, id));
  await audit(ctx, "PRODUCT_DELETED", "Product", id, { name: p.name, slug: p.slug }, null);
}
export async function duplicateProduct(ctx: Ctx, id: number) {
  const p = await getProductById(id);
  const suffix = Date.now().toString(36).slice(-4);
  return createProduct(ctx, { ...p, name: `${p.name} (Copy)`, slug: `${p.slug}-copy-${suffix}`, status: "DRAFT", specifications: p.specifications ?? undefined, categoryIds: p.categories.map((c) => c.id), collectionIds: p.collections.map((c) => c.id), tags: p.tags, images: p.images.map((i) => ({ url: i.url, altText: i.altText, color: i.color, sortOrder: i.sortOrder })), variants: p.variants.map((v) => ({ sku: `${v.sku}-C${suffix}`, color: v.color, colorHex: v.colorHex, size: v.size, price: v.price, compareAtPrice: v.compareAtPrice, costPrice: v.costPrice, barcode: null, weightGrams: v.weightGrams, status: v.status })) });
}
export async function bulkProducts(ctx: Ctx, ids: number[], action: "publish" | "unpublish" | "archive" | "delete") {
  for (const id of ids) {
    if (action === "delete") await deleteProduct(ctx, id);
    else await setProductStatus(ctx, id, action === "publish" ? "ACTIVE" : action === "unpublish" ? "DRAFT" : "ARCHIVED");
  }
  return { affected: ids.length };
}

// ---------------- Categories & Collections ----------------
export async function saveCategory(ctx: Ctx, input: { name: string; slug?: string; description?: string | null; imageUrl?: string | null; parentId?: number | null; isActive?: boolean; sortOrder?: number }, id?: number) {
  const vals = { ...input, slug: slugify(input.slug || input.name) };
  const [row] = id ? await db.update(s.categories).set(vals).where(eq(s.categories.id, id)).returning() : await db.insert(s.categories).values(vals).returning();
  await audit(ctx, id ? "CATEGORY_UPDATED" : "CATEGORY_CREATED", "Category", row.id, null, vals);
  return row;
}
export async function deleteCategory(ctx: Ctx, id: number) { await db.delete(s.categories).where(eq(s.categories.id, id)); await audit(ctx, "CATEGORY_DELETED", "Category", id); }
export async function saveCollection(ctx: Ctx, input: { name: string; slug?: string; description?: string | null; imageUrl?: string | null; isFeatured?: boolean; isActive?: boolean; sortOrder?: number; productIds?: number[] }, id?: number) {
  const { productIds, ...rest } = input;
  const vals = { ...rest, slug: slugify(input.slug || input.name) };
  const [row] = id ? await db.update(s.collections).set(vals).where(eq(s.collections.id, id)).returning() : await db.insert(s.collections).values(vals).returning();
  if (productIds) { await db.delete(s.productCollections).where(eq(s.productCollections.collectionId, row.id)); if (productIds.length) await db.insert(s.productCollections).values(productIds.map((productId) => ({ productId, collectionId: row.id }))); }
  await audit(ctx, id ? "COLLECTION_UPDATED" : "COLLECTION_CREATED", "Collection", row.id, null, vals);
  return row;
}
export async function deleteCollection(ctx: Ctx, id: number) { await db.delete(s.collections).where(eq(s.collections.id, id)); await audit(ctx, "COLLECTION_DELETED", "Collection", id); }

// ---------------- Orders ----------------
export async function adminListOrders(sp: URLSearchParams, page: number, pageSize: number) {
  const c: SQL[] = [];
  const q = sp.get("q");
  if (q) c.push(or(ilike(s.orders.orderNumber, `%${q}%`), ilike(s.orders.email, `%${q}%`))!);
  if (sp.get("status")) c.push(eq(s.orders.status, sp.get("status")!));
  if (sp.get("from")) c.push(gte(s.orders.createdAt, new Date(sp.get("from")!)));
  if (sp.get("to")) c.push(lte(s.orders.createdAt, new Date(sp.get("to")!)));
  if (sp.get("userId")) c.push(eq(s.orders.userId, Number(sp.get("userId"))));
  const where = c.length ? and(...c) : undefined;
  const sort = sp.get("sort");
  const [list, [{ count }]] = await Promise.all([
    db.select({ id: s.orders.id, orderNumber: s.orders.orderNumber, status: s.orders.status, grandTotal: s.orders.grandTotal, email: s.orders.email, createdAt: s.orders.createdAt, shippingMethod: s.orders.shippingMethod, customer: sql<string>`coalesce("users"."first_name" || ' ' || "users"."last_name", "orders"."email")`, itemCount: sql<number>`(select coalesce(sum(quantity),0) from order_items oi where oi.order_id = "orders"."id")`, paymentStatus: sql<string>`(select status from payments p where p.order_id = "orders"."id" order by id desc limit 1)` })
      .from(s.orders).leftJoin(s.users, eq(s.users.id, s.orders.userId)).where(where).orderBy(sort === "total_desc" ? desc(s.orders.grandTotal) : sort === "oldest" ? asc(s.orders.createdAt) : desc(s.orders.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)` }).from(s.orders).where(where),
  ]);
  return { items: list.map((o) => ({ ...o, grandTotal: num(o.grandTotal), itemCount: Number(o.itemCount) })), total: Number(count) };
}
export async function adminGetOrder(id: number) {
  const [o] = await db.select().from(s.orders).where(eq(s.orders.id, id));
  if (!o) throw notFound("ORDER_NOT_FOUND", "Order not found");
  return hydrateOrder(o);
}
export async function adminUpdateOrderStatus(ctx: Ctx, id: number, status: string, note?: string, extra?: { carrier?: string; trackingNumber?: string }) {
  const r = await transitionOrder(id, status, ctx.user!.id, note, extra);
  await audit(ctx, status === "REFUNDED" ? "REFUND_CREATED" : "ORDER_STATUS_CHANGED", "Order", id, { status: r.from }, { status: r.to, note });
  const o = r.order;
  const titles: Record<string, string> = { SHIPPED: "Your order has shipped", DELIVERED: "Your order was delivered", CANCELLED: "Your order was cancelled", REFUNDED: "Your refund has been issued" };
  if (titles[status]) await notify(o.userId, o.email, status === "SHIPPED" ? "ORDER_SHIPPED" : status === "DELIVERED" ? "ORDER_DELIVERED" : "ORDER_CONFIRMED", `${titles[status]} (${o.orderNumber})`, note ?? titles[status]);
  return adminGetOrder(id);
}
export async function adminAddOrderNote(ctx: Ctx, id: number, message: string) {
  await db.insert(s.orderEvents).values({ orderId: id, type: "NOTE_ADDED", message, actorId: ctx.user!.id });
  return adminGetOrder(id);
}

// ---------------- Inventory ----------------
export async function adminInventory(sp: URLSearchParams, page: number, pageSize: number) {
  const c: SQL[] = [];
  const q = sp.get("q");
  if (q) c.push(or(ilike(s.productVariants.sku, `%${q}%`), ilike(s.products.name, `%${q}%`))!);
  if (sp.get("warehouseId")) c.push(eq(s.warehouseInventory.warehouseId, Number(sp.get("warehouseId"))));
  if (sp.get("variantId")) c.push(eq(s.warehouseInventory.variantId, Number(sp.get("variantId"))));
  if (sp.get("stock") === "low") c.push(sql`"warehouse_inventory"."quantity_on_hand" - "warehouse_inventory"."quantity_reserved" <= "warehouse_inventory"."reorder_level" and "warehouse_inventory"."quantity_on_hand" - "warehouse_inventory"."quantity_reserved" > 0`);
  if (sp.get("stock") === "out") c.push(sql`"warehouse_inventory"."quantity_on_hand" - "warehouse_inventory"."quantity_reserved" <= 0`);
  const where = c.length ? and(...c) : undefined;
  const base = db.select({ id: s.warehouseInventory.id, variantId: s.warehouseInventory.variantId, warehouseId: s.warehouseInventory.warehouseId, warehouseCode: s.warehouses.code, warehouseName: s.warehouses.name, sku: s.productVariants.sku, productId: s.products.id, productName: s.products.name, productSlug: s.products.slug, color: s.productVariants.color, size: s.productVariants.size, quantityOnHand: s.warehouseInventory.quantityOnHand, quantityReserved: s.warehouseInventory.quantityReserved, quantityAvailable: sql<number>`"warehouse_inventory"."quantity_on_hand" - "warehouse_inventory"."quantity_reserved"`, reorderLevel: s.warehouseInventory.reorderLevel, updatedAt: s.warehouseInventory.updatedAt })
    .from(s.warehouseInventory).innerJoin(s.productVariants, eq(s.productVariants.id, s.warehouseInventory.variantId)).innerJoin(s.products, eq(s.products.id, s.productVariants.productId)).innerJoin(s.warehouses, eq(s.warehouses.id, s.warehouseInventory.warehouseId)).where(where);
  const [list, [{ count }], [summary]] = await Promise.all([
    base.orderBy(sp.get("sort") === "available_asc" ? asc(sql`"warehouse_inventory"."quantity_on_hand" - "warehouse_inventory"."quantity_reserved"`) : asc(s.products.name), asc(s.productVariants.sku), asc(s.warehouses.priority)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)` }).from(s.warehouseInventory).innerJoin(s.productVariants, eq(s.productVariants.id, s.warehouseInventory.variantId)).innerJoin(s.products, eq(s.products.id, s.productVariants.productId)).innerJoin(s.warehouses, eq(s.warehouses.id, s.warehouseInventory.warehouseId)).where(where),
    db.select({ onHand: sql<number>`coalesce(sum(quantity_on_hand),0)`, reserved: sql<number>`coalesce(sum(quantity_reserved),0)`, low: sql<number>`count(*) filter (where quantity_on_hand - quantity_reserved <= reorder_level and quantity_on_hand - quantity_reserved > 0)`, out: sql<number>`count(*) filter (where quantity_on_hand - quantity_reserved <= 0)` }).from(s.warehouseInventory),
  ]);
  return { items: list.map((r) => ({ ...r, quantityAvailable: Number(r.quantityAvailable) })), total: Number(count), summary: { onHand: Number(summary.onHand), reserved: Number(summary.reserved), low: Number(summary.low), out: Number(summary.out) } };
}
export async function adminAdjustInventory(ctx: Ctx, input: { variantId: number; warehouseId: number; type: InvTxType; quantity: number; reason: string; reorderLevel?: number }) {
  if (["SALE", "RESERVATION", "RELEASE", "TRANSFER_IN", "TRANSFER_OUT"].includes(input.type)) throw badRequest("INVALID_TYPE", "Use the order or transfer workflows for this transaction type");
  const [before] = await db.select().from(s.warehouseInventory).where(and(eq(s.warehouseInventory.variantId, input.variantId), eq(s.warehouseInventory.warehouseId, input.warehouseId)));
  const result = await db.transaction(async (tx) => {
    const r = await applyTransaction(tx, { ...input, referenceType: "ADMIN", referenceId: String(ctx.user!.id), createdBy: ctx.user!.id });
    if (input.reorderLevel != null) await tx.update(s.warehouseInventory).set({ reorderLevel: input.reorderLevel }).where(and(eq(s.warehouseInventory.variantId, input.variantId), eq(s.warehouseInventory.warehouseId, input.warehouseId)));
    return r;
  });
  await audit(ctx, "INVENTORY_ADJUSTED", "WarehouseInventory", `${input.variantId}:${input.warehouseId}`, { quantityOnHand: before?.quantityOnHand ?? 0 }, { quantityOnHand: result.quantityOnHand, type: input.type, quantity: input.quantity, reason: input.reason });
  if (result.quantityAvailable <= result.reorderLevel) {
    const [v] = await db.select({ sku: s.productVariants.sku }).from(s.productVariants).where(eq(s.productVariants.id, input.variantId));
    await notify(ctx.user!.id, null, "LOW_STOCK", `Low stock: ${v?.sku}`, `${result.quantityAvailable} available at warehouse #${input.warehouseId}`);
  }
  return result;
}
export async function inventoryTransactions(sp: URLSearchParams, page: number, pageSize: number) {
  const c: SQL[] = [];
  if (sp.get("variantId")) c.push(eq(s.inventoryTransactions.variantId, Number(sp.get("variantId"))));
  if (sp.get("warehouseId")) c.push(eq(s.inventoryTransactions.warehouseId, Number(sp.get("warehouseId"))));
  if (sp.get("type")) c.push(eq(s.inventoryTransactions.type, sp.get("type")!));
  const where = c.length ? and(...c) : undefined;
  const [list, [{ count }]] = await Promise.all([
    db.select({ id: s.inventoryTransactions.id, type: s.inventoryTransactions.type, quantity: s.inventoryTransactions.quantity, referenceType: s.inventoryTransactions.referenceType, referenceId: s.inventoryTransactions.referenceId, reason: s.inventoryTransactions.reason, createdAt: s.inventoryTransactions.createdAt, sku: s.productVariants.sku, productName: s.products.name, warehouseCode: s.warehouses.code, actor: sql<string | null>`"users"."first_name" || ' ' || "users"."last_name"` })
      .from(s.inventoryTransactions).innerJoin(s.productVariants, eq(s.productVariants.id, s.inventoryTransactions.variantId)).innerJoin(s.products, eq(s.products.id, s.productVariants.productId)).innerJoin(s.warehouses, eq(s.warehouses.id, s.inventoryTransactions.warehouseId)).leftJoin(s.users, eq(s.users.id, s.inventoryTransactions.createdBy)).where(where).orderBy(desc(s.inventoryTransactions.createdAt), desc(s.inventoryTransactions.id)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)` }).from(s.inventoryTransactions).where(where),
  ]);
  return { items: list, total: Number(count) };
}

// ---------------- Warehouses & transfers ----------------
export async function listWarehouses() {
  const rowsW = await db.select({ w: s.warehouses, skus: sql<number>`(select count(*) from warehouse_inventory wi where wi.warehouse_id = "warehouses"."id" and wi.quantity_on_hand > 0)`, onHand: sql<number>`(select coalesce(sum(quantity_on_hand),0) from warehouse_inventory wi where wi.warehouse_id = "warehouses"."id")`, reserved: sql<number>`(select coalesce(sum(quantity_reserved),0) from warehouse_inventory wi where wi.warehouse_id = "warehouses"."id")`, low: sql<number>`(select count(*) from warehouse_inventory wi where wi.warehouse_id = "warehouses"."id" and wi.quantity_on_hand - wi.quantity_reserved <= wi.reorder_level)` }).from(s.warehouses).orderBy(asc(s.warehouses.priority));
  return rowsW.map((r) => ({ ...r.w, skus: Number(r.skus), onHand: Number(r.onHand), reserved: Number(r.reserved), low: Number(r.low) }));
}
export async function saveWarehouse(ctx: Ctx, input: Partial<typeof s.warehouses.$inferInsert> & { code: string; name: string }, id?: number) {
  if (input.isDefault) await db.update(s.warehouses).set({ isDefault: false });
  const [row] = id ? await db.update(s.warehouses).set(input).where(eq(s.warehouses.id, id)).returning() : await db.insert(s.warehouses).values(input).returning();
  await audit(ctx, id ? "WAREHOUSE_UPDATED" : "WAREHOUSE_CREATED", "Warehouse", row.id, null, input);
  return row;
}
export async function listTransfers() {
  const list = await db.select({ t: s.inventoryTransfers, from: sql<string>`(select code from warehouses where id = "inventory_transfers"."from_warehouse_id")`, to: sql<string>`(select code from warehouses where id = "inventory_transfers"."to_warehouse_id")`, items: sql<number>`(select count(*) from inventory_transfer_items i where i.transfer_id = "inventory_transfers"."id")`, units: sql<number>`(select coalesce(sum(quantity),0) from inventory_transfer_items i where i.transfer_id = "inventory_transfers"."id")` }).from(s.inventoryTransfers).orderBy(desc(s.inventoryTransfers.createdAt)).limit(100);
  return list.map((r) => ({ ...r.t, fromCode: r.from, toCode: r.to, itemCount: Number(r.items), units: Number(r.units) }));
}
export async function createTransfer(ctx: Ctx, input: { fromWarehouseId: number; toWarehouseId: number; notes?: string; items: { variantId?: number; sku?: string; quantity: number }[] }) {
  if (input.fromWarehouseId === input.toWarehouseId) throw badRequest("SAME_WAREHOUSE", "Source and destination must differ");
  const items: { variantId: number; quantity: number }[] = [];
  for (const it of input.items) {
    let variantId = it.variantId;
    if (!variantId && it.sku) variantId = (await db.select({ id: s.productVariants.id }).from(s.productVariants).where(eq(s.productVariants.sku, it.sku)))[0]?.id;
    if (!variantId) throw badRequest("VARIANT_NOT_FOUND", `Unknown SKU ${it.sku ?? ""}`);
    items.push({ variantId, quantity: it.quantity });
  }
  const [t] = await db.insert(s.inventoryTransfers).values({ fromWarehouseId: input.fromWarehouseId, toWarehouseId: input.toWarehouseId, notes: input.notes, createdBy: ctx.user!.id }).returning();
  await db.insert(s.inventoryTransferItems).values(items.map((i) => ({ ...i, transferId: t.id })));
  await audit(ctx, "TRANSFER_CREATED", "InventoryTransfer", t.id, null, input);
  return t;
}
const TRANSFER_FLOW: Record<string, string[]> = { REQUESTED: ["APPROVED", "CANCELLED"], APPROVED: ["IN_TRANSIT", "CANCELLED"], IN_TRANSIT: ["COMPLETED"], COMPLETED: [], CANCELLED: [] };
export async function updateTransferStatus(ctx: Ctx, id: number, status: string) {
  return db.transaction(async (tx) => {
    const [t] = await tx.select().from(s.inventoryTransfers).where(eq(s.inventoryTransfers.id, id)).for("update");
    if (!t) throw notFound("TRANSFER_NOT_FOUND", "Transfer not found");
    if (!TRANSFER_FLOW[t.status].includes(status)) throw new ApiError(409, "INVALID_TRANSITION", `Cannot move transfer from ${t.status} to ${status}`);
    const items = await tx.select().from(s.inventoryTransferItems).where(eq(s.inventoryTransferItems.transferId, id));
    if (status === "IN_TRANSIT") for (const i of items) await applyTransaction(tx, { variantId: i.variantId, warehouseId: t.fromWarehouseId, type: "TRANSFER_OUT", quantity: i.quantity, referenceType: "TRANSFER", referenceId: String(id), reason: "Stock transfer out", createdBy: ctx.user!.id });
    if (status === "COMPLETED") for (const i of items) await applyTransaction(tx, { variantId: i.variantId, warehouseId: t.toWarehouseId, type: "TRANSFER_IN", quantity: i.quantity, referenceType: "TRANSFER", referenceId: String(id), reason: "Stock transfer in", createdBy: ctx.user!.id });
    const [row] = await tx.update(s.inventoryTransfers).set({ status, updatedAt: new Date() }).where(eq(s.inventoryTransfers.id, id)).returning();
    await tx.insert(s.auditLogs).values({ actorId: ctx.user!.id, action: "TRANSFER_STATUS_CHANGED", entityType: "InventoryTransfer", entityId: String(id), oldValue: { status: t.status }, newValue: { status }, ipAddress: ctx.ip });
    return row;
  });
}

// ---------------- Customers ----------------
export async function adminListCustomers(sp: URLSearchParams, page: number, pageSize: number) {
  const c: SQL[] = [eq(s.users.isStaff, false)];
  const q = sp.get("q");
  if (q) c.push(or(ilike(s.users.email, `%${q}%`), ilike(s.users.firstName, `%${q}%`), ilike(s.users.lastName, `%${q}%`))!);
  if (sp.get("status")) c.push(eq(s.users.status, sp.get("status")!));
  const where = and(...c);
  const ltv = sql<string>`(select coalesce(sum(grand_total),0) from orders o where o.user_id = "users"."id" and o.status in ('CONFIRMED','PROCESSING','PACKED','SHIPPED','DELIVERED'))`;
  const [list, [{ count }]] = await Promise.all([
    db.select({ id: s.users.id, email: s.users.email, firstName: s.users.firstName, lastName: s.users.lastName, status: s.users.status, createdAt: s.users.createdAt, lastLoginAt: s.users.lastLoginAt, orderCount: sql<number>`(select count(*) from orders o where o.user_id = "users"."id")`, lifetimeValue: ltv, lastOrderAt: sql<Date | null>`(select max(created_at) from orders o where o.user_id = "users"."id")` }).from(s.users).where(where).orderBy(sp.get("sort") === "ltv" ? desc(ltv) : desc(s.users.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)` }).from(s.users).where(where),
  ]);
  return { items: list.map((u) => ({ ...u, orderCount: Number(u.orderCount), lifetimeValue: num(u.lifetimeValue) })), total: Number(count) };
}
export async function adminGetCustomer(id: number) {
  const [u] = await db.select({ id: s.users.id, email: s.users.email, firstName: s.users.firstName, lastName: s.users.lastName, phone: s.users.phone, status: s.users.status, createdAt: s.users.createdAt, lastLoginAt: s.users.lastLoginAt, marketingOptIn: s.users.marketingOptIn }).from(s.users).where(eq(s.users.id, id));
  if (!u) throw notFound("CUSTOMER_NOT_FOUND", "Customer not found");
  const [ordersList, addressesList, reviewsList, wishlist, notes, [stats]] = await Promise.all([
    db.select({ id: s.orders.id, orderNumber: s.orders.orderNumber, status: s.orders.status, grandTotal: s.orders.grandTotal, createdAt: s.orders.createdAt }).from(s.orders).where(eq(s.orders.userId, id)).orderBy(desc(s.orders.createdAt)).limit(50),
    db.select().from(s.addresses).where(eq(s.addresses.userId, id)),
    db.select({ id: s.reviews.id, rating: s.reviews.rating, title: s.reviews.title, status: s.reviews.status, createdAt: s.reviews.createdAt, productName: s.products.name }).from(s.reviews).innerJoin(s.products, eq(s.products.id, s.reviews.productId)).where(eq(s.reviews.userId, id)).orderBy(desc(s.reviews.createdAt)),
    db.select({ id: s.wishlistItems.id, productName: s.products.name, productSlug: s.products.slug, createdAt: s.wishlistItems.createdAt }).from(s.wishlistItems).innerJoin(s.wishlists, eq(s.wishlists.id, s.wishlistItems.wishlistId)).innerJoin(s.products, eq(s.products.id, s.wishlistItems.productId)).where(eq(s.wishlists.userId, id)),
    db.select().from(s.notifications).where(eq(s.notifications.userId, id)).orderBy(desc(s.notifications.createdAt)).limit(20),
    db.select({ ltv: sql<string>`coalesce(sum(grand_total) filter (where status in ('CONFIRMED','PROCESSING','PACKED','SHIPPED','DELIVERED')),0)`, count: sql<number>`count(*)`, aov: sql<string>`coalesce(avg(grand_total) filter (where status in ('CONFIRMED','PROCESSING','PACKED','SHIPPED','DELIVERED')),0)` }).from(s.orders).where(eq(s.orders.userId, id)),
  ]);
  return { ...u, orders: ordersList.map((o) => ({ ...o, grandTotal: num(o.grandTotal) })), addresses: addressesList, reviews: reviewsList, wishlist, activity: notes, stats: { lifetimeValue: num(stats.ltv), orderCount: Number(stats.count), aov: num(stats.aov) } };
}
export async function adminSetUserStatus(ctx: Ctx, id: number, status: string, action = "CUSTOMER_STATUS_CHANGED") {
  const [before] = await db.select({ status: s.users.status }).from(s.users).where(eq(s.users.id, id));
  if (!before) throw notFound("USER_NOT_FOUND", "User not found");
  await db.update(s.users).set({ status, updatedAt: new Date() }).where(eq(s.users.id, id));
  if (status === "DISABLED") await db.update(s.refreshTokens).set({ revokedAt: new Date() }).where(eq(s.refreshTokens.userId, id));
  await audit(ctx, action, "User", id, { status: before.status }, { status });
}

// ---------------- Employees ----------------
export async function listEmployees() {
  const list = await db.select({ id: s.users.id, email: s.users.email, firstName: s.users.firstName, lastName: s.users.lastName, jobTitle: s.users.jobTitle, status: s.users.status, lastLoginAt: s.users.lastLoginAt, createdAt: s.users.createdAt, roles: sql<string[]>`array(select r.name from user_roles ur join roles r on r.id = ur.role_id where ur.user_id = "users"."id")` }).from(s.users).where(eq(s.users.isStaff, true)).orderBy(asc(s.users.createdAt));
  const rolesList = await db.select({ role: s.roles.name, permission: s.permissions.name }).from(s.rolePermissions).innerJoin(s.roles, eq(s.roles.id, s.rolePermissions.roleId)).innerJoin(s.permissions, eq(s.permissions.id, s.rolePermissions.permissionId));
  const rolePerms: Record<string, string[]> = {};
  for (const r of rolesList) (rolePerms[r.role] ??= []).push(r.permission);
  return { employees: list.map((e) => ({ ...e, permissions: [...new Set(e.roles.flatMap((r) => rolePerms[r] ?? []))] })), rolePermissions: rolePerms };
}
export async function createEmployee(ctx: Ctx, input: { email: string; firstName: string; lastName: string; password: string; role: string; jobTitle?: string }) {
  const actorRoles = ctx.user!.roles;
  if (["ADMIN", "SUPER_ADMIN"].includes(input.role) && !actorRoles.includes("SUPER_ADMIN")) throw new ApiError(403, "FORBIDDEN", "Only super admins can grant admin roles");
  const [dup] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, input.email.toLowerCase()));
  if (dup) throw new ApiError(409, "EMAIL_TAKEN", "Email already in use");
  const [role] = await db.select().from(s.roles).where(eq(s.roles.name, input.role));
  if (!role || role.name === "CUSTOMER") throw badRequest("INVALID_ROLE", "Invalid staff role");
  const [u] = await db.insert(s.users).values({ email: input.email.toLowerCase(), firstName: input.firstName, lastName: input.lastName, passwordHash: await bcrypt.hash(input.password, 10), isStaff: true, jobTitle: input.jobTitle, status: "ACTIVE", emailVerifiedAt: new Date() }).returning();
  await db.insert(s.userRoles).values({ userId: u.id, roleId: role.id });
  await audit(ctx, "EMPLOYEE_CREATED", "User", u.id, null, { email: u.email, role: input.role });
  return u.id;
}
export async function updateEmployee(ctx: Ctx, id: number, input: { role?: string; status?: string; jobTitle?: string }) {
  if (input.role) {
    if (["ADMIN", "SUPER_ADMIN"].includes(input.role) && !ctx.user!.roles.includes("SUPER_ADMIN")) throw new ApiError(403, "FORBIDDEN", "Only super admins can grant admin roles");
    const [role] = await db.select().from(s.roles).where(eq(s.roles.name, input.role));
    if (!role || role.name === "CUSTOMER") throw badRequest("INVALID_ROLE", "Invalid staff role");
    const old = await db.select({ name: s.roles.name }).from(s.userRoles).innerJoin(s.roles, eq(s.roles.id, s.userRoles.roleId)).where(eq(s.userRoles.userId, id));
    await db.delete(s.userRoles).where(eq(s.userRoles.userId, id));
    await db.insert(s.userRoles).values({ userId: id, roleId: role.id });
    await db.update(s.refreshTokens).set({ revokedAt: new Date() }).where(eq(s.refreshTokens.userId, id));
    await audit(ctx, "ROLE_CHANGED", "User", id, { roles: old.map((o) => o.name) }, { roles: [input.role] });
  }
  if (input.status) {
    if (id === ctx.user!.id) throw badRequest("SELF_DEACTIVATE", "You cannot deactivate your own account");
    await adminSetUserStatus(ctx, id, input.status, input.status === "DISABLED" ? "EMPLOYEE_DEACTIVATED" : "EMPLOYEE_ACTIVATED");
  }
  if (input.jobTitle !== undefined) await db.update(s.users).set({ jobTitle: input.jobTitle }).where(eq(s.users.id, id));
}

// ---------------- Promotions ----------------
export const listCoupons = () => db.select().from(s.coupons).orderBy(desc(s.coupons.createdAt));
export async function saveCoupon(ctx: Ctx, input: Partial<typeof s.coupons.$inferInsert> & { code: string; type: string; value: string }, id?: number) {
  const vals = { ...input, code: input.code.toUpperCase().trim() };
  const [row] = id ? await db.update(s.coupons).set(vals).where(eq(s.coupons.id, id)).returning() : await db.insert(s.coupons).values(vals).returning();
  await audit(ctx, id ? "COUPON_UPDATED" : "COUPON_CREATED", "Coupon", row.id, null, vals);
  return row;
}

// ---------------- Reviews ----------------
export async function adminListReviews(sp: URLSearchParams, page: number, pageSize: number) {
  const where = sp.get("status") ? eq(s.reviews.status, sp.get("status")!) : undefined;
  const [list, [{ count }]] = await Promise.all([
    db.select({ id: s.reviews.id, rating: s.reviews.rating, title: s.reviews.title, comment: s.reviews.comment, status: s.reviews.status, isVerifiedPurchase: s.reviews.isVerifiedPurchase, createdAt: s.reviews.createdAt, productId: s.reviews.productId, productName: s.products.name, productSlug: s.products.slug, author: sql<string>`"users"."first_name" || ' ' || "users"."last_name"`, email: s.users.email }).from(s.reviews).innerJoin(s.products, eq(s.products.id, s.reviews.productId)).innerJoin(s.users, eq(s.users.id, s.reviews.userId)).where(where).orderBy(desc(s.reviews.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)` }).from(s.reviews).where(where),
  ]);
  return { items: list, total: Number(count) };
}
export async function moderateReview(ctx: Ctx, id: number, status: "APPROVED" | "REJECTED") {
  const [r] = await db.update(s.reviews).set({ status, moderatedBy: ctx.user!.id }).where(eq(s.reviews.id, id)).returning();
  if (!r) throw notFound("REVIEW_NOT_FOUND", "Review not found");
  await recalcRating(r.productId);
  await audit(ctx, "REVIEW_MODERATED", "Review", id, null, { status });
  return r;
}
export async function deleteReview(ctx: Ctx, id: number) {
  const [r] = await db.delete(s.reviews).where(eq(s.reviews.id, id)).returning();
  if (r) { await recalcRating(r.productId); await audit(ctx, "REVIEW_DELETED", "Review", id, { rating: r.rating }, null); }
}

// ---------------- Audit logs & settings ----------------
export async function auditLogs(sp: URLSearchParams, page: number, pageSize: number) {
  const c: SQL[] = [];
  if (sp.get("action")) c.push(ilike(s.auditLogs.action, `%${sp.get("action")}%`));
  if (sp.get("entityType")) c.push(eq(s.auditLogs.entityType, sp.get("entityType")!));
  if (sp.get("actorId")) c.push(eq(s.auditLogs.actorId, Number(sp.get("actorId"))));
  const where = c.length ? and(...c) : undefined;
  const [list, [{ count }]] = await Promise.all([
    db.select({ id: s.auditLogs.id, action: s.auditLogs.action, entityType: s.auditLogs.entityType, entityId: s.auditLogs.entityId, oldValue: s.auditLogs.oldValue, newValue: s.auditLogs.newValue, ipAddress: s.auditLogs.ipAddress, createdAt: s.auditLogs.createdAt, actor: sql<string | null>`"users"."first_name" || ' ' || "users"."last_name"`, actorEmail: s.users.email }).from(s.auditLogs).leftJoin(s.users, eq(s.users.id, s.auditLogs.actorId)).where(where).orderBy(desc(s.auditLogs.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)` }).from(s.auditLogs).where(where),
  ]);
  return { items: list, total: Number(count) };
}
export const listSettings = () => db.select().from(s.storeSettings).orderBy(asc(s.storeSettings.group), asc(s.storeSettings.key));
export async function updateSettings(ctx: Ctx, entries: { key: string; value: unknown }[]) {
  for (const e of entries) {
    if (/secret|password|apiKey/i.test(e.key)) throw badRequest("SECRET_SETTING", "Secrets must be configured via environment variables");
    await db.insert(s.storeSettings).values({ key: e.key, value: e.value as object, group: e.key.split(".")[0] }).onConflictDoUpdate({ target: s.storeSettings.key, set: { value: e.value as object, updatedAt: new Date() } });
  }
  invalidateSettings();
  await audit(ctx, "SETTINGS_UPDATED", "StoreSettings", null, null, entries);
  return listSettings();
}
