"use client";
import Link from "next/link";
import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, DataTable, ErrorState, PageHeader, Skeleton, StatCard, StatusBadge, Stars } from "@/components/ui";
import { usePerm } from "@/components/admin/shared";
import { get, patch } from "@/lib/api";
import { cn, formatDate, formatDateTime, formatMoney } from "@/lib/utils";
import { useUi } from "@/stores/ui";
const TABS = ["Profile", "Orders", "Addresses", "Wishlist", "Reviews", "Activity"];
export default function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const toast = useUi((s) => s.toast);
  const can = usePerm();
  const [tab, setTab] = useState(0);
  const { data: c, isLoading, isError } = useQuery({ queryKey: ["admin-customer", id], queryFn: async () => (await get(`/admin/customers/${id}`)).data });
  const status = useMutation({ mutationFn: (s: string) => patch(`/admin/customers/${id}/status`, { status: s }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-customer", id] }); toast({ title: "Account status updated", variant: "success" }); }, onError: (e: any) => toast({ title: e.message, variant: "error" }) });
  if (isLoading) return <Skeleton className="h-96" />;
  if (isError || !c) return <ErrorState title="Customer not found" />;
  return (
    <div>
      <PageHeader crumbs={[{ label: "Customers", href: "/admin/customers" }, { label: `${c.firstName} ${c.lastName}` }]} title={`${c.firstName} ${c.lastName}`} description={c.email} actions={<><StatusBadge status={c.status} />{can("CUSTOMER_UPDATE") && <Button size="sm" variant={c.status === "ACTIVE" ? "danger" : "primary"} onClick={() => status.mutate(c.status === "ACTIVE" ? "DISABLED" : "ACTIVE")} loading={status.isPending}>{c.status === "ACTIVE" ? "Disable account" : "Enable account"}</Button>}</>} />
      <div className="grid gap-4 sm:grid-cols-3"><StatCard label="Lifetime value" value={formatMoney(c.stats.lifetimeValue)} /><StatCard label="Orders" value={c.stats.orderCount} /><StatCard label="Avg. order" value={formatMoney(c.stats.aov)} /></div>
      <div className="my-5 flex gap-1 border-b border-ink/10">{TABS.map((t, i) => <button key={t} onClick={() => setTab(i)} className={cn("border-b-2 px-4 py-2.5 text-sm", tab === i ? "border-ink font-medium" : "border-transparent text-stone")}>{t}</button>)}</div>
      {tab === 0 && <Card className="p-5 text-sm"><dl className="grid gap-4 sm:grid-cols-2">{[["Email", c.email], ["Phone", c.phone ?? "—"], ["Joined", formatDate(c.createdAt)], ["Last login", formatDateTime(c.lastLoginAt)], ["Marketing", c.marketingOptIn ? "Opted in" : "Opted out"], ["Status", c.status]].map(([k, v]) => <div key={k as string}><dt className="text-xs uppercase tracking-wider text-stone">{k as string}</dt><dd className="mt-0.5">{v as string}</dd></div>)}</dl></Card>}
      {tab === 1 && <DataTable rows={c.orders} keyField="id" columns={[{ key: "orderNumber", header: "Order", render: (o: any) => <Link href={`/admin/orders/${o.id}`} className="font-medium hover:underline">{o.orderNumber}</Link> }, { key: "status", header: "Status", render: (o: any) => <StatusBadge status={o.status} /> }, { key: "grandTotal", header: "Total", render: (o: any) => formatMoney(o.grandTotal) }, { key: "createdAt", header: "Date", render: (o: any) => formatDate(o.createdAt) }]} />}
      {tab === 2 && <div className="grid gap-3 sm:grid-cols-2">{c.addresses.length ? c.addresses.map((a: any) => <Card key={a.id} className="p-4 text-sm"><p className="font-medium">{a.label}</p><p className="text-ink/80">{a.firstName} {a.lastName}<br />{a.line1}<br />{a.city}, {a.region} {a.postalCode}</p></Card>) : <p className="text-sm text-stone">No addresses</p>}</div>}
      {tab === 3 && <DataTable rows={c.wishlist} keyField="id" empty="Wishlist is empty" columns={[{ key: "productName", header: "Product", render: (w: any) => <Link href={`/products/${w.productSlug}`} className="hover:underline">{w.productName}</Link> }, { key: "createdAt", header: "Added", render: (w: any) => formatDate(w.createdAt) }]} />}
      {tab === 4 && <DataTable rows={c.reviews} keyField="id" empty="No reviews" columns={[{ key: "productName", header: "Product" }, { key: "rating", header: "Rating", render: (r: any) => <Stars value={r.rating} /> }, { key: "title", header: "Title" }, { key: "status", header: "Status", render: (r: any) => <StatusBadge status={r.status} /> }]} />}
      {tab === 5 && <DataTable rows={c.activity} keyField="id" empty="No activity" columns={[{ key: "createdAt", header: "When", render: (n: any) => formatDateTime(n.createdAt) }, { key: "type", header: "Type" }, { key: "channel", header: "Channel" }, { key: "title", header: "Message" }]} />}
    </div>
  );
}
