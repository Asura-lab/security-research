// Backend-руу хандах API client. Variant branch-т `NEXT_PUBLIC_API_BASE`-ыг тухайн backend-ийн
// public URL-руу заана. main branch дээр default `""` (frontend backend-руу холбогдоогүй).

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

export type ErrorBody = { error: string; message?: string };

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, body: ErrorBody) {
    super(body.message ?? body.error);
    this.status = status;
    this.code = body.error;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  token?: string | null,
): Promise<T> {
  if (!API_BASE) {
    throw new Error('NEXT_PUBLIC_API_BASE тохируулаагүй байна');
  }
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });
  if (!res.ok) {
    let body: ErrorBody = { error: 'internal' };
    try {
      body = (await res.json()) as ErrorBody;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  register: (body: { username: string; email: string; password: string }) =>
    request<{ user_id: number; username: string; role: 'customer' }>(
      '/api/auth/register',
      { method: 'POST', body: JSON.stringify(body) },
    ),
  login: (body: { username: string; password: string }) =>
    request<{ access_token: string; role: 'customer' | 'admin'; user_id: number }>(
      '/api/auth/login',
      { method: 'POST', body: JSON.stringify(body) },
    ),
  products: (params: URLSearchParams) =>
    request<{ items: Array<Product> }>(`/api/products?${params.toString()}`),
  product: (id: number) => request<{ product: Product }>(`/api/products/${id}`),
  myOrders: (token: string, id: number) =>
    request<{ order: Order }>(`/api/orders/${id}`, {}, token),
  updateOrder: (token: string, id: number, status: string) =>
    request<{ order: Order }>(
      `/api/orders/${id}`,
      { method: 'PUT', body: JSON.stringify({ status }) },
      token,
    ),
  createOrder: (token: string, items: Array<{ product_id: number; quantity: number }>) =>
    request<{ order: Order }>(
      '/api/orders',
      { method: 'POST', body: JSON.stringify({ items }) },
      token,
    ),
  profile: (token: string) => request<{ profile: Profile }>('/api/profile', {}, token),
  updateProfile: (token: string, body: Record<string, unknown>) =>
    request<{ profile: Profile }>(
      '/api/profile',
      { method: 'PUT', body: JSON.stringify(body) },
      token,
    ),
};

export interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number;
  category_id: number | null;
}

export interface OrderItem {
  product_id: number;
  quantity: number;
  unit_price: number;
}

export interface Order {
  id: number;
  user_id: number;
  status: string;
  total: number;
  items: OrderItem[];
}

export interface Profile {
  user_id: number;
  username: string;
  email: string;
  role: 'customer' | 'admin';
  is_admin: boolean;
  address: string | null;
}
