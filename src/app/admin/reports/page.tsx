"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { Card, DataTable, ErrorState, PageHeader, Skeleton, StatCard } from "@/components/ui";
import { get } from "@/lib/api";
import { cn, formatDate, formatMoney } from "@/lib/utils";
const RANGES = [["7d", "7 days"], ["30d", "30 days"], ["90d", "90 days"], ["12m", "12 months"]];
const COLORS = ["#1f3d2b", "#6b7a5a", "#9aa88f", "#b5715a", "#8a867d", "#28324a", "#cfc2a8", "#3a3a3a"];
export default function ReportsPage() {
  const [range, setRange] = useState("30d");
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["reports", range], queryFn: async () => (await get(`/admin/reports?range=${range}`)).data, placeholderData: (p) => p });
  if (isError) return <ErrorState retry={() => refetch()} />;
  if (isLoading || !data) return <Skeleton className="h-96" />;
  const k = data.kpis;
  return (
    <div>
      <PageHeader title="Reports" description="Sales, product and inventory analytics." actions={<div className="flex rounded-full border border-ink/10 bg-white p-1">{RANGES.map(([v, l]) => <button key={v} onClick={() => setRange(v)} className={cn("rounded-full px-3 py-1.5 text-xs font-medium", range === v ? "bg-ink text-white" : "hover:bg-ink/5")}>{l}</button>)}</div>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><StatCard label="Revenue" value={formatMoney(k.revenue.value)} change={k.revenue.change} /><StatCard label="Orders" value={k.orders.value} change={k.orders.change} /><StatCard label="New customers" value={k.customers.value} change={k.customers.change} /><StatCard label="AOV" value={formatMoney(k.aov.value)} change={k.aov.change} /><StatCard label="Units sold" value={k.unitsSold} /></div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3"><StatCard label="Inventory value (cost)" value={formatMoney(k.inventoryValue)} /><StatCard label="Low-stock rows" value={k.lowStockCount} /><StatCard label="Out-of-stock rows" value={k.outOfStockCount} /></div>
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Card className="p-5"><p className="text-sm font-medium">Revenue over time</p><div className="mt-4 h-64"><ResponsiveContainer><AreaChart data={data.series}><CartesianGrid strokeDasharray="3 3" stroke="#eee" /><XAxis dataKey="bucket" tickFormatter={(v) => formatDate(v, { month: "short", day: "numeric" })} fontSize={11} /><YAxis fontSize={11} /><Tooltip formatter={(v: any) => formatMoney(v)} labelFormatter={(v) => formatDate(v as string)} /><Area type="monotone" dataKey="revenue" stroke="#1f3d2b" fill="#1f3d2b22" strokeWidth={2} /></AreaChart></ResponsiveContainer></div></Card>
        <Card className="p-5"><p className="text-sm font-medium">Orders over time</p><div className="mt-4 h-64"><ResponsiveContainer><BarChart data={data.series}><CartesianGrid strokeDasharray="3 3" stroke="#eee" /><XAxis dataKey="bucket" tickFormatter={(v) => formatDate(v, { month: "short", day: "numeric" })} fontSize={11} /><YAxis fontSize={11} allowDecimals={false} /><Tooltip labelFormatter={(v) => formatDate(v as string)} /><Bar dataKey="orders" fill="#6b7a5a" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></Card>
        <Card className="p-5"><p className="text-sm font-medium">Top products by revenue</p><div className="mt-4 h-72"><ResponsiveContainer><BarChart data={data.topProducts} layout="vertical" margin={{ left: 40 }}><XAxis type="number" fontSize={11} /><YAxis type="category" dataKey="name" width={160} fontSize={10} /><Tooltip formatter={(v: any) => formatMoney(v)} /><Bar dataKey="revenue" fill="#1f3d2b" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div></Card>
        <Card className="p-5"><p className="text-sm font-medium">Category sales</p><div className="mt-4 h-72"><ResponsiveContainer><PieChart><Pie data={data.categorySales} dataKey="revenue" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>{data.categorySales.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={(v: any) => formatMoney(v)} /><Legend /></PieChart></ResponsiveContainer></div></Card>
      </div>
      <Card className="mt-6 p-5"><p className="mb-3 text-sm font-medium">Top categories</p><DataTable rows={data.categorySales} keyField="name" columns={[{ key: "name", header: "Category" }, { key: "units", header: "Units" }, { key: "revenue", header: "Revenue", render: (c: any) => formatMoney(c.revenue) }]} /></Card>
    </div>
  );
}
