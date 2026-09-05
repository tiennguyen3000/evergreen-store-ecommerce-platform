import Link from "next/link";
export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-stone">404</p>
      <h1 className="mt-3 font-display text-4xl">This trail doesn't exist.</h1>
      <p className="mt-2 max-w-md text-stone">The page you're looking for may have moved or never existed.</p>
      <Link href="/" className="mt-8 rounded-full bg-forest px-6 py-3 text-sm font-medium text-white hover:bg-forest-dark">Back to home</Link>
    </div>
  );
}
