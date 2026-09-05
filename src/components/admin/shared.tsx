"use client";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Search } from "lucide-react";
import { Input, Select } from "@/components/ui";
import { get } from "@/lib/api";
import { useMe } from "@/lib/hooks";

/** Read/write list state (search, filters, page) from the URL so admin views are shareable. */
export function useListParams() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const set = useCallback((patch: Record<string, string | number | null | undefined>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) { if (v == null || v === "") next.delete(k); else next.set(k, String(v)); }
    if (!("page" in patch)) next.delete("page");
    router.replace(`${pathname}?${next.toString()}`);
  }, [sp, router, pathname]);
  return { sp, set, query: sp.toString() ? `?${sp.toString()}` : "" };
}
export function useAdminList<T = any>(path: string, extra = "") {
  const { query } = useListParams();
  const url = `${path}${query}${extra ? (query ? "&" : "?") + extra : ""}`;
  return useQuery({ queryKey: [path, url], queryFn: () => get<T[]>(url), placeholderData: (p) => p });
}
export function SearchInput({ placeholder = "Search…", param = "q" }: { placeholder?: string; param?: string }) {
  const { sp, set } = useListParams();
  return <div className="relative w-full sm:w-72"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone" /><Input defaultValue={sp.get(param) ?? ""} placeholder={placeholder} className="h-10 pl-9" onKeyDown={(e) => { if (e.key === "Enter") set({ [param]: (e.target as HTMLInputElement).value }); }} onBlur={(e) => { if (e.target.value !== (sp.get(param) ?? "")) set({ [param]: e.target.value }); }} /></div>;
}
export function FilterSelect({ param, options, label }: { param: string; options: [string, string][]; label: string }) {
  const { sp, set } = useListParams();
  return <Select value={sp.get(param) ?? ""} onChange={(e) => set({ [param]: e.target.value })} className="h-10 w-auto" aria-label={label}><option value="">{label}</option>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>;
}
export function DateRangePicker() {
  const { sp, set } = useListParams();
  return <div className="flex items-center gap-2 text-xs"><Input type="date" className="h-10 w-auto" value={sp.get("from") ?? ""} onChange={(e) => set({ from: e.target.value })} aria-label="From" /><span className="text-stone">to</span><Input type="date" className="h-10 w-auto" value={sp.get("to") ?? ""} onChange={(e) => set({ to: e.target.value })} aria-label="To" /></div>;
}
export const usePerm = () => { const { data: me } = useMe(); return (p: string) => !!me && (me.roles?.includes("SUPER_ADMIN") || me.permissions?.includes(p)); };
