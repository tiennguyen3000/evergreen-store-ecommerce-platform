"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button, Card, DataTable, Dialog, Field, Input, PageHeader, Select, Skeleton, StatusBadge, Badge } from "@/components/ui";
import { usePerm } from "@/components/admin/shared";
import { get, patch, post } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { useMe } from "@/lib/hooks";
import { useUi } from "@/stores/ui";
const ROLES = ["EMPLOYEE", "MANAGER", "ADMIN", "SUPER_ADMIN"];
export default function EmployeesPage() {
  const qc = useQueryClient();
  const toast = useUi((s) => s.toast);
  const can = usePerm();
  const { data: me } = useMe();
  const [create, setCreate] = useState<any>(null);
  const [perms, setPerms] = useState<any>(null);
  const { data, isLoading } = useQuery({ queryKey: ["employees"], queryFn: async () => (await get("/admin/employees")).data });
  const onError = (e: any) => toast({ title: e.message, variant: "error" });
  const inv = () => qc.invalidateQueries({ queryKey: ["employees"] });
  const add = useMutation({ mutationFn: (v: any) => post("/admin/employees", v), onSuccess: () => { inv(); setCreate(null); toast({ title: "Employee created", variant: "success" }); }, onError });
  const update = useMutation({ mutationFn: (v: { id: number; role?: string; status?: string }) => patch(`/admin/employees/${v.id}`, v), onSuccess: () => { inv(); toast({ title: "Employee updated", variant: "success" }); }, onError });
  if (isLoading) return <Skeleton className="h-64" />;
  const superAdmin = me?.roles?.includes("SUPER_ADMIN");
  return (
    <div>
      <PageHeader title="Employees" description="Staff accounts, roles and permissions. Permissions are enforced server-side on every request." actions={can("EMPLOYEE_MANAGE") && <Button onClick={() => setCreate({ email: "", firstName: "", lastName: "", password: "", role: "EMPLOYEE", jobTitle: "" })}><Plus className="h-4 w-4" /> Add employee</Button>} />
      <DataTable rows={data?.employees ?? []} keyField="id" columns={[{ key: "name", header: "Employee", render: (e: any) => <div><p className="font-medium">{e.firstName} {e.lastName}</p><p className="text-xs text-stone">{e.email}{e.jobTitle && ` · ${e.jobTitle}`}</p></div> }, { key: "roles", header: "Role", render: (e: any) => can("EMPLOYEE_MANAGE") && e.id !== me?.id ? <Select className="h-9 w-40" value={e.roles[0]} onChange={(ev) => update.mutate({ id: e.id, role: ev.target.value })}>{ROLES.filter((r) => superAdmin || !["ADMIN", "SUPER_ADMIN"].includes(r) || r === e.roles[0]).map((r) => <option key={r} value={r}>{r}</option>)}</Select> : <Badge>{e.roles.join(", ")}</Badge> }, { key: "permissions", header: "Permissions", render: (e: any) => <button onClick={() => setPerms(e)} className="text-xs underline-offset-4 hover:underline">{e.permissions.length} permissions</button> }, { key: "status", header: "Status", render: (e: any) => <StatusBadge status={e.status} /> }, { key: "lastLoginAt", header: "Last login", render: (e: any) => formatDateTime(e.lastLoginAt) }, { key: "actions", header: "", render: (e: any) => can("EMPLOYEE_MANAGE") && e.id !== me?.id && <Button size="sm" variant={e.status === "ACTIVE" ? "danger" : "primary"} onClick={() => update.mutate({ id: e.id, status: e.status === "ACTIVE" ? "DISABLED" : "ACTIVE" })}>{e.status === "ACTIVE" ? "Deactivate" : "Activate"}</Button>, className: "text-right" }]} />
      <Card className="mt-8 p-5"><p className="mb-3 text-sm font-medium">Role → permission matrix</p><div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-left text-stone"><th className="py-1">Permission</th>{ROLES.map((r) => <th key={r} className="py-1 text-center">{r}</th>)}</tr></thead><tbody>{[...new Set(Object.values(data?.rolePermissions ?? {}).flat() as string[])].sort().map((p) => <tr key={p} className="border-t border-ink/5"><td className="py-1 font-mono">{p}</td>{ROLES.map((r) => <td key={r} className="py-1 text-center">{data.rolePermissions[r]?.includes(p) ? "●" : "·"}</td>)}</tr>)}</tbody></table></div></Card>
      <Dialog open={!!create} onClose={() => setCreate(null)} title="New employee">{create && <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); add.mutate(create); }}><div className="grid grid-cols-2 gap-3"><Field label="First name"><Input required value={create.firstName} onChange={(e) => setCreate({ ...create, firstName: e.target.value })} /></Field><Field label="Last name"><Input required value={create.lastName} onChange={(e) => setCreate({ ...create, lastName: e.target.value })} /></Field></div><Field label="Email"><Input type="email" required value={create.email} onChange={(e) => setCreate({ ...create, email: e.target.value })} /></Field><Field label="Temporary password"><Input type="text" required minLength={8} value={create.password} onChange={(e) => setCreate({ ...create, password: e.target.value })} /></Field><div className="grid grid-cols-2 gap-3"><Field label="Role"><Select value={create.role} onChange={(e) => setCreate({ ...create, role: e.target.value })}>{ROLES.filter((r) => superAdmin || !["ADMIN", "SUPER_ADMIN"].includes(r)).map((r) => <option key={r}>{r}</option>)}</Select></Field><Field label="Job title"><Input value={create.jobTitle} onChange={(e) => setCreate({ ...create, jobTitle: e.target.value })} /></Field></div><Button type="submit" className="w-full" loading={add.isPending}>Create employee</Button></form>}</Dialog>
      <Dialog open={!!perms} onClose={() => setPerms(null)} title={`Permissions · ${perms?.firstName ?? ""}`}><div className="flex flex-wrap gap-1.5">{perms?.permissions.map((p: string) => <Badge key={p}>{p}</Badge>)}</div></Dialog>
    </div>
  );
}
