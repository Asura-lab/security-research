'use client';

import { useState } from 'react';
import { ApiError, api, type Order } from '@/lib/api';
import { useSession } from '@/lib/session';

export default function OrdersPage() {
  const [session] = useSession();
  const [orderId, setOrderId] = useState('101');
  const [status, setStatus] = useState('pending');
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = async () => {
    if (!session) return;
    setError(null);
    try {
      const result = await api.myOrders(session.token, Number(orderId));
      setOrder(result.order);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  };

  const updateOrder = async () => {
    if (!session) return;
    setError(null);
    try {
      const result = await api.updateOrder(session.token, Number(orderId), status);
      setOrder(result.order);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  };

  if (!session) return <p>Эхлээд нэвтэрнэ үү.</p>;
  return (
    <section>
      <h1>Захиалга</h1>
      <label>Order ID<input value={orderId} onChange={(e) => setOrderId(e.target.value)} /></label>
      <button onClick={fetchOrder}>Харах</button>
      {order && (
        <>
          <p>user_id={order.user_id} status={order.status} total={order.total}</p>
          <label>Шинэ статус<input value={status} onChange={(e) => setStatus(e.target.value)} /></label>
          <button onClick={updateOrder}>Шинэчлэх</button>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
