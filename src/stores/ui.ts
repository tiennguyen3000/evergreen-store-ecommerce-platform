"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type Toast = { id: number; title: string; description?: string; variant?: "default" | "success" | "error" };
type UiState = {
  toasts: Toast[]; toast: (t: Omit<Toast, "id">) => void; dismiss: (id: number) => void;
  cartOpen: boolean; setCartOpen: (v: boolean) => void; mobileNavOpen: boolean; setMobileNavOpen: (v: boolean) => void; searchOpen: boolean; setSearchOpen: (v: boolean) => void;
};
let nextId = 1;
export const useUi = create<UiState>((set) => ({
  toasts: [],
  toast: (t) => { const id = nextId++; set((s) => ({ toasts: [...s.toasts, { ...t, id }] })); setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 3500); },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
  cartOpen: false, setCartOpen: (cartOpen) => set({ cartOpen }),
  mobileNavOpen: false, setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
  searchOpen: false, setSearchOpen: (searchOpen) => set({ searchOpen }),
}));

type LocalState = { recentlyViewed: string[]; addRecentlyViewed: (slug: string) => void; recentSearches: string[]; addRecentSearch: (q: string) => void; clearRecentSearches: () => void };
export const useLocal = create<LocalState>()(persist((set) => ({
  recentlyViewed: [], addRecentlyViewed: (slug) => set((s) => ({ recentlyViewed: [slug, ...s.recentlyViewed.filter((x) => x !== slug)].slice(0, 8) })),
  recentSearches: [], addRecentSearch: (q) => set((s) => ({ recentSearches: [q, ...s.recentSearches.filter((x) => x !== q)].slice(0, 6) })), clearRecentSearches: () => set({ recentSearches: [] }),
}), { name: "evergreen-local" }));
