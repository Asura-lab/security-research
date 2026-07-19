import Image from 'next/image';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { StarRating } from './star-rating';
import { AddToCartButton } from './add-to-cart';
import { Badge } from './ui/badge';
import { discountedPrice, formatPrice, pct } from '@/lib/utils';
import type { DummyProduct } from '@/lib/dummyjson';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  product: DummyProduct;
  className?: string;
  compact?: boolean;
}

export function ProductCard({ product, className, compact = false }: ProductCardProps) {
  const final = discountedPrice(product.price, product.discountPercentage);
  const hasDiscount = product.discountPercentage >= 3;
  return (
    <Link
      href={`/product/${product.id}`}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-[14px] border border-[color:var(--color-border)] bg-white transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]',
        className,
      )}
    >
      <div className="relative aspect-square bg-[color:var(--color-surface)]">
        <Image
          src={product.thumbnail}
          alt={product.title}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className="object-contain p-4 mix-blend-multiply transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute left-3 top-3 flex flex-col items-start gap-1">
          {hasDiscount && (
            <Badge variant="accent" className="font-semibold">
              -{pct(product.discountPercentage)}
            </Badge>
          )}
          {product.availabilityStatus === 'Low Stock' && (
            <Badge variant="outline" className="font-medium">
              Low stock
            </Badge>
          )}
        </div>
        <button
          type="button"
          aria-label="Add to wishlist"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-white/90 text-[color:var(--color-foreground)] opacity-0 shadow-sm backdrop-blur transition-opacity duration-200 group-hover:opacity-100"
        >
          <Heart size={16} strokeWidth={1.5} />
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {product.brand && (
          <div className="text-[11px] font-medium uppercase tracking-wider text-[color:var(--color-muted-foreground)]">
            {product.brand}
          </div>
        )}
        <h3 className="line-clamp-2 text-[15px] font-medium leading-snug text-[color:var(--color-foreground)]">
          {product.title}
        </h3>
        <StarRating value={product.rating} count={product.reviews.length} size={13} />
        <div className="mt-auto flex items-baseline gap-2 pt-2">
          <span className="text-lg font-semibold tabular-nums text-[color:var(--color-foreground)]">
            {formatPrice(final)}
          </span>
          {hasDiscount && (
            <span className="text-sm text-[color:var(--color-muted-foreground)] line-through tabular-nums">
              {formatPrice(product.price)}
            </span>
          )}
        </div>
        {!compact && (
          <div className="mt-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <AddToCartButton
              product={{
                id: product.id,
                title: product.title,
                price: product.price,
                discountPercentage: product.discountPercentage,
                thumbnail: product.thumbnail,
              }}
              variant="dark"
              size="sm"
              fullWidth
              label="Add to cart"
            />
          </div>
        )}
      </div>
    </Link>
  );
}
