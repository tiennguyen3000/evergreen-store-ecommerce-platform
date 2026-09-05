import { Newsletter } from "@/components/store/shell";
export const metadata = { title: "Sustainability", description: "How Evergreen designs with renewable materials and measures every footprint." };
export default function SustainabilityPage() {
  return (
    <>
      <section className="relative isolate"><img src="/images/sustainability.jpg" alt="" className="h-[60vh] w-full object-cover" /><div className="absolute inset-0 bg-ink/30" /><div className="container-x absolute inset-0 flex flex-col justify-end pb-14 text-white"><p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/70">Sustainability</p><h1 className="mt-2 max-w-2xl font-display text-5xl sm:text-6xl">Better is a direction, not a destination.</h1></div></section>
      <section className="container-x grid gap-12 py-20 lg:grid-cols-3" id="materials">
        {[["Merino wool", "Sourced from ZQ-certified farms in New Zealand where animal welfare and land regeneration are audited annually. Naturally temperature-regulating and odor-resistant."], ["Eucalyptus tree fiber", "FSC-certified eucalyptus grown in South Africa uses 95% less water than cotton. Spun into a silky, breathable knit for warm-weather styles."], ["Sugarcane foam", "Our midsoles are made from Brazilian sugarcane — a fully renewable resource that removes carbon from the air as it grows."]].map(([t, d]) => <div key={t}><h2 className="font-display text-2xl">{t}</h2><p className="mt-3 text-stone">{d}</p></div>)}
      </section>
      <section className="bg-white py-20"><div className="container-x grid gap-8 text-center sm:grid-cols-4">{[["7.4 kg", "Avg. CO₂e per pair, labeled on every product"], ["100%", "Of emissions offset through verified projects"], ["83%", "Natural or recycled materials by weight"], ["1%", "Of revenue given to environmental non-profits"]].map(([n, d]) => <div key={d}><p className="font-display text-5xl text-forest">{n}</p><p className="mt-2 text-sm text-stone">{d}</p></div>)}</div></section>
      <Newsletter />
    </>
  );
}
