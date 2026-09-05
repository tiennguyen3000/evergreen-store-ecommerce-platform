import { randomBytes } from "crypto";
import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { ApiError, Ctx, badRequest, forbidden, getSettings, money, notFound, notify, num, unauthorized } from "../core";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Exec = Tx | typeof db;

// =====================================================================
// Inventory ledger — the ONLY way stock changes.
// =====================================================================
export type InvTxType = "PURCHASE" | "SALE" | "RETURN" | "ADJUSTMENT" | "TRANSFER_IN" | "TRANSFER_OUT" | "DAMAGE" | "RESERVATION" | "RELEASE";
export async function applyTransaction(ex: Exec, input: { variantId: number; warehouseId: number; type: InvTxType; quantity: number; referenceType?: string; referenceId?: string; reason?: string; createdBy?: number | null }) {
  const { variantId, warehouseId, type, quantity } = input;
  if (!Number.isInteger(quantity) || quantity === 0) throw badRequest("INVALID_QUANTITY", "Quantity must be a non-zero integer");
  let onHandDelta = 0, reservedDelta = 0;
  switch (type) {
    case "RESERVATION": reservedDelta = Math.abs(quantity); break;
    case "RELEASE": reservedDelta = -Math.abs(quantity); break;
    case "SALE": onHandDelta = -Math.abs(quantity); reservedDelta = -Math.abs(quantity); break;
    case "TRANSFER_OUT": case "DAMAGE": onHandDelta = -Math.abs(quantity); break;
    case "PURCHASE": case "RETURN": case "TRANSFER_IN": onHandDelta = Math.abs(quantity); break;
    case "ADJUSTMENT": onHandDelta = quantity; break;
  }
  const [row] = await ex.select().from(s.warehouseInventory).where(and(eq(s.warehouseInventory.variantId, variantId), eq(s.warehouseInventory.warehouseId, warehouseId))).for("update");
  const current = row ?? (await ex.insert(s.warehouseInventory).values({ variantId, warehouseId, quantityOnHand: 0, quantityReserved: 0 }).returning())[0];
  const newOnHand = current.quantityOnHand + onHandDelta;
  const newReserved = Math.max(0, current.quantityReserved + reservedDelta);
  if (newOnHand < 0) throw new ApiError(409, "INSUFFICIENT_STOCK", "Insufficient stock for this operation", { variantId, warehouseId, available: current.quantityOnHand - current.quantityReserved });
  if (type === "RESERVATION" && current.quantityOnHand - newReserved < 0) throw new ApiError(409, "INSUFFICIENT_STOCK", "Insufficient stock to reserve", { variantId, warehouseId, available: current.quantityOnHand - current.quantityReserved });
  await ex.update(s.warehouseInventory).set({ quantityOnHand: newOnHand, quantityReserved: newReserved, updatedAt: new Date() }).where(eq(s.warehouseInventory.id, current.id));
  await ex.insert(s.inventoryTransactions).values({ variantId, warehouseId, type, quantity: type === "SALE" || type === "TRANSFER_OUT" || type === "DAMAGE" ? -Math.abs(quantity) : quantity, referenceType: input.referenceType, referenceId: input.referenceId, reason: input.reason, createdBy: input.createdBy ?? null });
  return { quantityOnHand: newOnHand, quantityReserved: newReserved, quantityAvailable: newOnHand - newReserved, reorderLevel: current.reorderLevel };
}

// =====================================================================
// Cart
// =====================================================================
export async function getOrCreateCart(ctx: Ctx) {
  const userId = ctx.user?.id ?? null;
  let cart: typeof s.carts.$inferSelect | undefined;
  if (userId) {
    [cart] = await db.select().from(s.carts).where(and(eq(s.carts.userId, userId), eq(s.carts.status, "ACTIVE")));
    // merge guest cart into user cart
    if (ctx.cartToken) {
      const [guest] = await db.select().from(s.carts).where(and(eq(s.carts.token, ctx.cartToken), isNull(s.carts.userId), eq(s.carts.status, "ACTIVE")));
      if (guest) {
        if (!cart) {
          [cart] = await db.update(s.carts).set({ userId }).where(eq(s.carts.id, guest.id)).returning();
        } else {
          const items = await db.select().from(s.cartItems).where(eq(s.cartItems.cartId, guest.id));
          for (const it of items) await upsertItem(cart.id, it.variantId, it.quantity, "add");
          await db.delete(s.carts).where(eq(s.carts.id, guest.id));
        }
      }
    }
  } else if (ctx.cartToken) {
    [cart] = await db.select().from(s.carts).where(and(eq(s.carts.token, ctx.cartToken), isNull(s.carts.userId), eq(s.carts.status, "ACTIVE")));
  }
  if (!cart) [cart] = await db.insert(s.carts).values({ userId, token: randomBytes(24).toString("hex") }).returning();
  return cart;
}

async function upsertItem(cartId: number, variantId: number, quantity: number, mode: "add" | "set") {
  const [existing] = await db.select().from(s.cartItems).where(and(eq(s.cartItems.cartId, cartId), eq(s.cartItems.variantId, variantId)));
  const target = mode === "add" ? (existing?.quantity ?? 0) + quantity : quantity;
  const available = await variantAvailability(variantId);
  if (target > available) throw new ApiError(409, "INSUFFICIENT_STOCK", available === 0 ? "This item is out of stock" : `Only ${available} left in stock`, { available });
  if (existing) return (await db.update(s.cartItems).set({ quantity: target, savedForLater: false }).where(eq(s.cartItems.id, existing.id)).returning())[0];
  return (await db.insert(s.cartItems).values({ cartId, variantId, quantity: target }).returning())[0];
}

export async function variantAvailability(variantId: number) {
  const [r] = await db.select({ a: sql<number>`coalesce(sum("warehouse_inventory"."quantity_on_hand" - "warehouse_inventory"."quantity_reserved"),0)` }).from(s.warehouseInventory).innerJoin(s.warehouses, eq(s.warehouses.id, s.warehouseInventory.warehouseId)).where(and(eq(s.warehouseInventory.variantId, variantId), eq(s.warehouses.status, "ACTIVE")));
  return num(r?.a);
}

export async function addCartItem(ctx: Ctx, variantId: number, quantity: number) {
  const [v] = await db.select({ id: s.productVariants.id, status: s.productVariants.status, pstatus: s.products.status }).from(s.productVariants).innerJoin(s.products, eq(s.products.id, s.productVariants.productId)).where(eq(s.productVariants.id, variantId));
  if (!v || v.status !== "ACTIVE" || v.pstatus !== "ACTIVE") throw notFound("VARIANT_NOT_FOUND", "This product variant is unavailable");
  const cart = await getOrCreateCart(ctx);
  await upsertItem(cart.id, variantId, quantity, "add");
  await db.update(s.carts).set({ updatedAt: new Date() }).where(eq(s.carts.id, cart.id));
  return getCartView(ctx, cart);
}
export async function updateCartItem(ctx: Ctx, itemId: number, patch: { quantity?: number; savedForLater?: boolean }) {
  const cart = await getOrCreateCart(ctx);
  const [item] = await db.select().from(s.cartItems).where(and(eq(s.cartItems.id, itemId), eq(s.cartItems.cartId, cart.id)));
  if (!item) throw notFound("CART_ITEM_NOT_FOUND", "Cart item not found");
  if (patch.quantity != null) {
    if (patch.quantity <= 0) await db.delete(s.cartItems).where(eq(s.cartItems.id, itemId));
    else {
      const available = await variantAvailability(item.variantId);
      if (patch.quantity > available) throw new ApiError(409, "INSUFFICIENT_STOCK", `Only ${available} left in stock`, { available });
      await db.update(s.cartItems).set({ quantity: patch.quantity }).where(eq(s.cartItems.id, itemId));
    }
  }
  if (patch.savedForLater != null) await db.update(s.cartItems).set({ savedForLater: patch.savedForLater }).where(eq(s.cartItems.id, itemId));
  return getCartView(ctx, cart);
}
export async function removeCartItem(ctx: Ctx, itemId: number) {
  const cart = await getOrCreateCart(ctx);
  await db.delete(s.cartItems).where(and(eq(s.cartItems.id, itemId), eq(s.cartItems.cartId, cart.id)));
  return getCartView(ctx, cart);
}
export async function applyCoupon(ctx: Ctx, code: string | null) {
  const cart = await getOrCreateCart(ctx);
  if (code) {
    const view = await getCartView(ctx, cart);
    await validateCoupon(code, view.subtotal, view.items.map((i) => ({ productType: i.productType, categoryIds: i.categoryIds, lineTotal: i.lineTotal })), ctx.user?.id ?? null);
  }
  await db.update(s.carts).set({ couponCode: code ? code.toUpperCase() : null }).where(eq(s.carts.id, cart.id));
  return getCartView(ctx, { ...cart, couponCode: code ? code.toUpperCase() : null });
}

export async function getCartView(ctx: Ctx, cart?: typeof s.carts.$inferSelect) {
  cart = cart ?? (await getOrCreateCart(ctx));
  const rows = await db.select({
    id: s.cartItems.id, quantity: s.cartItems.quantity, savedForLater: s.cartItems.savedForLater, variantId: s.productVariants.id, sku: s.productVariants.sku, color: s.productVariants.color, colorHex: s.productVariants.colorHex, size: s.productVariants.size,
    price: s.productVariants.price, compareAtPrice: s.productVariants.compareAtPrice, variantStatus: s.productVariants.status, productId: s.products.id, productName: s.products.name, productSlug: s.products.slug, productType: s.products.productType, productStatus: s.products.status,
    image: sql<string | null>`(select url from product_images pi where pi.product_id = "products"."id" and (pi.color = "product_variants"."color" or pi.color is null) order by pi.sort_order limit 1)`,
    available: sql<number>`coalesce((select sum(wi.quantity_on_hand - wi.quantity_reserved) from warehouse_inventory wi join warehouses w on w.id = wi.warehouse_id where w.status='ACTIVE' and wi.variant_id = "product_variants"."id"),0)`,
    categoryIds: sql<number[]>`array(select category_id from product_categories pc where pc.product_id = "products"."id")`,
  }).from(s.cartItems).innerJoin(s.productVariants, eq(s.productVariants.id, s.cartItems.variantId)).innerJoin(s.products, eq(s.products.id, s.productVariants.productId)).where(eq(s.cartItems.cartId, cart.id)).orderBy(asc(s.cartItems.createdAt));
  const items = rows.map((r) => ({ ...r, price: num(r.price), compareAtPrice: r.compareAtPrice ? num(r.compareAtPrice) : null, available: num(r.available), lineTotal: num(r.price) * r.quantity, unavailable: r.variantStatus !== "ACTIVE" || r.productStatus !== "ACTIVE" || num(r.available) < r.quantity }));
  const active = items.filter((i) => !i.savedForLater);
  const subtotal = active.reduce((a, i) => a + i.lineTotal, 0);
  const totals = await computeTotals(subtotal, active, cart.couponCode, "standard", ctx.user?.id ?? null);
  return { ...totals, id: cart.id, token: cart.token, couponCode: totals.couponError ? null : cart.couponCode, items, savedItems: items.filter((i) => i.savedForLater), itemCount: active.reduce((a, i) => a + i.quantity, 0), subtotal };
}

export async function computeTotals(subtotal: number, items: { productType: string; categoryIds: number[]; lineTotal: number }[], couponCode: string | null | undefined, shippingMethod: string, userId: number | null) {
  const settings = await getSettings();
  const methods = (settings["shipping.methods"] as { code: string; name: string; price: number }[]) ?? [{ code: "standard", name: "Standard", price: 8 }];
  const freeThreshold = Number(settings["shipping.freeThreshold"] ?? 100);
  const taxRate = Number(settings["tax.rate"] ?? 0.08);
  let discount = 0, couponError: string | null = null, coupon: typeof s.coupons.$inferSelect | null = null, freeShipping = false;
  if (couponCode) {
    try {
      const r = await validateCoupon(couponCode, subtotal, items, userId);
      discount = r.discount; coupon = r.coupon; freeShipping = r.freeShipping;
    } catch (e) { couponError = (e as Error).message; }
  }
  const method = methods.find((m) => m.code === shippingMethod) ?? methods[0];
  let shipping = subtotal === 0 ? 0 : method.price;
  if (freeShipping || (method.code === "standard" && subtotal - discount >= freeThreshold)) shipping = 0;
  const tax = Math.round((subtotal - discount) * taxRate * 100) / 100;
  return { discount, shipping, tax, total: Math.max(0, Math.round((subtotal - discount + shipping + tax) * 100) / 100), couponError, coupon, shippingMethod: method.code, shippingMethods: methods.map((m) => ({ ...m, price: (m.code === "standard" && subtotal - discount >= freeThreshold) || freeShipping ? 0 : m.price })), freeShippingThreshold: freeThreshold, taxRate };
}

// =====================================================================
// Coupons
// =====================================================================
export async function validateCoupon(code: string, subtotal: number, items: { productType: string; categoryIds: number[]; lineTotal: number }[], userId: number | null) {
  const [c] = await db.select().from(s.coupons).where(eq(s.coupons.code, code.toUpperCase().trim()));
  if (!c || !c.isActive) throw badRequest("COUPON_INVALID", "This promo code is not valid");
  const now = new Date();
  if (c.startsAt && c.startsAt > now) throw badRequest("COUPON_NOT_STARTED", "This promo code is not active yet");
  if (c.expiresAt && c.expiresAt < now) throw badRequest("COUPON_EXPIRED", "This promo code has expired");
  if (c.usageLimit != null && c.usageCount >= c.usageLimit) throw badRequest("COUPON_EXHAUSTED", "This promo code has reached its usage limit");
  if (c.perCustomerLimit != null && userId) {
    const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(s.couponUsages).where(and(eq(s.couponUsages.couponId, c.id), eq(s.couponUsages.userId, userId)));
    if (Number(n) >= c.perCustomerLimit) throw badRequest("COUPON_LIMIT_REACHED", "You have already used this promo code");
  }
  if (c.minimumOrderAmount && subtotal < num(c.minimumOrderAmount)) throw badRequest("COUPON_MINIMUM", `Spend at least $${num(c.minimumOrderAmount).toFixed(0)} to use this code`);
  const eligible = items.filter((i) => (!c.appliesToProductType || i.productType === c.appliesToProductType) && (!c.appliesToCategoryId || i.categoryIds.includes(c.appliesToCategoryId)));
  const eligibleTotal = eligible.reduce((a, i) => a + i.lineTotal, 0);
  if ((c.appliesToProductType || c.appliesToCategoryId) && eligibleTotal === 0) throw badRequest("COUPON_NOT_ELIGIBLE", "This promo code doesn't apply to items in your cart");
  let discount = 0, freeShipping = false;
  if (c.type === "PERCENTAGE") discount = Math.round(eligibleTotal * num(c.value)) / 100;
  else if (c.type === "FIXED_AMOUNT") discount = Math.min(num(c.value), eligibleTotal);
  else freeShipping = true;
  return { coupon: c, discount: Math.round(discount * 100) / 100, freeShipping };
}

// =====================================================================
// Payment abstraction
// =====================================================================
export type PaymentInput = { amount: number; currency: string; method: string; card?: { number: string; expMonth: string; expYear: string; cvc: string; name: string } };
export type PaymentResult = { status: "PAID" | "AUTHORIZED" | "FAILED"; reference: string; failureReason?: string; last4?: string };
export interface PaymentProvider { name: string; charge(input: PaymentInput): Promise<PaymentResult>; refund(reference: string, amount: number): Promise<{ ok: boolean; reference: string }> }
export const mockPaymentProvider: PaymentProvider = {
  name: "mock",
  async charge(input) {
    const digits = (input.card?.number ?? "").replace(/\D/g, "");
    const last4 = digits.slice(-4);
    if (input.method === "card") {
      if (digits.length < 12) return { status: "FAILED", reference: `mock_${Date.now()}`, failureReason: "Invalid card number", last4 };
      if (last4 === "0000") return { status: "FAILED", reference: `mock_${Date.now()}`, failureReason: "Card declined by issuer", last4 };
      if (last4 === "9995") return { status: "FAILED", reference: `mock_${Date.now()}`, failureReason: "Insufficient funds", last4 };
    }
    return { status: "PAID", reference: `mock_${Date.now()}_${randomBytes(3).toString("hex")}`, last4 };
  },
  async refund(reference) { return { ok: true, reference: `re_${reference}` }; },
};
export const paymentProvider: PaymentProvider = mockPaymentProvider;

// =====================================================================
// Checkout
// =====================================================================
export type Address = { firstName: string; lastName: string; line1: string; line2?: string | null; city: string; region: string; postalCode: string; country: string; phone?: string | null };
export type CheckoutInput = { email: string; shippingAddress: Address; billingAddress?: Address | null; shippingMethod: string; payment: { method: "card" | "cash_on_delivery"; card?: { number: string; expMonth: string; expYear: string; cvc: string; name: string } }; couponCode?: string | null; customerNote?: string | null; saveAddress?: boolean; createAccountPassword?: string | null };

export async function checkout(ctx: Ctx, input: CheckoutInput) {
  const cart = await getOrCreateCart(ctx);
  const view = await getCartView(ctx, cart);
  const items = view.items.filter((i) => !i.savedForLater);
  if (!items.length) throw badRequest("CART_EMPTY", "Your cart is empty");
  const bad = items.filter((i) => i.variantStatus !== "ACTIVE" || i.productStatus !== "ACTIVE");
  if (bad.length) throw new ApiError(409, "PRODUCT_UNAVAILABLE", `${bad[0].productName} is no longer available`, { items: bad.map((b) => b.id) });
  const couponCode = input.couponCode ?? cart.couponCode;
  const totals = await computeTotals(view.subtotal, items, couponCode, input.shippingMethod, ctx.user?.id ?? null);
  if (couponCode && totals.couponError) throw badRequest("COUPON_INVALID", totals.couponError);
  const settings = await getSettings();
  const userId = ctx.user?.id ?? null;
  const email = (ctx.user?.email ?? input.email).toLowerCase();

  const result = await db.transaction(async (tx) => {
    const warehouses = await tx.select().from(s.warehouses).where(eq(s.warehouses.status, "ACTIVE")).orderBy(asc(s.warehouses.priority));
    // lock inventory rows for all variants
    const inv = await tx.select().from(s.warehouseInventory).where(and(inArray(s.warehouseInventory.variantId, items.map((i) => i.variantId)), inArray(s.warehouseInventory.warehouseId, warehouses.map((w) => w.id)))).for("update");
    const shortages: { variantId: number; name: string; requested: number; available: number }[] = [];
    const allocation = new Map<number, number>();
    for (const it of items) {
      const rows = inv.filter((r) => r.variantId === it.variantId);
      const totalAvail = rows.reduce((a, r) => a + r.quantityOnHand - r.quantityReserved, 0);
      const wh = warehouses.find((w) => (rows.find((r) => r.warehouseId === w.id)?.quantityOnHand ?? 0) - (rows.find((r) => r.warehouseId === w.id)?.quantityReserved ?? 0) >= it.quantity);
      if (!wh) shortages.push({ variantId: it.variantId, name: `${it.productName} (${it.color} / ${it.size})`, requested: it.quantity, available: totalAvail });
      else allocation.set(it.variantId, wh.id);
    }
    if (shortages.length) throw new ApiError(409, "INSUFFICIENT_STOCK", `${shortages[0].name}: only ${shortages[0].available} available`, { shortages });

    const orderNumber = `EG-${Date.now().toString(36).toUpperCase()}${randomBytes(2).toString("hex").toUpperCase()}`;
    const guestToken = userId ? null : randomBytes(16).toString("hex");
    const [order] = await tx.insert(s.orders).values({
      orderNumber, userId, email, guestToken, status: "PENDING", subtotal: money(view.subtotal), discountTotal: money(totals.discount), shippingTotal: money(totals.shipping), taxTotal: money(totals.tax), grandTotal: money(totals.total),
      couponId: totals.coupon?.id ?? null, couponCode: totals.coupon?.code ?? null, shippingMethod: totals.shippingMethod, shippingAddress: input.shippingAddress, billingAddress: input.billingAddress ?? input.shippingAddress, warehouseId: allocation.get(items[0].variantId) ?? warehouses[0]?.id, customerNote: input.customerNote ?? null,
    }).returning();
    await tx.insert(s.orderItems).values(items.map((i) => ({ orderId: order.id, variantId: i.variantId, productId: i.productId, productName: i.productName, productSlug: i.productSlug, sku: i.sku, color: i.color, size: i.size, imageUrl: i.image, unitPrice: money(i.price), quantity: i.quantity, lineTotal: money(i.lineTotal) })));
    await tx.insert(s.orderEvents).values({ orderId: order.id, type: "ORDER_CREATED", message: "Order placed", actorId: userId });
    for (const it of items) await applyTransaction(tx, { variantId: it.variantId, warehouseId: allocation.get(it.variantId)!, type: "RESERVATION", quantity: it.quantity, referenceType: "ORDER", referenceId: orderNumber, reason: "Checkout reservation", createdBy: userId });

    // Payment
    const pay = input.payment.method === "cash_on_delivery" ? { status: "AUTHORIZED" as const, reference: `cod_${order.id}` } : await paymentProvider.charge({ amount: totals.total, currency: "USD", method: input.payment.method, card: input.payment.card });
    const [payment] = await tx.insert(s.payments).values({ orderId: order.id, provider: paymentProvider.name, providerReference: pay.reference, method: input.payment.method, status: pay.status, amount: money(totals.total), cardLast4: pay.last4 ?? null, failureReason: pay.failureReason ?? null }).returning();
    if (pay.status === "FAILED") {
      for (const it of items) await applyTransaction(tx, { variantId: it.variantId, warehouseId: allocation.get(it.variantId)!, type: "RELEASE", quantity: it.quantity, referenceType: "ORDER", referenceId: orderNumber, reason: "Payment failed", createdBy: userId });
      await tx.update(s.orders).set({ status: "CANCELLED", updatedAt: new Date() }).where(eq(s.orders.id, order.id));
      await tx.insert(s.orderEvents).values([{ orderId: order.id, type: "PAYMENT_FAILED", message: pay.failureReason ?? "Payment failed" }, { orderId: order.id, type: "ORDER_CANCELLED", message: "Cancelled: payment failed" }]);
      return { order, payment, failed: true as const, reason: pay.failureReason };
    }
    for (const it of items) await applyTransaction(tx, { variantId: it.variantId, warehouseId: allocation.get(it.variantId)!, type: "SALE", quantity: it.quantity, referenceType: "ORDER", referenceId: orderNumber, reason: "Order confirmed", createdBy: userId });
    await tx.update(s.orders).set({ status: "CONFIRMED", updatedAt: new Date() }).where(eq(s.orders.id, order.id));
    await tx.insert(s.orderEvents).values({ orderId: order.id, type: "PAYMENT_CONFIRMED", message: pay.status === "AUTHORIZED" ? "Payment authorized (pay on delivery)" : `Payment captured (${paymentProvider.name} •••• ${pay.last4})` });
    await tx.insert(s.shipments).values({ orderId: order.id, warehouseId: order.warehouseId, status: "PENDING" });
    if (totals.coupon) {
      await tx.insert(s.couponUsages).values({ couponId: totals.coupon.id, userId, orderId: order.id, discountAmount: money(totals.discount) });
      await tx.update(s.coupons).set({ usageCount: sql`"coupons"."usage_count" + 1` }).where(eq(s.coupons.id, totals.coupon.id));
    }
    await tx.delete(s.cartItems).where(and(eq(s.cartItems.cartId, cart.id), eq(s.cartItems.savedForLater, false)));
    await tx.update(s.carts).set({ couponCode: null, updatedAt: new Date() }).where(eq(s.carts.id, cart.id));
    if (userId && input.saveAddress) await tx.insert(s.addresses).values({ userId, ...input.shippingAddress, label: "Shipping" });
    return { order, payment, failed: false as const, reason: undefined };
  });

  void settings;
  if (result.failed) throw new ApiError(402, "PAYMENT_FAILED", result.reason ?? "Payment failed", { orderNumber: result.order.orderNumber });
  await notify(userId, email, "ORDER_CONFIRMED", `Order ${result.order.orderNumber} confirmed`, `Thanks for your order! We'll email you when it ships.`, { orderNumber: result.order.orderNumber });
  return getOrder(ctx, result.order.orderNumber, result.order.guestToken ?? undefined);
}

// =====================================================================
// Orders (customer facing)
// =====================================================================
export async function getOrder(ctx: Ctx, orderNumberOrId: string, guestToken?: string) {
  const isId = /^\d+$/.test(orderNumberOrId);
  const [o] = await db.select().from(s.orders).where(isId ? eq(s.orders.id, Number(orderNumberOrId)) : eq(s.orders.orderNumber, orderNumberOrId));
  if (!o) throw notFound("ORDER_NOT_FOUND", "Order not found");
  const isOwner = ctx.user && o.userId === ctx.user.id;
  const isGuest = guestToken && o.guestToken === guestToken;
  if (!isOwner && !isGuest && !ctx.user?.isStaff) throw ctx.user ? forbidden() : unauthorized();
  return hydrateOrder(o);
}
export async function hydrateOrder(o: typeof s.orders.$inferSelect) {
  const [items, pays, ships, events, customer] = await Promise.all([
    db.select().from(s.orderItems).where(eq(s.orderItems.orderId, o.id)).orderBy(asc(s.orderItems.id)),
    db.select().from(s.payments).where(eq(s.payments.orderId, o.id)),
    db.select().from(s.shipments).where(eq(s.shipments.orderId, o.id)),
    db.select().from(s.orderEvents).where(eq(s.orderEvents.orderId, o.id)).orderBy(asc(s.orderEvents.createdAt), asc(s.orderEvents.id)),
    o.userId ? db.select({ id: s.users.id, firstName: s.users.firstName, lastName: s.users.lastName, email: s.users.email }).from(s.users).where(eq(s.users.id, o.userId)) : Promise.resolve([]),
  ]);
  const reviewed = items.length ? await db.select({ orderItemId: s.reviews.orderItemId }).from(s.reviews).where(inArray(s.reviews.orderItemId, items.map((i) => i.id))) : [];
  const reviewedSet = new Set(reviewed.map((r) => r.orderItemId));
  return { ...o, subtotal: num(o.subtotal), discountTotal: num(o.discountTotal), shippingTotal: num(o.shippingTotal), taxTotal: num(o.taxTotal), grandTotal: num(o.grandTotal), items: items.map((i) => ({ ...i, unitPrice: num(i.unitPrice), lineTotal: num(i.lineTotal), reviewed: reviewedSet.has(i.id) })), payments: pays.map((p) => ({ ...p, amount: num(p.amount), refundedAmount: num(p.refundedAmount) })), shipments: ships, events, customer: customer[0] ?? null, canCancel: ["PENDING", "CONFIRMED", "PROCESSING"].includes(o.status) };
}
export async function listMyOrders(userId: number, page: number, pageSize: number) {
  const [rows, [{ count }]] = await Promise.all([
    db.select().from(s.orders).where(eq(s.orders.userId, userId)).orderBy(desc(s.orders.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)` }).from(s.orders).where(eq(s.orders.userId, userId)),
  ]);
  const ids = rows.map((r) => r.id);
  const items = ids.length ? await db.select().from(s.orderItems).where(inArray(s.orderItems.orderId, ids)) : [];
  return { items: rows.map((o) => ({ ...o, grandTotal: num(o.grandTotal), items: items.filter((i) => i.orderId === o.id).map((i) => ({ ...i, unitPrice: num(i.unitPrice) })) })), total: Number(count) };
}

/** Shared status transition with inventory + payment side-effects. Used by customers (cancel) and admins. */
const TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"], CONFIRMED: ["PROCESSING", "CANCELLED"], PROCESSING: ["PACKED", "CANCELLED"], PACKED: ["SHIPPED", "CANCELLED"], SHIPPED: ["DELIVERED", "REFUNDED"], DELIVERED: ["REFUNDED"], CANCELLED: [], REFUNDED: [],
};
const EVENT_FOR: Record<string, string> = { CONFIRMED: "PAYMENT_CONFIRMED", PROCESSING: "ORDER_PROCESSING", PACKED: "ORDER_PACKED", SHIPPED: "ORDER_SHIPPED", DELIVERED: "ORDER_DELIVERED", CANCELLED: "ORDER_CANCELLED", REFUNDED: "REFUND_CREATED" };
export async function transitionOrder(orderId: number, to: string, actorId: number | null, note?: string, extra?: { carrier?: string; trackingNumber?: string }) {
  return db.transaction(async (tx) => {
    const [o] = await tx.select().from(s.orders).where(eq(s.orders.id, orderId)).for("update");
    if (!o) throw notFound("ORDER_NOT_FOUND", "Order not found");
    if (!TRANSITIONS[o.status]?.includes(to)) throw new ApiError(409, "INVALID_TRANSITION", `Cannot move order from ${o.status} to ${to}`);
    const items = await tx.select().from(s.orderItems).where(eq(s.orderItems.orderId, o.id));
    const [payment] = await tx.select().from(s.payments).where(eq(s.payments.orderId, o.id)).orderBy(desc(s.payments.id));
    const wh = o.warehouseId ?? (await tx.select().from(s.warehouses).where(eq(s.warehouses.isDefault, true)))[0]?.id;
    if (to === "CANCELLED" || to === "REFUNDED") {
      for (const it of items) if (it.variantId && wh) {
        if (o.status === "PENDING") await applyTransaction(tx, { variantId: it.variantId, warehouseId: wh, type: "RELEASE", quantity: it.quantity, referenceType: "ORDER", referenceId: o.orderNumber, reason: "Order cancelled", createdBy: actorId });
        else await applyTransaction(tx, { variantId: it.variantId, warehouseId: wh, type: "RETURN", quantity: it.quantity, referenceType: "ORDER", referenceId: o.orderNumber, reason: to === "REFUNDED" ? "Refund / return" : "Order cancelled", createdBy: actorId });
      }
      if (payment && ["PAID", "AUTHORIZED"].includes(payment.status)) {
        await paymentProvider.refund(payment.providerReference ?? "", num(payment.amount));
        await tx.update(s.payments).set({ status: "REFUNDED", refundedAmount: payment.amount, updatedAt: new Date() }).where(eq(s.payments.id, payment.id));
      }
    }
    if (to === "SHIPPED") await tx.update(s.shipments).set({ status: "SHIPPED", shippedAt: new Date(), carrier: extra?.carrier ?? "EcoPost", trackingNumber: extra?.trackingNumber ?? `EP${Date.now()}US`, updatedAt: new Date() }).where(eq(s.shipments.orderId, o.id));
    if (to === "PACKED") await tx.update(s.shipments).set({ status: "PACKED", updatedAt: new Date() }).where(eq(s.shipments.orderId, o.id));
    if (to === "DELIVERED") await tx.update(s.shipments).set({ status: "DELIVERED", deliveredAt: new Date(), updatedAt: new Date() }).where(eq(s.shipments.orderId, o.id));
    if (to === "REFUNDED") await tx.update(s.shipments).set({ status: "RETURNED", updatedAt: new Date() }).where(eq(s.shipments.orderId, o.id));
    await tx.update(s.orders).set({ status: to, updatedAt: new Date() }).where(eq(s.orders.id, o.id));
    await tx.insert(s.orderEvents).values({ orderId: o.id, type: EVENT_FOR[to] ?? "STATUS_CHANGED", message: note ?? `Status changed to ${to}`, actorId });
    return { from: o.status, to, order: o };
  });
}
export async function cancelMyOrder(ctx: Ctx, orderNumber: string, guestToken?: string) {
  const o = await getOrder(ctx, orderNumber, guestToken);
  if (!o.canCancel) throw new ApiError(409, "CANNOT_CANCEL", "This order can no longer be cancelled");
  await transitionOrder(o.id, "CANCELLED", ctx.user?.id ?? null, "Cancelled by customer");
  await notify(o.userId, o.email, "ORDER_CONFIRMED", `Order ${o.orderNumber} cancelled`, "Your order was cancelled and any payment refunded.");
  return getOrder(ctx, orderNumber, guestToken);
}
export async function reorder(ctx: Ctx, orderNumber: string) {
  const o = await getOrder(ctx, orderNumber);
  const added: string[] = [], skipped: string[] = [];
  for (const it of o.items) {
    if (!it.variantId) { skipped.push(it.productName); continue; }
    try { await addCartItem(ctx, it.variantId, it.quantity); added.push(it.productName); } catch { skipped.push(it.productName); }
  }
  return { added, skipped, cart: await getCartView(ctx) };
}

// =====================================================================
// Wishlist
// =====================================================================
async function wishlistId(userId: number) {
  const [w] = await db.select().from(s.wishlists).where(eq(s.wishlists.userId, userId));
  return w ? w.id : (await db.insert(s.wishlists).values({ userId }).returning())[0].id;
}
export async function getWishlist(userId: number) {
  const wid = await wishlistId(userId);
  const rows = await db.select({ id: s.wishlistItems.id, productId: s.wishlistItems.productId, variantId: s.wishlistItems.variantId, priceAtAdd: s.wishlistItems.priceAtAdd, createdAt: s.wishlistItems.createdAt }).from(s.wishlistItems).where(eq(s.wishlistItems.wishlistId, wid)).orderBy(desc(s.wishlistItems.createdAt));
  if (!rows.length) return [];
  const { hydrateCards } = await import("./catalog");
  const cards = await hydrateCards(await db.select().from(s.products).where(inArray(s.products.id, rows.map((r) => r.productId))));
  return rows.map((r) => ({ ...r, priceAtAdd: r.priceAtAdd ? num(r.priceAtAdd) : null, product: cards.find((c) => c.id === r.productId) ?? null })).filter((r) => r.product);
}
export async function toggleWishlist(userId: number, productId: number, variantId?: number | null) {
  const wid = await wishlistId(userId);
  const [existing] = await db.select().from(s.wishlistItems).where(and(eq(s.wishlistItems.wishlistId, wid), eq(s.wishlistItems.productId, productId)));
  if (existing) { await db.delete(s.wishlistItems).where(eq(s.wishlistItems.id, existing.id)); return { added: false }; }
  const [v] = await db.select({ p: sql<string>`min(price)` }).from(s.productVariants).where(eq(s.productVariants.productId, productId));
  await db.insert(s.wishlistItems).values({ wishlistId: wid, productId, variantId: variantId ?? null, priceAtAdd: v?.p ?? null });
  return { added: true };
}
export async function removeWishlist(userId: number, productId: number) {
  const wid = await wishlistId(userId);
  await db.delete(s.wishlistItems).where(and(eq(s.wishlistItems.wishlistId, wid), eq(s.wishlistItems.productId, productId)));
}
export async function wishlistProductIds(userId: number) {
  const wid = await wishlistId(userId);
  return (await db.select({ productId: s.wishlistItems.productId }).from(s.wishlistItems).where(eq(s.wishlistItems.wishlistId, wid))).map((r) => r.productId);
}

// =====================================================================
// Addresses
// =====================================================================
export const listAddresses = (userId: number) => db.select().from(s.addresses).where(eq(s.addresses.userId, userId)).orderBy(desc(s.addresses.isDefault), desc(s.addresses.createdAt));
export async function saveAddress(userId: number, input: Address & { label?: string | null; isDefault?: boolean }, id?: number) {
  if (input.isDefault) await db.update(s.addresses).set({ isDefault: false }).where(eq(s.addresses.userId, userId));
  if (id) {
    const [a] = await db.update(s.addresses).set(input).where(and(eq(s.addresses.id, id), eq(s.addresses.userId, userId))).returning();
    if (!a) throw notFound("ADDRESS_NOT_FOUND", "Address not found");
    return a;
  }
  return (await db.insert(s.addresses).values({ ...input, userId }).returning())[0];
}
export const deleteAddress = (userId: number, id: number) => db.delete(s.addresses).where(and(eq(s.addresses.id, id), eq(s.addresses.userId, userId)));

// =====================================================================
// Reviews
// =====================================================================
export async function listProductReviews(productId: number, page: number, pageSize: number) {
  const where = and(eq(s.reviews.productId, productId), eq(s.reviews.status, "APPROVED"));
  const [rows, [{ count }]] = await Promise.all([
    db.select({ id: s.reviews.id, rating: s.reviews.rating, title: s.reviews.title, comment: s.reviews.comment, images: s.reviews.images, isVerifiedPurchase: s.reviews.isVerifiedPurchase, createdAt: s.reviews.createdAt, author: sql<string>`"users"."first_name" || ' ' || left("users"."last_name", 1) || '.'` }).from(s.reviews).innerJoin(s.users, eq(s.users.id, s.reviews.userId)).where(where).orderBy(desc(s.reviews.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)` }).from(s.reviews).where(where),
  ]);
  return { items: rows, total: Number(count) };
}
export async function createReview(userId: number, input: { productId: number; orderItemId?: number | null; rating: number; title?: string; comment?: string; images?: string[] }) {
  let verified = false;
  if (input.orderItemId) {
    const [oi] = await db.select({ id: s.orderItems.id, productId: s.orderItems.productId, userId: s.orders.userId, status: s.orders.status }).from(s.orderItems).innerJoin(s.orders, eq(s.orders.id, s.orderItems.orderId)).where(eq(s.orderItems.id, input.orderItemId));
    if (!oi || oi.userId !== userId) throw forbidden();
    if (oi.productId !== input.productId) throw badRequest("REVIEW_MISMATCH", "Order item does not match product");
    const [dup] = await db.select({ id: s.reviews.id }).from(s.reviews).where(eq(s.reviews.orderItemId, input.orderItemId));
    if (dup) throw new ApiError(409, "REVIEW_EXISTS", "You already reviewed this item");
    verified = true;
  } else {
    const [prev] = await db.select({ id: s.reviews.id }).from(s.reviews).where(and(eq(s.reviews.userId, userId), eq(s.reviews.productId, input.productId), isNull(s.reviews.orderItemId)));
    if (prev) throw new ApiError(409, "REVIEW_EXISTS", "You already reviewed this product");
    const [purchase] = await db.select({ id: s.orderItems.id }).from(s.orderItems).innerJoin(s.orders, eq(s.orders.id, s.orderItems.orderId)).where(and(eq(s.orders.userId, userId), eq(s.orderItems.productId, input.productId), or(eq(s.orders.status, "DELIVERED"), eq(s.orders.status, "SHIPPED")))).limit(1);
    verified = !!purchase;
  }
  const [r] = await db.insert(s.reviews).values({ productId: input.productId, userId, orderItemId: input.orderItemId ?? null, rating: input.rating, title: input.title, comment: input.comment, images: input.images ?? [], isVerifiedPurchase: verified, status: "PENDING" }).returning();
  return r;
}
export const listMyReviews = (userId: number) => db.select({ id: s.reviews.id, rating: s.reviews.rating, title: s.reviews.title, comment: s.reviews.comment, status: s.reviews.status, createdAt: s.reviews.createdAt, productName: s.products.name, productSlug: s.products.slug }).from(s.reviews).innerJoin(s.products, eq(s.products.id, s.reviews.productId)).where(eq(s.reviews.userId, userId)).orderBy(desc(s.reviews.createdAt));
export async function recalcRating(productId: number) {
  await db.execute(sql`update products p set rating_avg = coalesce(r.avg, 0), rating_count = coalesce(r.cnt, 0) from (select ${productId}::int as pid, round(avg(rating)::numeric, 2) as avg, count(*) as cnt from reviews where status = 'APPROVED' and product_id = ${productId}) r where p.id = r.pid`);
}
