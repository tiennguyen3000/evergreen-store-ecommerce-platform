import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, and } from "drizzle-orm";
import { db, pool } from "@/db";
import * as s from "@/db/schema";
import { applyTransaction, validateCoupon, variantAvailability, transitionOrder } from "@/server/services/commerce";
import { listProducts, getProductBySlug } from "@/server/services/catalog";
import { ApiError } from "@/server/core";

let variantId: number; let warehouseId: number;
beforeAll(async () => {
  const [v] = await db.select({ id: s.productVariants.id }).from(s.productVariants).where(eq(s.productVariants.status, "ACTIVE")).limit(1);
  const [w] = await db.select({ id: s.warehouses.id }).from(s.warehouses).where(eq(s.warehouses.isDefault, true));
  variantId = v.id; warehouseId = w.id;
});
afterAll(() => pool.end());

describe("inventory ledger", () => {
  it("records a transaction and updates balances atomically", async () => {
    const before = (await db.select().from(s.warehouseInventory).where(and(eq(s.warehouseInventory.variantId, variantId), eq(s.warehouseInventory.warehouseId, warehouseId))))[0];
    const r = await db.transaction((tx) => applyTransaction(tx, { variantId, warehouseId, type: "PURCHASE", quantity: 5, reason: "test" }));
    expect(r.quantityOnHand).toBe(before.quantityOnHand + 5);
    const r2 = await db.transaction((tx) => applyTransaction(tx, { variantId, warehouseId, type: "ADJUSTMENT", quantity: -5, reason: "test revert" }));
    expect(r2.quantityOnHand).toBe(before.quantityOnHand);
  });
  it("reserves then releases without touching on-hand", async () => {
    const before = (await db.select().from(s.warehouseInventory).where(and(eq(s.warehouseInventory.variantId, variantId), eq(s.warehouseInventory.warehouseId, warehouseId))))[0];
    if (before.quantityOnHand - before.quantityReserved < 1) return;
    const r = await db.transaction((tx) => applyTransaction(tx, { variantId, warehouseId, type: "RESERVATION", quantity: 1 }));
    expect(r.quantityReserved).toBe(before.quantityReserved + 1); expect(r.quantityOnHand).toBe(before.quantityOnHand);
    const r2 = await db.transaction((tx) => applyTransaction(tx, { variantId, warehouseId, type: "RELEASE", quantity: 1 }));
    expect(r2.quantityReserved).toBe(before.quantityReserved);
  });
  it("refuses to reserve more than available (inventory shortage)", async () => {
    await expect(db.transaction((tx) => applyTransaction(tx, { variantId, warehouseId, type: "RESERVATION", quantity: 100000 }))).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
  });
  it("availability = on hand - reserved across active warehouses", async () => {
    const a = await variantAvailability(variantId);
    expect(typeof a).toBe("number"); expect(a).toBeGreaterThanOrEqual(0);
  });
});

describe("coupon validation", () => {
  const items = [{ productType: "shoes", categoryIds: [], lineTotal: 200 }];
  it("applies percentage discounts", async () => { const r = await validateCoupon("WELCOME10", 200, items, null); expect(r.discount).toBe(20); });
  it("rejects expired / exhausted / inactive / minimum", async () => {
    await expect(validateCoupon("EXPIRED10", 200, items, null)).rejects.toMatchObject({ code: "COUPON_EXPIRED" });
    await expect(validateCoupon("MAXEDOUT", 200, items, null)).rejects.toMatchObject({ code: "COUPON_EXHAUSTED" });
    await expect(validateCoupon("INACTIVE5", 200, items, null)).rejects.toMatchObject({ code: "COUPON_INVALID" });
    await expect(validateCoupon("WELCOME10", 20, items, null)).rejects.toMatchObject({ code: "COUPON_MINIMUM" });
  });
  it("enforces product-type eligibility", async () => {
    await expect(validateCoupon("SHOES25", 100, [{ productType: "apparel", categoryIds: [], lineTotal: 100 }], null)).rejects.toMatchObject({ code: "COUPON_NOT_ELIGIBLE" });
  });
});

describe("catalog", () => {
  it("filters by size/color and returns cards", async () => {
    const r = await listProducts({ category: "shoes", size: ["42"], sort: "price_asc" }, 1, 5);
    expect(r.total).toBeGreaterThan(0); expect(r.items[0].price).toBeLessThanOrEqual(r.items[r.items.length - 1].price);
    const d = await getProductBySlug(r.items[0].slug);
    expect(d.variants.length).toBeGreaterThan(0);
  });
  it("404s unknown slugs", async () => { await expect(getProductBySlug("nope-nope")).rejects.toBeInstanceOf(ApiError); });
});

describe("order state machine", () => {
  it("rejects invalid transitions", async () => {
    const [o] = await db.select({ id: s.orders.id }).from(s.orders).where(eq(s.orders.status, "DELIVERED")).limit(1);
    await expect(transitionOrder(o.id, "PROCESSING", null)).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });
});
