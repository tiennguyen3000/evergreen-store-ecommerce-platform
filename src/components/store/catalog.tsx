"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Heart, SlidersHorizontal, X, Plus } from "lucide-react";
import { Badge, Button, Checkbox, Dialog, EmptyState, ErrorState, Pagination, Select, Skeleton, Stars } from "@/components/ui";
import { get, qs } from "@/lib/api";
import { useCartMutations, useWishlistIds, useWishlistToggle } from "@/lib/hooks";
import { cn, formatMoney } from "@/lib/utils";

export type Card = { id: number; slug: string; name: string; category: string | null; price: number; compareAtPrice: number | null; images: string[]; colors: { name: string; hex: string }[]; sizes: string[]; available: number; badges: string[]; ratingAvg: number; ratingCount: number };

const badgeTone = (b: string): "danger" | "success" | "warning" | "dark" | "neutral" => (b === "SALE" ? "danger" : b === "NEW" ? "success" : b === "LOW STOCK" ? "warning" : b === "SOLD OUT" ? "dark" : "neutral");

export function ProductCard({ p, priority }: { p: Card; priority?: boolean }) {
  const [quick, setQuick] = useState(false);
  const { data: wishIds } = useWishlistIds();
  const wish = useWishlistToggle();
  const saved = wishIds?.includes(p.id);
  return (
    <div className="group relative flex flex-col animate-fade-up">
      <Link href={`/products/${p.slug}`} className="relative block aspect-[4/5] overflow-hidden rounded-2xl bg-sand">
        <img src={p.images[0]} alt={p.name} loading={priority ? "eager" : "lazy"} className={cn("h-full w-full object-cover transition-all duration-500", p.images[1] && "group-hover:opacity-0")} />
        {p.images[1] && <img src={p.images[1]} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100" />}
        <div className="absolute left-3 top-3 flex flex-col gap-1">{p.badges.slice(0, 2).map((b) => <Badge key={b} tone={badgeTone(b)} className="bg-white/90 backdrop-blur">{b}</Badge>)}</div>
      </Link>
      <button onClick={() => wish.mutate(p.id)} className={cn("absolute right-3 top-3 rounded-full bg-white/90 p-2 shadow-sm backdrop-blur transition hover:scale-105", saved && "text-clay")} aria-label={saved ? "Remove from wishlist" : "Add to wishlist"}>
        <Heart className={cn("h-4 w-4", saved && "fill-current")} />
      </button>
      {p.available > 0 && (
        <button onClick={() => setQuick(true)} className="absolute bottom-[calc(100%*0.2+4.5rem)] left-1/2 hidden -translate-x-1/2 translate-y-2 items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold opacity-0 shadow-lg transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 lg:inline-flex" style={{ bottom: "calc(4.75rem + 12px)" }}>
          <Plus className="h-3.5 w-3.5" /> Quick add
        </button>
      )}
      <div className="mt-3 flex flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <Link href={`/products/${p.slug}`} className="text-sm font-medium leading-snug hover:text-forest">{p.name}</Link>
          <div className="shrink-0 text-right text-sm">{p.compareAtPrice ? <><span className="text-clay">{formatMoney(p.price)}</span> <span className="ml-1 text-stone line-through">{formatMoney(p.compareAtPrice)}</span></> : formatMoney(p.price)}</div>
        </div>
        <div className="flex items-center justify-between text-xs text-stone">
          <span>{p.category}</span>
          {p.ratingCount > 0 && <span className="flex items-center gap-1"><Stars value={p.ratingAvg} /> ({p.ratingCount})</span>}
        </div>
        <div className="mt-1 flex items-center gap-1.5">{p.colors.slice(0, 6).map((c) => <span key={c.name} title={c.name} className="h-3.5 w-3.5 rounded-full ring-1 ring-ink/10" style={{ background: c.hex }} />)}{p.colors.length > 6 && <span className="text-[10px] text-stone">+{p.colors.length - 6}</span>}</div>
        <p className="text-[11px] text-stone">{p.available === 0 ? "Sold out" : `${p.sizes.length} sizes available`}</p>
      </div>
      {quick && <QuickAdd slug={p.slug} onClose={() => setQuick(false)} />}
    </div>
  );
}

function QuickAdd({ slug, onClose }: { slug: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({ queryKey: ["product", slug], queryFn: async () => (await get(`/products/${slug}`)).data });
  const { add } = useCartMutations();
  const [color, setColor] = useState<string | null>(null);
  const p = data;
  const activeColor = color ?? p?.colors?.[0]?.name;
  const variants = p?.variants?.filter((v: any) => v.color === activeColor && v.status === "ACTIVE") ?? [];
  return (
    <Dialog open onClose={onClose} title={p?.name ?? "Quick add"}>
      {isLoading || !p ? <div className="space-y-3"><Skeleton className="h-6 w-1/2" /><Skeleton className="h-10 w-full" /></div> : (
        <div className="flex gap-4">
          <img src={p.images.find((i: any) => i.color === activeColor)?.url ?? p.images[0]?.url} alt="" className="hidden h-40 w-32 rounded-xl bg-sand object-cover sm:block" />
          <div className="flex-1">
            <p className="text-sm text-stone">{formatMoney(p.price)}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-stone">Color · {activeColor}</p>
            <div className="mt-2 flex flex-wrap gap-2">{p.colors.map((c: any) => <button key={c.name} onClick={() => setColor(c.name)} className={cn("h-7 w-7 rounded-full ring-2 ring-offset-2", activeColor === c.name ? "ring-ink" : "ring-transparent hover:ring-ink/30")} style={{ background: c.hex }} aria-label={c.name} />)}</div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-stone">Select size</p>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {variants.map((v: any) => <button key={v.id} disabled={v.available <= 0} onClick={() => { add.mutate({ variantId: v.id, quantity: 1 }, { onSuccess: onClose }); }} className="rounded-lg border border-ink/15 py-2 text-sm hover:border-ink disabled:cursor-not-allowed disabled:opacity-30 disabled:line-through">{v.size}</button>)}
            </div>
            <Link href={`/products/${slug}`} className="mt-4 inline-block text-xs underline underline-offset-4">View full details</Link>
          </div>
        </div>
      )}
    </Dialog>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 xl:grid-cols-4">{Array.from({ length: count }).map((_, i) => <div key={i}><Skeleton className="aspect-[4/5] rounded-2xl" /><Skeleton className="mt-3 h-4 w-3/4" /><Skeleton className="mt-2 h-3 w-1/3" /></div>)}</div>;
}

const SORTS = [["featured", "Featured"], ["newest", "Newest"], ["best_selling", "Best selling"], ["price_asc", "Price: low to high"], ["price_desc", "Price: high to low"], ["rating", "Top rated"]];

/** URL-state-driven product listing used by collections and search. */
export function ProductListing({ endpoint, baseParams = {}, title, description, emptyTitle = "No products found", emptyDescription = "Try adjusting your filters." }: { endpoint: "/products" | "/search"; baseParams?: Record<string, string>; title: string; description?: string | null; emptyTitle?: string; emptyDescription?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const params = useMemo(() => {
    const o: Record<string, string> = { ...baseParams };
    sp.forEach((v, k) => { o[k] = v; });
    return o;
  }, [sp, baseParams]);
  const query = qs(params);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: [endpoint, query], queryFn: () => get<Card[]>(`${endpoint}${query}`), placeholderData: (prev) => prev });
  const setParam = useCallback((k: string, v: string | null) => {
    const next = new URLSearchParams(sp.toString());
    if (v == null || v === "") next.delete(k); else next.set(k, v);
    if (k !== "page") next.delete("page");
    router.push(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: k === "page" });
  }, [sp, router, pathname]);
  const toggleList = (k: string, v: string) => { const cur = (sp.get(k) ?? "").split(",").filter(Boolean); const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]; setParam(k, next.join(",") || null); };
  const facets = data?.meta?.facets;
  const total = data?.meta?.total ?? 0;
  const active = ["size", "color", "minPrice", "maxPrice", "inStock", "onSale", "gender", "type"].filter((k) => sp.get(k));
  const clearAll = () => router.push(pathname);

  const FilterPanel = (
    <div className="space-y-7 text-sm">
      {active.length > 0 && <button onClick={clearAll} className="text-xs font-medium text-clay underline-offset-4 hover:underline">Clear all filters ({active.length})</button>}
      {!baseParams.gender && (
        <fieldset><legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone">Shop for</legend><div className="flex gap-2">{[["all", "All"], ["men", "Men"], ["women", "Women"]].map(([v, l]) => <button key={v} onClick={() => setParam("gender", v === "all" ? null : v)} className={cn("rounded-full border px-3 py-1 text-xs", (sp.get("gender") ?? "all") === v ? "border-ink bg-ink text-white" : "border-ink/15 hover:border-ink")}>{l}</button>)}</div></fieldset>
      )}
      {!baseParams.type && !baseParams.category && (
        <fieldset><legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone">Category</legend><div className="space-y-1.5">{[["shoes", "Shoes"], ["apparel", "Apparel"], ["accessories", "Accessories"]].map(([v, l]) => <Checkbox key={v} label={l} checked={sp.get("type") === v} onChange={() => setParam("type", sp.get("type") === v ? null : v)} />)}</div></fieldset>
      )}
      <fieldset><legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone">Availability</legend><div className="space-y-1.5"><Checkbox label="In stock only" checked={sp.get("inStock") === "true"} onChange={(e) => setParam("inStock", e.target.checked ? "true" : null)} /><Checkbox label="On sale" checked={sp.get("onSale") === "true"} onChange={(e) => setParam("onSale", e.target.checked ? "true" : null)} /></div></fieldset>
      {facets?.sizes?.length > 0 && (
        <fieldset><legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone">Size</legend><div className="flex flex-wrap gap-1.5">{facets.sizes.map((s: any) => { const on = (sp.get("size") ?? "").split(",").includes(s.size); return <button key={s.size} onClick={() => toggleList("size", s.size)} className={cn("min-w-[2.5rem] rounded-md border px-2 py-1.5 text-xs", on ? "border-ink bg-ink text-white" : "border-ink/15 hover:border-ink")}>{s.size}</button>; })}</div></fieldset>
      )}
      {facets?.colors?.length > 0 && (
        <fieldset><legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone">Color</legend><div className="flex flex-wrap gap-2">{facets.colors.map((c: any) => { const on = (sp.get("color") ?? "").toLowerCase().split(",").includes(c.name.toLowerCase()); return <button key={c.name} title={`${c.name} (${c.count})`} onClick={() => toggleList("color", c.name)} className={cn("h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-bone", on ? "ring-ink" : "ring-ink/10 hover:ring-ink/40")} style={{ background: c.hex }} aria-label={c.name} aria-pressed={on} />; })}</div></fieldset>
      )}
      {facets?.priceRange && (
        <fieldset><legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone">Price</legend><div className="flex items-center gap-2"><input type="number" placeholder={String(facets.priceRange.min)} defaultValue={sp.get("minPrice") ?? ""} onBlur={(e) => setParam("minPrice", e.target.value || null)} className="h-9 w-full rounded-md border border-ink/15 px-2 text-sm" aria-label="Min price" /><span className="text-stone">–</span><input type="number" placeholder={String(facets.priceRange.max)} defaultValue={sp.get("maxPrice") ?? ""} onBlur={(e) => setParam("maxPrice", e.target.value || null)} className="h-9 w-full rounded-md border border-ink/15 px-2 text-sm" aria-label="Max price" /></div></fieldset>
      )}
    </div>
  );

  return (
    <div className="container-x py-8 sm:py-12">
      <div className="mb-8 max-w-2xl"><h1 className="font-display text-3xl sm:text-4xl">{title}</h1>{description && <p className="mt-2 text-stone">{description}</p>}</div>
      <div className="mb-6 flex items-center justify-between gap-3 border-b border-ink/10 pb-4">
        <p className="text-sm text-stone">{isLoading ? "Loading…" : `${total} product${total === 1 ? "" : "s"}`}</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setFiltersOpen(true)}><SlidersHorizontal className="h-4 w-4" /> Filters{active.length > 0 && ` (${active.length})`}</Button>
          <Select value={sp.get("sort") ?? baseParams.sort ?? "featured"} onChange={(e) => setParam("sort", e.target.value)} className="h-9 w-auto text-xs" aria-label="Sort by">{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
        </div>
      </div>
      {active.length > 0 && <div className="mb-5 flex flex-wrap gap-2">{active.map((k) => <button key={k} onClick={() => setParam(k, null)} className="flex items-center gap-1 rounded-full bg-ink/5 px-3 py-1 text-xs hover:bg-ink/10">{k === "inStock" ? "In stock" : k === "onSale" ? "On sale" : `${k}: ${sp.get(k)}`}<X className="h-3 w-3" /></button>)}</div>}
      <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block"><div className="sticky top-28">{FilterPanel}</div></aside>
        <div>
          {isError ? <ErrorState retry={() => refetch()} /> : isLoading && !data ? <ProductGridSkeleton /> : data && data.data.length === 0 ? <EmptyState title={emptyTitle} description={emptyDescription} action={<Button variant="outline" onClick={clearAll}>Clear filters</Button>} /> : (
            <>
              <div className={cn("grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4", isLoading && "opacity-60")}>{data!.data.map((p, i) => <ProductCard key={p.id} p={p} priority={i < 4} />)}</div>
              <div className="mt-12"><Pagination page={data!.meta.page} totalPages={data!.meta.totalPages} onChange={(p) => setParam("page", String(p))} /></div>
            </>
          )}
        </div>
      </div>
      <Dialog open={filtersOpen} onClose={() => setFiltersOpen(false)} side="left" title="Filters">{FilterPanel}<Button className="mt-8 w-full" onClick={() => setFiltersOpen(false)}>Show {total} results</Button></Dialog>
    </div>
  );
}
