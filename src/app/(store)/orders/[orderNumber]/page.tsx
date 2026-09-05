"use client";
import Link from "next/link";
import { use } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Package } from "lucide-react";
import { ButtonLink, ErrorState, Skeleton, StatusBadge } from "@/components/ui";
import { get } from "@/lib/api";
import { formatDateTime, formatMoney, titleCase } from "@/lib/utils";

export default function OrderConfirmationPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = use(params);
  const sp = useSearchParams();
  const token = sp.get("token");
  const { data, isLoading, isError, error } = useQuery({ queryKey: ["order", orderNumber, token], queryFn: async () => (await get(`/orders/${orderNumber}${token ? `?token=${token}` : ""}`)).data });
  if (isLoading) return <div className="container-x max-w-3xl py-16"><Skeleton className="h-10 w-72" /><Skeleton className="mt-6 h-80" /></div>;
  if (isError || !data) return <div className="container-x max-w-3xl py-16"><ErrorState title={(error as any)?.status === 401 ? "Sign in to view this order" : "Order not found"} description={(error as any)?.message} /><div className="mt-4 text-center"><Link href={`/login?next=/orders/${orderNumber}`} className="underline">Sign in</Link></div></div>;
  const o = data;
  const a = o.shippingAddress;
  return (
    <div className="container-x max-w-3xl py-12 sm:py-16">
      <div className="text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-forest" /><p className="mt-4 text-xs font-semibold uppercase tracking-[0.25em] text-stone">Order {o.orderNumber}</p><h1 className="mt-2 font-display text-4xl">Thank you, {a.firstName}!</h1><p className="mt-2 text-stone">We've emailed a confirmation to <strong>{o.email}</strong>. Your order is <StatusBadge status={o.status} />.</p></div>
      <div className="mt-10 rounded-2xl bg-white p-6 ring-1 ring-ink/10">
        <ul className="divide-y divide-ink/5">{o.items.map((i: any) => <li key={i.id} className="flex items-center gap-4 py-3"><img src={i.imageUrl} alt="" className="h-16 w-14 rounded-lg bg-sand object-cover" /><div className="flex-1"><p className="text-sm font-medium">{i.productName}</p><p className="text-xs text-stone">{i.color} / {i.size} · Qty {i.quantity}</p></div><span className="text-sm">{formatMoney(i.lineTotal)}</span></li>)}</ul>
        <dl className="mt-4 space-y-1.5 border-t border-ink/10 pt-4 text-sm"><div className="flex justify-between"><dt>Subtotal</dt><dd>{formatMoney(o.subtotal)}</dd></div>{o.discountTotal > 0 && <div className="flex justify-between text-emerald-700"><dt>Discount ({o.couponCode})</dt><dd>-{formatMoney(o.discountTotal)}</dd></div>}<div className="flex justify-between"><dt>Shipping ({titleCase(o.shippingMethod)})</dt><dd>{o.shippingTotal === 0 ? "Free" : formatMoney(o.shippingTotal)}</dd></div><div className="flex justify-between"><dt>Tax</dt><dd>{formatMoney(o.taxTotal)}</dd></div><div className="flex justify-between border-t border-ink/10 pt-2 text-base font-semibold"><dt>Total</dt><dd>{formatMoney(o.grandTotal)}</dd></div></dl>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 text-sm ring-1 ring-ink/10"><p className="text-xs font-semibold uppercase tracking-wider text-stone">Shipping to</p><p className="mt-2">{a.firstName} {a.lastName}<br />{a.line1}{a.line2 && <>, {a.line2}</>}<br />{a.city}, {a.region} {a.postalCode}</p></div>
        <div className="rounded-2xl bg-white p-5 text-sm ring-1 ring-ink/10"><p className="text-xs font-semibold uppercase tracking-wider text-stone">Payment</p><p className="mt-2">{o.payments[0]?.method === "card" ? `Card •••• ${o.payments[0]?.cardLast4}` : "Pay on delivery"} · <StatusBadge status={o.payments[0]?.status ?? "PENDING"} /></p><p className="mt-1 text-xs text-stone">Placed {formatDateTime(o.placedAt)}</p></div>
      </div>
      <div className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-ink/10"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone"><Package className="h-4 w-4" /> Timeline</p><ol className="mt-3 space-y-2 text-sm">{o.events.map((e: any) => <li key={e.id} className="flex justify-between gap-3"><span>{e.message}</span><span className="shrink-0 text-xs text-stone">{formatDateTime(e.createdAt)}</span></li>)}</ol></div>
      <div className="mt-8 flex flex-wrap justify-center gap-3"><ButtonLink href="/collections/all" variant="outline">Continue shopping</ButtonLink>{o.userId ? <ButtonLink href={`/account/orders/${o.id}`}>View in my account</ButtonLink> : <ButtonLink href="/register">Create an account to track orders</ButtonLink>}</div>
    </div>
  );
}
