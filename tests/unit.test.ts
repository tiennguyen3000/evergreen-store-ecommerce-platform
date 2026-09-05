import { describe, it, expect } from "vitest";
import { mockPaymentProvider } from "@/server/services/commerce";
import { pagination, pageMeta, money, ApiError } from "@/server/core";

describe("MockPaymentProvider", () => {
  it("captures a valid card", async () => {
    const r = await mockPaymentProvider.charge({ amount: 100, currency: "USD", method: "card", card: { number: "4242424242424242", expMonth: "12", expYear: "30", cvc: "123", name: "T" } });
    expect(r.status).toBe("PAID"); expect(r.last4).toBe("4242");
  });
  it("declines cards ending in 0000", async () => {
    const r = await mockPaymentProvider.charge({ amount: 100, currency: "USD", method: "card", card: { number: "4242424242420000", expMonth: "12", expYear: "30", cvc: "123", name: "T" } });
    expect(r.status).toBe("FAILED"); expect(r.failureReason).toMatch(/declined/i);
  });
  it("rejects malformed card numbers", async () => {
    const r = await mockPaymentProvider.charge({ amount: 100, currency: "USD", method: "card", card: { number: "1234", expMonth: "12", expYear: "30", cvc: "123", name: "T" } });
    expect(r.status).toBe("FAILED");
  });
});
describe("core helpers", () => {
  it("clamps pagination", () => {
    const p = pagination(new URLSearchParams("page=0&pageSize=999"));
    expect(p.page).toBe(1); expect(p.pageSize).toBe(100);
    expect(pageMeta(2, 10, 35)).toEqual({ page: 2, pageSize: 10, total: 35, totalPages: 4 });
  });
  it("formats money and errors", () => {
    expect(money(10.005)).toBe("10.01");
    const e = new ApiError(409, "INSUFFICIENT_STOCK", "no stock");
    expect(e.status).toBe(409); expect(e.code).toBe("INSUFFICIENT_STOCK");
  });
});
