"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, Skeleton, StatusBadge } from "@/components/ui";
import { get } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/utils";
import { useMe } from "@/lib/hooks";
export default function AccountOverview() {
  const { data: me } = useMe();
  const { data: orders, isLoading } = useQuery({ queryKey: ["orders", 1], queryFn: () => get("/orders?pageSize=3") });
  const { data: notes } = useQuery({ queryKey: ["notifications"], queryFn: async () => (await get("/account/notifications")).data });
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">{[["Orders", orders?.meta?.total ?? "—"], ["Member since", formatDate(me?.createdAt)], ["Email", me?.email]].map(([l, v]) => <Card key={l as string} className="p-5"><p className="text-xs uppercase tracking-wider text-stone">{l as string}</p><p className="mt-1 truncate font-display text-2xl">{v as string}</p></Card>)}</div>
      <section><div className="mb-3 flex items-center justify-between"><h2 className="font-display text-2xl">Recent orders</h2><Link href="/account/orders" className="text-sm underline-offset-4 hover:underline">View all</Link></div>
        {isLoading ? <Skeleton className="h-32" /> : orders?.data?.length ? <ul className="divide-y divide-ink/10 rounded-2xl bg-white ring-1 ring-ink/10">{orders.data.map((o: any) => <li key={o.id}><Link href={`/account/orders/${o.id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-bone/60"><div><p className="text-sm font-medium">{o.orderNumber}</p><p className="text-xs text-stone">{formatDate(o.createdAt)} · {o.items.length} item{o.items.length === 1 ? "" : "s"}</p></div><div className="flex items-center gap-3"><StatusBadge status={o.status} /><span className="text-sm">{formatMoney(o.grandTotal)}</span></div></Link></li>)}</ul> : <p className="text-sm text-stone">No orders yet. <Link href="/collections/all" className="underline">Start shopping</Link>.</p>}
      </section>
      <section><h2 className="mb-3 font-display text-2xl">Notifications</h2>{notes?.length ? <ul className="space-y-2">{notes.slice(0, 5).map((n: any) => <li key={n.id} className="rounded-xl bg-white p-4 text-sm ring-1 ring-ink/10"><p className="font-medium">{n.title}</p><p className="text-stone">{n.body}</p><p className="mt-1 text-xs text-stone">{formatDate(n.createdAt)}</p></li>)}</ul> : <p className="text-sm text-stone">You're all caught up.</p>}</section>
    </div>
  );
}
