"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Heart, Menu, Search, ShoppingBag, User, X, Minus, Plus, Trash2, Leaf, ChevronRight } from "lucide-react";
import { Button, ButtonLink, Dialog, Input } from "@/components/ui";
import { useCart, useCartMutations, useLogout, useMe } from "@/lib/hooks";
import { get, post } from "@/lib/api";
import { formatMoney, cn } from "@/lib/utils";
import { useLocal, useUi } from "@/stores/ui";

export const NAV = [
  { label: "Men", href: "/collections/men" }, { label: "Women", href: "/collections/women" }, { label: "Shoes", href: "/collections/shoes" }, { label: "Apparel", href: "/collections/apparel" },
  { label: "Accessories", href: "/collections/accessories" }, { label: "New Arrivals", href: "/collections/new-arrivals" }, { label: "Sale", href: "/collections/sale", accent: true },
];
const MEGA: Record<string, { title: string; links: { label: string; href: string }[] }[]> = {
  Men: [{ title: "Shoes", links: [{ label: "Sneakers", href: "/collections/sneakers?gender=men" }, { label: "Running", href: "/collections/running?gender=men" }, { label: "Slip-Ons", href: "/collections/slip-ons?gender=men" }, { label: "Boots", href: "/collections/boots?gender=men" }] }, { title: "Apparel", links: [{ label: "Tees & Tops", href: "/collections/tees?gender=men" }, { label: "Sweatshirts", href: "/collections/sweatshirts?gender=men" }, { label: "Bottoms", href: "/collections/bottoms?gender=men" }, { label: "Outerwear", href: "/collections/outerwear?gender=men" }] }],
  Women: [{ title: "Shoes", links: [{ label: "Sneakers", href: "/collections/sneakers?gender=women" }, { label: "Running", href: "/collections/running?gender=women" }, { label: "Slip-Ons", href: "/collections/slip-ons?gender=women" }, { label: "Boots", href: "/collections/boots?gender=women" }] }, { title: "Apparel", links: [{ label: "Tees & Tops", href: "/collections/tees?gender=women" }, { label: "Sweatshirts", href: "/collections/sweatshirts?gender=women" }, { label: "Bottoms", href: "/collections/bottoms?gender=women" }, { label: "Outerwear", href: "/collections/outerwear?gender=women" }] }],
  Shoes: [{ title: "By style", links: [{ label: "Sneakers", href: "/collections/sneakers" }, { label: "Running", href: "/collections/running" }, { label: "Slip-Ons", href: "/collections/slip-ons" }, { label: "Boots", href: "/collections/boots" }] }, { title: "Collections", links: [{ label: "Trail Ready", href: "/collections/trail-ready" }, { label: "Wool Essentials", href: "/collections/wool-essentials" }, { label: "Best Sellers", href: "/collections/best-sellers" }] }],
  Apparel: [{ title: "Categories", links: [{ label: "Tees & Tops", href: "/collections/tees" }, { label: "Sweatshirts & Knits", href: "/collections/sweatshirts" }, { label: "Bottoms", href: "/collections/bottoms" }, { label: "Outerwear", href: "/collections/outerwear" }] }, { title: "Collections", links: [{ label: "Everyday Basics", href: "/collections/everyday-basics" }, { label: "Wool Essentials", href: "/collections/wool-essentials" }] }],
  Accessories: [{ title: "Categories", links: [{ label: "Socks", href: "/collections/socks" }, { label: "Hats & Scarves", href: "/collections/hats" }, { label: "Bags", href: "/collections/bags" }, { label: "Shoe Care", href: "/collections/care" }] }, { title: "Gifting", links: [{ label: "Gifts Under $50", href: "/collections/gifts-under-50" }] }],
};

export const Logo = ({ className, light }: { className?: string; light?: boolean }) => (
  <Link href="/" className={cn("flex items-center gap-2", className)} aria-label="Evergreen home">
    <span className={cn("flex h-8 w-8 items-center justify-center rounded-full", light ? "bg-white/15" : "bg-forest")}><Leaf className="h-4 w-4 text-white" /></span>
    <span className={cn("font-display text-xl tracking-tight", light && "text-white")}>Evergreen</span>
  </Link>
);

export function Header({ announcement }: { announcement?: string }) {
  const pathname = usePathname();
  const { data: cart } = useCart();
  const { data: me } = useMe();
  const { setCartOpen, setMobileNavOpen, setSearchOpen } = useUi();
  const [scrolled, setScrolled] = useState(false);
  const [mega, setMega] = useState<string | null>(null);
  useEffect(() => { const f = () => setScrolled(window.scrollY > 8); f(); window.addEventListener("scroll", f); return () => window.removeEventListener("scroll", f); }, []);
  const count = cart?.itemCount ?? 0;
  return (
    <header className={cn("sticky top-0 z-50 bg-bone/90 backdrop-blur transition-shadow", scrolled && "shadow-[0_1px_0_0_rgba(0,0,0,0.06)]")} onMouseLeave={() => setMega(null)}>
      {announcement && <div className="bg-forest px-4 py-2 text-center text-xs font-medium tracking-wide text-white">{announcement}</div>}
      <div className="container-x flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-2 lg:hidden">
          <button onClick={() => setMobileNavOpen(true)} className="rounded-full p-2 hover:bg-ink/5" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <button onClick={() => setSearchOpen(true)} className="rounded-full p-2 hover:bg-ink/5" aria-label="Search"><Search className="h-5 w-5" /></button>
        </div>
        <Logo />
        <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
          {NAV.map((n) => (
            <div key={n.label} className="relative" onMouseEnter={() => setMega(MEGA[n.label] ? n.label : null)}>
              <Link href={n.href} className={cn("text-sm font-medium tracking-wide transition hover:text-forest", pathname === n.href && "text-forest", n.accent && "text-clay")}>{n.label}</Link>
            </div>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <button onClick={() => setSearchOpen(true)} className="hidden rounded-full p-2 hover:bg-ink/5 lg:block" aria-label="Search"><Search className="h-5 w-5" /></button>
          <Link href={me ? "/account/wishlist" : "/login?next=/account/wishlist"} className="hidden rounded-full p-2 hover:bg-ink/5 sm:block" aria-label="Wishlist"><Heart className="h-5 w-5" /></Link>
          <Link href={me ? "/account" : "/login"} className="rounded-full p-2 hover:bg-ink/5" aria-label="Account"><User className="h-5 w-5" /></Link>
          <button onClick={() => setCartOpen(true)} className="relative rounded-full p-2 hover:bg-ink/5" aria-label={`Cart, ${count} items`}>
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-forest px-1 text-[10px] font-semibold text-white">{count}</span>}
          </button>
        </div>
      </div>
      {mega && MEGA[mega] && (
        <div className="absolute inset-x-0 top-full hidden border-t border-ink/5 bg-white shadow-xl animate-fade-in lg:block">
          <div className="container-x grid grid-cols-4 gap-8 py-8">
            {MEGA[mega].map((col) => (
              <div key={col.title}>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone">{col.title}</p>
                <ul className="space-y-2">{col.links.map((l) => <li key={l.href}><Link href={l.href} onClick={() => setMega(null)} className="text-sm hover:text-forest">{l.label}</Link></li>)}</ul>
              </div>
            ))}
            <Link href={NAV.find((n) => n.label === mega)!.href} onClick={() => setMega(null)} className="col-span-2 flex items-end overflow-hidden rounded-xl bg-sand p-6">
              <div><p className="font-display text-2xl">Shop all {mega}</p><p className="mt-1 text-sm text-stone">Natural materials, everyday comfort →</p></div>
            </Link>
          </div>
        </div>
      )}
      <MobileNav />
      <SearchOverlay />
      <CartDrawer />
    </header>
  );
}

function MobileNav() {
  const { mobileNavOpen, setMobileNavOpen } = useUi();
  const { data: me } = useMe();
  return (
    <Dialog open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} side="left" title={<Logo />}>
      <nav className="flex flex-col divide-y divide-ink/5" aria-label="Mobile">
        {NAV.map((n) => <Link key={n.href} href={n.href} onClick={() => setMobileNavOpen(false)} className={cn("flex items-center justify-between py-3.5 text-base font-medium", n.accent && "text-clay")}>{n.label}<ChevronRight className="h-4 w-4 text-stone" /></Link>)}
      </nav>
      <div className="mt-6 space-y-2">
        {me ? <ButtonLink href="/account" variant="outline" className="w-full" onClick={() => setMobileNavOpen(false)}>My account</ButtonLink> : <><ButtonLink href="/login" className="w-full" onClick={() => setMobileNavOpen(false)}>Sign in</ButtonLink><ButtonLink href="/register" variant="outline" className="w-full" onClick={() => setMobileNavOpen(false)}>Create account</ButtonLink></>}
        <Link href="/sustainability" onClick={() => setMobileNavOpen(false)} className="block pt-3 text-center text-sm text-stone underline-offset-4 hover:underline">Our sustainability story</Link>
      </div>
    </Dialog>
  );
}

function SearchOverlay() {
  const { searchOpen, setSearchOpen } = useUi();
  const { recentSearches, addRecentSearch, clearRecentSearches } = useLocal();
  const [q, setQ] = useState("");
  const router = useRouter();
  const { data } = useQuery({ queryKey: ["suggest", q], queryFn: async () => (await get(`/search?suggest=true&q=${encodeURIComponent(q)}`)), enabled: searchOpen && q.length >= 2 });
  useEffect(() => { if (!searchOpen) setQ(""); }, [searchOpen]);
  const go = (term: string) => { if (!term.trim()) return; addRecentSearch(term.trim()); setSearchOpen(false); router.push(`/search?q=${encodeURIComponent(term.trim())}`); };
  return (
    <Dialog open={searchOpen} onClose={() => setSearchOpen(false)} className="top-[8%] max-w-2xl -translate-y-0 sm:top-[12%]">
      <form onSubmit={(e) => { e.preventDefault(); go(q); }} className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-stone" />
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search shoes, apparel, materials…" className="h-12 pl-11 text-base" aria-label="Search" />
      </form>
      <div className="mt-4">
        {q.length < 2 ? (
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-stone">Recent searches</p>{recentSearches.length > 0 && <button onClick={clearRecentSearches} className="text-xs text-stone hover:text-ink">Clear</button>}</div>
              {recentSearches.length ? <ul className="space-y-1">{recentSearches.map((r) => <li key={r}><button onClick={() => go(r)} className="text-sm hover:text-forest">{r}</button></li>)}</ul> : <p className="text-sm text-stone">No recent searches</p>}
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone">Popular</p>
              <ul className="space-y-1">{["runner", "wool", "hoodie", "trail", "socks", "merino"].map((r) => <li key={r}><button onClick={() => go(r)} className="text-sm hover:text-forest">{r}</button></li>)}</ul>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-[1fr_180px]">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone">Products</p>
              {data?.data?.products?.length ? <ul className="space-y-2">{data.data.products.map((p: any) => (
                <li key={p.slug}><Link href={`/products/${p.slug}`} onClick={() => { addRecentSearch(q); setSearchOpen(false); }} className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-bone">
                  {p.image && <img src={p.image} alt="" className="h-12 w-12 rounded-md bg-sand object-cover" />}<span className="flex-1 text-sm">{p.name}</span><span className="text-sm text-stone">{formatMoney(p.price)}</span></Link></li>
              ))}</ul> : <p className="text-sm text-stone">No matching products</p>}
              <button onClick={() => go(q)} className="mt-3 text-sm font-medium text-forest hover:underline">See all results for “{q}” →</button>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone">Categories</p>
              <ul className="space-y-1">{data?.data?.categories?.map((c: any) => <li key={c.slug}><Link href={`/collections/${c.slug}`} onClick={() => setSearchOpen(false)} className="text-sm hover:text-forest">{c.name}</Link></li>)}</ul>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}

export function CartDrawer() {
  const { cartOpen, setCartOpen } = useUi();
  const { data: cart, isLoading } = useCart();
  const { update, remove } = useCartMutations();
  const items = cart?.items?.filter((i: any) => !i.savedForLater) ?? [];
  const remaining = cart ? Math.max(0, cart.freeShippingThreshold - cart.subtotal) : 0;
  return (
    <Dialog open={cartOpen} onClose={() => setCartOpen(false)} side="right" title={`Your bag${cart?.itemCount ? ` (${cart.itemCount})` : ""}`}>
      {isLoading ? <p className="text-sm text-stone">Loading…</p> : items.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center text-center"><ShoppingBag className="mb-3 h-8 w-8 text-stone" /><p className="font-display text-xl">Your bag is empty</p><p className="mt-1 text-sm text-stone">Discover naturally comfortable essentials.</p><Button className="mt-6" onClick={() => setCartOpen(false)}>Continue shopping</Button></div>
      ) : (
        <div className="flex h-full flex-col">
          <div className="mb-4 rounded-lg bg-sand/70 px-3 py-2 text-xs">{remaining > 0 ? <>You're <strong>{formatMoney(remaining)}</strong> away from free shipping</> : <>🎉 You've unlocked free standard shipping</>}</div>
          <ul className="flex-1 space-y-4">
            {items.map((i: any) => (
              <li key={i.id} className="flex gap-3">
                <Link href={`/products/${i.productSlug}`} onClick={() => setCartOpen(false)}><img src={i.image} alt={i.productName} className="h-24 w-20 rounded-lg bg-sand object-cover" /></Link>
                <div className="flex flex-1 flex-col">
                  <div className="flex justify-between gap-2"><Link href={`/products/${i.productSlug}`} onClick={() => setCartOpen(false)} className="text-sm font-medium leading-tight hover:text-forest">{i.productName}</Link><span className="text-sm">{formatMoney(i.lineTotal)}</span></div>
                  <p className="mt-0.5 text-xs text-stone">{i.color} / {i.size}</p>
                  {i.unavailable && <p className="mt-0.5 text-xs text-red-600">Only {i.available} available</p>}
                  <div className="mt-auto flex items-center justify-between">
                    <div className="flex items-center rounded-full border border-ink/15">
                      <button className="p-1.5 disabled:opacity-40" onClick={() => update.mutate({ id: i.id, quantity: i.quantity - 1 })} aria-label="Decrease"><Minus className="h-3.5 w-3.5" /></button>
                      <span className="w-6 text-center text-sm">{i.quantity}</span>
                      <button className="p-1.5 disabled:opacity-40" disabled={i.quantity >= i.available} onClick={() => update.mutate({ id: i.id, quantity: i.quantity + 1 })} aria-label="Increase"><Plus className="h-3.5 w-3.5" /></button>
                    </div>
                    <button onClick={() => remove.mutate(i.id)} className="p-1 text-stone hover:text-red-600" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-6 border-t border-ink/10 pt-4">
            <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatMoney(cart.subtotal)}</span></div>
            {cart.discount > 0 && <div className="flex justify-between text-sm text-emerald-700"><span>Discount ({cart.couponCode})</span><span>-{formatMoney(cart.discount)}</span></div>}
            <p className="mt-1 text-xs text-stone">Shipping & taxes calculated at checkout</p>
            <ButtonLink href="/checkout" size="lg" className="mt-4 w-full" onClick={() => setCartOpen(false)}>Checkout · {formatMoney(cart.total)}</ButtonLink>
            <Link href="/cart" onClick={() => setCartOpen(false)} className="mt-3 block text-center text-sm text-stone underline-offset-4 hover:underline">View full bag</Link>
          </div>
        </div>
      )}
    </Dialog>
  );
}

export function AccountMenu() {
  const { data: me } = useMe();
  const logout = useLogout();
  if (!me) return null;
  return <div className="flex items-center gap-3 text-sm"><span className="text-stone">Hi, {me.firstName}</span><button onClick={() => logout.mutate()} className="underline-offset-4 hover:underline">Sign out</button></div>;
}

export function Newsletter() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const toast = useUi((s) => s.toast);
  return (
    <section className="bg-forest text-white">
      <div className="container-x grid gap-8 py-16 md:grid-cols-2 md:items-center">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Newsletter</p><h2 className="mt-2 font-display text-3xl sm:text-4xl">Good things, in your inbox.</h2><p className="mt-2 max-w-md text-white/70">New materials, limited colors and early access to seasonal drops. No spam, ever.</p></div>
        {done ? <p className="font-display text-2xl">Thanks — you're on the list. 🌱</p> : (
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={async (e) => { e.preventDefault(); try { await post("/newsletter", { email }); setDone(true); } catch (err: any) { toast({ title: err.message, variant: "error" }); } }}>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" className="h-12 flex-1 rounded-full border border-white/20 bg-white/10 px-5 text-sm text-white outline-none placeholder:text-white/50 focus:border-white/60" />
            <Button type="submit" size="lg" className="bg-white text-forest hover:bg-sand">Subscribe</Button>
          </form>
        )}
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-ink/10 bg-bone">
      <div className="container-x grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2"><Logo /><p className="mt-4 max-w-xs text-sm text-stone">Naturally better everyday essentials. Designed in Portland, made with materials the planet can replenish.</p><p className="mt-6 text-xs text-stone">Certified carbon neutral · 1% for the planet</p></div>
        {[
          { title: "Shop", links: [["Men", "/collections/men"], ["Women", "/collections/women"], ["Shoes", "/collections/shoes"], ["Apparel", "/collections/apparel"], ["Accessories", "/collections/accessories"], ["Sale", "/collections/sale"]] },
          { title: "Help", links: [["Shipping & returns", "/help"], ["Size guide", "/help#sizing"], ["Track order", "/account/orders"], ["Contact", "mailto:support@evergreen.example"], ["API docs", "/api-docs"]] },
          { title: "Company", links: [["Sustainability", "/sustainability"], ["Our materials", "/sustainability#materials"], ["Careers", "/sustainability"], ["Admin", "/admin"]] },
        ].map((c) => (
          <div key={c.title}><p className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone">{c.title}</p><ul className="space-y-2">{c.links.map(([l, h]) => <li key={l}><Link href={h} className="text-sm hover:text-forest">{l}</Link></li>)}</ul></div>
        ))}
      </div>
      <div className="border-t border-ink/10"><div className="container-x flex flex-col items-center justify-between gap-2 py-5 text-xs text-stone sm:flex-row"><span>© {new Date().getFullYear()} Evergreen Store. All rights reserved.</span><span>Privacy · Terms · Accessibility</span></div></div>
    </footer>
  );
}
