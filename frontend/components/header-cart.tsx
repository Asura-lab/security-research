'use client';

import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useCart } from '@/lib/cart-store';

export function HeaderCart() {
  const [mounted, setMounted] = useState(false);
  const count = useCart((s) => s.items.reduce((sum, i) => sum + i.quantity, 0));
  useEffect(() => setMounted(true), []);
  return (
    <Link
      href="/cart"
      aria-label="Cart"
      className="relative grid size-10 place-items-center rounded-full text-[color:var(--color-foreground)] transition-colors hover:bg-[color:var(--color-surface)]"
    >
      <ShoppingBag size={20} strokeWidth={1.5} />
      {mounted && count > 0 && (
        <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--color-primary)] px-1.5 text-[10px] font-semibold text-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
