'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PackageSearch, RefreshCw } from 'lucide-react';
import { ApiError, api, type Order } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/utils';

const STATUS_COLORS: Record<string, 'accent' | 'muted' | 'accentSoft' | 'danger'> = {
  pending: 'muted',
  processing: 'accentSoft',
  shipped: 'accentSoft',
  delivered: 'accent',
  cancelled: 'danger',
};

export default function OrdersPage() {
  const [session] = useSession();
  const [orderId, setOrderId] = useState('101');
  const [status, setStatus] = useState('pending');
  const [order, setOrder] = useState<Order | null>(null);
  const [loadingFetch, setLoadingFetch] = useState(false);
  const [loadingUpdate, setLoadingUpdate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = async () => {
    if (!session) return;
    setError(null);
    setLoadingFetch(true);
    try {
      const result = await api.myOrders(session.token, Number(orderId));
      setOrder(result.order);
      setStatus(result.order.status);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
      setOrder(null);
    } finally {
      setLoadingFetch(false);
    }
  };

  const updateOrder = async () => {
    if (!session) return;
    setError(null);
    setLoadingUpdate(true);
    try {
      const result = await api.updateOrder(session.token, Number(orderId), status);
      setOrder(result.order);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setLoadingUpdate(false);
    }
  };

  if (!session) {
    return (
      <main className="flex min-h-[calc(100vh-200px)] items-center justify-center px-4 py-16">
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <div className="grid size-16 place-items-center rounded-full bg-[color:var(--color-surface)] text-[color:var(--color-muted-foreground)]">
            <PackageSearch size={28} strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-semibold">Sign in required</h1>
          <p className="text-sm text-[color:var(--color-muted-foreground)]">
            Sign in to view and manage your orders.
          </p>
          <Button asChild variant="primary" size="lg">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 md:px-6">
      <h1 className="mb-8 text-3xl font-semibold tracking-tight" style={{ letterSpacing: '-0.02em' }}>
        Orders
      </h1>

      {/* Lookup */}
      <div className="rounded-[14px] border border-[color:var(--color-border)] bg-white p-6">
        <h2 className="mb-4 font-semibold">Look up an order</h2>
        <div className="flex gap-3">
          <Input
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="Order ID"
            className="max-w-[140px]"
          />
          <Button onClick={fetchOrder} disabled={loadingFetch} variant="dark" size="md">
            <RefreshCw size={16} strokeWidth={1.5} className={loadingFetch ? 'animate-spin' : ''} />
            {loadingFetch ? 'Loading...' : 'Fetch'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-[10px] border border-[color:var(--color-danger)]/20 bg-[color:var(--color-danger)]/5 px-4 py-3 text-sm text-[color:var(--color-danger)]">
          {error}
        </div>
      )}

      {order && (
        <div className="mt-6 rounded-[14px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="section-label mb-1">Order #{order.id}</div>
              <div className="text-xl font-semibold tabular-nums">{formatPrice(order.total)}</div>
            </div>
            <Badge variant={STATUS_COLORS[order.status] ?? 'muted'} className="text-sm capitalize">
              {order.status}
            </Badge>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-[color:var(--color-muted-foreground)]">User ID</div>
              <div className="font-medium tabular-nums">{order.user_id}</div>
            </div>
            <div>
              <div className="text-[color:var(--color-muted-foreground)]">Items</div>
              <div className="font-medium">{order.items.length} item(s)</div>
            </div>
          </div>

          {order.items.length > 0 && (
            <div className="mb-5 rounded-[10px] border border-[color:var(--color-border)] bg-white">
              <div className="divide-y divide-[color:var(--color-border)]">
                {order.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3 text-sm">
                    <span className="text-[color:var(--color-muted-foreground)]">Product #{item.product_id}</span>
                    <span>×{item.quantity}</span>
                    <span className="font-medium tabular-nums">{formatPrice(item.unit_price)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 border-t border-[color:var(--color-border)] pt-5">
            <Input
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              placeholder="New status"
              className="max-w-[160px]"
            />
            <Button onClick={updateOrder} disabled={loadingUpdate} variant="primary" size="md">
              {loadingUpdate ? 'Updating...' : 'Update status'}
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
