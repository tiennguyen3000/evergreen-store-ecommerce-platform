"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { ButtonLink, EmptyState, Pagination, Skeleton, StatusBadge } from "@/components/ui";
import { get } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/utils";
export default function OrdersPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({ queryKey: ["orders", page], queryFn: () => get(`/orders?page=${page}&pageSize=10`), placeholderData: (p) => p });
  if (isLoading) return <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>;
  if (!data?.data?.length) return <EmptyState icon={Package} title="No orders yet" description="When you place an order it will show up here." action={<ButtonLink href="/collections/all">Start shopping</ButtonLink>} />;
  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl">Order history</h2>
      {data.data.map((o: any) => (
        <Link key={o.id} href={`/account/orders/${o.id}`} className="block rounded-2xl bg-white p-5 ring-1 ring-ink/10 transition hover:ring-ink/30">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium">{o.orderNumber}</p><p className="text-xs text-stone">Placed {formatDate(o.createdAt)}</p></div><div className="flex items-center gap-3"><StatusBadge status={o.status} /><span className="font-medium">{formatMoney(o.grandTotal)}</span></div></div>
          <div className="mt-4 flex gap-2">{o.items.slice(0, 5).map((i: any) => <img key={i.id} src={i.imageUrl} alt={i.productName} className="h-16 w-14 rounded-lg bg-sand object-cover" />)}{o.items.length > 5 && <span className="flex h-16 w-14 items-center justify-center rounded-lg bg-sand text-xs">+{o.items.length - 5}</span>}</div>
        </Link>
      ))}
      <Pagination page={data.meta.page} totalPages={data.meta.totalPages} onChange={setPage} />
    </div>
  );
}
