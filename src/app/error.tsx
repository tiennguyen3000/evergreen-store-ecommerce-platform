"use client";
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-stone">500</p>
      <h1 className="mt-3 font-display text-4xl">Something went wrong.</h1>
      <p className="mt-2 max-w-md text-stone">{error.message || "An unexpected error occurred."}</p>
      <button onClick={reset} className="mt-8 rounded-full bg-forest px-6 py-3 text-sm font-medium text-white">Try again</button>
    </div>
  );
}
