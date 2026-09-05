"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Check, Lock, ShoppingBag } from "lucide-react";
import { Button, ButtonLink, Checkbox, EmptyState, Field, Input, Select, Skeleton } from "@/components/ui";
import { useCart, useMe } from "@/lib/hooks";
import { ApiClientError, get, post } from "@/lib/api";
import { cn, formatMoney } from "@/lib/utils";
import { useUi } from "@/stores/ui";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  firstName: z.string().min(1, "Required"), lastName: z.string().min(1, "Required"), line1: z.string().min(3, "Required"), line2: z.string().optional(), city: z.string().min(1, "Required"), region: z.string().min(1, "Required"), postalCode: z.string().min(3, "Required"), country: z.string().default("US"), phone: z.string().optional(),
  shippingMethod: z.string().default("standard"),
  paymentMethod: z.enum(["card", "cash_on_delivery"]).default("card"),
  cardName: z.string().optional(), cardNumber: z.string().optional(), expMonth: z.string().optional(), expYear: z.string().optional(), cvc: z.string().optional(),
  saveAddress: z.boolean().optional(), customerNote: z.string().max(500).optional(),
}).superRefine((v, ctx) => {
  if (v.paymentMethod === "card") {
    if (!v.cardName) ctx.addIssue({ code: "custom", path: ["cardName"], message: "Required" });
    if (!v.cardNumber || v.cardNumber.replace(/\D/g, "").length < 12) ctx.addIssue({ code: "custom", path: ["cardNumber"], message: "Enter a valid card number" });
    if (!v.expMonth || !v.expYear) ctx.addIssue({ code: "custom", path: ["expMonth"], message: "Required" });
    if (!v.cvc || v.cvc.length < 3) ctx.addIssue({ code: "custom", path: ["cvc"], message: "Required" });
  }
});
type Form = z.infer<typeof schema>;
const STEPS = ["Information", "Shipping", "Payment", "Review"];

export default function CheckoutPage() {
  const router = useRouter();
  const toast = useUi((s) => s.toast);
  const { data: cart, isLoading } = useCart();
  const { data: me } = useMe();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const { register, handleSubmit, watch, trigger, setValue, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) as any, defaultValues: { country: "US", shippingMethod: "standard", paymentMethod: "card", saveAddress: true } });
  const { data: addresses } = useQuery({ queryKey: ["addresses"], queryFn: async () => (await get("/account/addresses")).data, enabled: !!me });
  useEffect(() => { if (me) { setValue("email", me.email); setValue("firstName", me.firstName); setValue("lastName", me.lastName); } }, [me, setValue]);
  useEffect(() => { const a = addresses?.[0]; if (a) { (["line1", "line2", "city", "region", "postalCode", "country", "phone"] as const).forEach((k) => setValue(k, a[k] ?? "")); } }, [addresses, setValue]);
  const shippingMethod = watch("shippingMethod");
  const paymentMethod = watch("paymentMethod");
  const { data: quote } = useQuery({ queryKey: ["quote", shippingMethod, cart?.couponCode], queryFn: async () => (await post("/checkout/quote", { shippingMethod })).data, enabled: !!cart });
  const items = useMemo(() => cart?.items?.filter((i: any) => !i.savedForLater) ?? [], [cart]);
  if (isLoading) return <div className="container-x max-w-5xl py-12"><Skeleton className="h-8 w-40" /><Skeleton className="mt-6 h-96" /></div>;
  if (!cart || items.length === 0) return <div className="container-x max-w-2xl py-16"><EmptyState icon={ShoppingBag} title="Nothing to check out" description="Add some items to your bag first." action={<ButtonLink href="/collections/all">Continue shopping</ButtonLink>} /></div>;

  const next = async () => {
    const fields: (keyof Form)[][] = [["email", "firstName", "lastName", "line1", "city", "region", "postalCode"], ["shippingMethod"], ["paymentMethod", "cardName", "cardNumber", "expMonth", "expYear", "cvc"], []];
    if (await trigger(fields[step])) setStep(step + 1);
  };
  const onSubmit = async (v: Form) => {
    setSubmitting(true); setPayError(null);
    try {
      const r = await post("/checkout", {
        email: v.email, shippingAddress: { firstName: v.firstName, lastName: v.lastName, line1: v.line1, line2: v.line2 || null, city: v.city, region: v.region, postalCode: v.postalCode, country: v.country, phone: v.phone || null }, shippingMethod: v.shippingMethod,
        payment: { method: v.paymentMethod, card: v.paymentMethod === "card" ? { number: v.cardNumber!, expMonth: v.expMonth!, expYear: v.expYear!, cvc: v.cvc!, name: v.cardName! } : undefined }, customerNote: v.customerNote || null, saveAddress: !!v.saveAddress,
      });
      const o = r.data;
      router.push(`/orders/${o.orderNumber}${o.guestToken ? `?token=${o.guestToken}` : ""}`);
    } catch (e) {
      const err = e as ApiClientError;
      if (err.code === "PAYMENT_FAILED") { setPayError(`${err.message}. Please try a different card.`); setStep(2); }
      else if (err.code === "INSUFFICIENT_STOCK") { toast({ title: "Stock changed", description: err.message, variant: "error" }); router.push("/cart"); }
      else toast({ title: err.message ?? "Checkout failed", variant: "error" });
      setSubmitting(false);
    }
  };
  const v = watch();
  return (
    <div className="container-x max-w-6xl py-8 sm:py-12">
      <div className="mb-8 flex items-center justify-between"><h1 className="font-display text-3xl">Checkout</h1><p className="flex items-center gap-1.5 text-xs text-stone"><Lock className="h-3.5 w-3.5" /> Secure checkout</p></div>
      <ol className="mb-8 flex items-center gap-2 text-xs sm:gap-4">{STEPS.map((s, i) => <li key={s} className="flex items-center gap-2"><span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold", i < step ? "bg-forest text-white" : i === step ? "bg-ink text-white" : "bg-ink/10 text-stone")}>{i < step ? <Check className="h-3 w-3" /> : i + 1}</span><span className={cn("hidden sm:inline", i === step ? "font-medium" : "text-stone")}>{s}</span>{i < STEPS.length - 1 && <span className="h-px w-6 bg-ink/15 sm:w-10" />}</li>)}</ol>
      <div className="grid gap-10 lg:grid-cols-[1fr_400px]">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {step === 0 && (
            <section className="space-y-5 animate-fade-in">
              <div className="flex items-end justify-between"><h2 className="font-display text-xl">Contact</h2>{!me && <p className="text-xs text-stone">Have an account? <Link href="/login?next=/checkout" className="underline">Sign in</Link></p>}</div>
              <Field label="Email" error={errors.email?.message}><Input type="email" autoComplete="email" {...register("email")} /></Field>
              <h2 className="pt-2 font-display text-xl">Shipping address</h2>
              {addresses?.length > 0 && <Select onChange={(e) => { const a = addresses.find((x: any) => String(x.id) === e.target.value); if (a) (["firstName", "lastName", "line1", "line2", "city", "region", "postalCode", "country", "phone"] as const).forEach((k) => setValue(k, a[k] ?? "")); }}><option value="">Choose a saved address…</option>{addresses.map((a: any) => <option key={a.id} value={a.id}>{a.label ?? "Address"} — {a.line1}, {a.city}</option>)}</Select>}
              <div className="grid gap-4 sm:grid-cols-2"><Field label="First name" error={errors.firstName?.message}><Input autoComplete="given-name" {...register("firstName")} /></Field><Field label="Last name" error={errors.lastName?.message}><Input autoComplete="family-name" {...register("lastName")} /></Field></div>
              <Field label="Address" error={errors.line1?.message}><Input autoComplete="address-line1" {...register("line1")} /></Field>
              <Field label="Apartment, suite (optional)"><Input autoComplete="address-line2" {...register("line2")} /></Field>
              <div className="grid gap-4 sm:grid-cols-3"><Field label="City" error={errors.city?.message}><Input autoComplete="address-level2" {...register("city")} /></Field><Field label="State / Region" error={errors.region?.message}><Input autoComplete="address-level1" {...register("region")} /></Field><Field label="Postal code" error={errors.postalCode?.message}><Input autoComplete="postal-code" {...register("postalCode")} /></Field></div>
              <div className="grid gap-4 sm:grid-cols-2"><Field label="Country"><Select {...register("country")}><option value="US">United States</option><option value="CA">Canada</option><option value="GB">United Kingdom</option><option value="DE">Germany</option></Select></Field><Field label="Phone (optional)"><Input type="tel" autoComplete="tel" {...register("phone")} /></Field></div>
              {me && <Checkbox label="Save this address to my account" {...register("saveAddress")} />}
              <Button type="button" size="lg" onClick={next}>Continue to shipping</Button>
            </section>
          )}
          {step === 1 && (
            <section className="space-y-5 animate-fade-in">
              <h2 className="font-display text-xl">Shipping method</h2>
              <div className="space-y-3">{(quote?.shippingMethods ?? cart.shippingMethods).map((m: any) => <label key={m.code} className={cn("flex cursor-pointer items-center justify-between rounded-xl border p-4", shippingMethod === m.code ? "border-ink bg-white" : "border-ink/15")}><span className="flex items-center gap-3"><input type="radio" value={m.code} {...register("shippingMethod")} className="accent-forest" /><span className="text-sm">{m.name}</span></span><span className="text-sm font-medium">{m.price === 0 ? "Free" : formatMoney(m.price)}</span></label>)}</div>
              <Field label="Delivery note (optional)"><Input placeholder="Leave at the side door…" {...register("customerNote")} /></Field>
              <div className="flex gap-3"><Button type="button" variant="outline" onClick={() => setStep(0)}>Back</Button><Button type="button" size="lg" onClick={next}>Continue to payment</Button></div>
            </section>
          )}
          {step === 2 && (
            <section className="space-y-5 animate-fade-in">
              <h2 className="font-display text-xl">Payment</h2>
              {payError && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{payError}</div>}
              <div className="space-y-3">
                {[["card", "Credit / debit card"], ["cash_on_delivery", "Pay on delivery"]].map(([val, label]) => <label key={val} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border p-4", paymentMethod === val ? "border-ink bg-white" : "border-ink/15")}><input type="radio" value={val} {...register("paymentMethod")} className="accent-forest" /><span className="text-sm">{label}</span></label>)}
              </div>
              {paymentMethod === "card" && (
                <div className="space-y-4 rounded-xl bg-white p-5 ring-1 ring-ink/10">
                  <Field label="Name on card" error={errors.cardName?.message}><Input autoComplete="cc-name" {...register("cardName")} /></Field>
                  <Field label="Card number" error={errors.cardNumber?.message}><Input inputMode="numeric" autoComplete="cc-number" placeholder="4242 4242 4242 4242" {...register("cardNumber")} /></Field>
                  <div className="grid grid-cols-3 gap-3"><Field label="Month" error={errors.expMonth?.message}><Input placeholder="MM" autoComplete="cc-exp-month" {...register("expMonth")} /></Field><Field label="Year"><Input placeholder="YY" autoComplete="cc-exp-year" {...register("expYear")} /></Field><Field label="CVC" error={errors.cvc?.message}><Input placeholder="123" inputMode="numeric" autoComplete="cc-csc" {...register("cvc")} /></Field></div>
                  <p className="text-xs text-stone">Development mode uses a mock provider: any card succeeds except numbers ending in <code>0000</code> (declined) or <code>9995</code> (insufficient funds).</p>
                </div>
              )}
              <div className="flex gap-3"><Button type="button" variant="outline" onClick={() => setStep(1)}>Back</Button><Button type="button" size="lg" onClick={next}>Review order</Button></div>
            </section>
          )}
          {step === 3 && (
            <section className="space-y-6 animate-fade-in">
              <h2 className="font-display text-xl">Review your order</h2>
              <dl className="grid gap-4 rounded-xl bg-white p-5 text-sm ring-1 ring-ink/10 sm:grid-cols-3">
                <div><dt className="text-xs uppercase tracking-wider text-stone">Contact</dt><dd className="mt-1">{v.email}</dd><button type="button" onClick={() => setStep(0)} className="text-xs underline">Edit</button></div>
                <div><dt className="text-xs uppercase tracking-wider text-stone">Ship to</dt><dd className="mt-1">{v.firstName} {v.lastName}<br />{v.line1}{v.line2 && `, ${v.line2}`}<br />{v.city}, {v.region} {v.postalCode}</dd></div>
                <div><dt className="text-xs uppercase tracking-wider text-stone">Payment</dt><dd className="mt-1">{v.paymentMethod === "card" ? `Card ending ${(v.cardNumber ?? "").replace(/\D/g, "").slice(-4)}` : "Pay on delivery"}<br />{v.shippingMethod === "express" ? "Express" : "Standard"} shipping</dd><button type="button" onClick={() => setStep(2)} className="text-xs underline">Edit</button></div>
              </dl>
              <div className="flex gap-3"><Button type="button" variant="outline" onClick={() => setStep(2)}>Back</Button><Button type="submit" size="lg" loading={submitting} className="flex-1 sm:flex-none">Place order · {formatMoney(quote?.total ?? cart.total)}</Button></div>
              <p className="text-xs text-stone">By placing your order you agree to our terms. Inventory is reserved and charged only when your order is confirmed.</p>
            </section>
          )}
        </form>
        <aside className="h-fit rounded-2xl bg-white p-6 ring-1 ring-ink/10 lg:sticky lg:top-28">
          <h2 className="font-display text-lg">Order summary</h2>
          <ul className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">{items.map((i: any) => <li key={i.id} className="flex items-center gap-3 text-sm"><div className="relative"><img src={i.image} alt="" className="h-16 w-14 rounded-lg bg-sand object-cover" /><span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[10px] text-white">{i.quantity}</span></div><div className="flex-1"><p className="font-medium leading-tight">{i.productName}</p><p className="text-xs text-stone">{i.color} / {i.size}</p></div><span>{formatMoney(i.lineTotal)}</span></li>)}</ul>
          <dl className="mt-5 space-y-2 border-t border-ink/10 pt-4 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatMoney(cart.subtotal)}</dd></div>
            {(quote?.discount ?? cart.discount) > 0 && <div className="flex justify-between text-emerald-700"><dt>Discount {cart.couponCode && `(${cart.couponCode})`}</dt><dd>-{formatMoney(quote?.discount ?? cart.discount)}</dd></div>}
            <div className="flex justify-between"><dt>Shipping</dt><dd>{(quote?.shipping ?? cart.shipping) === 0 ? "Free" : formatMoney(quote?.shipping ?? cart.shipping)}</dd></div>
            <div className="flex justify-between"><dt>Tax</dt><dd>{formatMoney(quote?.tax ?? cart.tax)}</dd></div>
            <div className="flex justify-between border-t border-ink/10 pt-3 text-base font-semibold"><dt>Total</dt><dd>{formatMoney(quote?.total ?? cart.total)}</dd></div>
          </dl>
          <Link href="/cart" className="mt-4 block text-center text-xs text-stone underline-offset-4 hover:underline">Edit bag or promo code</Link>
        </aside>
      </div>
    </div>
  );
}
