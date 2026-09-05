"use client";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, X } from "lucide-react";
import { Button, ButtonLink, EmptyState, Skeleton } from "@/components/ui";
import { del, get } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import { useCartMutations } from "@/lib/hooks";
import { useState } from "react";
export default function WishlistPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["wishlist"], queryFn: async () => (await get("/wishlist")).data });
  const remove = useMutation({ mutationFn: (pid: number) => del(`/wishlist/${pid}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ["wishlist"] }); qc.invalidateQueries({ queryKey: ["wishlist-ids"] }); } });
  const { add } = useCartMutations();
  const [picking, setPicking] = useState<number | null>(null);
  const { data: detail } = useQuery({ queryKey: ["product-by-id", picking], queryFn: async () => (await get(`/products/${data.find((w: any) => w.productId === picking).product.slug}`)).data, enabled: !!picking });
  if (isLoading) return <Skeleton className="h-64" />;
  if (!data?.length) return <EmptyState icon={Heart} title="Your wishlist is empty" description="Tap the heart on any product to save it here." action={<ButtonLink href="/collections/all">Explore products</ButtonLink>} />;
  return (
    <div>
      <h2 className="mb-4 font-display text-2xl">Wishlist ({data.length})</h2>
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3">
        {data.map((w: any) => { const p = w.product; const drop = w.priceAtAdd && p.price < w.priceAtAdd; return (
          <div key={w.id} className="group relative">
            <Link href={`/products/${p.slug}`} className="block aspect-[4/5] overflow-hidden rounded-2xl bg-sand"><img src={p.images[0]} alt={p.name} className="h-full w-full object-cover transition group-hover:scale-105" /></Link>
            <button onClick={() => remove.mutate(p.id)} className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 shadow" aria-label="Remove"><X className="h-4 w-4" /></button>
            <p className="mt-3 text-sm font-medium">{p.name}</p>
            <p className="text-sm">{formatMoney(p.price)} {drop && <span className="ml-1 text-xs text-emerald-700">↓ was {formatMoney(w.priceAtAdd)}</span>}</p>
            <p className="text-xs text-stone">{p.available > 0 ? `${p.available} in stock` : "Out of stock"}</p>
            {picking === p.id && detail ? <div className="mt-2 grid grid-cols-4 gap-1">{detail.variants.filter((v: any) => v.status === "ACTIVE" && v.available > 0).slice(0, 12).map((v: any) => <button key={v.id} onClick={() => add.mutate({ variantId: v.id }, { onSuccess: () => setPicking(null) })} className="rounded border border-ink/15 py-1 text-[11px] hover:border-ink" title={`${v.color} / ${v.size}`}>{v.size}</button>)}</div> : <Button size="sm" variant="outline" className="mt-2 w-full" disabled={p.available === 0} onClick={() => setPicking(p.id)}>Move to bag</Button>}
          </div>
        ); })}
      </div>
    </div>
  );
}
