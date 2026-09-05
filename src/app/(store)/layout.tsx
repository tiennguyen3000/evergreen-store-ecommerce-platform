import type { ReactNode } from "react";
import { Footer, Header } from "@/components/store/shell";
import { getSettings } from "@/server/core";

export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: { children: ReactNode }) {
  const settings = await getSettings().catch(() => ({} as Record<string, unknown>));
  return (
    <div className="flex min-h-screen flex-col">
      <Header announcement={String(settings["store.announcement"] ?? "Free carbon-neutral shipping on orders over $100")} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
