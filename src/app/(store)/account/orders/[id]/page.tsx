"use client";
import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, ConfirmDialog, Dialog, ErrorState, Field, Input, Skeleton, StatusBadge, Textarea } from "@/components/ui";
import { get, post } from "@/lib/api";
import { formatDateTime, formatMoney, titleCase } from "@/lib/utils";
import { useUi } from "@/stores/ui";

export default function AccountOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const router = useRouter();
  const toast = useUi((s) => s.toast);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reviewItem, setReviewItem] = useState<any>(null);
  const [rating, setRating] = useState(5); const [title, setTitle] = useState(""); const [comment, setComment] = useState("");
  const { data: o, isLoading, isError } = useQuery({ queryKey: ["order", id], queryFn: async () => (await get(`/orders/${id}`)).data });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["order", id] }); qc.invalidateQueries({ queryKey: ["orders"] }); };
  const cancel = useMutation({ mutationFn: () => post(`/orders/${o.orderNumber}/cancel`), onSuccess: () => { invalidate(); setCancelOpen(false); toast({ title: "Order cancelled", variant: "success" }); }, onError: (e: any) => toast({ title: e.message, variant: "error" }) });
  const reorder = useMutation({ mutationFn: () => post(`/orders/${o.orderNumber}/reorder`), onSuccess: (r) => { qc.setQueryData(["cart"], r.data.cart); toast({ title: `${r.data.added.length} item(s) added to bag`, description: r.data.skipped.length ? `${r.data.skipped.length} unavailable` : undefined, variant: "success" }); router.push("/cart"); }, onError: (e: any) => toast({ title: e.message, variant: "error" }) });
  const review = useMutation({ mutationFn: () => post("/reviews", { productId: reviewItem.productId, orderItemId: reviewItem.id, rating, title, comment }), onSuccess: () => { invalidate(); setReviewItem(null); toast({ title: "Review submitted for moderation", variant: "success" }); }, onError: (e: any) => toast({ title: e.message, variant: "error" }) });
  if (isLoading) return <Skeleton className="h-96" />;
  if (isError || !o) return <ErrorState title="Order not found" />;
  const a = o.shippingAddress;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><Link href="/account/orders" className="text-xs text-stone hover:text-ink">← Orders</Link><h2 className="font-display text-2xl">{o.orderNumber}</h2><p className="text-xs text-stone">Placed {formatDateTime(o.placedAt)}</p></div><div className="flex items-center gap-2"><StatusBadge status={o.status} /><Button variant="outline" size="sm" onClick={() => reorder.mutate()} loading={reorder.isPending}>Reorder</Button>{o.canCancel && <Button variant="danger" size="sm" onClick={() => setCancelOpen(true)}>Cancel order</Button>}</div></div>
      <div className="rounded-2xl bg-white ring-1 ring-ink/10"><ul className="divide-y divide-ink/5">{o.items.map((i: any) => <li key={i.id} className="flex items-center gap-4 p-4"><img src={i.imageUrl} alt="" className="h-20 w-16 rounded-lg bg-sand object-cover" /><div className="flex-1"><Link href={`/products/${i.productSlug}`} className="text-sm font-medium hover:text-forest">{i.productName}</Link><p className="text-xs text-stone">{i.color} / {i.size} · Qty {i.quantity} · {formatMoney(i.unitPrice)}</p>{o.status === "DELIVERED" && (i.reviewed ? <p className="mt-1 text-xs text-forest">✓ Reviewed</p> : <button onClick={() => setReviewItem(i)} className="mt-1 text-xs underline underline-offset-4">Write a review</button>)}</div><span className="text-sm">{formatMoney(i.lineTotal)}</span></li>)}</ul>
        <dl className="space-y-1.5 border-t border-ink/10 p-4 text-sm"><div className="flex justify-between"><dt>Subtotal</dt><dd>{formatMoney(o.subtotal)}</dd></div>{o.discountTotal > 0 && <div className="flex justify-between text-emerald-700"><dt>Discount ({o.couponCode})</dt><dd>-{formatMoney(o.discountTotal)}</dd></div>}<div className="flex justify-between"><dt>Shipping ({titleCase(o.shippingMethod)})</dt><dd>{o.shippingTotal === 0 ? "Free" : formatMoney(o.shippingTotal)}</dd></div><div className="flex justify-between"><dt>Tax</dt><dd>{formatMoney(o.taxTotal)}</dd></div><div className="flex justify-between border-t border-ink/10 pt-2 font-semibold"><dt>Total</dt><dd>{formatMoney(o.grandTotal)}</dd></div></dl></div>
      <div className="grid gap-4 sm:grid-cols-3 text-sm">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-ink/10"><p className="text-xs font-semibold uppercase tracking-wider text-stone">Shipping address</p><p className="mt-2">{a.firstName} {a.lastName}<br />{a.line1}<br />{a.city}, {a.region} {a.postalCode}</p></div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-ink/10"><p className="text-xs font-semibold uppercase tracking-wider text-stone">Payment</p><p className="mt-2">{o.payments[0]?.method === "card" ? `Card •••• ${o.payments[0].cardLast4}` : "Pay on delivery"}</p><div className="mt-1"><StatusBadge status={o.payments[0]?.status ?? "PENDING"} /></div></div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-ink/10"><p className="text-xs font-semibold uppercase tracking-wider text-stone">Shipment</p>{o.shipments[0] ? <><div className="mt-2"><StatusBadge status={o.shipments[0].status} /></div>{o.shipments[0].trackingNumber && <p className="mt-1 text-xs">{o.shipments[0].carrier} · {o.shipments[0].trackingNumber}</p>}</> : <p className="mt-2 text-stone">Not yet shipped</p>}</div>
      </div>
      <div className="rounded-2xl bg-white p-5 ring-1 ring-ink/10"><p className="text-xs font-semibold uppercase tracking-wider text-stone">Timeline</p><ol className="mt-3 space-y-3">{o.events.map((e: any) => <li key={e.id} className="flex gap-3 text-sm"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-forest" /><div><p>{e.message}</p><p className="text-xs text-stone">{formatDateTime(e.createdAt)}</p></div></li>)}</ol></div>
      <ConfirmDialog open={cancelOpen} onClose={() => setCancelOpen(false)} onConfirm={() => cancel.mutate()} loading={cancel.isPending} danger title="Cancel this order?" description="Your payment will be refunded and items returned to stock." confirmLabel="Cancel order" />
      <Dialog open={!!reviewItem} onClose={() => setReviewItem(null)} title={`Review ${reviewItem?.productName ?? ""}`}>
        <div className="space-y-4"><div><p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-ink/70">Rating</p><div className="flex gap-1">{[1, 2, 3, 4, 5].map((r) => <button key={r} onClick={() => setRating(r)} className={`text-2xl ${r <= rating ? "text-forest" : "text-ink/20"}`} aria-label={`${r} stars`}>★</button>)}</div></div><Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field><Field label="Review"><Textarea value={comment} onChange={(e) => setComment(e.target.value)} /></Field><Button onClick={() => review.mutate()} loading={review.isPending} className="w-full">Submit review</Button></div>
      </Dialog>
    </div>
  );
}
