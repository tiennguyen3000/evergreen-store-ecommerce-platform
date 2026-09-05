"use client";
import Link from "next/link";
import { Suspense } from "react";
import { DataTable, ErrorState, PageHeader, Pagination, StatusBadge } from "@/components/ui";
import { FilterSelect, SearchInput, useAdminList, useListParams } from "@/components/admin/shared";
import { formatDate, formatMoney } from "@/lib/utils";
function Inner() {
  const { data, isLoading, isError, refetch } = useAdminList("/admin/customers");
  const { set } = useListParams();
  if (isError) return <ErrorState retry={() => refetch()} />;
  return <div><PageHeader title="Customers" description={`${data?.meta?.total ?? "…"} customers`} /><div className="mb-4 flex flex-wrap gap-2"><SearchInput placeholder="Name or email…" /><FilterSelect param="status" label="All statuses" options={[["ACTIVE", "Active"], ["DISABLED", "Disabled"]]} /><FilterSelect param="sort" label="Newest" options={[["ltv", "Lifetime value"]]} /></div>
    <DataTable loading={isLoading && !data} rows={data?.data ?? []} keyField="id" columns={[{ key: "name", header: "Customer", render: (c: any) => <Link href={`/admin/customers/${c.id}`} className="block"><p className="font-medium hover:underline">{c.firstName} {c.lastName}</p><p className="text-xs text-stone">{c.email}</p></Link> }, { key: "status", header: "Status", render: (c: any) => <StatusBadge status={c.status} /> }, { key: "orderCount", header: "Orders" }, { key: "lifetimeValue", header: "Lifetime value", render: (c: any) => formatMoney(c.lifetimeValue) }, { key: "lastOrderAt", header: "Last order", render: (c: any) => formatDate(c.lastOrderAt) }, { key: "createdAt", header: "Joined", render: (c: any) => formatDate(c.createdAt) }]} />
    <div className="mt-6"><Pagination page={data?.meta?.page ?? 1} totalPages={data?.meta?.totalPages ?? 1} onChange={(p) => set({ page: p })} /></div></div>;
}
export default function CustomersPage() { return <Suspense><Inner /></Suspense>; }
