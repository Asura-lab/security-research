// Prisma-ийн parameterized query — SQLi 3 вектор бүгд хаагдана.
// Alpha/Beta ялгаа байхгүй (Prisma нь string interpolation боломж өгдөггүй).

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';

export interface ProductsQuery {
  search?: string;
  category?: string;
  min_price?: string;
  max_price?: string;
  limit?: string;
}

export interface ProductDto {
  id: number;
  name: string;
  description: string | null;
  price: number;
  category_id: number | null;
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ProductsQuery): Promise<{ items: ProductDto[] }> {
    const limit = this.parseLimit(query.limit);
    const items = await this.prisma.product.findMany({
      where: {
        AND: [
          query.search ? { name: { contains: query.search } } : {},
          query.category ? { categoryId: Number(query.category) } : {},
          query.min_price ? { price: { gte: Number(query.min_price) } } : {},
          query.max_price ? { price: { lte: Number(query.max_price) } } : {},
        ],
      },
      orderBy: { id: 'asc' },
      take: limit,
    });
    return { items: items.map(this.mapProduct) };
  }

  async get(id: number): Promise<{ product: ProductDto }> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Бараа олдсонгүй');
    return { product: this.mapProduct(product) };
  }

  private parseLimit(raw?: string): number {
    const n = raw === undefined ? 50 : Number(raw);
    if (!Number.isFinite(n) || n <= 0) return 50;
    return Math.min(50, Math.floor(n));
  }

  private mapProduct = (product: {
    id: number;
    name: string;
    description: string | null;
    price: { toNumber(): number };
    categoryId: number | null;
  }): ProductDto => ({
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price.toNumber(),
    category_id: product.categoryId,
  });
}
