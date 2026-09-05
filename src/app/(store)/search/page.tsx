import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductListing, ProductGridSkeleton } from "@/components/store/catalog";
import { SearchHero } from "./search-hero";

type Props = { searchParams: Promise<{ q?: string }> };
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> { const { q } = await searchParams; return { title: q ? `Search: ${q}` : "Search", robots: { index: false } }; }
export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  if (!q) return <SearchHero />;
  return <Suspense fallback={<div className="container-x py-12"><ProductGridSkeleton /></div>}><ProductListing endpoint="/search" title={`Results for “${q}”`} emptyTitle={`No results for “${q}”`} emptyDescription="Check the spelling or try a broader term like “runner”, “wool” or “hoodie”." /></Suspense>;
}
