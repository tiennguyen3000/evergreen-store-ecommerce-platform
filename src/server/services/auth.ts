import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { ApiError, AuthUser, Ctx, badRequest, loadUserWithRoles, notify, signAccessToken, unauthorized, audit, REFRESH_TTL_SEC, rateLimiter } from "../core";

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export type TokenPair = { accessToken: string; refreshToken: string; user: AuthUser };

async function issueTokens(ctx: Ctx, user: AuthUser, family?: string): Promise<TokenPair> {
  const refreshToken = randomBytes(32).toString("hex");
  await db.insert(s.refreshTokens).values({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    family: family ?? randomBytes(16).toString("hex"),
    expiresAt: new Date(Date.now() + REFRESH_TTL_SEC * 1000),
    userAgent: ctx.userAgent.slice(0, 500),
    ipAddress: ctx.ip,
  });
  return { accessToken: await signAccessToken(user), refreshToken, user };
}

export async function register(ctx: Ctx, input: { email: string; password: string; firstName: string; lastName: string; marketingOptIn?: boolean }) {
  const email = input.email.toLowerCase().trim();
  const [existing] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, email));
  if (existing) throw new ApiError(409, "EMAIL_TAKEN", "An account with this email already exists");
  const passwordHash = await bcrypt.hash(input.password, 10);
  const [u] = await db.insert(s.users).values({ email, passwordHash, firstName: input.firstName, lastName: input.lastName, marketingOptIn: !!input.marketingOptIn, status: "ACTIVE", emailVerifiedAt: null }).returning();
  const [role] = await db.select().from(s.roles).where(eq(s.roles.name, "CUSTOMER"));
  await db.insert(s.userRoles).values({ userId: u.id, roleId: role.id });
  // Email verification abstraction: token logged by the LoggingEmailProvider.
  await notify(u.id, email, "PROMOTION", "Welcome to Evergreen", `Hi ${u.firstName}, verify your email to unlock your account perks. Use WELCOME10 for 10% off.`);
  const user = (await loadUserWithRoles(u.id))!;
  return issueTokens(ctx, user);
}

export async function login(ctx: Ctx, input: { email: string; password: string }) {
  const email = input.email.toLowerCase().trim();
  if (!rateLimiter.hit(`login:${ctx.ip}:${email}`, 10, 15 * 60_000)) throw new ApiError(429, "RATE_LIMITED", "Too many login attempts. Try again later.");
  const [u] = await db.select().from(s.users).where(eq(s.users.email, email));
  const valid = u ? await bcrypt.compare(input.password, u.passwordHash) : false;
  if (!u || !valid) throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  if (u.status === "DISABLED") throw new ApiError(403, "ACCOUNT_DISABLED", "This account has been disabled");
  await db.update(s.users).set({ lastLoginAt: new Date() }).where(eq(s.users.id, u.id));
  const user = (await loadUserWithRoles(u.id))!;
  return issueTokens(ctx, user);
}

/** Refresh token rotation: the presented token is revoked, a new token in the same family is issued.
 *  Reuse of an already-revoked token revokes the whole family (theft detection). */
export async function refresh(ctx: Ctx, token: string | undefined) {
  if (!token) throw unauthorized();
  const [row] = await db.select().from(s.refreshTokens).where(eq(s.refreshTokens.tokenHash, hashToken(token)));
  if (!row) throw unauthorized();
  if (row.revokedAt) {
    await db.update(s.refreshTokens).set({ revokedAt: new Date() }).where(and(eq(s.refreshTokens.family, row.family), isNull(s.refreshTokens.revokedAt)));
    throw new ApiError(401, "REFRESH_REUSED", "Refresh token reuse detected; please sign in again");
  }
  if (row.expiresAt < new Date()) throw new ApiError(401, "REFRESH_EXPIRED", "Session expired");
  await db.update(s.refreshTokens).set({ revokedAt: new Date() }).where(eq(s.refreshTokens.id, row.id));
  const user = await loadUserWithRoles(row.userId);
  if (!user) throw unauthorized();
  return issueTokens(ctx, user, row.family);
}

export async function logout(token: string | undefined) {
  if (token) await db.update(s.refreshTokens).set({ revokedAt: new Date() }).where(eq(s.refreshTokens.tokenHash, hashToken(token)));
}

export async function me(ctx: Ctx) {
  if (!ctx.user) return null;
  const fresh = await loadUserWithRoles(ctx.user.id);
  if (!fresh) return null;
  const [u] = await db.select({ phone: s.users.phone, status: s.users.status, createdAt: s.users.createdAt, marketingOptIn: s.users.marketingOptIn, emailVerifiedAt: s.users.emailVerifiedAt }).from(s.users).where(eq(s.users.id, ctx.user.id));
  return { ...fresh, ...u };
}

export async function changePassword(ctx: Ctx, userId: number, currentPassword: string, newPassword: string) {
  const [u] = await db.select().from(s.users).where(eq(s.users.id, userId));
  if (!u || !(await bcrypt.compare(currentPassword, u.passwordHash))) throw badRequest("INVALID_PASSWORD", "Current password is incorrect");
  await db.update(s.users).set({ passwordHash: await bcrypt.hash(newPassword, 10), updatedAt: new Date() }).where(eq(s.users.id, userId));
  await db.update(s.refreshTokens).set({ revokedAt: new Date() }).where(and(eq(s.refreshTokens.userId, userId), isNull(s.refreshTokens.revokedAt)));
  await notify(userId, u.email, "PASSWORD_CHANGED", "Your password was changed", "If this wasn't you, contact support immediately.");
  await audit(ctx, "PASSWORD_CHANGED", "User", userId);
}

export async function updateProfile(userId: number, input: { firstName?: string; lastName?: string; phone?: string | null; marketingOptIn?: boolean }) {
  const [u] = await db.update(s.users).set({ ...input, updatedAt: new Date() }).where(eq(s.users.id, userId)).returning({ id: s.users.id, email: s.users.email, firstName: s.users.firstName, lastName: s.users.lastName, phone: s.users.phone, marketingOptIn: s.users.marketingOptIn });
  return u;
}
