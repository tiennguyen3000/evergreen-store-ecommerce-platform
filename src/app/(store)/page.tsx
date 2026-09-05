import Link from "next/link";
import { ArrowRight, Leaf, Recycle, Wind } from "lucide-react";
import { hydrateCards, listCollections, listProducts } from "@/server/services/catalog";
import { ProductCard } from "@/components/store/catalog";
import { Newsletter } from "@/components/store/shell";
import { ButtonLink } from "@/components/ui";
import { db } from "@/db";
import * as s from "@/db/schema";
import { desc, eq, and } from "drizzle-orm";

export const metadata = { title: "Evergreen — Naturally better everyday essentials", alternates: { canonical: "/" } };

export default async function HomePage() {
  const [featured, best, fresh, collections] = await Promise.all([
    listProducts({ featured: true, sort: "featured" }, 1, 4),
    listProducts({ bestSeller: true, sort: "rating" }, 1, 8),
    hydrateCards(await db.select().from(s.products).where(and(eq(s.products.status, "ACTIVE"))).orderBy(desc(s.products.createdAt)).limit(4)),
    listCollections(true),
  ]);
  const cats = [
    { name: "Shoes", href: "/collections/shoes", img: "/images/products/runner.jpg", blurb: "Sneakers, runners & slip-ons" },
    { name: "Apparel", href: "/collections/apparel", img: "/images/products/hoodie.jpg", blurb: "Tees, knits & outerwear" },
    { name: "Accessories", href: "/collections/accessories", img: "/images/products/accessory.jpg", blurb: "Socks, hats & bags" },
  ];
  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-sand">
        <img src="/images/hero.jpg" alt="Walking through a misty forest trail in Evergreen sneakers" className="absolute inset-0 h-full w-full object-cover" fetchPriority="high" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/60 via-ink/20 to-transparent" />
        <div className="container-x relative flex min-h-[78vh] flex-col justify-end pb-16 pt-32 text-white sm:min-h-[84vh]">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-white/70 animate-fade-up">New season · Made from trees, wool & sugarcane</p>
          <h1 className="max-w-2xl font-display text-5xl leading-[1.02] sm:text-7xl animate-fade-up" style={{ animationDelay: "80ms" }}>Comfort that treads lightly.</h1>
          <p className="mt-5 max-w-lg text-base text-white/85 sm:text-lg animate-fade-up" style={{ animationDelay: "160ms" }}>Shoes and essentials crafted from natural, renewable materials — engineered for all-day ease and a lighter footprint.</p>
          <div className="mt-8 flex flex-wrap gap-3 animate-fade-up" style={{ animationDelay: "240ms" }}>
            <ButtonLink href="/collections/men" size="lg" className="bg-white text-ink hover:bg-sand">Shop Men</ButtonLink>
            <ButtonLink href="/collections/women" size="lg" className="border border-white/60 bg-transparent text-white hover:bg-white/10">Shop Women</ButtonLink>
          </div>
        </div>
      </section>

      {/* Featured categories */}
      <section className="container-x py-16 sm:py-24">
        <div className="mb-8 flex items-end justify-between"><h2 className="font-display text-3xl sm:text-4xl">Shop by category</h2><Link href="/collections/all" className="hidden items-center gap-1 text-sm font-medium hover:text-forest sm:flex">View all <ArrowRight className="h-4 w-4" /></Link></div>
        <div className="grid gap-4 sm:grid-cols-3">
          {cats.map((c) => (
            <Link key={c.name} href={c.href} className="group relative aspect-[4/5] overflow-hidden rounded-3xl bg-sand sm:aspect-[3/4]">
              <img src={c.img} alt={c.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 to-transparent p-6 text-white"><p className="font-display text-2xl">{c.name}</p><p className="text-sm text-white/80">{c.blurb}</p></div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured products */}
      <section className="bg-white py-16 sm:py-24">
        <div className="container-x">
          <div className="mb-8 flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone">Featured</p><h2 className="mt-1 font-display text-3xl sm:text-4xl">Editor's picks</h2></div><Link href="/collections/best-sellers" className="hidden items-center gap-1 text-sm font-medium hover:text-forest sm:flex">Shop best sellers <ArrowRight className="h-4 w-4" /></Link></div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">{featured.items.map((p, i) => <ProductCard key={p.id} p={p} priority={i < 2} />)}</div>
        </div>
      </section>

      {/* Sustainability story */}
      <section className="container-x grid items-center gap-10 py-16 sm:py-24 lg:grid-cols-2" id="story">
        <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-sand lg:order-2"><img src="/images/sustainability.jpg" alt="Merino sheep on green hills" loading="lazy" className="h-full w-full object-cover" /></div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-moss">Our approach</p>
          <h2 className="mt-2 font-display text-3xl sm:text-5xl">Nature makes the best materials. We just listen.</h2>
          <p className="mt-4 max-w-lg text-stone">Merino wool that regulates temperature. Eucalyptus fiber that breathes. Sugarcane foam that bounces back. Every Evergreen product is designed around what renewable materials do best — then measured, labeled and offset.</p>
          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            {[{ i: Leaf, t: "Renewable inputs", d: "83% of our materials are natural or recycled." }, { i: Wind, t: "Carbon neutral", d: "Every order offset. Footprint on every label." }, { i: Recycle, t: "Circular by design", d: "Take-back program and repairable soles." }].map((f) => <div key={f.t}><f.i className="h-5 w-5 text-forest" /><p className="mt-2 text-sm font-semibold">{f.t}</p><p className="text-xs text-stone">{f.d}</p></div>)}
          </div>
          <ButtonLink href="/sustainability" variant="outline" className="mt-8">Read our sustainability story</ButtonLink>
        </div>
      </section>

      {/* Best sellers */}
      <section className="bg-white py-16 sm:py-24">
        <div className="container-x">
          <div className="mb-8 flex items-end justify-between"><h2 className="font-display text-3xl sm:text-4xl">Best sellers</h2><Link href="/collections/best-sellers" className="text-sm font-medium hover:text-forest">View all →</Link></div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">{best.items.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        </div>
      </section>

      {/* Editorial / collections */}
      <section className="container-x py-16 sm:py-24">
        <div className="mb-8"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone">Editorial</p><h2 className="mt-1 font-display text-3xl sm:text-4xl">Collections worth a closer look</h2></div>
        <div className="flex snap-x gap-4 overflow-x-auto pb-4 no-scrollbar">
          {collections.map((c) => (
            <Link key={c.id} href={`/collections/${c.slug}`} className="group relative aspect-[3/4] w-64 shrink-0 snap-start overflow-hidden rounded-3xl bg-sand sm:w-72">
              <img src={c.imageUrl ?? "/images/products/runner.jpg"} alt={c.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-x-0 bottom-0 p-5 text-white"><div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" /><p className="relative font-display text-2xl">{c.name}</p><p className="relative text-xs text-white/80">{c.productCount} styles</p></div>
            </Link>
          ))}
        </div>
      </section>

      {/* New arrivals */}
      <section className="container-x pb-16 sm:pb-24">
        <div className="mb-8 flex items-end justify-between"><h2 className="font-display text-3xl sm:text-4xl">New arrivals</h2><Link href="/collections/new-arrivals" className="text-sm font-medium hover:text-forest">View all →</Link></div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">{fresh.map((p) => <ProductCard key={p.id} p={p} />)}</div>
      </section>

      {/* Promo banner */}
      <section className="container-x pb-16 sm:pb-24">
        <div className="relative overflow-hidden rounded-3xl bg-clay px-8 py-14 text-white sm:px-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Limited time</p>
          <h2 className="mt-2 max-w-xl font-display text-3xl sm:text-5xl">Take 10% off your first order with code <span className="whitespace-nowrap rounded-lg bg-white/15 px-2">WELCOME10</span></h2>
          <ButtonLink href="/collections/sale" className="mt-8 bg-white text-clay hover:bg-sand">Shop the sale</ButtonLink>
        </div>
      </section>
      <Newsletter />
    </>
  );
}
