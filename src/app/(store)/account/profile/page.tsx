"use client";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Checkbox, Field, Input } from "@/components/ui";
import { post, put } from "@/lib/api";
import { useMe } from "@/lib/hooks";
import { useUi } from "@/stores/ui";
export default function ProfilePage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const toast = useUi((s) => s.toast);
  const [f, setF] = useState({ firstName: "", lastName: "", phone: "", marketingOptIn: false });
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  useEffect(() => { if (me) setF({ firstName: me.firstName, lastName: me.lastName, phone: me.phone ?? "", marketingOptIn: !!me.marketingOptIn }); }, [me]);
  const save = useMutation({ mutationFn: () => put("/account/profile", { ...f, phone: f.phone || null }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["me"] }); toast({ title: "Profile updated", variant: "success" }); }, onError: (e: any) => toast({ title: e.message, variant: "error" }) });
  const changePw = useMutation({ mutationFn: () => post("/account/password", pw), onSuccess: () => { setPw({ currentPassword: "", newPassword: "" }); toast({ title: "Password changed", variant: "success" }); }, onError: (e: any) => toast({ title: e.message, variant: "error" }) });
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form className="space-y-4 rounded-2xl bg-white p-6 ring-1 ring-ink/10" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}><h2 className="font-display text-xl">Profile</h2><div className="grid gap-4 sm:grid-cols-2"><Field label="First name"><Input value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} /></Field><Field label="Last name"><Input value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} /></Field></div><Field label="Email"><Input value={me?.email ?? ""} disabled /></Field><Field label="Phone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field><Checkbox label="Send me product news and offers" checked={f.marketingOptIn} onChange={(e) => setF({ ...f, marketingOptIn: e.target.checked })} /><Button type="submit" loading={save.isPending}>Save changes</Button></form>
      <form className="space-y-4 rounded-2xl bg-white p-6 ring-1 ring-ink/10" onSubmit={(e) => { e.preventDefault(); changePw.mutate(); }}><h2 className="font-display text-xl">Change password</h2><Field label="Current password"><Input type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field><Field label="New password"><Input type="password" autoComplete="new-password" minLength={8} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field><p className="text-xs text-stone">Changing your password signs you out of other devices.</p><Button type="submit" variant="outline" loading={changePw.isPending}>Update password</Button></form>
    </div>
  );
}
