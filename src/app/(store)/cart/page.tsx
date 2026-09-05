"use client";
import Link from "next/link";
import { useState } from "react";
import { Minus, Plus, Trash2, Bookmark, ShoppingBag, Tag } from "lucide-react";
import { Button, ButtonLink, EmptyState, Input, Skeleton, ErrorState } from "@/components/ui";
import { useCart, useCartMutations } from "@/lib/hooks";
import { formatMoney } from "@/lib/utils";

export default function CartPage() {
  const { data: cart, isLoading, isError, refetch } = useCart();
  const { update, remove, coupon } = useCartMutations();
  const [code, setCode] = useState("");
  if (isLoading) return <div className="container-x py-12"><Skeleton className="h-8 w-40" /><div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]"><div className="space-y-4">{[1, 2].map((i) => <Skeleton key={i} className="h-32" />)}</div><Skeleton className="h-64" /></div></div>;
  if (isError || !cart) return <div className="container-x py-12"><ErrorState retry={() => refetch()} /></div>;
  const items = cart.items.filter((i: any) => !i.savedForLater);
  const saved = cart.savedItems ?? [];
  if (items.length === 0 && saved.length === 0) return <div className="container-x max-w-2xl py-16"><EmptyState icon={ShoppingBag} title="Your bag is empty" description="Looks like you haven't added anything yet. Explore our best sellers to get started." action={<ButtonLink href="/collections/best-sellers">Shop best sellers</ButtonLink>} /></div>;
  const Line = ({ i, isSaved }: { i: any; isSaved?: boolean }) => (
    <li className="flex gap-4 py-5">
      <Link href={`/products/${i.productSlug}`}><img src={i.image} alt={i.productName} className="h-32 w-26 rounded-xl bg-sand object-cover sm:w-28" /></Link>
      <div className="flex flex-1 flex-col">
        <div className="flex justify-between gap-3"><div><Link href={`/products/${i.productSlug}`} className="font-medium hover:text-forest">{i.productName}</Link><p className="text-sm text-stone">{i.color} / {i.size}</p><p className="text-xs text-stone">SKU {i.sku}</p></div><p className="font-medium">{formatMoney(i.lineTotal)}</p></div>
        {i.unavailable && <p className="mt-1 text-xs text-red-600">{i.available === 0 ? "Currently out of stock" : `Only ${i.available} available`}</p>}
        {i.compareAtPrice && <p className="text-xs text-clay">You save {formatMoney((i.compareAtPrice - i.price) * i.quantity)}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-3 pt-3 text-xs">
          {!isSaved && <div className="flex items-center rounded-full border border-ink/15"><button className="p-2" onClick={() => update.mutate({ id: i.id, quantity: i.quantity - 1 })} aria-label="Decrease"><Minus className="h-3.5 w-3.5" /></button><span className="w-6 text-center text-sm">{i.quantity}</span><button className="p-2 disabled:opacity-30" disabled={i.quantity >= i.available} onClick={() => update.mutate({ id: i.id, quantity: i.quantity + 1 })} aria-label="Increase"><Plus className="h-3.5 w-3.5" /></button></div>}
          <button onClick={() => update.mutate({ id: i.id, savedForLater: !isSaved })} className="flex items-center gap-1 text-stone hover:text-ink"><Bookmark className="h-3.5 w-3.5" />{isSaved ? "Move to bag" : "Save for later"}</button>
          <button onClick={() => remove.mutate(i.id)} className="flex items-center gap-1 text-stone hover:text-red-600"><Trash2 className="h-3.5 w-3.5" />Remove</button>
        </div>
      </div>
    </li>
  );
  return (
    <div className="container-x py-10 sm:py-14">
      <h1 className="font-display text-3xl sm:text-4xl">Your bag <span className="text-lg text-stone">({cart.itemCount})</span></h1>
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
        <div>
          {items.length ? <ul className="divide-y divide-ink/10 border-y border-ink/10">{items.map((i: any) => <Line key={i.id} i={i} />)}</ul> : <p className="rounded-xl bg-sand/60 p-6 text-sm text-stone">No items in your bag. Move something from saved items below.</p>}
          {saved.length > 0 && <div className="mt-12"><h2 className="font-display text-2xl">Saved for later ({saved.length})</h2><ul className="mt-2 divide-y divide-ink/10 border-y border-ink/10">{saved.map((i: any) => <Line key={i.id} i={i} isSaved />)}</ul></div>}
        </div>
        <aside className="h-fit rounded-2xl bg-white p-6 ring-1 ring-ink/10 lg:sticky lg:top-28">
          <h2 className="font-display text-xl">Summary</h2>
          <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (code) coupon.mutate(code, { onSuccess: () => setCode("") }); }}>
            <div className="relative flex-1"><Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone" /><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Promo code" className="pl-9 uppercase" /></div>
            <Button type="submit" variant="outline" loading={coupon.isPending}>Apply</Button>
          </form>
          {cart.couponError && <p className="mt-2 text-xs text-red-600">{cart.couponError}</p>}
          {cart.couponCode && <p className="mt-2 flex items-center justify-between text-xs text-emerald-700"><span>Code <strong>{cart.couponCode}</strong> applied</span><button onClick={() => coupon.mutate(null)} className="underline">Remove</button></p>}
          <dl className="mt-5 space-y-2 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatMoney(cart.subtotal)}</dd></div>
            {cart.discount > 0 && <div className="flex justify-between text-emerald-700"><dt>Discount</dt><dd>-{formatMoney(cart.discount)}</dd></div>}
            <div className="flex justify-between"><dt>Shipping (standard)</dt><dd>{cart.shipping === 0 ? "Free" : formatMoney(cart.shipping)}</dd></div>
            <div className="flex justify-between"><dt>Estimated tax</dt><dd>{formatMoney(cart.tax)}</dd></div>
            <div className="flex justify-between border-t border-ink/10 pt-3 text-base font-semibold"><dt>Total</dt><dd>{formatMoney(cart.total)}</dd></div>
          </dl>
          <ButtonLink href="/checkout" size="lg" className={`mt-5 w-full ${items.length === 0 ? "pointer-events-none opacity-50" : ""}`}>Proceed to checkout</ButtonLink>
          <p className="mt-3 text-center text-xs text-stone">Free returns within 30 days · Carbon-neutral delivery</p>
        </aside>
      </div>
    </div>
  );
}
