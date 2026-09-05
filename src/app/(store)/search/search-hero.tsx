"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui";
import { useLocal } from "@/stores/ui";
export function SearchHero() {
  const [q, setQ] = useState("");
  const router = useRouter();
  const { recentSearches, addRecentSearch } = useLocal();
  const go = (t: string) => { addRecentSearch(t); router.push(`/search?q=${encodeURIComponent(t)}`); };
  return (
    <div className="container-x max-w-2xl py-20 text-center">
      <h1 className="font-display text-4xl">What are you looking for?</h1>
      <form className="relative mt-8" onSubmit={(e) => { e.preventDefault(); if (q.trim()) go(q.trim()); }}><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone" /><Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products, materials, categories…" className="h-14 rounded-full pl-12 text-base" /></form>
      <div className="mt-6 flex flex-wrap justify-center gap-2">{[...new Set([...recentSearches, "runner", "merino", "hoodie", "trail", "socks"])].slice(0, 8).map((t) => <button key={t} onClick={() => go(t)} className="rounded-full border border-ink/15 px-4 py-1.5 text-sm hover:border-ink">{t}</button>)}</div>
    </div>
  );
}
