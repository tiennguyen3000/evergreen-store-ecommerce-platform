import { SQL, and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { notFound, num } from "../core";

export type ProductCard = {
  id: number; slug: string; name: string; productType: string; gender: string; category: string | null; categorySlug: string | null;
  price: number; compareAtPrice: number | null; images: string[]; colors: { name: string; hex: string }[]; sizes: string[];
  available: number; badges: string[]; ratingAvg: number; ratingCount: number; createdAt: string;
};

export type ListFilters = {
  category?: string | null; collection?: string | null; size?: string[]; color?: string[]; minPrice?: number | null; maxPrice?: number | null;
  inStock?: boolean; onSale?: boolean; gender?: string | null; productType?: string | null; q?: string | null; sort?: string | null; badge?: string | null;
  status?: string | null; featured?: boolean; bestSeller?: boolean; includeDraft?: boolean; ids?: number[];
};

const availableExpr = sql<number>`coalesce((select sum(wi.quantity_on_hand - wi.quantity_reserved) from warehouse_inventory wi join warehouses w on w.id = wi.warehouse_id where w.status = 'ACTIVE' and wi.variant_id in (select id from product_variants pv where pv.product_id = "products"."id" and pv.status = 'ACTIVE')), 0)`;
const minPriceExpr = sql<string>`(select min(price) from product_variants pv where pv.product_id = "products"."id" and pv.status = 'ACTIVE')`;

export function buildConditions(f: ListFilters): SQL[] {
  const c: SQL[] = [];
  if (!f.includeDraft) c.push(eq(s.products.status, "ACTIVE"));
  else if (f.status) c.push(eq(s.products.status, f.status));
  if (f.ids?.length) c.push(inArray(s.products.id, f.ids));
  if (f.category) c.push(sql`exists (select 1 from product_categories pc join categories c on c.id = pc.category_id where pc.product_id = "products"."id" and c.slug = ${f.category})`);
  if (f.collection) c.push(sql`exists (select 1 from product_collections pc join collections c on c.id = pc.collection_id where pc.product_id = "products"."id" and c.slug = ${f.collection})`);
  if (f.size?.length) c.push(sql`exists (select 1 from product_variants pv where pv.product_id = "products"."id" and pv.size in ${f.size})`);
  if (f.color?.length) c.push(sql`exists (select 1 from product_variants pv where pv.product_id = "products"."id" and lower(pv.color) in ${f.color.map((x) => x.toLowerCase())})`);
  if (f.minPrice != null) c.push(sql`${minPriceExpr} >= ${f.minPrice}`);
  if (f.maxPrice != null) c.push(sql`${minPriceExpr} <= ${f.maxPrice}`);
  if (f.inStock) c.push(sql`${availableExpr} > 0`);
  if (f.onSale) c.push(sql`exists (select 1 from product_variants pv where pv.product_id = "products"."id" and pv.compare_at_price > pv.price)`);
  if (f.gender && f.gender !== "all") c.push(inArray(s.products.gender, [f.gender, "unisex"]));
  if (f.productType) c.push(eq(s.products.productType, f.productType));
  if (f.featured) c.push(eq(s.products.isFeatured, true));
  if (f.bestSeller) c.push(eq(s.products.isBestSeller, true));
  if (f.badge === "new") c.push(sql`"products"."created_at" > now() - interval '45 days'`);
  if (f.q) {
    const q = f.q.trim();
    c.push(or(ilike(s.products.name, `%${q}%`), sql`to_tsvector('english', "products"."name" || ' ' || "products"."description" || ' ' || coalesce("products"."material", '')) @@ plainto_tsquery('english', ${q})`)!);
  }
  return c;
}

function orderBy(sort?: string | null) {
  switch (sort) {
    case "price_asc": return [asc(sql`${minPriceExpr}::numeric`)];
    case "price_desc": return [desc(sql`${minPriceExpr}::numeric`)];
    case "rating": return [desc(s.products.ratingAvg), desc(s.products.ratingCount)];
    case "best_selling": return [desc(s.products.isBestSeller), desc(s.products.ratingCount)];
    case "name_asc": return [asc(s.products.name)];
    case "oldest": return [asc(s.products.createdAt)];
    case "featured": return [desc(s.products.isFeatured), desc(s.products.isBestSeller), desc(s.products.createdAt)];
    default: return [desc(s.products.createdAt)];
  }
}

export async function hydrateCards(rows: { id: number; slug: string; name: string; productType: string; gender: string; primaryCategoryId: number | null; isBestSeller: boolean; ratingAvg: string; ratingCount: number; createdAt: Date; status?: string }[]): Promise<ProductCard[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [variants, images, cats] = await Promise.all([
    db.select({ productId: s.productVariants.productId, color: s.productVariants.color, colorHex: s.productVariants.colorHex, size: s.productVariants.size, price: s.productVariants.price, compareAtPrice: s.productVariants.compareAtPrice, available: sql<number>`coalesce((select sum(wi.quantity_on_hand - wi.quantity_reserved) from warehouse_inventory wi join warehouses w on w.id = wi.warehouse_id where w.status='ACTIVE' and wi.variant_id = "product_variants"."id"),0)` })
      .from(s.productVariants).where(and(inArray(s.productVariants.productId, ids), eq(s.productVariants.status, "ACTIVE"))),
    db.select().from(s.productImages).where(inArray(s.productImages.productId, ids)).orderBy(asc(s.productImages.sortOrder)),
    db.select({ id: s.categories.id, name: s.categories.name, slug: s.categories.slug }).from(s.categories),
  ]);
  const catMap = Object.fromEntries(cats.map((c) => [c.id, c]));
  return rows.map((p) => {
    const vs = variants.filter((v) => v.productId === p.id);
    const prices = vs.map((v) => num(v.price));
    const price = prices.length ? Math.min(...prices) : 0;
    const cmp = vs.map((v) => num(v.compareAtPrice)).filter((x) => x > price);
    const colors = [...new Map(vs.map((v) => [v.color, { name: v.color, hex: v.colorHex }])).values()];
    const sizes = [...new Set(vs.filter((v) => num(v.available) > 0).map((v) => v.size))];
    const available = vs.reduce((a, v) => a + num(v.available), 0);
    const badges: string[] = [];
    if (Date.now() - new Date(p.createdAt).getTime() < 45 * 86400000) badges.push("NEW");
    if (p.isBestSeller) badges.push("BEST SELLER");
    if (cmp.length) badges.push("SALE");
    if (available > 0 && available <= 15) badges.push("LOW STOCK");
    if (available === 0) badges.push("SOLD OUT");
    const cat = p.primaryCategoryId ? catMap[p.primaryCategoryId] : null;
    return { id: p.id, slug: p.slug, name: p.name, productType: p.productType, gender: p.gender, category: cat?.name ?? null, categorySlug: cat?.slug ?? null, price, compareAtPrice: cmp.length ? Math.max(...cmp) : null, images: images.filter((i) => i.productId === p.id).map((i) => i.url).filter((u, i, arr) => arr.indexOf(u) === i).slice(0, 2), colors, sizes, available, badges, ratingAvg: num(p.ratingAvg), ratingCount: p.ratingCount, createdAt: p.createdAt.toISOString() };
  });
}

export async function listProducts(f: ListFilters, page: number, pageSize: number) {
  const where = and(...buildConditions(f));
  const [rows, [{ count }]] = await Promise.all([
    db.select().from(s.products).where(where).orderBy(...orderBy(f.sort)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)` }).from(s.products).where(where),
  ]);
  return { items: await hydrateCards(rows), total: Number(count) };
}

export async function facets(f: ListFilters) {
  const base = and(...buildConditions({ ...f, size: undefined, color: undefined, minPrice: undefined, maxPrice: undefined, inStock: undefined }));
  const sub = db.select({ id: s.products.id }).from(s.products).where(base);
  const [colors, sizes, [price]] = await Promise.all([
    db.select({ name: s.productVariants.color, hex: s.productVariants.colorHex, count: sql<number>`count(distinct "product_variants"."product_id")` }).from(s.productVariants).where(inArray(s.productVariants.productId, sub)).groupBy(s.productVariants.color, s.productVariants.colorHex).orderBy(desc(sql`count(distinct "product_variants"."product_id")`)),
    db.select({ size: s.productVariants.size, count: sql<number>`count(distinct "product_variants"."product_id")` }).from(s.productVariants).where(inArray(s.productVariants.productId, sub)).groupBy(s.productVariants.size),
    db.select({ min: sql<string>`min(price)`, max: sql<string>`max(price)` }).from(s.productVariants).where(inArray(s.productVariants.productId, sub)),
  ]);
  const sizeSort = (a: string, b: string) => { const o = ["XS", "S", "M", "L", "XL", "One Size"]; const na = Number(a), nb = Number(b); if (!isNaN(na) && !isNaN(nb)) return na - nb; if (!isNaN(na)) return -1; if (!isNaN(nb)) return 1; return o.indexOf(a) - o.indexOf(b); };
  return { colors: colors.map((c) => ({ ...c, count: Number(c.count) })), sizes: sizes.map((x) => ({ ...x, count: Number(x.count) })).sort((a, b) => sizeSort(a.size, b.size)), priceRange: { min: Math.floor(num(price?.min)), max: Math.ceil(num(price?.max)) } };
}

export async function getProductBySlug(slug: string, includeDraft = false) {
  const [p] = await db.select().from(s.products).where(eq(s.products.slug, slug));
  if (!p || (!includeDraft && p.status !== "ACTIVE")) throw notFound("PRODUCT_NOT_FOUND", "Product not found");
  return getProductDetail(p);
}
export async function getProductById(id: number) {
  const [p] = await db.select().from(s.products).where(eq(s.products.id, id));
  if (!p) throw notFound("PRODUCT_NOT_FOUND", "Product not found");
  return getProductDetail(p);
}

async function getProductDetail(p: typeof s.products.$inferSelect) {
  const [variants, images, attributes, cats, cols, tags, ratingDist, brand] = await Promise.all([
    db.select({ id: s.productVariants.id, sku: s.productVariants.sku, barcode: s.productVariants.barcode, color: s.productVariants.color, colorHex: s.productVariants.colorHex, size: s.productVariants.size, price: s.productVariants.price, compareAtPrice: s.productVariants.compareAtPrice, costPrice: s.productVariants.costPrice, weightGrams: s.productVariants.weightGrams, status: s.productVariants.status, available: sql<number>`coalesce((select sum(wi.quantity_on_hand - wi.quantity_reserved) from warehouse_inventory wi join warehouses w on w.id = wi.warehouse_id where w.status='ACTIVE' and wi.variant_id = "product_variants"."id"),0)`, onHand: sql<number>`coalesce((select sum(wi.quantity_on_hand) from warehouse_inventory wi where wi.variant_id = "product_variants"."id"),0)` })
      .from(s.productVariants).where(eq(s.productVariants.productId, p.id)).orderBy(asc(s.productVariants.id)),
    db.select().from(s.productImages).where(eq(s.productImages.productId, p.id)).orderBy(asc(s.productImages.sortOrder)),
    db.select().from(s.productAttributes).where(eq(s.productAttributes.productId, p.id)),
    db.select({ id: s.categories.id, name: s.categories.name, slug: s.categories.slug }).from(s.productCategories).innerJoin(s.categories, eq(s.categories.id, s.productCategories.categoryId)).where(eq(s.productCategories.productId, p.id)),
    db.select({ id: s.collections.id, name: s.collections.name, slug: s.collections.slug }).from(s.productCollections).innerJoin(s.collections, eq(s.collections.id, s.productCollections.collectionId)).where(eq(s.productCollections.productId, p.id)),
    db.select({ tag: s.productTags.tag }).from(s.productTags).where(eq(s.productTags.productId, p.id)),
    db.select({ rating: s.reviews.rating, count: sql<number>`count(*)` }).from(s.reviews).where(and(eq(s.reviews.productId, p.id), eq(s.reviews.status, "APPROVED"))).groupBy(s.reviews.rating),
    p.brandId ? db.select().from(s.brands).where(eq(s.brands.id, p.brandId)) : Promise.resolve([]),
  ]);
  const activeVariants = variants.filter((v) => v.status === "ACTIVE");
  const prices = activeVariants.map((v) => num(v.price));
  const primaryCategory = cats.find((c) => c.id === p.primaryCategoryId) ?? cats[0] ?? null;
  return {
    ...p,
    ratingAvg: num(p.ratingAvg),
    brand: brand[0] ?? null,
    primaryCategory,
    price: prices.length ? Math.min(...prices) : 0,
    compareAtPrice: activeVariants.map((v) => num(v.compareAtPrice)).filter(Boolean).sort((a, b) => b - a)[0] ?? null,
    variants: variants.map((v) => ({ ...v, price: num(v.price), compareAtPrice: v.compareAtPrice ? num(v.compareAtPrice) : null, costPrice: v.costPrice ? num(v.costPrice) : null, available: num(v.available), onHand: num(v.onHand) })),
    colors: [...new Map(variants.map((v) => [v.color, { name: v.color, hex: v.colorHex }])).values()],
    images, attributes, categories: cats, collections: cols, tags: tags.map((t) => t.tag),
    ratingDistribution: [5, 4, 3, 2, 1].map((r) => ({ rating: r, count: Number(ratingDist.find((d) => d.rating === r)?.count ?? 0) })),
  };
}

export async function relatedProducts(productId: number, categoryId: number | null, limit = 4) {
  const cond = [eq(s.products.status, "ACTIVE"), sql`"products"."id" <> ${productId}`];
  if (categoryId) cond.push(eq(s.products.primaryCategoryId, categoryId));
  const rows = await db.select().from(s.products).where(and(...cond)).orderBy(desc(s.products.isBestSeller), desc(s.products.ratingCount)).limit(limit);
  return hydrateCards(rows);
}

export async function listCategories() {
  const rows = await db.select({ id: s.categories.id, parentId: s.categories.parentId, name: s.categories.name, slug: s.categories.slug, description: s.categories.description, imageUrl: s.categories.imageUrl, sortOrder: s.categories.sortOrder, isActive: s.categories.isActive, productCount: sql<number>`(select count(*) from product_categories pc join products p on p.id = pc.product_id where pc.category_id = "categories"."id" and p.status = 'ACTIVE')` }).from(s.categories).orderBy(asc(s.categories.sortOrder));
  return rows.map((r) => ({ ...r, productCount: Number(r.productCount) }));
}
export async function getCategory(slug: string) {
  const [c] = await db.select().from(s.categories).where(eq(s.categories.slug, slug));
  if (!c) throw notFound("CATEGORY_NOT_FOUND", "Category not found");
  const children = await db.select().from(s.categories).where(eq(s.categories.parentId, c.id)).orderBy(asc(s.categories.sortOrder));
  return { ...c, children };
}
export async function listCollections(featuredOnly = false) {
  const rows = await db.select({ id: s.collections.id, name: s.collections.name, slug: s.collections.slug, description: s.collections.description, imageUrl: s.collections.imageUrl, isFeatured: s.collections.isFeatured, isActive: s.collections.isActive, rules: s.collections.rules, sortOrder: s.collections.sortOrder, productCount: sql<number>`(select count(*) from product_collections pc join products p on p.id = pc.product_id where pc.collection_id = "collections"."id" and p.status = 'ACTIVE')` }).from(s.collections).where(featuredOnly ? eq(s.collections.isFeatured, true) : undefined).orderBy(asc(s.collections.sortOrder));
  return rows.map((r) => ({ ...r, productCount: Number(r.productCount) }));
}
export async function getCollection(slug: string) {
  const [c] = await db.select().from(s.collections).where(eq(s.collections.slug, slug));
  if (!c) throw notFound("COLLECTION_NOT_FOUND", "Collection not found");
  return c;
}

/** Resolve a storefront /collections/{handle} to either a collection, a category, or a virtual filter set. */
export async function resolveHandle(handle: string): Promise<{ kind: "collection" | "category" | "virtual"; title: string; description: string | null; imageUrl: string | null; filters: ListFilters }> {
  const virtual: Record<string, { title: string; filters: ListFilters; description: string }> = {
    all: { title: "All Products", filters: {}, description: "Everything we make, thoughtfully designed with natural materials." },
    men: { title: "Men", filters: { gender: "men" }, description: "Shoes, apparel and accessories for men." },
    women: { title: "Women", filters: { gender: "women" }, description: "Shoes, apparel and accessories for women." },
    "new-arrivals": { title: "New Arrivals", filters: { badge: "new", sort: "newest" }, description: "The latest additions to the Evergreen line-up." },
    sale: { title: "Sale", filters: { onSale: true }, description: "Limited-time prices on select styles." },
  };
  if (virtual[handle]) return { kind: "virtual", title: virtual[handle].title, description: virtual[handle].description, imageUrl: null, filters: virtual[handle].filters };
  const [col] = await db.select().from(s.collections).where(eq(s.collections.slug, handle));
  if (col) return { kind: "collection", title: col.name, description: col.description, imageUrl: col.imageUrl, filters: { collection: col.slug } };
  const [cat] = await db.select().from(s.categories).where(eq(s.categories.slug, handle));
  if (cat) return { kind: "category", title: cat.name, description: cat.description, imageUrl: cat.imageUrl, filters: { category: cat.slug } };
  throw notFound("COLLECTION_NOT_FOUND", "Collection not found");
}

// ---------- Search abstraction (swap with OpenSearch later) ----------
export interface SearchProvider {
  search(q: string, f: ListFilters, page: number, pageSize: number): Promise<{ items: ProductCard[]; total: number }>;
  suggest(q: string): Promise<{ products: { name: string; slug: string; image: string | null; price: number }[]; categories: { name: string; slug: string }[] }>;
}
export const postgresSearchProvider: SearchProvider = {
  async search(q, f, page, pageSize) {
    const r = await listProducts({ ...f, q }, page, pageSize);
    db.insert(s.searchEvents).values({ query: q.slice(0, 200), resultCount: r.total }).catch(() => {});
    return r;
  },
  async suggest(q) {
    const [prods, cats] = await Promise.all([
      db.select({ name: s.products.name, slug: s.products.slug, id: s.products.id }).from(s.products).where(and(eq(s.products.status, "ACTIVE"), ilike(s.products.name, `%${q}%`))).limit(6),
      db.select({ name: s.categories.name, slug: s.categories.slug }).from(s.categories).where(ilike(s.categories.name, `%${q}%`)).limit(4),
    ]);
    const cards = await hydrateCards(await db.select().from(s.products).where(inArray(s.products.id, prods.map((p) => p.id).concat(-1))));
    return { products: cards.map((c) => ({ name: c.name, slug: c.slug, image: c.images[0] ?? null, price: c.price })), categories: cats };
  },
};
export async function popularSearches() {
  const rows = await db.select({ query: s.searchEvents.query, c: sql<number>`count(*)` }).from(s.searchEvents).groupBy(s.searchEvents.query).orderBy(desc(sql`count(*)`)).limit(6);
  return rows.map((r) => r.query);
}
