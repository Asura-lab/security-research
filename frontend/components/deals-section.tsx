'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from './ui/badge';
import { AddToCartButton } from './add-to-cart';
import { discountedPrice, formatPrice, pct } from '@/lib/utils';
import type { DummyProduct } from '@/lib/dummyjson';

interface DealsSectionProps {
  products: DummyProduct[];
}

function useCountdown(targetHours = 8) {
  const [secs, setSecs] = useState(targetHours * 3600);
  useEffect(() => {
    const t = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return { h: pad(h), m: pad(m), s: pad(s) };
}

export function DealsSection({ products }: DealsSectionProps) {
  const { h, m, s } = useCountdown(8);
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="section-label">03 — Deals of the day</div>
        <div className="flex items-center gap-2 rounded-full border border-[color:var(--color-border)] px-4 py-1.5">
          <span className="text-xs text-[color:var(--color-muted-foreground)]">Ends in</span>
          <span className="font-mono text-sm font-semibold tabular-nums text-[color:var(--color-foreground)]">
            {h}:{m}:{s}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {products.map((p) => {
          const final = discountedPrice(p.price, p.discountPercentage);
          return (
            <Link
              key={p.id}
              href={`/product/${p.id}`}
              className="group relative flex flex-col gap-3 rounded-[14px] border border-[color:var(--color-border)] bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]"
            >
              <div className="relative aspect-square overflow-hidden rounded-lg bg-[color:var(--color-surface)]">
                <Image
                  src={p.thumbnail}
                  alt={p.title}
                  fill
                  sizes="180px"
                  className="object-contain p-3 mix-blend-multiply transition-transform group-hover:scale-105"
                />
                <Badge variant="accent" className="absolute left-2 top-2 font-semibold">
                  -{pct(p.discountPercentage)}
                </Badge>
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="line-clamp-2 text-[13px] font-medium leading-snug">
                  {p.title}
                </h3>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-base font-semibold tabular-nums">
                    {formatPrice(final)}
                  </span>
                  <span className="text-xs text-[color:var(--color-muted-foreground)] line-through tabular-nums">
                    {formatPrice(p.price)}
                  </span>
                </div>
              </div>
              <div className="opacity-0 transition-opacity group-hover:opacity-100">
                <AddToCartButton
                  product={{
                    id: p.id,
                    title: p.title,
                    price: p.price,
                    discountPercentage: p.discountPercentage,
                    thumbnail: p.thumbnail,
                  }}
                  variant="dark"
                  size="sm"
                  fullWidth
                />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
