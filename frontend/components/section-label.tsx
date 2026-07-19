import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SectionLabelProps {
  index: string;
  title: string;
  eyebrow?: string;
  description?: string;
  href?: string;
  hrefLabel?: string;
  className?: string;
}

export function SectionLabel({ index, title, eyebrow, description, href, hrefLabel = 'View all', className }: SectionLabelProps) {
  return (
    <div className={cn('flex flex-col gap-6 md:flex-row md:items-end md:justify-between', className)}>
      <div className="max-w-xl">
        <div className="section-label mb-4">
          {index} — {eyebrow ?? title}
        </div>
        <h2 className="text-3xl font-semibold tracking-tight text-[color:var(--color-foreground)] md:text-4xl">
          {title}
        </h2>
        {description && (
          <p className="mt-3 text-sm text-[color:var(--color-muted-foreground)] md:text-base">
            {description}
          </p>
        )}
      </div>
      {href && (
        <Link
          href={href}
          className="group inline-flex items-center gap-2 self-start rounded-full border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium text-[color:var(--color-foreground)] transition-colors hover:border-[color:var(--color-foreground)] md:self-auto"
        >
          {hrefLabel}
          <ArrowUpRight size={16} strokeWidth={1.5} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      )}
    </div>
  );
}
