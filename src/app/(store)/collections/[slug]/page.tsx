import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { resolveHandle } from "@/server/services/catalog";
import { ProductListing, ProductGridSkeleton } from "@/components/store/catalog";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try { const h = await resolveHandle(slug); return { title: h.title, description: h.description ?? undefined, alternates: { canonical: `/collections/${slug}` } }; } catch { return { title: "Collection" }; }
}
export default async function CollectionPage({ params }: Props) {
  const { slug } = await params;
  let h;
  try { h = await resolveHandle(slug); } catch { notFound(); }
  const base: Record<string, string> = {};
  if (h.filters.collection) base.collection = h.filters.collection;
  if (h.filters.category) base.category = h.filters.category;
  if (h.filters.gender) base.gender = h.filters.gender;
  if (h.filters.onSale) base.onSale = "true";
  if (h.filters.badge) base.badge = h.filters.badge;
  if (h.filters.sort) base.sort = h.filters.sort;
  return <Suspense fallback={<div className="container-x py-12"><ProductGridSkeleton /></div>}><ProductListing endpoint="/products" baseParams={base} title={h.title} description={h.description} /></Suspense>;
}
