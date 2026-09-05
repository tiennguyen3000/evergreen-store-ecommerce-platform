"use client";
import Link from "next/link";
import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, ConfirmDialog, ErrorState, Field, Input, PageHeader, Skeleton, StatusBadge, Textarea } from "@/components/ui";
import { usePerm } from "@/components/admin/shared";
import { get, patch, post } from "@/lib/api";
import { NEXT_STATUS, formatDateTime, formatMoney, titleCase } from "@/lib/utils";
import { useUi } from "@/stores/ui";

export default function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const toast = useUi((s) => s.toast);
  const can = usePerm();
  const [note, setNote] = useState("");
  const [tracking, setTracking] = useState({ carrier: "EcoPost", trackingNumber: "" });
  const [confirm, setConfirm] = useState<string | null>(null);
  const { data: o, isLoading, isError, refetch } = useQuery({ queryKey: ["admin-order", id], queryFn: async () => (await get(`/admin/orders/${id}`)).data });
  const inv = () => { qc.invalidateQueries({ queryKey: ["admin-order", id] }); qc.invalidateQueries({ queryKey: ["/admin/orders"] }); };
  const status = useMutation({ mutationFn: (s: string) => patch(`/admin/orders/${id}/status`, { status: s, ...(s === "SHIPPED" ? tracking : {}) }), onSuccess: (_r, s) => { inv(); setConfirm(null); toast({ title: `Order marked ${titleCase(s)}`, variant: "success" }); }, onError: (e: any) => toast({ title: e.message, variant: "error" }) });
  const addNote = useMutation({ mutationFn: () => post(`/admin/orders/${id}/notes`, { message: note }), onSuccess: () => { inv(); setNote(""); }, onError: (e: any) => toast({ title: e.message, variant: "error" }) });
  if (isLoading) return <Skeleton className="h-96" />;
  if (isError || !o) return <ErrorState title="Order not found" retry={() => refetch()} />;
  const a = o.shippingAddress;
  const nextStatuses = (NEXT_STATUS[o.status] ?? []).filter((s) => (s === "REFUNDED" ? can("ORDER_REFUND") : can("ORDER_UPDATE")));
  return (
    <div>
      <PageHeader crumbs={[{ label: "Orders", href: "/admin/orders" }, { label: o.orderNumber }]} title={o.orderNumber} description={`Placed ${formatDateTime(o.placedAt)} · ${o.email}`} actions={<><StatusBadge status={o.status} />{nextStatuses.map((s) => <Button key={s} size="sm" variant={s === "CANCELLED" || s === "REFUNDED" ? "danger" : "primary"} onClick={() => setConfirm(s)}>{s === "REFUNDED" ? "Refund" : s === "CANCELLED" ? "Cancel" : `Mark ${titleCase(s)}`}</Button>)}</>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card><table className="w-full text-sm"><thead><tr className="border-b border-ink/10 text-left text-[11px] uppercase tracking-wider text-stone"><th className="px-4 py-3">Item</th><th className="px-4 py-3">SKU</th><th className="px-4 py-3">Qty</th><th className="px-4 py-3 text-right">Total</th></tr></thead><tbody>{o.items.map((i: any) => <tr key={i.id} className="border-b border-ink/5"><td className="px-4 py-3"><div className="flex items-center gap-3"><img src={i.imageUrl} alt="" className="h-12 w-10 rounded bg-sand object-cover" /><div><p className="font-medium">{i.productName}</p><p className="text-xs text-stone">{i.color} / {i.size} · {formatMoney(i.unitPrice)}</p></div></div></td><td className="px-4 py-3 font-mono text-xs">{i.sku}</td><td className="px-4 py-3">{i.quantity}</td><td className="px-4 py-3 text-right">{formatMoney(i.lineTotal)}</td></tr>)}</tbody></table>
            <dl className="ml-auto max-w-xs space-y-1.5 p-4 text-sm"><div className="flex justify-between"><dt>Subtotal</dt><dd>{formatMoney(o.subtotal)}</dd></div>{o.discountTotal > 0 && <div className="flex justify-between text-emerald-700"><dt>Discount {o.couponCode && `(${o.couponCode})`}</dt><dd>-{formatMoney(o.discountTotal)}</dd></div>}<div className="flex justify-between"><dt>Shipping ({titleCase(o.shippingMethod)})</dt><dd>{formatMoney(o.shippingTotal)}</dd></div><div className="flex justify-between"><dt>Tax</dt><dd>{formatMoney(o.taxTotal)}</dd></div><div className="flex justify-between border-t border-ink/10 pt-2 font-semibold"><dt>Total</dt><dd>{formatMoney(o.grandTotal)}</dd></div></dl></Card>
          <Card className="p-5"><p className="mb-3 text-sm font-medium">Timeline</p><ol className="space-y-3">{o.events.map((e: any) => <li key={e.id} className="flex gap-3 text-sm"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${e.type === "NOTE_ADDED" ? "bg-amber-400" : e.type.includes("FAILED") || e.type.includes("CANCELLED") ? "bg-red-500" : "bg-forest"}`} /><div className="flex-1"><p><span className="font-medium">{titleCase(e.type)}</span> — {e.message}</p><p className="text-xs text-stone">{formatDateTime(e.createdAt)}</p></div></li>)}</ol>
            {can("ORDER_UPDATE") && <form className="mt-5 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (note) addNote.mutate(); }}><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an internal note…" /><Button type="submit" variant="outline" loading={addNote.isPending}>Add note</Button></form>}</Card>
        </div>
        <div className="space-y-4">
          <Card className="p-5 text-sm"><p className="text-xs font-semibold uppercase tracking-wider text-stone">Customer</p>{o.customer ? <Link href={`/admin/customers/${o.customer.id}`} className="mt-2 block font-medium hover:underline">{o.customer.firstName} {o.customer.lastName}</Link> : <p className="mt-2 font-medium">Guest</p>}<p className="text-stone">{o.email}</p></Card>
          <Card className="p-5 text-sm"><p className="text-xs font-semibold uppercase tracking-wider text-stone">Shipping address</p><p className="mt-2">{a.firstName} {a.lastName}<br />{a.line1}{a.line2 && <>, {a.line2}</>}<br />{a.city}, {a.region} {a.postalCode} {a.country}</p>{a.phone && <p className="text-stone">{a.phone}</p>}{o.customerNote && <p className="mt-2 rounded bg-amber-50 p-2 text-xs">Note: {o.customerNote}</p>}</Card>
          <Card className="p-5 text-sm"><p className="text-xs font-semibold uppercase tracking-wider text-stone">Payment</p>{o.payments.map((p: any) => <div key={p.id} className="mt-2"><div className="flex items-center justify-between"><span>{p.provider} · {p.method}{p.cardLast4 && ` •••• ${p.cardLast4}`}</span><StatusBadge status={p.status} /></div><p className="text-xs text-stone">{formatMoney(p.amount)}{p.refundedAmount > 0 && ` · refunded ${formatMoney(p.refundedAmount)}`}{p.failureReason && ` · ${p.failureReason}`}</p><p className="font-mono text-[10px] text-stone">{p.providerReference}</p></div>)}</Card>
          <Card className="p-5 text-sm"><p className="text-xs font-semibold uppercase tracking-wider text-stone">Shipment</p>{o.shipments.length ? o.shipments.map((s: any) => <div key={s.id} className="mt-2"><StatusBadge status={s.status} />{s.trackingNumber && <p className="mt-1">{s.carrier} · <span className="font-mono text-xs">{s.trackingNumber}</span></p>}{s.shippedAt && <p className="text-xs text-stone">Shipped {formatDateTime(s.shippedAt)}</p>}{s.deliveredAt && <p className="text-xs text-stone">Delivered {formatDateTime(s.deliveredAt)}</p>}</div>) : <p className="mt-2 text-stone">No shipment yet</p>}
            {o.status === "PACKED" && <div className="mt-3 space-y-2"><Field label="Carrier"><Input value={tracking.carrier} onChange={(e) => setTracking({ ...tracking, carrier: e.target.value })} /></Field><Field label="Tracking number"><Input value={tracking.trackingNumber} onChange={(e) => setTracking({ ...tracking, trackingNumber: e.target.value })} placeholder="auto-generated if blank" /></Field></div>}</Card>
        </div>
      </div>
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => confirm && status.mutate(confirm)} loading={status.isPending} danger={confirm === "CANCELLED" || confirm === "REFUNDED"} title={`${confirm === "REFUNDED" ? "Refund" : confirm === "CANCELLED" ? "Cancel" : `Mark as ${titleCase(confirm ?? "")}`} ${o.orderNumber}?`} description={confirm === "REFUNDED" ? "The payment will be refunded via the payment provider and items returned to stock." : confirm === "CANCELLED" ? "Reserved or sold stock is released back to the warehouse and any payment refunded." : "The customer will be notified of the status change."} confirmLabel={confirm === "REFUNDED" ? "Issue refund" : "Confirm"} />
    </div>
  );
}
