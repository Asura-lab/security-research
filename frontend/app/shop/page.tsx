import { Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { SectionLabel } from '@/components/section-label';
import { ProductGrid } from '@/components/product-grid';
import { Badge } from '@/components/ui/badge';
import {
  getAllProducts,
  getDealsProducts,
  getBestSellers,
  searchProducts,
  getProductsByCategory,
  getCategories,
  slugToTitle,
  type DummyProduct,
} from '@/lib/dummyjson';

export const revalidate = 3600;

interface ShopPageProps {
  searchParams: Promise<{ q?: string; category?: string; sort?: string }>;
}

async function getProducts(q?: string, category?: string, sort?: string): Promise<DummyProduct[]> {
  if (q) return searchProducts(q, 80);
  if (category) return getProductsByCategory(category, 80);
  if (sort === 'deal') return getDealsProducts(80);
  if (sort === 'best') return getBestSellers(80);
  return getAllProducts(194);
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const params = await searchParams;
  const { q, category, sort } = params;
  const [products, categories] = await Promise.all([
    getProducts(q, category, sort),
    getCategories(),
  ]);

  const title = q
    ? `Results for "${q}"`
    : category
      ? slugToTitle(category)
      : sort === 'deal'
        ? 'Deals of the Day'
        : sort === 'best'
          ? 'Best Sellers'
          : sort === 'new'
            ? 'New Arrivals'
            : 'All Products';

  return (
    <main>
      <div className="border-b border-[color:var(--color-border)]">
        <div className="mx-auto max-w-[var(--container-content)] px-4 py-10 md:px-6">
          <SectionLabel
            index={String(products.length).padStart(2, '0')}
            eyebrow="PRISM Shop"
            title={title}
            description={`${products.length} product${products.length !== 1 ? 's' : ''} found`}
          />
        </div>
      </div>

      <div className="mx-auto max-w-[var(--container-content)] px-4 py-8 md:px-6">
        {/* Category pills */}
        <div className="mb-8 flex flex-wrap gap-2">
          <Link href="/shop">
            <Badge variant={!q && !category && !sort ? 'accent' : 'outline'} className="cursor-pointer text-sm">
              All
            </Badge>
          </Link>
          <Link href="/shop?sort=deal">
            <Badge variant={sort === 'deal' ? 'accent' : 'outline'} className="cursor-pointer text-sm">
              Deals
            </Badge>
          </Link>
          <Link href="/shop?sort=best">
            <Badge variant={sort === 'best' ? 'accent' : 'outline'} className="cursor-pointer text-sm">
              Best sellers
            </Badge>
          </Link>
          {categories.slice(0, 10).map((c) => (
            <Link key={c.slug} href={`/shop?category=${c.slug}`}>
              <Badge
                variant={category === c.slug ? 'accent' : 'outline'}
                className="cursor-pointer text-sm"
              >
                {c.name}
              </Badge>
            </Link>
          ))}
        </div>

        {products.length === 0 ? (
          <div className="py-24 text-center text-[color:var(--color-muted-foreground)]">
            <p className="text-lg font-medium">No products found</p>
            <p className="mt-1 text-sm">Try a different search or category</p>
            <Link href="/shop" className="mt-6 inline-block text-sm font-medium underline">
              Clear filters
            </Link>
          </div>
        ) : (
          <ProductGrid products={products} columns={4} />
        )}
      </div>
    </main>
  );
}
