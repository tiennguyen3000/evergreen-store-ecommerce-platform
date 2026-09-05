import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "@/components/providers";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Evergreen — Naturally better everyday essentials", template: "%s | Evergreen" },
  description: "Shoes, apparel and accessories made from natural, renewable materials. Designed in Portland, shipped carbon neutral.",
  openGraph: { siteName: "Evergreen", type: "website", images: ["/images/hero.jpg"] },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
