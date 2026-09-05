"use client";
import Link from "next/link";
import { Suspense } from "react";
import { DataTable, ErrorState, PageHeader, Pagination, StatusBadge } from "@/components/ui";
import { DateRangePicker, FilterSelect, SearchInput, useAdminList, useListParams } from "@/components/admin/shared";
import { ORDER_STATUSES, formatDateTime, formatMoney, titleCase } from "@/lib/utils";
function Inner() {
  const { data, isLoading, isError, refetch } = useAdminList("/admin/orders");
  const { set } = useListParams();
  if (isError) return <ErrorState retry={() => refetch()} />;
  return (
    <div>
      <PageHeader title="Orders" description={`${data?.meta?.total ?? "…"} orders`} />
      <div className="mb-4 flex flex-wrap items-center gap-2"><SearchInput placeholder="Order # or email…" /><FilterSelect param="status" label="All statuses" options={ORDER_STATUSES.map((s) => [s, titleCase(s)])} /><DateRangePicker /><FilterSelect param="sort" label="Newest" options={[["oldest", "Oldest"], ["total_desc", "Highest total"]]} /></div>
      <DataTable loading={isLoading && !data} rows={data?.data ?? []} keyField="id" columns={[{ key: "orderNumber", header: "Order", render: (o: any) => <Link href={`/admin/orders/${o.id}`} className="font-medium hover:underline">{o.orderNumber}</Link> }, { key: "customer", header: "Customer", render: (o: any) => <div><p>{o.customer}</p><p className="text-xs text-stone">{o.email}</p></div> }, { key: "status", header: "Status", render: (o: any) => <StatusBadge status={o.status} /> }, { key: "paymentStatus", header: "Payment", render: (o: any) => <StatusBadge status={o.paymentStatus ?? "PENDING"} /> }, { key: "itemCount", header: "Items" }, { key: "grandTotal", header: "Total", render: (o: any) => formatMoney(o.grandTotal) }, { key: "createdAt", header: "Date", render: (o: any) => formatDateTime(o.createdAt) }]} />
      <div className="mt-6"><Pagination page={data?.meta?.page ?? 1} totalPages={data?.meta?.totalPages ?? 1} onChange={(p) => set({ page: p })} /></div>
    </div>
  );
}
export default function OrdersPage() { return <Suspense><Inner /></Suspense>; }
