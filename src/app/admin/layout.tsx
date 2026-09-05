"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, Package, Tags, Layers, ShoppingCart, Users, Boxes, Warehouse, Ticket, Star, UserCog, BarChart3, ScrollText, Settings, Menu, X, Bell, ExternalLink, LogOut, Leaf } from "lucide-react";
import { useLogout, useMe } from "@/lib/hooks";
import { get } from "@/lib/api";
import { cn } from "@/lib/utils";
import { LoadingState, ErrorState, ButtonLink } from "@/components/ui";

const NAV = [
  ["/admin", "Dashboard", LayoutDashboard, "REPORT_VIEW"], ["/admin/products", "Products", Package, "PRODUCT_VIEW"], ["/admin/categories", "Categories", Tags, "PRODUCT_VIEW"], ["/admin/collections", "Collections", Layers, "PRODUCT_VIEW"],
  ["/admin/orders", "Orders", ShoppingCart, "ORDER_VIEW"], ["/admin/customers", "Customers", Users, "CUSTOMER_VIEW"], ["/admin/inventory", "Inventory", Boxes, "INVENTORY_VIEW"], ["/admin/warehouses", "Warehouses", Warehouse, "INVENTORY_VIEW"],
  ["/admin/promotions", "Promotions", Ticket, "PRODUCT_VIEW"], ["/admin/reviews", "Reviews", Star, "PRODUCT_VIEW"], ["/admin/employees", "Employees", UserCog, "EMPLOYEE_VIEW"], ["/admin/reports", "Reports", BarChart3, "REPORT_VIEW"],
  ["/admin/audit-logs", "Audit Logs", ScrollText, "AUDIT_VIEW"], ["/admin/settings", "Settings", Settings, "SETTINGS_MANAGE"],
] as const;

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { data: me, isLoading } = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const logout = useLogout();
  const [open, setOpen] = useState(false);
  const [bell, setBell] = useState(false);
  const { data: notes } = useQuery({ queryKey: ["admin-notes"], queryFn: async () => (await get("/admin/notifications")).data, enabled: !!me?.isStaff });
  useEffect(() => { if (!isLoading && !me) router.replace(`/login?next=${encodeURIComponent(pathname)}`); }, [isLoading, me, router, pathname]);
  useEffect(() => setOpen(false), [pathname]);
  if (isLoading || !me) return <LoadingState label="Loading admin…" />;
  if (!me.isStaff) return <div className="mx-auto max-w-lg p-10"><ErrorState title="Forbidden" description="Your account doesn't have access to the admin console." /><div className="mt-4 text-center"><ButtonLink href="/" variant="outline">Back to store</ButtonLink></div></div>;
  const can = (p: string) => me.roles?.includes("SUPER_ADMIN") || me.permissions?.includes(p);
  const crumbs = pathname.split("/").filter(Boolean);
  const Sidebar = (
    <aside className="flex h-full w-64 flex-col bg-ink text-white">
      <div className="flex h-16 items-center gap-2 px-5"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest"><Leaf className="h-4 w-4" /></span><span className="font-display text-lg">Evergreen Admin</span></div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">{NAV.filter(([, , , perm]) => can(perm)).map(([href, label, Icon]) => <Link key={href} href={href} className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white", (pathname === href || (href !== "/admin" && pathname.startsWith(href))) && "bg-white/15 text-white")}><Icon className="h-4 w-4" />{label}</Link>)}</nav>
      <div className="border-t border-white/10 p-4 text-xs"><p className="font-medium">{me.firstName} {me.lastName}</p><p className="text-white/50">{me.roles.join(", ")}</p><div className="mt-3 flex gap-3"><Link href="/" className="flex items-center gap-1 text-white/70 hover:text-white"><ExternalLink className="h-3 w-3" /> Storefront</Link><button onClick={() => logout.mutate()} className="flex items-center gap-1 text-white/70 hover:text-white"><LogOut className="h-3 w-3" /> Sign out</button></div></div>
    </aside>
  );
  return (
    <div className="flex min-h-screen bg-bone">
      <div className="hidden lg:block lg:sticky lg:top-0 lg:h-screen">{Sidebar}</div>
      {open && <div className="fixed inset-0 z-50 lg:hidden"><div className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} /><div className="absolute inset-y-0 left-0">{Sidebar}</div><button onClick={() => setOpen(false)} className="absolute left-[17rem] top-4 rounded-full bg-white p-2"><X className="h-5 w-5" /></button></div>}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-ink/10 bg-white/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3"><button onClick={() => setOpen(true)} className="rounded-lg p-2 hover:bg-ink/5 lg:hidden" aria-label="Menu"><Menu className="h-5 w-5" /></button><nav className="flex items-center gap-1.5 text-xs text-stone">{crumbs.map((c, i) => <span key={i} className="flex items-center gap-1.5">{i > 0 && "/"}<Link href={`/${crumbs.slice(0, i + 1).join("/")}`} className={cn("capitalize hover:text-ink", i === crumbs.length - 1 && "text-ink")}>{c.replace(/-/g, " ")}</Link></span>)}</nav></div>
          <div className="relative"><button onClick={() => setBell(!bell)} className="relative rounded-lg p-2 hover:bg-ink/5" aria-label="Notifications"><Bell className="h-5 w-5" />{notes?.some((n: any) => !n.readAt) && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-clay" />}</button>
            {bell && <div className="absolute right-0 mt-2 w-80 rounded-xl border border-ink/10 bg-white p-2 shadow-xl"><p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-stone">Notifications</p>{notes?.length ? notes.slice(0, 6).map((n: any) => <div key={n.id} className="rounded-lg px-2 py-2 text-sm hover:bg-bone"><p className="font-medium">{n.title}</p><p className="text-xs text-stone">{n.body}</p></div>) : <p className="px-2 py-4 text-sm text-stone">No notifications</p>}</div>}
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
