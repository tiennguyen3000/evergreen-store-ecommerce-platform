import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export const cn = (...i: ClassValue[]) => twMerge(clsx(i));
export const formatMoney = (n: number | string | null | undefined, currency = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(Number(n ?? 0));
export const formatDate = (d: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) => (d ? new Intl.DateTimeFormat("en-US", opts).format(new Date(d)) : "—");
export const formatDateTime = (d: string | Date | null | undefined) => formatDate(d, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
export const titleCase = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
export const ORDER_STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"];
export const NEXT_STATUS: Record<string, string[]> = { PENDING: ["CONFIRMED", "CANCELLED"], CONFIRMED: ["PROCESSING", "CANCELLED"], PROCESSING: ["PACKED", "CANCELLED"], PACKED: ["SHIPPED", "CANCELLED"], SHIPPED: ["DELIVERED", "REFUNDED"], DELIVERED: ["REFUNDED"], CANCELLED: [], REFUNDED: [] };
