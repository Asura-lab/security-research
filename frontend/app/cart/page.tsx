'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Minus, Plus, Trash2, ArrowLeft, ShoppingBag } from 'lucide-react';
import { useCart } from '@/lib/cart-store';
import { Button } from '@/components/ui/button';
import { discountedPrice, formatPrice } from '@/lib/utils';

export default function CartPage() {
  const { items, remove, setQty, clear, subtotal } = useCart();

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-[var(--container-content)] px-4 py-24 text-center md:px-6">
        <div className="mx-auto flex max-w-sm flex-col items-center gap-4">
          <div className="grid size-20 place-items-center rounded-full bg-[color:var(--color-surface)] text-[color:var(--color-muted-foreground)]">
            <ShoppingBag size={32} strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-semibold">Your cart is empty</h1>
          <p className="text-sm text-[color:var(--color-muted-foreground)]">
            Browse the shop and add items you love.
          </p>
          <Button asChild variant="primary" size="lg" className="mt-2">
            <Link href="/shop">Browse products</Link>
          </Button>
        </div>
      </main>
    );
  }

  const sub = subtotal();
  const shipping = sub >= 50 ? 0 : 9.99;
  const total = sub + shipping;

  return (
    <main className="mx-auto max-w-[var(--container-content)] px-4 py-10 md:px-6">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight" style={{ letterSpacing: '-0.02em' }}>
          Shopping cart
        </h1>
        <button
          onClick={clear}
          className="text-sm text-[color:var(--color-muted-foreground)] underline underline-offset-4 hover:text-[color:var(--color-foreground)]"
        >
          Clear cart
        </button>
      </div>

      <div className="grid gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="divide-y divide-[color:var(--color-border)]">
            {items.map((item) => {
              const price = discountedPrice(item.price, item.discountPercentage);
              return (
                <div key={item.id} className="flex gap-4 py-6">
                  <Link
                    href={`/product/${item.id}`}
                    className="relative size-24 flex-shrink-0 overflow-hidden rounded-[10px] bg-[color:var(--color-surface)]"
                  >
                    <Image
                      src={item.thumbnail}
                      alt={item.title}
                      fill
                      sizes="96px"
                      className="object-contain p-2 mix-blend-multiply"
                    />
                  </Link>
                  <div className="flex flex-1 flex-col gap-2">
                    <Link
                      href={`/product/${item.id}`}
                      className="font-medium leading-snug hover:text-[color:var(--color-primary)]"
                    >
                      {item.title}
                    </Link>
                    <div className="text-sm text-[color:var(--color-muted-foreground)]">
                      {formatPrice(price)} each
                    </div>
                    <div className="mt-auto flex items-center justify-between">
                      <div className="flex items-center gap-2 rounded-[10px] border border-[color:var(--color-border)] p-1">
                        <button
                          onClick={() => setQty(item.id, item.quantity - 1)}
                          className="grid size-8 place-items-center rounded-lg text-[color:var(--color-foreground)] hover:bg-[color:var(--color-surface)]"
                        >
                          <Minus size={14} strokeWidth={2} />
                        </button>
                        <span className="w-8 text-center text-sm font-medium tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => setQty(item.id, item.quantity + 1)}
                          className="grid size-8 place-items-center rounded-lg text-[color:var(--color-foreground)] hover:bg-[color:var(--color-surface)]"
                        >
                          <Plus size={14} strokeWidth={2} />
                        </button>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-semibold tabular-nums">
                          {formatPrice(price * item.quantity)}
                        </span>
                        <button
                          onClick={() => remove(item.id)}
                          aria-label="Remove item"
                          className="grid size-9 place-items-center rounded-full text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-surface)] hover:text-[color:var(--color-danger)]"
                        >
                          <Trash2 size={16} strokeWidth={1.5} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4">
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 text-sm font-medium text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]"
            >
              <ArrowLeft size={16} strokeWidth={1.5} />
              Continue shopping
            </Link>
          </div>
        </div>

        <div>
          <div className="sticky top-24 rounded-[14px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
            <h2 className="mb-6 text-lg font-semibold">Order summary</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[color:var(--color-muted-foreground)]">Subtotal</span>
                <span className="font-medium tabular-nums">{formatPrice(sub)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[color:var(--color-muted-foreground)]">Shipping</span>
                <span className="font-medium tabular-nums">
                  {shipping === 0 ? 'Free' : formatPrice(shipping)}
                </span>
              </div>
              {sub < 50 && (
                <div className="rounded-lg bg-[color:var(--color-surface-3)] px-3 py-2 text-xs text-[color:var(--color-primary)]">
                  Add {formatPrice(50 - sub)} more for free shipping
                </div>
              )}
              <div className="hairline my-2" />
              <div className="flex justify-between">
                <span className="font-semibold">Total</span>
                <span className="text-lg font-semibold tabular-nums">{formatPrice(total)}</span>
              </div>
            </div>
            <Button variant="primary" size="lg" className="mt-6 w-full">
              Checkout
            </Button>
            <p className="mt-3 text-center text-xs text-[color:var(--color-muted-foreground)]">
              Secure checkout. Taxes calculated at checkout.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
