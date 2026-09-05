"use client";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Field, Input, PageHeader, Skeleton } from "@/components/ui";
import { get, put } from "@/lib/api";
import { cn, titleCase } from "@/lib/utils";
import { useUi } from "@/stores/ui";
const GROUPS = ["store", "shipping", "tax", "payment", "email", "inventory", "security"];
export default function SettingsPage() {
  const qc = useQueryClient();
  const toast = useUi((s) => s.toast);
  const [group, setGroup] = useState("store");
  const [vals, setVals] = useState<Record<string, string>>({});
  const { data, isLoading } = useQuery({ queryKey: ["settings"], queryFn: async () => (await get("/admin/settings")).data });
  useEffect(() => { if (data) setVals(Object.fromEntries(data.map((s: any) => [s.key, typeof s.value === "string" ? s.value : JSON.stringify(s.value)]))); }, [data]);
  const save = useMutation({ mutationFn: () => put("/admin/settings", data.filter((s: any) => s.group === group).map((s: any) => { const raw = vals[s.key]; let value: unknown = raw; if (typeof s.value !== "string") { try { value = JSON.parse(raw); } catch { value = raw; } } return { key: s.key, value }; })), onSuccess: () => { qc.invalidateQueries({ queryKey: ["settings"] }); toast({ title: "Settings saved", variant: "success" }); }, onError: (e: any) => toast({ title: e.message, variant: "error" }) });
  if (isLoading || !data) return <Skeleton className="h-64" />;
  return (
    <div>
      <PageHeader title="Settings" description="Database-backed store configuration. Secrets (JWT, DB, provider keys) live in environment variables only." actions={<Button onClick={() => save.mutate()} loading={save.isPending}>Save {titleCase(group)}</Button>} />
      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col">{GROUPS.map((g) => <button key={g} onClick={() => setGroup(g)} className={cn("shrink-0 rounded-lg px-3 py-2 text-left text-sm capitalize", group === g ? "bg-ink text-white" : "hover:bg-ink/5")}>{g}</button>)}</nav>
        <Card className="p-6"><div className="space-y-4">{data.filter((s: any) => s.group === group).map((s: any) => <Field key={s.key} label={s.key.split(".").slice(1).join(".").replace(/([A-Z])/g, " $1")}>{typeof s.value === "object" ? <textarea className="min-h-[90px] w-full rounded-lg border border-ink/15 px-3 py-2 font-mono text-xs" value={vals[s.key] ?? ""} onChange={(e) => setVals({ ...vals, [s.key]: e.target.value })} /> : <Input value={vals[s.key] ?? ""} onChange={(e) => setVals({ ...vals, [s.key]: e.target.value })} />}</Field>)}
          {group === "payment" && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Active provider: <strong>MockPaymentProvider</strong>. Swap to Stripe/PayPal by implementing the <code>PaymentProvider</code> interface; API keys must be supplied as env vars.</p>}
          {group === "email" && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Active provider: <strong>LoggingEmailProvider</strong> — emails are logged to the server console in development.</p>}
          {group === "security" && <p className="rounded-lg bg-bone p-3 text-xs text-stone">Access tokens: 15 min JWT. Refresh tokens: 30 days, rotated on every use with reuse detection. Passwords: bcrypt (cost 10).</p>}
        </div></Card>
      </div>
    </div>
  );
}
