export const metadata = { title: "Help & Sizing" };
export default function HelpPage() {
  return (
    <div className="container-x max-w-3xl py-16">
      <h1 className="font-display text-4xl">Help center</h1>
      <div className="mt-10 space-y-10 text-sm leading-relaxed text-ink/80">
        <section><h2 className="font-display text-2xl text-ink">Shipping</h2><p className="mt-2">Standard shipping (4–7 business days) is $8, or free on orders over $100. Express (2–3 days) is $18. Every shipment is carbon neutral and packed in 90% recycled materials.</p></section>
        <section><h2 className="font-display text-2xl text-ink">Returns</h2><p className="mt-2">Try Evergreen for 30 days. If you're not in love, return worn or unworn items for a full refund. Lightly used returns are donated or recycled through our take-back program.</p></section>
        <section id="sizing"><h2 className="font-display text-2xl text-ink">Size guide</h2><p className="mt-2">Our shoes run true to size. If you're between sizes, size down for knit uppers (Runner, Tree Flyer) and size up for wool styles.</p>
          <table className="mt-4 w-full text-left text-xs"><thead><tr className="border-b border-ink/10 uppercase tracking-wider text-stone"><th className="py-2">EU</th><th>US Men</th><th>US Women</th><th>Foot length</th></tr></thead><tbody>{[["36", "—", "6", "22.5 cm"], ["38", "6", "8", "24 cm"], ["40", "7.5", "9.5", "25.5 cm"], ["42", "9", "11", "27 cm"], ["44", "10.5", "—", "28.5 cm"], ["46", "12", "—", "30 cm"]].map((r) => <tr key={r[0]} className="border-b border-ink/5">{r.map((c, i) => <td key={i} className="py-2">{c}</td>)}</tr>)}</tbody></table></section>
      </div>
    </div>
  );
}
