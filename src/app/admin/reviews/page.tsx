"use client";
import Link from "next/link";
import { Suspense } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, DataTable, ErrorState, PageHeader, Pagination, Stars, StatusBadge } from "@/components/ui";
import { FilterSelect, useAdminList, useListParams, usePerm } from "@/components/admin/shared";
import { del, patch } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { useUi } from "@/stores/ui";
function Inner() {
  const { data, isLoading, isError, refetch } = useAdminList("/admin/reviews");
  const { set } = useListParams();
  const qc = useQueryClient();
  const toast = useUi((s) => s.toast);
  const can = usePerm();
  const inv = () => qc.invalidateQueries({ queryKey: ["/admin/reviews"] });
  const mod = useMutation({ mutationFn: (v: { id: number; status: string }) => patch(`/admin/reviews/${v.id}`, { status: v.status }), onSuccess: () => { inv(); toast({ title: "Review updated", variant: "success" }); }, onError: (e: any) => toast({ title: e.message, variant: "error" }) });
  const remove = useMutation({ mutationFn: (id: number) => del(`/admin/reviews/${id}`), onSuccess: inv, onError: (e: any) => toast({ title: e.message, variant: "error" }) });
  if (isError) return <ErrorState retry={() => refetch()} />;
  return <div><PageHeader title="Reviews" description="Moderate customer reviews. Approved reviews update product ratings." /><div className="mb-4"><FilterSelect param="status" label="All statuses" options={[["PENDING", "Pending"], ["APPROVED", "Approved"], ["REJECTED", "Rejected"]]} /></div>
    <DataTable loading={isLoading && !data} rows={data?.data ?? []} keyField="id" columns={[{ key: "productName", header: "Product", render: (r: any) => <Link href={`/products/${r.productSlug}`} className="hover:underline">{r.productName}</Link> }, { key: "rating", header: "Rating", render: (r: any) => <Stars value={r.rating} /> }, { key: "review", header: "Review", render: (r: any) => <div className="max-w-md"><p className="font-medium">{r.title}</p><p className="line-clamp-2 text-xs text-stone">{r.comment}</p></div> }, { key: "author", header: "Author", render: (r: any) => <div><p>{r.author}</p>{r.isVerifiedPurchase && <p className="text-[10px] uppercase text-forest">Verified</p>}</div> }, { key: "status", header: "Status", render: (r: any) => <StatusBadge status={r.status} /> }, { key: "createdAt", header: "Date", render: (r: any) => formatDate(r.createdAt) }, { key: "actions", header: "", render: (r: any) => can("PRODUCT_UPDATE") && <div className="flex justify-end gap-1">{r.status !== "APPROVED" && <Button size="sm" variant="outline" onClick={() => mod.mutate({ id: r.id, status: "APPROVED" })}>Approve</Button>}{r.status !== "REJECTED" && <Button size="sm" variant="ghost" onClick={() => mod.mutate({ id: r.id, status: "REJECTED" })}>Reject</Button>}{can("PRODUCT_DELETE") && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove.mutate(r.id)}>Delete</Button>}</div>, className: "text-right" }]} />
    <div className="mt-6"><Pagination page={data?.meta?.page ?? 1} totalPages={data?.meta?.totalPages ?? 1} onChange={(p) => set({ page: p })} /></div></div>;
}
export default function ReviewsPage() { return <Suspense><Inner /></Suspense>; }
