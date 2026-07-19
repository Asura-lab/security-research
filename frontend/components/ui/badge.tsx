import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full text-xs font-medium px-2.5 py-1',
  {
    variants: {
      variant: {
        default: 'bg-[color:var(--color-surface)] text-[color:var(--color-foreground)]',
        accent: 'bg-[color:var(--color-primary)] text-white',
        accentSoft:
          'bg-[color:var(--color-surface-3)] text-[color:var(--color-primary)]',
        outline: 'border border-[color:var(--color-border)] bg-white text-[color:var(--color-foreground)]',
        danger: 'bg-[color:var(--color-danger)] text-white',
        muted: 'bg-[color:var(--color-surface)] text-[color:var(--color-muted-foreground)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
