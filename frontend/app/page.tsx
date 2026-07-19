import { HeroCarousel } from '@/components/hero-carousel';
import { CategoryGrid } from '@/components/category-grid';
import { ProductGrid } from '@/components/product-grid';
import { DealsSection } from '@/components/deals-section';
import { ReviewsSection } from '@/components/reviews-section';
import { NewsletterSection } from '@/components/newsletter-section';
import { TrustStrip } from '@/components/trust-strip';
import { SectionLabel } from '@/components/section-label';
import {
  getAllProducts,
  getFeaturedProducts,
  getDealsProducts,
  getBestSellers,
  getTopReviews,
} from '@/lib/dummyjson';

export const revalidate = 3600;

export default async function HomePage() {
  const [featured, deals, bestSellers, reviews, all] = await Promise.all([
    getFeaturedProducts(8),
    getDealsProducts(6),
    getBestSellers(8),
    getTopReviews(8),
    getAllProducts(12),
  ]);

  return (
    <main>
      <HeroCarousel />
      <TrustStrip />

      {/* Categories */}
      <section className="mx-auto max-w-[var(--container-content)] px-4 py-16 md:px-6">
        <SectionLabel
          index="01"
          eyebrow="Browse"
          title="Shop by Category"
          description="Everything you need, organized by category."
          href="/categories"
          className="mb-10"
        />
        <CategoryGrid />
      </section>

      <div className="hairline" />

      {/* Deals of the day */}
      <section className="mx-auto max-w-[var(--container-content)] px-4 py-16 md:px-6">
        <SectionLabel
          index="02"
          eyebrow="Limited time"
          title="Deals of the Day"
          description="Hand-picked discounts — updated daily. Grab them before they are gone."
          href="/shop?sort=deal"
          className="mb-10"
        />
        <DealsSection products={deals} />
      </section>

      <div className="hairline" />

      {/* Featured */}
      <section className="mx-auto max-w-[var(--container-content)] px-4 py-16 md:px-6">
        <SectionLabel
          index="03"
          eyebrow="Editor picks"
          title="Featured Products"
          description="Products we are excited about — curated by our team every week."
          href="/shop"
          className="mb-10"
        />
        <ProductGrid products={featured} columns={4} />
      </section>

      <div className="hairline" />

      {/* New arrivals */}
      <section className="bg-[color:var(--color-surface)] px-4 py-16 md:px-6">
        <div className="mx-auto max-w-[var(--container-content)]">
          <SectionLabel
            index="04"
            eyebrow="Just landed"
            title="New Arrivals"
            description="The latest additions to the PRISM catalog."
            href="/shop?sort=new"
            className="mb-10"
          />
          <ProductGrid products={all} columns={4} />
        </div>
      </section>

      <div className="hairline" />

      {/* Best sellers */}
      <section className="mx-auto max-w-[var(--container-content)] px-4 py-16 md:px-6">
        <SectionLabel
          index="05"
          eyebrow="Most popular"
          title="Best Sellers"
          description="The products that shoppers keep coming back to."
          href="/shop?sort=best"
          className="mb-10"
        />
        <ProductGrid products={bestSellers} columns={4} />
      </section>

      <div className="hairline" />

      {/* Reviews */}
      <section className="bg-[color:var(--color-surface)] px-4 py-16 md:px-6">
        <div className="mx-auto max-w-[var(--container-content)]">
          <SectionLabel
            index="06"
            eyebrow="What shoppers say"
            title="Verified Reviews"
            description="Real feedback from real customers. Unfiltered."
            href="/shop"
            className="mb-10"
          />
          <ReviewsSection reviews={reviews} />
        </div>
      </section>

      <NewsletterSection />
    </main>
  );
}
