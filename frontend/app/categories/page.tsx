import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { SectionLabel } from '@/components/section-label';
import { getCategories, getProductsByCategory, slugToTitle } from '@/lib/dummyjson';

export const revalidate = 3600;

export default async function CategoriesPage() {
  const cats = await getCategories();

  // Get first product thumbnail per category for visual interest
  const catData = await Promise.all(
    cats.map(async (c) => {
      try {
        const products = await getProductsByCategory(c.slug, 4);
        return { ...c, products, count: products.length };
      } catch {
        return { ...c, products: [], count: 0 };
      }
    }),
  );

  return (
    <main>
      <div className="border-b border-[color:var(--color-border)]">
        <div className="mx-auto max-w-[var(--container-content)] px-4 py-10 md:px-6">
          <SectionLabel
            index={String(cats.length).padStart(2, '0')}
            eyebrow="PRISM Shop"
            title="All Categories"
            description="Browse by department — everything curated, nothing cluttered."
          />
        </div>
      </div>
      <div className="mx-auto max-w-[var(--container-content)] px-4 py-12 md:px-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {catData.map((c) => (
            <Link
              key={c.slug}
              href={`/shop?category=${c.slug}`}
              className="group flex flex-col gap-4 rounded-[14px] border border-[color:var(--color-border)] bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]"
            >
              {c.products.length > 0 && (
                <div className="grid grid-cols-4 gap-1.5">
                  {c.products.slice(0, 4).map((p) => (
                    <div
                      key={p.id}
                      className="relative aspect-square overflow-hidden rounded-lg bg-[color:var(--color-surface)]"
                    >
                      <img
                        src={p.thumbnail}
                        alt={p.title}
                        className="h-full w-full object-contain p-1 mix-blend-multiply"
                      />
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{slugToTitle(c.slug)}</div>
                  <div className="text-sm text-[color:var(--color-muted-foreground)]">
                    {c.count}+ products
                  </div>
                </div>
                <div className="grid size-9 place-items-center rounded-full border border-[color:var(--color-border)] text-[color:var(--color-foreground)] transition-all group-hover:border-[color:var(--color-foreground)]">
                  <ArrowUpRight size={16} strokeWidth={1.5} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
