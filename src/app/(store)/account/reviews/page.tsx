"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { ButtonLink, EmptyState, Skeleton, Stars, StatusBadge } from "@/components/ui";
import { get } from "@/lib/api";
import { formatDate } from "@/lib/utils";
export default function MyReviewsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["my-reviews"], queryFn: async () => (await get("/account/reviews")).data });
  if (isLoading) return <Skeleton className="h-48" />;
  if (!data?.length) return <EmptyState icon={Star} title="No reviews yet" description="Share your experience on items from delivered orders." action={<ButtonLink href="/account/orders" variant="outline">Go to orders</ButtonLink>} />;
  return <div className="space-y-3"><h2 className="font-display text-2xl">My reviews</h2>{data.map((r: any) => <div key={r.id} className="rounded-2xl bg-white p-5 ring-1 ring-ink/10"><div className="flex items-center justify-between"><Link href={`/products/${r.productSlug}`} className="text-sm font-medium hover:text-forest">{r.productName}</Link><StatusBadge status={r.status} /></div><div className="mt-1 flex items-center gap-2"><Stars value={r.rating} /><span className="text-xs text-stone">{formatDate(r.createdAt)}</span></div><p className="mt-2 text-sm font-medium">{r.title}</p><p className="text-sm text-ink/75">{r.comment}</p></div>)}</div>;
}
