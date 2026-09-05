"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, DataTable, Dialog, ErrorState, Field, Input, PageHeader, Pagination, Select, StatCard, Textarea } from "@/components/ui";
import { FilterSelect, SearchInput, useAdminList, useListParams, usePerm } from "@/components/admin/shared";
import { get, post } from "@/lib/api";
import { cn, formatDateTime } from "@/lib/utils";
import { useUi } from "@/stores/ui";
function Inner() {
  const { data, isLoading, isError, refetch } = useAdminList("/admin/inventory");
  const { set, sp } = useListParams();
  const qc = useQueryClient();
  const toast = useUi((s) => s.toast);
  const can = usePerm();
  const [adj, setAdj] = useState<any>(null);
  const [form, setForm] = useState({ type: "ADJUSTMENT", quantity: 0, reason: "", reorderLevel: "" });
  const [history, setHistory] = useState<any>(null);
  const { data: whs } = useQuery({ queryKey: ["warehouses"], queryFn: async () => (await get("/admin/warehouses")).data });
  const { data: tx } = useQuery({ queryKey: ["inv-tx", history?.variantId, history?.warehouseId], queryFn: async () => (await get(`/admin/inventory/transactions?variantId=${history.variantId}&warehouseId=${history.warehouseId}&pageSize=30`)).data, enabled: !!history });
  const adjust = useMutation({ mutationFn: () => post("/admin/inventory/adjustments", { variantId: adj.variantId, warehouseId: adj.warehouseId, type: form.type, quantity: Number(form.quantity), reason: form.reason, reorderLevel: form.reorderLevel === "" ? undefined : Number(form.reorderLevel) }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["/admin/inventory"] }); setAdj(null); setForm({ type: "ADJUSTMENT", quantity: 0, reason: "", reorderLevel: "" }); toast({ title: "Inventory adjusted", variant: "success" }); }, onError: (e: any) => toast({ title: e.message, variant: "error" }) });
  if (isError) return <ErrorState retry={() => refetch()} />;
  const s = data?.meta?.summary;
  return (
    <div>
      <PageHeader title="Inventory" description="Stock per SKU per warehouse. All changes are recorded as ledger transactions." actions={<Link href="/admin/warehouses" className="rounded-full border border-ink/15 px-4 py-2 text-sm hover:bg-ink/5">Warehouses & transfers</Link>} />
      {s && <div className="mb-5 grid gap-4 sm:grid-cols-4"><StatCard label="Units on hand" value={s.onHand.toLocaleString()} /><StatCard label="Reserved" value={s.reserved.toLocaleString()} /><StatCard label="Low stock rows" value={s.low} /><StatCard label="Out of stock rows" value={s.out} /></div>}
      <div className="mb-4 flex flex-wrap gap-2"><SearchInput placeholder="SKU or product…" /><FilterSelect param="warehouseId" label="All warehouses" options={(whs ?? []).map((w: any) => [String(w.id), `${w.code} — ${w.name}`])} /><FilterSelect param="stock" label="All stock levels" options={[["low", "Low stock"], ["out", "Out of stock"]]} /><FilterSelect param="sort" label="Sort: product" options={[["available_asc", "Lowest available"]]} /></div>
      <DataTable loading={isLoading && !data} rows={data?.data ?? []} keyField="id" columns={[{ key: "sku", header: "SKU", render: (r: any) => <span className="font-mono text-xs">{r.sku}</span> }, { key: "productName", header: "Product", render: (r: any) => <Link href={`/admin/products/${r.productId}`} className="hover:underline">{r.productName}<span className="block text-xs text-stone">{r.color} / {r.size}</span></Link> }, { key: "warehouseCode", header: "Warehouse", render: (r: any) => <span title={r.warehouseName}>{r.warehouseCode}</span> }, { key: "quantityOnHand", header: "On hand" }, { key: "quantityReserved", header: "Reserved" }, { key: "quantityAvailable", header: "Available", render: (r: any) => <span className={cn("font-semibold", r.quantityAvailable <= 0 ? "text-red-600" : r.quantityAvailable <= r.reorderLevel ? "text-amber-600" : "")}>{r.quantityAvailable}</span> }, { key: "reorderLevel", header: "Reorder at" }, { key: "actions", header: "", render: (r: any) => <div className="flex justify-end gap-2"><button onClick={() => setHistory(r)} className="text-xs underline-offset-4 hover:underline">History</button>{can("INVENTORY_UPDATE") && <Button size="sm" variant="outline" onClick={() => setAdj(r)}>Adjust</Button>}</div>, className: "text-right" }]} />
      <div className="mt-6"><Pagination page={data?.meta?.page ?? 1} totalPages={data?.meta?.totalPages ?? 1} onChange={(p) => set({ page: p })} /></div>
      <Dialog open={!!adj} onClose={() => setAdj(null)} title="Adjust inventory">
        {adj && <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); adjust.mutate(); }}><div className="rounded-lg bg-bone p-3 text-sm"><p className="font-medium">{adj.productName} · {adj.color} / {adj.size}</p><p className="font-mono text-xs">{adj.sku} @ {adj.warehouseCode}</p><p className="mt-1 text-xs text-stone">On hand {adj.quantityOnHand} · Reserved {adj.quantityReserved} · Available {adj.quantityAvailable}</p></div>
          <Field label="Transaction type"><Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="ADJUSTMENT">Adjustment (+/−)</option><option value="PURCHASE">Purchase receipt (+)</option><option value="RETURN">Customer return (+)</option><option value="DAMAGE">Damage / write-off (−)</option></Select></Field>
          <Field label={form.type === "ADJUSTMENT" ? "Quantity (negative to reduce)" : "Quantity"}><Input type="number" required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} /></Field>
          <Field label="Reason (required for audit)"><Textarea required minLength={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Cycle count correction, PO-1234 received…" /></Field>
          <Field label="Reorder level (optional)"><Input type="number" min={0} value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} placeholder={String(adj.reorderLevel)} /></Field>
          <Button type="submit" className="w-full" loading={adjust.isPending}>Apply adjustment</Button></form>}
      </Dialog>
      <Dialog open={!!history} onClose={() => setHistory(null)} title={`Stock movements · ${history?.sku ?? ""}`} className="max-w-2xl">
        <DataTable rows={tx ?? []} keyField="id" empty="No transactions" columns={[{ key: "createdAt", header: "When", render: (t: any) => formatDateTime(t.createdAt) }, { key: "type", header: "Type" }, { key: "quantity", header: "Qty", render: (t: any) => <span className={t.quantity < 0 ? "text-red-600" : "text-emerald-700"}>{t.quantity > 0 ? `+${t.quantity}` : t.quantity}</span> }, { key: "referenceId", header: "Reference", render: (t: any) => `${t.referenceType ?? ""} ${t.referenceId ?? ""}` }, { key: "reason", header: "Reason" }, { key: "actor", header: "By", render: (t: any) => t.actor ?? "system" }]} />
      </Dialog>
      {sp.get("stock") === "low" && <p className="mt-3 text-xs text-stone">Showing rows at or below their reorder level.</p>}
    </div>
  );
}
export default function InventoryPage() { return <Suspense><Inner /></Suspense>; }
