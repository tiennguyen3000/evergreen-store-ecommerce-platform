"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Heart, Truck, RotateCcw, Leaf, ChevronDown, Minus, Plus, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge, Button, Stars, Skeleton } from "@/components/ui";
import { ProductCard, type Card } from "@/components/store/catalog";
import { useCartMutations, useMe, useWishlistIds, useWishlistToggle } from "@/lib/hooks";
import { get } from "@/lib/api";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import { useLocal } from "@/stores/ui";

export function ProductView({ product: p, related, initialReviews }: { product: any; related: Card[]; initialReviews: { items: any[]; total: number } }) {
  const router = useRouter();
  const { add } = useCartMutations();
  const { data: me } = useMe();
  const { data: wishIds } = useWishlistIds();
  const wish = useWishlistToggle();
  const { recentlyViewed, addRecentlyViewed } = useLocal();
  const [color, setColor] = useState<string>(p.colors[0]?.name);
  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [imgIdx, setImgIdx] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string>("description");
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  useEffect(() => { addRecentlyViewed(p.slug); }, [p.slug, addRecentlyViewed]);
  const images = useMemo(() => { const forColor = p.images.filter((i: any) => i.color === color); return forColor.length ? forColor : p.images; }, [p.images, color]);
  useEffect(() => setImgIdx(0), [color]);
  const variants = p.variants.filter((v: any) => v.color === color && v.status === "ACTIVE");
  const selected = variants.find((v: any) => v.size === size);
  const price = selected?.price ?? Math.min(...(variants.length ? variants : p.variants).map((v: any) => v.price));
  const compare = selected?.compareAtPrice ?? p.compareAtPrice;
  const stockLabel = !selected ? null : selected.available <= 0 ? "Out of stock" : selected.available <= 5 ? `Only ${selected.available} left` : "In stock";
  const saved = wishIds?.includes(p.id);
  const sizeSort = (a: string, b: string) => { const order = ["XS", "S", "M", "L", "XL"]; return !isNaN(Number(a)) && !isNaN(Number(b)) ? Number(a) - Number(b) : order.indexOf(a) - order.indexOf(b); };
  const doAdd = (buyNow = false) => {
    if (!selected) { setError("Please select a size"); return; }
    setError(null);
    add.mutate({ variantId: selected.id, quantity: qty }, { onSuccess: () => buyNow && router.push("/checkout") });
  };
  const { data: recent } = useQuery({ queryKey: ["recent", recentlyViewed.join(",")], queryFn: async () => { const slugs = recentlyViewed.filter((x) => x !== p.slug).slice(0, 4); const r = await Promise.all(slugs.map((sl) => get(`/products/${sl}`).then((x) => x.data).catch(() => null))); return r.filter(Boolean); }, enabled: recentlyViewed.length > 1 });
  const { data: reviewsData } = useQuery({ queryKey: ["reviews", p.slug], queryFn: async () => (await get(`/products/${p.slug}/reviews?pageSize=6`)), initialData: { data: initialReviews.items, meta: { total: initialReviews.total } } });

  const AddBar = ({ mobile }: { mobile?: boolean }) => (
    <div className={cn("flex gap-2", mobile && "fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-white/95 p-3 backdrop-blur lg:hidden")}>
      {mobile && <div className="flex flex-col justify-center pr-2"><span className="text-xs text-stone">{selected ? `${color} / ${size}` : "Select size"}</span><span className="text-sm font-semibold">{formatMoney(price * qty)}</span></div>}
      <Button size="lg" className="flex-1" onClick={() => doAdd(false)} loading={add.isPending} disabled={selected && selected.available <= 0}>{selected && selected.available <= 0 ? "Sold out" : "Add to bag"}</Button>
      {!mobile && <Button size="lg" variant="secondary" className="flex-1" onClick={() => doAdd(true)} disabled={selected && selected.available <= 0}>Buy now</Button>}
    </div>
  );

  return (
    <div className="container-x pb-28 pt-6 sm:pt-10 lg:pb-16">
      <nav className="mb-6 text-xs text-stone" aria-label="Breadcrumb"><Link href="/" className="hover:text-ink">Home</Link> / {p.primaryCategory && <><Link href={`/collections/${p.primaryCategory.slug}`} className="hover:text-ink">{p.primaryCategory.name}</Link> / </>}<span className="text-ink">{p.name}</span></nav>
      <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
        {/* Gallery */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="relative aspect-[4/5] cursor-zoom-in overflow-hidden rounded-3xl bg-sand" onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 }); }} onMouseLeave={() => setZoom(null)}>
            <img src={images[imgIdx]?.url} alt={images[imgIdx]?.altText ?? p.name} className="h-full w-full object-cover transition-transform duration-200" style={zoom ? { transform: "scale(1.8)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined} />
            <div className="absolute left-4 top-4 flex gap-1">{p.isBestSeller && <Badge tone="dark">Best seller</Badge>}{compare && <Badge tone="danger">Sale</Badge>}</div>
          </div>
          {images.length > 1 && <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">{images.map((im: any, i: number) => <button key={im.id} onClick={() => setImgIdx(i)} className={cn("h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-sand ring-2 ring-offset-2", i === imgIdx ? "ring-ink" : "ring-transparent")}><img src={im.url} alt="" className="h-full w-full object-cover" /></button>)}</div>}
        </div>
        {/* Purchase panel */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone">{p.primaryCategory?.name}</p>
          <h1 className="mt-1 font-display text-3xl sm:text-4xl">{p.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p className="text-lg">{compare ? <><span className="text-clay">{formatMoney(price)}</span> <span className="ml-1 text-stone line-through">{formatMoney(compare)}</span></> : formatMoney(price)}</p>
            {p.ratingCount > 0 ? <a href="#reviews" className="flex items-center gap-1.5 text-sm text-stone hover:text-ink"><Stars value={p.ratingAvg} /> {p.ratingAvg.toFixed(1)} ({p.ratingCount} reviews)</a> : <span className="text-sm text-stone">No reviews yet</span>}
          </div>
          <p className="mt-4 text-stone">{p.shortDescription}</p>
          <div className="mt-7">
            <p className="text-xs font-semibold uppercase tracking-wider">Color <span className="ml-1 font-normal normal-case text-stone">— {color}</span></p>
            <div className="mt-2.5 flex flex-wrap gap-2.5">{p.colors.map((c: any) => <button key={c.name} onClick={() => { setColor(c.name); setSize(null); }} className={cn("h-9 w-9 rounded-full ring-2 ring-offset-2 ring-offset-bone transition", color === c.name ? "ring-ink" : "ring-ink/10 hover:ring-ink/40")} style={{ background: c.hex }} aria-label={c.name} aria-pressed={color === c.name} />)}</div>
          </div>
          <div className="mt-7">
            <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider">Size {size && <span className="ml-1 font-normal normal-case text-stone">— {size}</span>}</p><button onClick={() => setShowSizeGuide(!showSizeGuide)} className="text-xs underline underline-offset-4">Size guide</button></div>
            {showSizeGuide && <p className="mt-2 rounded-lg bg-sand/70 p-3 text-xs text-ink/80">{p.productType === "shoes" ? "Runs true to size. Between sizes? Size down for knit uppers and up for wool styles." : "Relaxed fit. Take your usual size for the intended silhouette, or size down for a trimmer look."} <Link href="/help#sizing" className="underline">Full guide</Link></p>}
            <div className="mt-2.5 grid grid-cols-4 gap-2 sm:grid-cols-5">
              {[...variants].sort((a: any, b: any) => sizeSort(a.size, b.size)).map((v: any) => <button key={v.id} onClick={() => { setSize(v.size); setError(null); setQty(1); }} disabled={v.available <= 0} className={cn("relative h-11 rounded-lg border text-sm transition", size === v.size ? "border-ink bg-ink text-white" : "border-ink/15 hover:border-ink", v.available <= 0 && "cursor-not-allowed text-stone/60 line-through hover:border-ink/15")} aria-pressed={size === v.size}>{v.size}{v.available > 0 && v.available <= 5 && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-amber-500" />}</button>)}
            </div>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            {stockLabel && <p className={cn("mt-2 text-sm", selected.available <= 0 ? "text-red-600" : selected.available <= 5 ? "text-amber-700" : "text-emerald-700")}>{stockLabel}</p>}
          </div>
          <div className="mt-7 flex items-center gap-3">
            <div className="flex h-12 items-center rounded-full border border-ink/15"><button className="px-3.5" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Decrease quantity"><Minus className="h-4 w-4" /></button><span className="w-6 text-center text-sm">{qty}</span><button className="px-3.5 disabled:opacity-30" disabled={selected ? qty >= Math.min(10, selected.available) : qty >= 10} onClick={() => setQty(qty + 1)} aria-label="Increase quantity"><Plus className="h-4 w-4" /></button></div>
            <button onClick={() => (me ? wish.mutate(p.id) : router.push(`/login?next=/products/${p.slug}`))} className={cn("flex h-12 w-12 items-center justify-center rounded-full border border-ink/15 hover:border-ink", saved && "border-clay text-clay")} aria-label="Save to wishlist"><Heart className={cn("h-5 w-5", saved && "fill-current")} /></button>
          </div>
          <div className="mt-4 hidden lg:block"><AddBar /></div>
          <ul className="mt-7 space-y-2.5 text-sm text-ink/80">
            <li className="flex items-center gap-2.5"><Truck className="h-4 w-4 text-forest" /> Free carbon-neutral shipping over $100 · arrives in 4–7 days</li>
            <li className="flex items-center gap-2.5"><RotateCcw className="h-4 w-4 text-forest" /> 30-day free returns, even if worn</li>
            <li className="flex items-center gap-2.5"><ShieldCheck className="h-4 w-4 text-forest" /> Secure checkout · Mock payments in development</li>
          </ul>
          <div className="mt-8 divide-y divide-ink/10 border-y border-ink/10">
            {[["description", "Description", p.description], ["materials", "Materials & care", `${p.material ?? ""}\n\n${p.careInstructions ?? ""}`], ["specs", "Specifications", Object.entries(p.specifications ?? {}).map(([k, v]) => `${k}: ${v}`).join("\n")], ["sustainability", "Sustainability", p.sustainabilityDescription]].map(([k, label, body]) => (
              <div key={k as string}>
                <button onClick={() => setOpen(open === k ? "" : (k as string))} className="flex w-full items-center justify-between py-4 text-left text-sm font-medium" aria-expanded={open === k}><span className="flex items-center gap-2">{k === "sustainability" && <Leaf className="h-4 w-4 text-forest" />}{label as string}</span><ChevronDown className={cn("h-4 w-4 transition", open === k && "rotate-180")} /></button>
                {open === k && <div className="whitespace-pre-line pb-5 text-sm leading-relaxed text-ink/75 animate-fade-in">{(body as string) || "—"}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reviews */}
      <section id="reviews" className="mt-20 grid gap-10 border-t border-ink/10 pt-14 lg:grid-cols-[300px_1fr]">
        <div>
          <h2 className="font-display text-3xl">Reviews</h2>
          <div className="mt-3 flex items-center gap-2"><span className="font-display text-5xl">{p.ratingAvg.toFixed(1)}</span><div><Stars value={p.ratingAvg} size="md" /><p className="text-xs text-stone">{p.ratingCount} verified reviews</p></div></div>
          <ul className="mt-5 space-y-1.5">{p.ratingDistribution.map((d: any) => <li key={d.rating} className="flex items-center gap-2 text-xs"><span className="w-3">{d.rating}</span><div className="h-1.5 flex-1 rounded-full bg-ink/8"><div className="h-full rounded-full bg-forest" style={{ width: `${p.ratingCount ? (d.count / p.ratingCount) * 100 : 0}%` }} /></div><span className="w-6 text-right text-stone">{d.count}</span></li>)}</ul>
          <p className="mt-6 text-xs text-stone">Purchased this item? Leave a review from <Link href="/account/orders" className="underline">your orders</Link>.</p>
        </div>
        <div className="space-y-6">
          {reviewsData?.data?.length ? reviewsData.data.map((r: any) => (
            <article key={r.id} className="border-b border-ink/5 pb-6"><div className="flex items-center justify-between"><Stars value={r.rating} /><span className="text-xs text-stone">{formatDate(r.createdAt)}</span></div><h3 className="mt-2 font-medium">{r.title}</h3><p className="mt-1 text-sm text-ink/75">{r.comment}</p><p className="mt-2 text-xs text-stone">{r.author}{r.isVerifiedPurchase && <span className="ml-2 text-forest">✓ Verified purchase</span>}</p></article>
          )) : <p className="text-sm text-stone">Be the first to review this product.</p>}
        </div>
      </section>

      {related.length > 0 && <section className="mt-20"><h2 className="mb-6 font-display text-3xl">You may also like</h2><div className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">{related.map((r) => <ProductCard key={r.id} p={r} />)}</div></section>}
      {recent && recent.length > 0 && <section className="mt-20"><h2 className="mb-6 font-display text-3xl">Recently viewed</h2><div className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">{recent.map((r: any) => <Link key={r.id} href={`/products/${r.slug}`} className="group"><div className="aspect-[4/5] overflow-hidden rounded-2xl bg-sand"><img src={r.images[0]?.url} alt={r.name} className="h-full w-full object-cover transition group-hover:scale-105" /></div><p className="mt-2 text-sm font-medium">{r.name}</p><p className="text-sm text-stone">{formatMoney(r.price)}</p></Link>)}</div></section>}
      {!recent && recentlyViewed.length > 1 && <div className="mt-20"><Skeleton className="h-6 w-40" /></div>}
      <AddBar mobile />
    </div>
  );
}
