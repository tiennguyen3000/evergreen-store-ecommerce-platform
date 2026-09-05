"use client";
import * as React from "react";
import Link from "next/link";
import { X, Loader2, ChevronLeft, ChevronRight, Check, AlertCircle, Inbox } from "lucide-react";
import { cn, titleCase } from "@/lib/utils";
import { useUi } from "@/stores/ui";

// ---------- Button ----------
type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "link";
type Size = "sm" | "md" | "lg" | "icon";
const variants: Record<Variant, string> = {
  primary: "bg-forest text-white hover:bg-forest-dark shadow-sm", secondary: "bg-ink text-white hover:bg-black", outline: "border border-ink/20 bg-transparent hover:bg-ink/5", ghost: "hover:bg-ink/5", danger: "bg-red-600 text-white hover:bg-red-700", link: "underline underline-offset-4 hover:text-forest p-0 h-auto",
};
const sizes: Record<Size, string> = { sm: "h-8 px-3 text-xs", md: "h-10 px-5 text-sm", lg: "h-12 px-7 text-sm", icon: "h-10 w-10" };
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean; asChild?: boolean };
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => (
  <button ref={ref} disabled={disabled || loading} className={cn("inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-wide transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]", variants[variant], sizes[size], className)} {...props}>
    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
    {children}
  </button>
));
Button.displayName = "Button";
export function ButtonLink({ href, className, variant = "primary", size = "md", children, ...props }: React.ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link href={href} className={cn("inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-wide transition-all duration-200", variants[variant], sizes[size], className)} {...props}>{children}</Link>;
}

// ---------- Form controls ----------
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { error?: string }>(({ className, error, ...props }, ref) => (
  <div className="w-full">
    <input ref={ref} className={cn("h-11 w-full rounded-lg border bg-white px-3.5 text-sm outline-none transition placeholder:text-stone focus:border-forest focus:ring-2 focus:ring-forest/20", error ? "border-red-400" : "border-ink/15", className)} aria-invalid={!!error} {...props} />
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
  </div>
));
Input.displayName = "Input";
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string }>(({ className, error, ...props }, ref) => (
  <div className="w-full">
    <textarea ref={ref} className={cn("min-h-[100px] w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-stone focus:border-forest focus:ring-2 focus:ring-forest/20", error ? "border-red-400" : "border-ink/15", className)} {...props} />
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
  </div>
));
Textarea.displayName = "Textarea";
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn("h-11 w-full rounded-lg border border-ink/15 bg-white px-3 text-sm outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/20", className)} {...props}>{children}</select>
));
Select.displayName = "Select";
export const Label = ({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) => <label className={cn("mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink/70", className)} {...p} />;
export const Field = ({ label, children, error, className }: { label: string; children: React.ReactNode; error?: string; className?: string }) => (
  <div className={className}><Label>{label}</Label>{children}{error && <p className="mt-1 text-xs text-red-600">{error}</p>}</div>
);
export const Checkbox = ({ label, className, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) => (
  <label className={cn("flex cursor-pointer items-center gap-2.5 text-sm", className)}><input type="checkbox" className="h-4 w-4 rounded border-ink/30 accent-forest" {...p} />{label}</label>
);

// ---------- Badges & status ----------
export const Badge = ({ className, children, tone = "neutral" }: { className?: string; children: React.ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "info" | "dark" }) => {
  const tones = { neutral: "bg-ink/5 text-ink/80", success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", warning: "bg-amber-50 text-amber-700 ring-amber-600/20", danger: "bg-red-50 text-red-700 ring-red-600/20", info: "bg-sky-50 text-sky-700 ring-sky-600/20", dark: "bg-ink text-white" };
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ring-1 ring-inset ring-transparent", tones[tone], className)}>{children}</span>;
};
const statusTone: Record<string, "neutral" | "success" | "warning" | "danger" | "info" | "dark"> = { PENDING: "warning", CONFIRMED: "info", PROCESSING: "info", PACKED: "info", SHIPPED: "info", IN_TRANSIT: "info", DELIVERED: "success", COMPLETED: "success", PAID: "success", AUTHORIZED: "info", APPROVED: "success", ACTIVE: "success", CANCELLED: "danger", FAILED: "danger", REJECTED: "danger", DISABLED: "danger", REFUNDED: "neutral", RETURNED: "neutral", DRAFT: "neutral", ARCHIVED: "neutral", INACTIVE: "neutral", REQUESTED: "warning", LOW: "warning", OUT: "danger" };
export const StatusBadge = ({ status }: { status: string }) => <Badge tone={statusTone[status] ?? "neutral"}>{titleCase(status)}</Badge>;

// ---------- Layout ----------
export const Card = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("rounded-2xl border border-ink/10 bg-white", className)} {...p} />;
export const Skeleton = ({ className }: { className?: string }) => <div className={cn("animate-pulse rounded-lg bg-ink/8", className)} />;
export const Spinner = ({ className }: { className?: string }) => <Loader2 className={cn("h-5 w-5 animate-spin text-stone", className)} />;
export const LoadingState = ({ label = "Loading…" }: { label?: string }) => <div className="flex items-center justify-center gap-2 py-16 text-sm text-stone"><Spinner />{label}</div>;
export const EmptyState = ({ title, description, action, icon: Icon = Inbox }: { title: string; description?: string; action?: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }) => (
  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink/15 px-6 py-16 text-center">
    <div className="mb-4 rounded-full bg-sand p-4"><Icon className="h-6 w-6 text-moss" /></div>
    <h3 className="font-display text-xl">{title}</h3>
    {description && <p className="mt-1 max-w-sm text-sm text-stone">{description}</p>}
    {action && <div className="mt-6">{action}</div>}
  </div>
);
export const ErrorState = ({ title = "Something went wrong", description, retry }: { title?: string; description?: string; retry?: () => void }) => (
  <div className="flex flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50/50 px-6 py-14 text-center">
    <AlertCircle className="mb-3 h-7 w-7 text-red-500" />
    <h3 className="font-medium">{title}</h3>
    {description && <p className="mt-1 text-sm text-stone">{description}</p>}
    {retry && <Button variant="outline" size="sm" className="mt-5" onClick={retry}>Try again</Button>}
  </div>
);

// ---------- Dialog / Drawer ----------
export function Dialog({ open, onClose, title, children, className, side }: { open: boolean; onClose: () => void; title?: React.ReactNode; children: React.ReactNode; className?: string; side?: "right" | "left" }) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div className={cn("absolute bg-white shadow-2xl", side ? cn("inset-y-0 flex w-full max-w-md flex-col", side === "right" ? "right-0 animate-[slide-in-right_0.3s_ease-out]" : "left-0") : "left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl animate-fade-up", className)}>
        {(title !== undefined || true) && (
          <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
            <h2 className="font-display text-lg">{title}</h2>
            <button onClick={onClose} className="rounded-full p-1.5 hover:bg-ink/5" aria-label="Close"><X className="h-5 w-5" /></button>
          </div>
        )}
        <div className={cn(side ? "flex-1 overflow-y-auto" : "max-h-[80vh] overflow-y-auto", "p-5")}>{children}</div>
      </div>
    </div>
  );
}
export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = "Confirm", danger, loading }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; description?: string; confirmLabel?: string; danger?: boolean; loading?: boolean }) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <p className="text-sm text-stone">{description}</p>
      <div className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>{confirmLabel}</Button></div>
    </Dialog>
  );
}

// ---------- Toaster ----------
export function Toaster() {
  const { toasts, dismiss } = useUi();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2 sm:bottom-6 sm:right-6">
      {toasts.map((t) => (
        <div key={t.id} className={cn("pointer-events-auto flex min-w-[260px] max-w-sm items-start gap-3 rounded-xl border bg-white px-4 py-3 shadow-lg animate-fade-up", t.variant === "error" ? "border-red-200" : t.variant === "success" ? "border-emerald-200" : "border-ink/10")}>
          {t.variant === "success" ? <Check className="mt-0.5 h-4 w-4 text-emerald-600" /> : t.variant === "error" ? <AlertCircle className="mt-0.5 h-4 w-4 text-red-500" /> : null}
          <div className="flex-1 text-sm"><p className="font-medium">{t.title}</p>{t.description && <p className="text-stone">{t.description}</p>}</div>
          <button onClick={() => dismiss(t.id)} aria-label="Dismiss"><X className="h-4 w-4 text-stone" /></button>
        </div>
      ))}
    </div>
  );
}

// ---------- Pagination ----------
export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <nav className="flex items-center justify-center gap-2" aria-label="Pagination">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft className="h-4 w-4" /> Prev</Button>
      <span className="px-3 text-sm text-stone">Page {page} of {totalPages}</span>
      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next <ChevronRight className="h-4 w-4" /></Button>
    </nav>
  );
}

// ---------- Rating ----------
export const Stars = ({ value, size = "sm", className }: { value: number; size?: "sm" | "md"; className?: string }) => (
  <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${value} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <svg key={i} viewBox="0 0 20 20" className={cn(size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5", i <= Math.round(value) ? "fill-forest" : "fill-ink/15")}><path d="M10 1.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L10 14.9l-5.2 2.8 1-5.9L1.5 7.7l5.9-.8z" /></svg>
    ))}
  </span>
);

// ---------- Admin table ----------
export function DataTable<T>({ columns, rows, keyField, empty = "No records", loading, onRowClick }: { columns: { key: string; header: React.ReactNode; render?: (row: T) => React.ReactNode; className?: string }[]; rows: T[]; keyField: keyof T; empty?: string; loading?: boolean; onRowClick?: (row: T) => void }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white">
      <table className="w-full min-w-[640px] text-sm">
        <thead><tr className="border-b border-ink/10 bg-bone/60 text-left text-[11px] uppercase tracking-wider text-stone">{columns.map((c) => <th key={c.key} className={cn("px-4 py-3 font-semibold", c.className)}>{c.header}</th>)}</tr></thead>
        <tbody>
          {loading ? Array.from({ length: 6 }).map((_, i) => <tr key={i} className="border-b border-ink/5">{columns.map((c) => <td key={c.key} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>)}</tr>)
            : rows.length === 0 ? <tr><td colSpan={columns.length} className="px-4 py-12 text-center text-stone">{empty}</td></tr>
            : rows.map((r) => (
              <tr key={String(r[keyField])} onClick={onRowClick ? () => onRowClick(r) : undefined} className={cn("border-b border-ink/5 last:border-0", onRowClick && "cursor-pointer hover:bg-bone/60")}>
                {columns.map((c) => <td key={c.key} className={cn("px-4 py-3 align-middle", c.className)}>{c.render ? c.render(r) : String((r as any)[c.key] ?? "")}</td>)}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
export const StatCard = ({ label, value, change, hint }: { label: string; value: React.ReactNode; change?: number; hint?: string }) => (
  <Card className="p-5">
    <p className="text-xs font-medium uppercase tracking-wider text-stone">{label}</p>
    <p className="mt-2 font-display text-3xl">{value}</p>
    {(change != null || hint) && <p className={cn("mt-1 text-xs", change != null && change >= 0 ? "text-emerald-600" : "text-red-600")}>{change != null ? `${change >= 0 ? "▲" : "▼"} ${Math.abs(change)}% vs previous period` : hint}</p>}
  </Card>
);
export const PageHeader = ({ title, description, actions, crumbs }: { title: string; description?: string; actions?: React.ReactNode; crumbs?: { label: string; href?: string }[] }) => (
  <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div>
      {crumbs && <nav className="mb-1 flex items-center gap-1.5 text-xs text-stone">{crumbs.map((c, i) => <React.Fragment key={i}>{i > 0 && <span>/</span>}{c.href ? <Link href={c.href} className="hover:text-ink">{c.label}</Link> : <span className="text-ink">{c.label}</span>}</React.Fragment>)}</nav>}
      <h1 className="font-display text-2xl sm:text-3xl">{title}</h1>
      {description && <p className="mt-1 text-sm text-stone">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </div>
);
