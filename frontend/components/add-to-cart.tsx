'use client';

import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { useCart, type CartItem } from '@/lib/cart-store';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AddToCartButtonProps {
  product: Omit<CartItem, 'quantity'>;
  quantity?: number;
  variant?: 'primary' | 'dark' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  label?: string;
  className?: string;
}

export function AddToCartButton({
  product,
  quantity = 1,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  label = 'Add to cart',
  className,
}: AddToCartButtonProps) {
  const add = useCart((s) => s.add);
  const [added, setAdded] = useState(false);

  const handle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    add(product, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  return (
    <Button
      variant={added ? 'dark' : variant}
      size={size}
      onClick={handle}
      className={cn(fullWidth && 'w-full', className)}
    >
      {added ? (
        <>
          <Check size={16} strokeWidth={2} />
          Added
        </>
      ) : (
        <>
          <Plus size={16} strokeWidth={2} />
          {label}
        </>
      )}
    </Button>
  );
}
