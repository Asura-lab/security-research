import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Package, RotateCcw, Truck, ShieldCheck, ArrowLeft } from 'lucide-react';
import { StarRating } from '@/components/star-rating';
import { AddToCartButton } from '@/components/add-to-cart';
import { Badge } from '@/components/ui/badge';
import { ProductGrid } from '@/components/product-grid';
import { SectionLabel } from '@/components/section-label';
import { getProduct, getRelatedProducts } from '@/lib/dummyjson';
import { discountedPrice, formatPrice, pct } from '@/lib/utils';

export const revalidate = 3600;

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  let product;
  try {
    product = await getProduct(id);
  } catch {
    notFound();
  }

  const related = await getRelatedProducts(product, 4);
  const final = discountedPrice(product.price, product.discountPercentage);
  const hasDiscount = product.discountPercentage >= 3;

  return (
    <main>
      <div className="mx-auto max-w-[var(--container-content)] px-4 py-6 md:px-6">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm text-[color:var(--color-muted-foreground)]">
          <Link href="/" className="hover:text-[color:var(--color-foreground)]">Home</Link>
          <span>/</span>
          <Link href="/shop" className="hover:text-[color:var(--color-foreground)]">Shop</Link>
          <span>/</span>
          <Link href={`/shop?category=${product.category}`} className="hover:text-[color:var(--color-foreground)] capitalize">
            {product.category.replace(/-/g, ' ')}
          </Link>
          <span>/</span>
          <span className="line-clamp-1 text-[color:var(--color-foreground)]">{product.title}</span>
        </div>

        <div className="grid gap-12 lg:grid-cols-2">
          {/* Gallery */}
          <div className="flex flex-col gap-4">
            <div className="relative aspect-square overflow-hidden rounded-[20px] bg-[color:var(--color-surface)]">
              <Image
                src={product.images[0] ?? product.thumbnail}
                alt={product.title}
                fill
                priority
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-contain p-8 mix-blend-multiply"
              />
              {hasDiscount && (
                <div className="absolute left-4 top-4">
                  <Badge variant="accent" className="text-sm font-semibold">
                    -{pct(product.discountPercentage)}
                  </Badge>
                </div>
              )}
            </div>
            {product.images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {product.images.slice(0, 5).map((img, i) => (
                  <div
                    key={i}
                    className="relative size-20 flex-shrink-0 overflow-hidden rounded-[10px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
                  >
                    <Image
                      src={img}
                      alt={`${product.title} ${i + 1}`}
                      fill
                      sizes="80px"
                      className="object-contain p-2 mix-blend-multiply"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col gap-5">
            {product.brand && (
              <div className="section-label">{product.brand}</div>
            )}
            <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl" style={{ letterSpacing: '-0.02em' }}>
              {product.title}
            </h1>

            <StarRating value={product.rating} count={product.reviews.length} size={16} />

            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-semibold tabular-nums" style={{ letterSpacing: '-0.02em' }}>
                {formatPrice(final)}
              </span>
              {hasDiscount && (
                <>
                  <span className="text-xl text-[color:var(--color-muted-foreground)] line-through tabular-nums">
                    {formatPrice(product.price)}
                  </span>
                  <Badge variant="accentSoft" className="text-sm">
                    Save {pct(product.discountPercentage)}
                  </Badge>
                </>
              )}
            </div>

            <p className="text-sm leading-relaxed text-[color:var(--color-muted-foreground)] md:text-base">
              {product.description}
            </p>

            <div className="flex flex-wrap gap-2">
              {product.tags.map((t) => (
                <Badge key={t} variant="muted">{t}</Badge>
              ))}
            </div>

            <div className="rounded-[10px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[color:var(--color-muted-foreground)]">Availability</span>
                  <div className="font-medium">{product.availabilityStatus}</div>
                </div>
                <div>
                  <span className="text-[color:var(--color-muted-foreground)]">Min. order</span>
                  <div className="font-medium">{product.minimumOrderQuantity} unit(s)</div>
                </div>
                <div>
                  <span className="text-[color:var(--color-muted-foreground)]">Shipping</span>
                  <div className="font-medium">{product.shippingInformation}</div>
                </div>
                <div>
                  <span className="text-[color:var(--color-muted-foreground)]">Returns</span>
                  <div className="font-medium">{product.returnPolicy}</div>
                </div>
              </div>
            </div>

            <AddToCartButton
              product={{
                id: product.id,
                title: product.title,
                price: product.price,
                discountPercentage: product.discountPercentage,
                thumbnail: product.thumbnail,
              }}
              size="lg"
              fullWidth
              label={`Add to cart — ${formatPrice(final)}`}
            />

            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Truck, text: 'Free shipping over $50' },
                { icon: RotateCcw, text: '30-day returns' },
                { icon: ShieldCheck, text: 'Buyer protection' },
                { icon: Package, text: product.warrantyInformation },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 text-xs text-[color:var(--color-muted-foreground)]">
                  <Icon size={14} strokeWidth={1.5} />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Reviews */}
        {product.reviews.length > 0 && (
          <section className="mt-20">
            <SectionLabel
              index={String(product.reviews.length).padStart(2, '0')}
              eyebrow="Customer feedback"
              title="Reviews"
              className="mb-8"
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {product.reviews.map((r, i) => (
                <div key={i} className="rounded-[14px] border border-[color:var(--color-border)] bg-white p-5">
                  <StarRating value={r.rating} showValue={false} size={14} />
                  {r.comment && (
                    <p className="mt-3 text-sm leading-relaxed text-[color:var(--color-foreground)]">
                      &ldquo;{r.comment}&rdquo;
                    </p>
                  )}
                  <div className="mt-4 flex items-center justify-between border-t border-[color:var(--color-border)] pt-4 text-xs text-[color:var(--color-muted-foreground)]">
                    <div className="flex items-center gap-2">
                      <div className="grid size-6 place-items-center rounded-full bg-[color:var(--color-surface)] text-[10px] font-semibold">
                        {r.reviewerName.charAt(0)}
                      </div>
                      <span className="font-medium text-[color:var(--color-foreground)]">{r.reviewerName}</span>
                    </div>
                    <time>{new Date(r.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</time>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Related */}
        {related.length > 0 && (
          <section className="mt-20">
            <SectionLabel
              index="04"
              eyebrow="You may also like"
              title="Related Products"
              href={`/shop?category=${product.category}`}
              className="mb-8"
            />
            <ProductGrid products={related} columns={4} />
          </section>
        )}
      </div>
    </main>
  );
}
