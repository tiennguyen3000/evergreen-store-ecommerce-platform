"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Checkbox, Field, Input } from "@/components/ui";
import { post } from "@/lib/api";

const schema = z.object({ firstName: z.string().min(1, "Required"), lastName: z.string().min(1, "Required"), email: z.string().email("Enter a valid email"), password: z.string().min(8, "At least 8 characters"), marketingOptIn: z.boolean().optional() });
function RegisterForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { marketingOptIn: true } });
  const onSubmit = async (v: z.infer<typeof schema>) => { setError(null); try { await post("/auth/register", v); await qc.invalidateQueries(); router.push(sp.get("next") ?? "/account"); router.refresh(); } catch (e: any) { setError(e.message); } };
  return (
    <>
      <h1 className="font-display text-3xl">Create your account</h1>
      <p className="mt-1 text-sm text-stone">Get 10% off your first order with code WELCOME10.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <div className="grid gap-4 sm:grid-cols-2"><Field label="First name" error={errors.firstName?.message}><Input autoComplete="given-name" {...register("firstName")} /></Field><Field label="Last name" error={errors.lastName?.message}><Input autoComplete="family-name" {...register("lastName")} /></Field></div>
        <Field label="Email" error={errors.email?.message}><Input type="email" autoComplete="email" {...register("email")} /></Field>
        <Field label="Password" error={errors.password?.message}><Input type="password" autoComplete="new-password" {...register("password")} /></Field>
        <Checkbox label={<span className="text-stone">Email me about new materials and offers</span>} {...register("marketingOptIn")} />
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Create account</Button>
      </form>
      <p className="mt-6 text-center text-sm text-stone">Already have an account? <Link href="/login" className="font-medium text-ink underline-offset-4 hover:underline">Sign in</Link></p>
    </>
  );
}
export default function RegisterPage() { return <Suspense><RegisterForm /></Suspense>; }
