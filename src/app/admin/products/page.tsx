"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Copy, Archive, Eye, EyeOff, Trash2 } from "lucide-react";
import { Button, ConfirmDialog, DataTable, ErrorState, PageHeader, Pagination, StatusBadge, ButtonLink } from "@/components/ui";
import { FilterSelect, SearchInput, useAdminList, useListParams, usePerm } from "@/components/admin/shared";
import { del, post } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/utils";
import { useUi } from "@/stores/ui";

function ProductsInner() {
  const { data, isLoading, isError, refetch } = useAdminList("/admin/products");
  const { set } = useListParams();
  const qc = useQueryClient();
  const toast = useUi((s) => s.toast);
  const can = usePerm();
  const [selected, setSelected] = useState<number[]>([]);
  const [confirm, setConfirm] = useState<{ ids: number[]; action: string } | null>(null);
  const inv = () => { qc.invalidateQueries({ queryKey: ["/admin/products"] }); setSelected([]); };
  const act = useMutation({ mutationFn: ({ id, action }: { id: number; action: string }) => (action === "delete" ? del(`/admin/products/${id}`) : post(`/admin/products/${id}/${action}`)), onSuccess: (_r, v) => { inv(); toast({ title: `Product ${v.action}d`, variant: "success" }); if (v.action === "duplicate") toast({ title: "Copy created as draft" }); }, onError: (e: any) => toast({ title: e.message, variant: "error" }) });
  const bulk = useMutation({ mutationFn: (v: { ids: number[]; action: string }) => post("/admin/products/bulk", v), onSuccess: (r) => { inv(); setConfirm(null); toast({ title: `${r.data.affected} products updated`, variant: "success" }); }, onError: (e: any) => toast({ title: e.message, variant: "error" }) });
  if (isError) return <ErrorState retry={() => refetch()} />;
  const rows = data?.data ?? [];
  const allSel = rows.length > 0 && rows.every((r: any) => selected.includes(r.id));
  return (
    <div>
      <PageHeader title="Products" description={`${data?.meta?.total ?? "…"} products in catalog`} actions={can("PRODUCT_CREATE") && <ButtonLink href="/admin/products/new"><Plus className="h-4 w-4" /> New product</ButtonLink>} />
      <div className="mb-4 flex flex-wrap items-center gap-2"><SearchInput placeholder="Search products…" /><FilterSelect param="status" label="All statuses" options={[["ACTIVE", "Active"], ["DRAFT", "Draft"], ["ARCHIVED", "Archived"]]} /><FilterSelect param="type" label="All types" options={[["shoes", "Shoes"], ["apparel", "Apparel"], ["accessories", "Accessories"]]} /><FilterSelect param="sort" label="Newest" options={[["oldest", "Oldest"], ["name_asc", "Name A–Z"]]} />
        {selected.length > 0 && can("PRODUCT_UPDATE") && <div className="ml-auto flex items-center gap-2 rounded-full bg-ink px-3 py-1.5 text-xs text-white"><span>{selected.length} selected</span><button onClick={() => bulk.mutate({ ids: selected, action: "publish" })} className="underline">Publish</button><button onClick={() => bulk.mutate({ ids: selected, action: "unpublish" })} className="underline">Unpublish</button><button onClick={() => bulk.mutate({ ids: selected, action: "archive" })} className="underline">Archive</button>{can("PRODUCT_DELETE") && <button onClick={() => setConfirm({ ids: selected, action: "delete" })} className="text-red-300 underline">Delete</button>}</div>}
      </div>
      <DataTable loading={isLoading && !data} rows={rows} keyField="id" columns={[
        { key: "sel", header: <input type="checkbox" checked={allSel} onChange={(e) => setSelected(e.target.checked ? rows.map((r: any) => r.id) : [])} aria-label="Select all" />, render: (p: any) => <input type="checkbox" checked={selected.includes(p.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, p.id] : selected.filter((x) => x !== p.id))} aria-label={`Select ${p.name}`} />, className: "w-8" },
        { key: "name", header: "Product", render: (p: any) => <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3"><img src={p.images[0]} alt="" className="h-11 w-9 rounded-md bg-sand object-cover" /><div><p className="font-medium hover:underline">{p.name}</p><p className="text-xs text-stone">{p.category} · {p.variantCount} variants</p></div></Link> },
        { key: "status", header: "Status", render: (p: any) => <StatusBadge status={p.status} /> }, { key: "price", header: "Price", render: (p: any) => formatMoney(p.price) }, { key: "available", header: "Stock", render: (p: any) => <span className={p.available === 0 ? "text-red-600" : p.available < 20 ? "text-amber-600" : ""}>{p.available}</span> }, { key: "updatedAt", header: "Updated", render: (p: any) => formatDate(p.updatedAt) },
        { key: "actions", header: "", render: (p: any) => can("PRODUCT_UPDATE") && <div className="flex justify-end gap-1 text-stone">{p.status === "ACTIVE" ? <button title="Unpublish" onClick={() => act.mutate({ id: p.id, action: "unpublish" })} className="rounded p-1.5 hover:bg-ink/5"><EyeOff className="h-4 w-4" /></button> : <button title="Publish" onClick={() => act.mutate({ id: p.id, action: "publish" })} className="rounded p-1.5 hover:bg-ink/5"><Eye className="h-4 w-4" /></button>}<button title="Duplicate" onClick={() => act.mutate({ id: p.id, action: "duplicate" })} className="rounded p-1.5 hover:bg-ink/5"><Copy className="h-4 w-4" /></button><button title="Archive" onClick={() => act.mutate({ id: p.id, action: "archive" })} className="rounded p-1.5 hover:bg-ink/5"><Archive className="h-4 w-4" /></button>{can("PRODUCT_DELETE") && <button title="Delete" onClick={() => setConfirm({ ids: [p.id], action: "delete" })} className="rounded p-1.5 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}</div>, className: "text-right" },
      ]} />
      <div className="mt-6"><Pagination page={data?.meta?.page ?? 1} totalPages={data?.meta?.totalPages ?? 1} onChange={(p) => set({ page: p })} /></div>
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} danger title={`Delete ${confirm?.ids.length} product(s)?`} description="This permanently removes the product, its variants and inventory records." confirmLabel="Delete" loading={bulk.isPending} onConfirm={() => confirm && bulk.mutate({ ids: confirm.ids, action: "delete" })} />
    </div>
  );
}
export default function ProductsPage() { return <Suspense><ProductsInner /></Suspense>; }
