"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, patch, post } from "./api";
import { useUi } from "@/stores/ui";

export const useMe = () => useQuery({ queryKey: ["me"], queryFn: async () => (await get("/auth/me")).data, staleTime: 60_000 });
export const useCart = () => useQuery({ queryKey: ["cart"], queryFn: async () => (await get("/cart")).data, staleTime: 15_000 });
export const useWishlistIds = () => { const me = useMe(); return useQuery({ queryKey: ["wishlist-ids"], queryFn: async () => (await get<number[]>("/wishlist/ids")).data, enabled: !!me.data }); };

export function useCartMutations() {
  const qc = useQueryClient();
  const toast = useUi((s) => s.toast);
  const setCartOpen = useUi((s) => s.setCartOpen);
  const onError = (e: any) => toast({ title: e?.message ?? "Something went wrong", variant: "error" });
  const sync = (data: any) => { qc.setQueryData(["cart"], data); };
  const add = useMutation({ mutationFn: (v: { variantId: number; quantity?: number }) => post("/cart/items", v), onSuccess: (r) => { sync(r.data); setCartOpen(true); }, onError });
  const update = useMutation({
    mutationFn: (v: { id: number; quantity?: number; savedForLater?: boolean }) => patch(`/cart/items/${v.id}`, { quantity: v.quantity, savedForLater: v.savedForLater }),
    onMutate: async (v) => { await qc.cancelQueries({ queryKey: ["cart"] }); const prev = qc.getQueryData<any>(["cart"]); if (prev && v.quantity != null) qc.setQueryData(["cart"], { ...prev, items: prev.items.map((i: any) => (i.id === v.id ? { ...i, quantity: v.quantity, lineTotal: i.price * (v.quantity ?? i.quantity) } : i)) }); return { prev }; },
    onError: (e, _v, c) => { if (c?.prev) qc.setQueryData(["cart"], c.prev); onError(e); }, onSuccess: (r) => sync(r.data),
  });
  const remove = useMutation({ mutationFn: (id: number) => del(`/cart/items/${id}`), onSuccess: (r) => { sync(r.data); toast({ title: "Removed from cart" }); }, onError });
  const coupon = useMutation({ mutationFn: (code: string | null) => (code ? post("/cart/coupon", { code }) : del("/cart/coupon")), onSuccess: (r, code) => { sync(r.data); if (code) toast({ title: "Promo code applied", variant: "success" }); }, onError });
  return { add, update, remove, coupon };
}
export function useWishlistToggle() {
  const qc = useQueryClient();
  const toast = useUi((s) => s.toast);
  return useMutation({
    mutationFn: (productId: number) => post<{ added: boolean }>("/wishlist", { productId }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["wishlist-ids"] }); qc.invalidateQueries({ queryKey: ["wishlist"] }); toast({ title: r.data.added ? "Saved to wishlist" : "Removed from wishlist", variant: "success" }); },
    onError: (e: any) => toast({ title: e.status === 401 ? "Sign in to save items" : e.message, variant: "error" }),
  });
}
export function useLogout() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => post("/auth/logout"), onSuccess: () => { qc.clear(); window.location.href = "/"; } });
}
