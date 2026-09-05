"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Field, Input } from "@/components/ui";
import { post } from "@/lib/api";

const schema = z.object({ email: z.string().email("Enter a valid email"), password: z.string().min(1, "Required") });
function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const onSubmit = async (v: z.infer<typeof schema>) => {
    setError(null);
    try { const r = await post("/auth/login", v); await qc.invalidateQueries(); const next = sp.get("next"); router.push(next ?? (r.data.user.isStaff ? "/admin" : "/account")); router.refresh(); } catch (e: any) { setError(e.message); }
  };
  return (
    <>
      <h1 className="font-display text-3xl">Welcome back</h1>
      <p className="mt-1 text-sm text-stone">Sign in to track orders, save favorites and check out faster.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <Field label="Email" error={errors.email?.message}><Input type="email" autoComplete="email" {...register("email")} /></Field>
        <Field label="Password" error={errors.password?.message}><Input type="password" autoComplete="current-password" {...register("password")} /></Field>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Sign in</Button>
      </form>
      <p className="mt-6 text-center text-sm text-stone">New to Evergreen? <Link href={`/register${sp.get("next") ? `?next=${sp.get("next")}` : ""}`} className="font-medium text-ink underline-offset-4 hover:underline">Create an account</Link></p>
      <div className="mt-8 rounded-xl bg-sand/60 p-4 text-xs text-ink/70"><p className="font-semibold">Development accounts (password: <code>Password123!</code>)</p><ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5"><li>customer@example.com</li><li>employee@example.com</li><li>manager@example.com</li><li>admin@example.com</li><li>superadmin@example.com</li></ul></div>
    </>
  );
}
export default function LoginPage() { return <Suspense><LoginForm /></Suspense>; }
