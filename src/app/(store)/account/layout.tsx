"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Heart, MapPin, Package, Star, User, LayoutDashboard, LogOut, Shield } from "lucide-react";
import { useLogout, useMe } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui";

const LINKS = [["/account", "Overview", LayoutDashboard], ["/account/orders", "Orders", Package], ["/account/wishlist", "Wishlist", Heart], ["/account/addresses", "Addresses", MapPin], ["/account/reviews", "Reviews", Star], ["/account/profile", "Profile & security", User]] as const;
export default function AccountLayout({ children }: { children: ReactNode }) {
  const { data: me, isLoading } = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const logout = useLogout();
  useEffect(() => { if (!isLoading && !me) router.replace(`/login?next=${encodeURIComponent(pathname)}`); }, [isLoading, me, router, pathname]);
  if (isLoading || !me) return <div className="container-x py-12"><Skeleton className="h-8 w-48" /><Skeleton className="mt-6 h-64" /></div>;
  return (
    <div className="container-x py-10 sm:py-14">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone">My account</p><h1 className="mt-1 font-display text-3xl">Hi, {me.firstName}</h1></div>{me.isStaff && <Link href="/admin" className="flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-medium text-white"><Shield className="h-3.5 w-3.5" /> Open admin</Link>}</div>
      <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
        <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 no-scrollbar lg:mx-0 lg:flex-col lg:px-0" aria-label="Account">
          {LINKS.map(([href, label, Icon]) => <Link key={href} href={href} className={cn("flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm lg:rounded-lg", pathname === href ? "bg-ink text-white" : "hover:bg-ink/5")}><Icon className="h-4 w-4" />{label}</Link>)}
          <button onClick={() => logout.mutate()} className="flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm text-stone hover:bg-ink/5 lg:rounded-lg"><LogOut className="h-4 w-4" />Sign out</button>
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
