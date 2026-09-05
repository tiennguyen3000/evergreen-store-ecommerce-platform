"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Plus } from "lucide-react";
import { Button, Checkbox, Dialog, EmptyState, Field, Input, Skeleton } from "@/components/ui";
import { del, get, post, put } from "@/lib/api";
import { useUi } from "@/stores/ui";
const empty = { label: "Home", firstName: "", lastName: "", line1: "", line2: "", city: "", region: "", postalCode: "", country: "US", phone: "", isDefault: false };
export default function AddressesPage() {
  const qc = useQueryClient();
  const toast = useUi((s) => s.toast);
  const [editing, setEditing] = useState<any>(null);
  const { data, isLoading } = useQuery({ queryKey: ["addresses"], queryFn: async () => (await get("/account/addresses")).data });
  const inv = () => qc.invalidateQueries({ queryKey: ["addresses"] });
  const save = useMutation({ mutationFn: (a: any) => (a.id ? put(`/account/addresses/${a.id}`, a) : post("/account/addresses", a)), onSuccess: () => { inv(); setEditing(null); toast({ title: "Address saved", variant: "success" }); }, onError: (e: any) => toast({ title: e.message, variant: "error" }) });
  const remove = useMutation({ mutationFn: (id: number) => del(`/account/addresses/${id}`), onSuccess: inv });
  if (isLoading) return <Skeleton className="h-48" />;
  return (
    <div>
      <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-2xl">Addresses</h2><Button size="sm" onClick={() => setEditing({ ...empty })}><Plus className="h-4 w-4" /> Add address</Button></div>
      {!data?.length ? <EmptyState icon={MapPin} title="No saved addresses" description="Add an address to speed up checkout." /> : <div className="grid gap-4 sm:grid-cols-2">{data.map((a: any) => <div key={a.id} className="rounded-2xl bg-white p-5 text-sm ring-1 ring-ink/10"><div className="flex items-center justify-between"><p className="font-medium">{a.label ?? "Address"}</p>{a.isDefault && <span className="rounded-full bg-forest/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-forest">Default</span>}</div><p className="mt-2 text-ink/80">{a.firstName} {a.lastName}<br />{a.line1}{a.line2 && <>, {a.line2}</>}<br />{a.city}, {a.region} {a.postalCode}<br />{a.country}</p><div className="mt-3 flex gap-3 text-xs"><button onClick={() => setEditing({ ...a, line2: a.line2 ?? "", phone: a.phone ?? "" })} className="underline underline-offset-4">Edit</button><button onClick={() => remove.mutate(a.id)} className="text-red-600 underline underline-offset-4">Delete</button></div></div>)}</div>}
      <Dialog open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit address" : "New address"}>
        {editing && <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate({ ...editing, line2: editing.line2 || null, phone: editing.phone || null }); }}>
          <Field label="Label"><Input value={editing.label ?? ""} onChange={(e) => setEditing({ ...editing, label: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="First name"><Input required value={editing.firstName} onChange={(e) => setEditing({ ...editing, firstName: e.target.value })} /></Field><Field label="Last name"><Input required value={editing.lastName} onChange={(e) => setEditing({ ...editing, lastName: e.target.value })} /></Field></div>
          <Field label="Address"><Input required value={editing.line1} onChange={(e) => setEditing({ ...editing, line1: e.target.value })} /></Field><Field label="Apt / suite"><Input value={editing.line2} onChange={(e) => setEditing({ ...editing, line2: e.target.value })} /></Field>
          <div className="grid grid-cols-3 gap-3"><Field label="City"><Input required value={editing.city} onChange={(e) => setEditing({ ...editing, city: e.target.value })} /></Field><Field label="Region"><Input required value={editing.region} onChange={(e) => setEditing({ ...editing, region: e.target.value })} /></Field><Field label="Postal"><Input required value={editing.postalCode} onChange={(e) => setEditing({ ...editing, postalCode: e.target.value })} /></Field></div>
          <div className="grid grid-cols-2 gap-3"><Field label="Country"><Input required maxLength={2} value={editing.country} onChange={(e) => setEditing({ ...editing, country: e.target.value.toUpperCase() })} /></Field><Field label="Phone"><Input value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></Field></div>
          <Checkbox label="Set as default" checked={!!editing.isDefault} onChange={(e) => setEditing({ ...editing, isDefault: e.target.checked })} />
          <Button type="submit" className="w-full" loading={save.isPending}>Save address</Button>
        </form>}
      </Dialog>
    </div>
  );
}
