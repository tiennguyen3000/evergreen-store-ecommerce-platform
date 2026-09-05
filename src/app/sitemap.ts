import type { MetadataRoute } from "next";
import { db } from "@/db";
import * as s from "@/db/schema";
import { eq } from "drizzle-orm";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const [products, cats, cols] = await Promise.all([db.select({ slug: s.products.slug, updatedAt: s.products.updatedAt }).from(s.products).where(eq(s.products.status, "ACTIVE")), db.select({ slug: s.categories.slug }).from(s.categories), db.select({ slug: s.collections.slug }).from(s.collections)]);
  return [{ url: base, priority: 1 }, { url: `${base}/sustainability` }, ...["men", "women", "new-arrivals", "sale", "all"].map((h) => ({ url: `${base}/collections/${h}`, priority: 0.8 })), ...cats.map((c) => ({ url: `${base}/collections/${c.slug}`, priority: 0.7 })), ...cols.map((c) => ({ url: `${base}/collections/${c.slug}`, priority: 0.7 })), ...products.map((p) => ({ url: `${base}/products/${p.slug}`, lastModified: p.updatedAt, priority: 0.6 }))];
}
