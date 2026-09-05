"use client";
import { Suspense, useState } from "react";
import { DataTable, Dialog, ErrorState, PageHeader, Pagination, Badge } from "@/components/ui";
import { FilterSelect, SearchInput, useAdminList, useListParams } from "@/components/admin/shared";
import { formatDateTime } from "@/lib/utils";
function Inner() {
  const { data, isLoading, isError, refetch } = useAdminList("/admin/audit-logs");
  const { set } = useListParams();
  const [row, setRow] = useState<any>(null);
  if (isError) return <ErrorState retry={() => refetch()} />;
  return <div><PageHeader title="Audit logs" description="Immutable record of sensitive admin operations." /><div className="mb-4 flex flex-wrap gap-2"><SearchInput placeholder="Filter by action (e.g. PRODUCT)…" param="action" /><FilterSelect param="entityType" label="All entities" options={[["Product", "Product"], ["Order", "Order"], ["User", "User"], ["WarehouseInventory", "Inventory"], ["InventoryTransfer", "Transfer"], ["Coupon", "Coupon"], ["Review", "Review"], ["StoreSettings", "Settings"], ["Warehouse", "Warehouse"], ["Category", "Category"], ["Collection", "Collection"]]} /></div>
    <DataTable loading={isLoading && !data} rows={data?.data ?? []} keyField="id" onRowClick={setRow} columns={[{ key: "createdAt", header: "When", render: (l: any) => formatDateTime(l.createdAt) }, { key: "actor", header: "Actor", render: (l: any) => <div><p>{l.actor ?? "system"}</p><p className="text-xs text-stone">{l.actorEmail}</p></div> }, { key: "action", header: "Action", render: (l: any) => <Badge>{l.action}</Badge> }, { key: "entityType", header: "Entity", render: (l: any) => `${l.entityType} #${l.entityId ?? ""}` }, { key: "ipAddress", header: "IP" }, { key: "diff", header: "Change", render: (l: any) => <span className="line-clamp-1 max-w-xs font-mono text-[11px] text-stone">{l.newValue ? JSON.stringify(l.newValue) : "—"}</span> }]} />
    <div className="mt-6"><Pagination page={data?.meta?.page ?? 1} totalPages={data?.meta?.totalPages ?? 1} onChange={(p) => set({ page: p })} /></div>
    <Dialog open={!!row} onClose={() => setRow(null)} title={row?.action} className="max-w-2xl">{row && <div className="grid gap-4 text-xs sm:grid-cols-2"><div><p className="mb-1 font-semibold uppercase tracking-wider text-stone">Before</p><pre className="overflow-auto rounded-lg bg-bone p-3">{JSON.stringify(row.oldValue, null, 2) ?? "null"}</pre></div><div><p className="mb-1 font-semibold uppercase tracking-wider text-stone">After</p><pre className="overflow-auto rounded-lg bg-bone p-3">{JSON.stringify(row.newValue, null, 2) ?? "null"}</pre></div><p className="sm:col-span-2 text-stone">{row.entityType} #{row.entityId} · {row.actor} · {row.ipAddress} · {formatDateTime(row.createdAt)}</p></div>}</Dialog></div>;
}
export default function AuditLogsPage() { return <Suspense><Inner /></Suspense>; }
