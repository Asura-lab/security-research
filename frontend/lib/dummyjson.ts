// Data layer for https://dummyjson.com — server-side fetch helpers with revalidation.
// This is used ONLY for the E-Commerce demo/UX. Backend integration (lib/api.ts)
// remains unchanged.

const DUMMY = 'https://dummyjson.com';
const REVALIDATE = 3600; // 1 hour

export interface DummyProduct {
  id: number;
  title: string;
  description: string;
  category: string;
  price: number;
  discountPercentage: number;
  rating: number;
  stock: number;
  tags: string[];
  brand?: string;
  sku: string;
  weight: number;
  dimensions: { width: number; height: number; depth: number };
  warrantyInformation: string;
  shippingInformation: string;
  availabilityStatus: string;
  reviews: DummyReview[];
  returnPolicy: string;
  minimumOrderQuantity: number;
  meta: { createdAt: string; updatedAt: string; barcode: string; qrCode: string };
  images: string[];
  thumbnail: string;
}

export interface DummyReview {
  rating: number;
  comment: string;
  date: string;
  reviewerName: string;
  reviewerEmail: string;
}

export interface DummyUser {
  id: number;
  firstName: string;
  lastName: string;
  age: number;
  gender: string;
  email: string;
  username: string;
  image: string;
  address: { city: string; state: string; country: string };
}

export interface DummyCategory {
  slug: string;
  name: string;
  url: string;
}

interface ProductListResponse {
  products: DummyProduct[];
  total: number;
  skip: number;
  limit: number;
}

interface UserListResponse {
  users: DummyUser[];
  total: number;
  skip: number;
  limit: number;
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${DUMMY}${path}`, { next: { revalidate: REVALIDATE } });
  if (!res.ok) throw new Error(`dummyjson ${res.status} on ${path}`);
  return (await res.json()) as T;
}

export async function getAllProducts(limit = 194): Promise<DummyProduct[]> {
  const data = await fetchJson<ProductListResponse>(`/products?limit=${limit}`);
  return data.products;
}

export async function getProduct(id: number | string): Promise<DummyProduct> {
  return fetchJson<DummyProduct>(`/products/${id}`);
}

export async function getProductsByCategory(slug: string, limit = 30): Promise<DummyProduct[]> {
  const data = await fetchJson<ProductListResponse>(`/products/category/${slug}?limit=${limit}`);
  return data.products;
}

export async function searchProducts(q: string, limit = 30): Promise<DummyProduct[]> {
  const data = await fetchJson<ProductListResponse>(
    `/products/search?q=${encodeURIComponent(q)}&limit=${limit}`,
  );
  return data.products;
}

export async function getCategories(): Promise<DummyCategory[]> {
  return fetchJson<DummyCategory[]>('/products/categories');
}

export async function getUsers(limit = 30): Promise<DummyUser[]> {
  const data = await fetchJson<UserListResponse>(`/users?limit=${limit}`);
  return data.users;
}

// -------- Derived helpers used by home page sections --------

export async function getFeaturedProducts(limit = 8): Promise<DummyProduct[]> {
  const all = await getAllProducts(100);
  return [...all]
    .sort((a, b) => b.rating * 100 + b.stock - (a.rating * 100 + a.stock))
    .slice(0, limit);
}

export async function getDealsProducts(limit = 6): Promise<DummyProduct[]> {
  const all = await getAllProducts(100);
  return [...all]
    .filter((p) => p.discountPercentage >= 12)
    .sort((a, b) => b.discountPercentage - a.discountPercentage)
    .slice(0, limit);
}

export async function getBestSellers(limit = 8): Promise<DummyProduct[]> {
  const all = await getAllProducts(100);
  return [...all]
    .sort((a, b) => b.reviews.length + b.rating * 20 - (a.reviews.length + a.rating * 20))
    .slice(0, limit);
}

export async function getTopReviews(
  limit = 8,
): Promise<Array<DummyReview & { productId: number; productTitle: string; productThumbnail: string }>> {
  const all = await getAllProducts(100);
  const rows: Array<DummyReview & { productId: number; productTitle: string; productThumbnail: string }> = [];
  for (const p of all) {
    for (const r of p.reviews) {
      if (r.rating >= 4 && r.comment && r.comment.length > 10) {
        rows.push({
          ...r,
          productId: p.id,
          productTitle: p.title,
          productThumbnail: p.thumbnail,
        });
      }
    }
  }
  return rows.sort((a, b) => b.rating - a.rating).slice(0, limit);
}

export async function getRelatedProducts(product: DummyProduct, limit = 4): Promise<DummyProduct[]> {
  const same = await getProductsByCategory(product.category, 12);
  return same.filter((p) => p.id !== product.id).slice(0, limit);
}

export function slugToTitle(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
