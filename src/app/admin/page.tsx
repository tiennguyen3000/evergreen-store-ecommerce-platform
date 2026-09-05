"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, DataTable, ErrorState, PageHeader, Skeleton, StatCard, StatusBadge } from "@/components/ui";
import { get } from "@/lib/api";
import { cn, formatDate, formatMoney } from "@/lib/utils";

const RANGES = [["today", "Today"], ["7d", "7 days"], ["30d", "30 days"], ["90d", "90 days"], ["this_year", "This year"]];
export default function AdminDashboard() {
  const [range, setRange] = useState("30d");
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["analytics", range], queryFn: async () => (await get(`/admin/analytics?range=${range}`)).data, placeholderData: (p) => p });
  if (isError) return <ErrorState retry={() => refetch()} />;
  const k = data?.kpis;
  return (
    <div>
      <PageHeader title="Dashboard" description="Store performance at a glance." actions={<div className="flex rounded-full border border-ink/10 bg-white p-1">{RANGES.map(([v, l]) => <button key={v} onClick={() => setRange(v)} className={cn("rounded-full px-3 py-1.5 text-xs font-medium", range === v ? "bg-ink text-white" : "hover:bg-ink/5")}>{l}</button>)}</div>} />
      {isLoading || !data ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}</div> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Revenue" value={formatMoney(k.revenue.value)} change={k.revenue.change} /><StatCard label="Orders" value={k.orders.value} change={k.orders.change} /><StatCard label="New customers" value={k.customers.value} change={k.customers.change} /><StatCard label="Avg. order value" value={formatMoney(k.aov.value)} change={k.aov.change} />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Active products" value={k.products} hint="Published in catalog" /><StatCard label="Units sold" value={k.unitsSold} hint="In selected period" /><StatCard label="Conversion rate" value={`${k.conversionRate}%`} hint="Placeholder — connect analytics" /><StatCard label="Inventory alerts" value={k.lowStockCount} hint={`${k.outOfStockCount} SKUs out of stock`} />
          </div>
          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            <Card className="p-5"><p className="text-sm font-medium">Revenue over time</p><div className="mt-4 h-64"><ResponsiveContainer><AreaChart data={data.series}><defs><linearGradient id="rev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1f3d2b" stopOpacity={0.35} /><stop offset="100%" stopColor="#1f3d2b" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#eee" /><XAxis dataKey="bucket" tickFormatter={(v) => formatDate(v, { month: "short", day: "numeric" })} fontSize={11} /><YAxis fontSize={11} tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} /><Tooltip formatter={(v: any) => formatMoney(v)} labelFormatter={(v) => formatDate(v as string)} /><Area type="monotone" dataKey="revenue" stroke="#1f3d2b" fill="url(#rev)" strokeWidth={2} /></AreaChart></ResponsiveContainer></div></Card>
            <Card className="p-5"><p className="text-sm font-medium">Orders over time</p><div className="mt-4 h-64"><ResponsiveContainer><BarChart data={data.series}><CartesianGrid strokeDasharray="3 3" stroke="#eee" /><XAxis dataKey="bucket" tickFormatter={(v) => formatDate(v, { month: "short", day: "numeric" })} fontSize={11} /><YAxis fontSize={11} allowDecimals={false} /><Tooltip labelFormatter={(v) => formatDate(v as string)} /><Bar dataKey="orders" fill="#9aa88f" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></Card>
          </div>
          <div className="mt-6 grid gap-4 xl:grid-cols-3">
            <Card className="p-5 xl:col-span-2"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-medium">Recent orders</p><Link href="/admin/orders" className="text-xs underline-offset-4 hover:underline">View all</Link></div>
              <DataTable rows={data.recentOrders} keyField="id" columns={[{ key: "orderNumber", header: "Order", render: (o: any) => <Link href={`/admin/orders/${o.id}`} className="font-medium hover:underline">{o.orderNumber}</Link> }, { key: "customer", header: "Customer" }, { key: "status", header: "Status", render: (o: any) => <StatusBadge status={o.status} /> }, { key: "grandTotal", header: "Total", render: (o: any) => formatMoney(o.grandTotal) }, { key: "createdAt", header: "Date", render: (o: any) => formatDate(o.createdAt) }]} /></Card>
            <Card className="p-5"><p className="mb-3 text-sm font-medium">Top selling products</p><ul className="space-y-3">{data.topProducts.map((p: any) => <li key={p.productId ?? p.name} className="flex items-center gap-3 text-sm"><img src={p.image} alt="" className="h-10 w-9 rounded-md bg-sand object-cover" /><div className="flex-1 truncate"><p className="truncate font-medium">{p.name}</p><p className="text-xs text-stone">{p.units} units</p></div><span>{formatMoney(p.revenue)}</span></li>)}</ul></Card>
          </div>
          <Card className="mt-6 p-5"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-medium">Low stock alerts</p><Link href="/admin/inventory?stock=low" className="text-xs underline-offset-4 hover:underline">Manage inventory</Link></div>
            <DataTable rows={data.lowStock} keyField="variantId" empty="All SKUs are above reorder level" columns={[{ key: "sku", header: "SKU", render: (r: any) => <span className="font-mono text-xs">{r.sku}</span> }, { key: "productName", header: "Product", render: (r: any) => `${r.productName} · ${r.color} / ${r.size}` }, { key: "warehouse", header: "Warehouse" }, { key: "available", header: "Available", render: (r: any) => <span className={cn("font-semibold", r.available <= 0 ? "text-red-600" : "text-amber-600")}>{r.available}</span> }, { key: "reorderLevel", header: "Reorder at" }]} /></Card>
        </>
      )}
    </div>
  );
}
