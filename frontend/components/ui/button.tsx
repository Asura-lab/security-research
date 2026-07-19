import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-200 ease-out disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-white',
  {
    variants: {
      variant: {
        primary:
          'bg-[color:var(--color-primary)] text-white hover:bg-[color:var(--color-primary-hover)]',
        secondary:
          'bg-[color:var(--color-secondary)] text-[color:var(--color-foreground)] hover:bg-[color:var(--color-surface-2)]',
        outline:
          'border border-[color:var(--color-border)] bg-white text-[color:var(--color-foreground)] hover:bg-[color:var(--color-surface)]',
        ghost:
          'text-[color:var(--color-foreground)] hover:bg-[color:var(--color-surface)]',
        link: 'text-[color:var(--color-primary)] underline-offset-4 hover:underline',
        dark: 'bg-[color:var(--color-foreground)] text-white hover:bg-[color:var(--color-foreground)]/90',
      },
      size: {
        sm: 'h-9 rounded-[10px] px-3 text-sm',
        md: 'h-11 rounded-[10px] px-5 text-sm',
        lg: 'h-12 rounded-[10px] px-6 text-base',
        pill: 'h-11 rounded-full px-6 text-sm',
        icon: 'size-10 rounded-[10px]',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
