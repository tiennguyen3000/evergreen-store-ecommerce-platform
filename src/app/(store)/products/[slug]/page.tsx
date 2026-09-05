import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug, relatedProducts } from "@/server/services/catalog";
import { listProductReviews } from "@/server/services/commerce";
import { ProductView } from "./product-view";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const p = await getProductBySlug(slug);
    return { title: p.seoTitle ?? p.name, description: p.seoDescription ?? p.shortDescription ?? undefined, alternates: { canonical: `/products/${p.slug}` }, openGraph: { title: p.name, description: p.shortDescription ?? undefined, images: p.images[0] ? [p.images[0].url] : [], type: "website" } };
  } catch { return { title: "Product not found" }; }
}
export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  let product;
  try { product = await getProductBySlug(slug); } catch { notFound(); }
  const [related, reviews] = await Promise.all([relatedProducts(product.id, product.primaryCategoryId), listProductReviews(product.id, 1, 6)]);
  const jsonLd = {
    "@context": "https://schema.org", "@type": "Product", name: product.name, description: product.shortDescription, image: product.images.map((i) => i.url), sku: product.variants[0]?.sku, brand: { "@type": "Brand", name: "Evergreen" },
    aggregateRating: product.ratingCount ? { "@type": "AggregateRating", ratingValue: product.ratingAvg, reviewCount: product.ratingCount } : undefined,
    offers: { "@type": "AggregateOffer", priceCurrency: "USD", lowPrice: product.price, highPrice: Math.max(...product.variants.map((v) => v.price)), offerCount: product.variants.length, availability: product.variants.some((v) => v.available > 0) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ProductView product={JSON.parse(JSON.stringify(product))} related={related} initialReviews={JSON.parse(JSON.stringify(reviews))} />
    </>
  );
}
