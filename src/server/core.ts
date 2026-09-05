import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z, ZodType } from "zod";
import { db } from "@/db";
import * as s from "@/db/schema";

// ---------- Errors & envelope ----------
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}
export const notFound = (code: string, msg: string) => new ApiError(404, code, msg);
export const badRequest = (code: string, msg: string, details?: unknown) => new ApiError(400, code, msg, details);
export const unauthorized = () => new ApiError(401, "UNAUTHORIZED", "Authentication required");
export const forbidden = () => new ApiError(403, "FORBIDDEN", "You do not have permission to perform this action");

export function ok<T>(data: T, meta: Record<string, unknown> = {}, init?: ResponseInit) {
  return NextResponse.json({ data, meta }, init);
}
export function created<T>(data: T, meta: Record<string, unknown> = {}) {
  return ok(data, meta, { status: 201 });
}
export function errorResponse(e: unknown, requestId: string) {
  if (e instanceof ApiError) {
    return NextResponse.json({ error: { code: e.code, message: e.message, details: e.details ?? {} }, meta: { requestId } }, { status: e.status });
  }
  if (e instanceof z.ZodError) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Request validation failed", details: e.flatten().fieldErrors }, meta: { requestId } }, { status: 400 });
  }
  console.error(JSON.stringify({ level: "error", requestId, message: (e as Error)?.message, stack: (e as Error)?.stack?.split("\n").slice(0, 4) }));
  return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong", details: {} }, meta: { requestId } }, { status: 500 });
}

export async function parseBody<T extends ZodType>(req: NextRequest, schema: T): Promise<z.infer<T>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw badRequest("INVALID_JSON", "Request body must be valid JSON");
  }
  return schema.parse(json);
}

export function pagination(sp: URLSearchParams, defaultSize = 24, max = 100) {
  const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);
  const pageSize = Math.min(max, Math.max(1, Number(sp.get("pageSize") ?? defaultSize) || defaultSize));
  return { page, pageSize, offset: (page - 1) * pageSize };
}
export const pageMeta = (page: number, pageSize: number, total: number) => ({ page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });

// ---------- Auth context ----------
const secret = () => new TextEncoder().encode(process.env.JWT_SECRET ?? "dev-only-secret-change-me-in-production-please");
export const ACCESS_COOKIE = "eg_access";
export const REFRESH_COOKIE = "eg_refresh";
export const CART_COOKIE = "eg_cart";
export const ACCESS_TTL_SEC = 60 * 15;
export const REFRESH_TTL_SEC = 60 * 60 * 24 * 30;

export type AuthUser = { id: number; email: string; firstName: string; lastName: string; roles: string[]; permissions: string[]; isStaff: boolean };
export type Ctx = { req: NextRequest; requestId: string; user: AuthUser | null; ip: string; userAgent: string; cartToken: string | null };

export async function signAccessToken(u: AuthUser) {
  return new SignJWT({ email: u.email, roles: u.roles, permissions: u.permissions, isStaff: u.isStaff, firstName: u.firstName, lastName: u.lastName })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(u.id))
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SEC}s`)
    .sign(secret());
}

export async function verifyAccessToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      id: Number(payload.sub),
      email: String(payload.email),
      firstName: String(payload.firstName ?? ""),
      lastName: String(payload.lastName ?? ""),
      roles: (payload.roles as string[]) ?? [],
      permissions: (payload.permissions as string[]) ?? [],
      isStaff: Boolean(payload.isStaff),
    };
  } catch {
    return null;
  }
}

export async function buildContext(req: NextRequest): Promise<Ctx> {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const token = bearer || req.cookies.get(ACCESS_COOKIE)?.value;
  const user = token ? await verifyAccessToken(token) : null;
  return {
    req,
    requestId,
    user,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1",
    userAgent: req.headers.get("user-agent") ?? "",
    cartToken: req.cookies.get(CART_COOKIE)?.value ?? req.headers.get("x-cart-token"),
  };
}

export function requireAuth(ctx: Ctx): AuthUser {
  if (!ctx.user) throw unauthorized();
  return ctx.user;
}
export function requirePermission(ctx: Ctx, ...perms: string[]): AuthUser {
  const u = requireAuth(ctx);
  if (!u.isStaff) throw forbidden();
  if (u.roles.includes("SUPER_ADMIN")) return u;
  if (!perms.every((p) => u.permissions.includes(p))) throw forbidden();
  return u;
}

export async function loadUserWithRoles(userId: number): Promise<AuthUser | null> {
  const [u] = await db.select().from(s.users).where(eq(s.users.id, userId));
  if (!u) return null;
  const roleRows = await db.select({ name: s.roles.name, id: s.roles.id }).from(s.userRoles).innerJoin(s.roles, eq(s.roles.id, s.userRoles.roleId)).where(eq(s.userRoles.userId, userId));
  const roleIds = roleRows.map((r) => r.id);
  const permRows = roleIds.length
    ? await db.selectDistinct({ name: s.permissions.name }).from(s.rolePermissions).innerJoin(s.permissions, eq(s.permissions.id, s.rolePermissions.permissionId)).where(inArray(s.rolePermissions.roleId, roleIds))
    : [];
  return { id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, roles: roleRows.map((r) => r.name), permissions: permRows.map((p) => p.name), isStaff: u.isStaff };
}

// ---------- Audit, notifications, settings ----------
export async function audit(ctx: Ctx, action: string, entityType: string, entityId: string | number | null, oldValue?: unknown, newValue?: unknown) {
  await db.insert(s.auditLogs).values({ actorId: ctx.user?.id ?? null, action, entityType, entityId: entityId == null ? null : String(entityId), oldValue: oldValue ?? null, newValue: newValue ?? null, ipAddress: ctx.ip, userAgent: ctx.userAgent.slice(0, 500) });
}

/** EmailProvider abstraction — LoggingEmailProvider for development. */
export interface EmailProvider { send(to: string, subject: string, body: string): Promise<void> }
export const loggingEmailProvider: EmailProvider = {
  async send(to, subject, body) {
    console.log(JSON.stringify({ level: "info", event: "email.sent", to, subject, preview: body.slice(0, 80) }));
  },
};
export async function notify(userId: number | null, email: string | null, type: string, title: string, body: string, data?: unknown) {
  await db.insert(s.notifications).values({ userId, type, channel: "IN_APP", title, body, data: data ?? null });
  if (email) {
    await loggingEmailProvider.send(email, title, body);
    await db.insert(s.notifications).values({ userId, type, channel: "EMAIL", title, body, data: data ?? null, sentAt: new Date() });
  }
}

const settingsCache: { at: number; map: Record<string, unknown> } = { at: 0, map: {} };
export async function getSettings(): Promise<Record<string, unknown>> {
  if (Date.now() - settingsCache.at < 30_000 && Object.keys(settingsCache.map).length) return settingsCache.map;
  const rows = await db.select().from(s.storeSettings);
  settingsCache.map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  settingsCache.at = Date.now();
  return settingsCache.map;
}
export const invalidateSettings = () => { settingsCache.at = 0; };

// ---------- Simple in-memory rate limiter abstraction (swap for Redis in prod) ----------
export interface RateLimiter { hit(key: string, limit: number, windowMs: number): boolean }
const buckets = new Map<string, { count: number; reset: number }>();
export const rateLimiter: RateLimiter = {
  hit(key, limit, windowMs) {
    const now = Date.now();
    const b = buckets.get(key);
    if (!b || b.reset < now) { buckets.set(key, { count: 1, reset: now + windowMs }); return true; }
    b.count++;
    return b.count <= limit;
  },
};

export const num = (v: string | number | null | undefined) => Number(v ?? 0);
export const money = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
export { and, eq, sql };
