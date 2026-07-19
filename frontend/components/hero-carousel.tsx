'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

const SLIDES = [
  {
    index: '01',
    bg: 'bg-[color:var(--color-foreground)]',
    textColor: 'text-white',
    mutedColor: 'text-white/60',
    eyebrow: 'Summer Collection 2026',
    headline: 'New Arrivals Every\nWeek',
    sub: 'Fresh picks across every category — beauty, tech, fashion, home and more.',
    cta: { label: 'Shop now', href: '/shop?sort=new', variant: 'primary' as const },
    ctaSecondary: { label: 'View all deals', href: '/shop?sort=deal' },
    accentBox: 'bg-[color:var(--color-primary)]',
  },
  {
    index: '02',
    bg: 'bg-[color:var(--color-surface-3)]',
    textColor: 'text-[color:var(--color-foreground)]',
    mutedColor: 'text-[color:var(--color-muted-foreground)]',
    eyebrow: 'Electronics & Gadgets',
    headline: 'Top Tech at\nUnbeatable Prices',
    sub: 'Laptops, smartphones, accessories — the best brands at the best prices.',
    cta: { label: 'Shop electronics', href: '/categories', variant: 'dark' as const },
    ctaSecondary: { label: 'See all categories', href: '/categories' },
    accentBox: 'bg-[color:var(--color-foreground)]',
  },
  {
    index: '03',
    bg: 'bg-[color:var(--color-surface-2)]',
    textColor: 'text-[color:var(--color-foreground)]',
    mutedColor: 'text-[color:var(--color-muted-foreground)]',
    eyebrow: 'Deals of the Day',
    headline: 'Up to 30% Off\nSelected Items',
    sub: 'Limited-time discounts on thousands of products. Today only.',
    cta: { label: 'View deals', href: '/shop?sort=deal', variant: 'dark' as const },
    ctaSecondary: { label: 'How deals work', href: '#' },
    accentBox: 'bg-[color:var(--color-primary)]',
  },
  {
    index: '04',
    bg: 'bg-white',
    textColor: 'text-[color:var(--color-foreground)]',
    mutedColor: 'text-[color:var(--color-muted-foreground)]',
    eyebrow: 'Best Sellers',
    headline: 'Most Loved\nProducts',
    sub: 'Thousands of five-star reviews. See what everyone is buying right now.',
    cta: { label: 'Browse best sellers', href: '/shop?sort=best', variant: 'dark' as const },
    ctaSecondary: { label: 'Read reviews', href: '/shop' },
    accentBox: 'bg-[color:var(--color-foreground)]',
  },
];

export function HeroCarousel() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  const prev = useCallback(() => setIdx((i) => (i - 1 + SLIDES.length) % SLIDES.length), []);
  const next = useCallback(() => setIdx((i) => (i + 1) % SLIDES.length), []);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(next, 6000);
    return () => clearInterval(t);
  }, [paused, next]);

  const slide = SLIDES[idx];

  return (
    <section
      className={cn('relative overflow-hidden transition-colors duration-700', slide.bg)}
      style={{ minHeight: '520px' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="mx-auto flex min-h-[520px] max-w-[var(--container-content)] flex-col items-start justify-center px-4 py-16 md:px-6 md:py-0">
        <div className="max-w-2xl prism-fade-up" key={idx}>
          <div className={cn('section-label mb-6', slide.mutedColor)}>
            {slide.index} — {slide.eyebrow}
          </div>
          <h1
            className={cn(
              'whitespace-pre-line text-5xl font-semibold leading-none tracking-tight md:text-7xl',
              slide.textColor,
            )}
            style={{ letterSpacing: '-0.03em' }}
          >
            {slide.headline}
          </h1>
          <p className={cn('mt-6 max-w-md text-base md:text-lg', slide.mutedColor)}>
            {slide.sub}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild variant={slide.cta.variant} size="pill">
              <Link href={slide.cta.href}>{slide.cta.label}</Link>
            </Button>
            <Link
              href={slide.ctaSecondary.href}
              className={cn(
                'text-sm font-medium underline underline-offset-4 transition-opacity hover:opacity-70',
                slide.mutedColor,
              )}
            >
              {slide.ctaSecondary.label}
            </Link>
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-4 flex items-center gap-4 md:left-6">
        <div className={cn('section-label', slide.mutedColor)}>
          {String(idx + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}
        </div>
        <div className="flex gap-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i === idx
                  ? cn('w-8', slide.index === '01' ? 'bg-white' : 'bg-[color:var(--color-foreground)]')
                  : cn('w-1.5', 'bg-current opacity-25', slide.textColor),
              )}
            />
          ))}
        </div>
      </div>

      <div className="absolute bottom-6 right-4 flex items-center gap-2 md:right-6">
        <button
          onClick={prev}
          aria-label="Previous"
          className={cn(
            'grid size-10 place-items-center rounded-full border transition-colors',
            slide.index === '01'
              ? 'border-white/30 text-white hover:border-white'
              : 'border-[color:var(--color-border)] text-[color:var(--color-foreground)] hover:border-[color:var(--color-foreground)]',
          )}
        >
          <ArrowLeft size={16} strokeWidth={1.5} />
        </button>
        <button
          onClick={next}
          aria-label="Next"
          className={cn(
            'grid size-10 place-items-center rounded-full border transition-colors',
            slide.index === '01'
              ? 'border-white/30 text-white hover:border-white'
              : 'border-[color:var(--color-border)] text-[color:var(--color-foreground)] hover:border-[color:var(--color-foreground)]',
          )}
        >
          <ArrowRight size={16} strokeWidth={1.5} />
        </button>
      </div>
    </section>
  );
}
