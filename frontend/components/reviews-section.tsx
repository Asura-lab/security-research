import Image from 'next/image';
import { StarRating } from './star-rating';
import type { DummyReview } from '@/lib/dummyjson';

type ReviewWithMeta = DummyReview & {
  productId: number;
  productTitle: string;
  productThumbnail: string;
};

export function ReviewsSection({ reviews }: { reviews: ReviewWithMeta[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {reviews.slice(0, 8).map((r, i) => (
        <div
          key={i}
          className="flex flex-col gap-4 rounded-[14px] border border-[color:var(--color-border)] bg-white p-6"
        >
          <StarRating value={r.rating} showValue={false} size={14} />
          {r.comment && (
            <p className="flex-1 text-sm leading-relaxed text-[color:var(--color-foreground)] line-clamp-4">
              &ldquo;{r.comment}&rdquo;
            </p>
          )}
          <div className="flex items-center gap-3 border-t border-[color:var(--color-border)] pt-4">
            <div className="grid size-8 place-items-center rounded-full bg-[color:var(--color-surface)] text-xs font-semibold text-[color:var(--color-foreground)]">
              {r.reviewerName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{r.reviewerName}</div>
              <div className="truncate text-xs text-[color:var(--color-muted-foreground)]">
                on {r.productTitle}
              </div>
            </div>
            <div className="relative size-9 flex-shrink-0 overflow-hidden rounded-lg bg-[color:var(--color-surface)]">
              <Image
                src={r.productThumbnail}
                alt={r.productTitle}
                fill
                sizes="36px"
                className="object-contain p-1 mix-blend-multiply"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
