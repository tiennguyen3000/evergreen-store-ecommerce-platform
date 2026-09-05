import type { ReactNode } from "react";
import { Logo } from "@/components/store/shell";
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden lg:block"><img src="/images/hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-0 bg-ink/30" /><div className="relative flex h-full flex-col justify-between p-10 text-white"><Logo light /><p className="max-w-md font-display text-4xl leading-tight">"The most comfortable shoes I've owned — and I feel good wearing them."</p></div></div>
      <div className="flex flex-col px-6 py-10 sm:px-12 lg:px-20"><div className="lg:hidden"><Logo /></div><div className="my-auto w-full max-w-md py-10">{children}</div></div>
    </div>
  );
}
