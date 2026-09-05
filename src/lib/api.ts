"use client";
/** Typed API client for /api/v1 — the only place the frontend talks to the backend. */
export class ApiClientError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); }
}
export type Envelope<T> = { data: T; meta: Record<string, any> };

let refreshing: Promise<boolean> | null = null;
async function tryRefresh() {
  refreshing ??= fetch("/api/v1/auth/refresh", { method: "POST", credentials: "include" }).then((r) => r.ok).catch(() => false).finally(() => setTimeout(() => (refreshing = null), 0));
  return refreshing;
}

export async function api<T = any>(path: string, init: RequestInit & { json?: unknown; retry?: boolean } = {}): Promise<Envelope<T>> {
  const { json, retry = true, ...rest } = init;
  const res = await fetch(`/api/v1${path}`, { ...rest, credentials: "include", headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...(rest.headers ?? {}) }, body: json !== undefined ? JSON.stringify(json) : rest.body });
  if (res.status === 401 && retry && !path.startsWith("/auth/")) {
    if (await tryRefresh()) return api<T>(path, { ...init, retry: false });
  }
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiClientError(res.status, payload?.error?.code ?? "HTTP_ERROR", payload?.error?.message ?? res.statusText, payload?.error?.details);
  return payload as Envelope<T>;
}
export const get = <T = any>(path: string) => api<T>(path);
export const post = <T = any>(path: string, json?: unknown) => api<T>(path, { method: "POST", json });
export const put = <T = any>(path: string, json?: unknown) => api<T>(path, { method: "PUT", json });
export const patch = <T = any>(path: string, json?: unknown) => api<T>(path, { method: "PATCH", json });
export const del = <T = any>(path: string) => api<T>(path, { method: "DELETE" });
export const qs = (params: Record<string, string | number | boolean | undefined | null | string[]>) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) { if (v == null || v === "" || v === false) continue; if (Array.isArray(v)) { if (v.length) sp.set(k, v.join(",")); } else sp.set(k, String(v)); }
  const str = sp.toString();
  return str ? `?${str}` : "";
};
