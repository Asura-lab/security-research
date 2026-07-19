import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  value: number;
  size?: number;
  showValue?: boolean;
  count?: number;
  className?: string;
}

export function StarRating({ value, size = 14, showValue = true, count, className }: StarRatingProps) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <div className={cn('inline-flex items-center gap-1.5 text-xs text-[color:var(--color-muted-foreground)]', className)}>
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= rounded;
          const half = !filled && n - 0.5 === rounded;
          return (
            <span key={n} className="relative inline-block" style={{ width: size, height: size }}>
              <Star size={size} strokeWidth={1.5} className="absolute inset-0 text-[color:var(--color-border)]" />
              {(filled || half) && (
                <span
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: half ? size / 2 : size }}
                >
                  <Star
                    size={size}
                    strokeWidth={1.5}
                    className="text-[color:var(--color-foreground)]"
                    fill="currentColor"
                  />
                </span>
              )}
            </span>
          );
        })}
      </div>
      {showValue && <span className="tabular-nums text-[color:var(--color-foreground)] font-medium">{value.toFixed(2)}</span>}
      {typeof count === 'number' && <span className="tabular-nums">({count})</span>}
    </div>
  );
}
