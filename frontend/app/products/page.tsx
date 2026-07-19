'use client';

import { useEffect, useState } from 'react';
import { ApiError, api, type Product } from '@/lib/api';

export default function ProductsPage() {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async (searchValue: string) => {
    setError(null);
    const params = new URLSearchParams();
    if (searchValue) params.set('search', searchValue);
    params.set('limit', '50');
    try {
      const result = await api.products(params);
      setItems(result.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  };

  useEffect(() => {
    void load('');
  }, []);

  return (
    <section>
      <h1>Бараа</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void load(search);
        }}
      >
        <label>Хайлт<input value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <button type="submit">Хайх</button>
      </form>
      {error && <p className="error">{error}</p>}
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Нэр</th>
            <th>Үнэ</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>{p.name}</td>
              <td>{p.price.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
