// SQL Injection туршилтын гол цэг — Raw хувилбар.
//
// Vulnerable-by-design: `search`, `category`, `min_price`, `max_price` талбарууд
// шууд string interpolation-аар query-д залгагдана. Прод коданд байх ёсгүй.
//
// Халдлагын 3 вектор (11-Цель-өгөгдөл.md):
//   - UNION-based: `' UNION SELECT ... FROM secrets --`
//   - Boolean-blind: `' AND 1=1 --` vs `' AND 1=0 --`
//   - Error-based: PostgreSQL `extractvalue`-ийн эквивалент функцийг ашиглан алдаа гаргах
//
// Beta implementation-т ижил service параметржүүлсэн query-д шилжинэ.

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../config';
import { PgPool } from '../db/pool';

interface ProductRow {
  id: number;
  name: string;
  description: string | null;
  price: string; // NUMERIC → string нь `pg`-ийн default
  category_id: number | null;
}

export interface ProductsQuery {
  search?: string;
  category?: string;
  min_price?: string;
  max_price?: string;
  limit?: string;
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly pool: PgPool,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async list(query: ProductsQuery): Promise<{ items: Array<Product> }> {
    if (this.config.implementation === 'beta') {
      return this.listBeta(query);
    }
    return this.listAlpha(query);
  }

  // ⚠️ Alpha — зориудаар vulnerable. String interpolation ашиглаж query бүрдүүлж байна.
  private async listAlpha(query: ProductsQuery): Promise<{ items: Array<Product> }> {
    const clauses: string[] = ['1=1'];
    if (query.search !== undefined) {
      clauses.push(`name LIKE '%${query.search}%'`);
    }
    if (query.category !== undefined) {
      clauses.push(`category_id = ${query.category}`);
    }
    if (query.min_price !== undefined) {
      clauses.push(`price >= ${query.min_price}`);
    }
    if (query.max_price !== undefined) {
      clauses.push(`price <= ${query.max_price}`);
    }
    const limit = this.parseLimit(query.limit);
    const sql =
      `SELECT id, name, description, price, category_id FROM products ` +
      `WHERE ${clauses.join(' AND ')} ORDER BY id ASC LIMIT ${limit}`;
    const result = await this.pool.query<ProductRow>(sql);
    return { items: result.rows.map(mapProduct) };
  }

  // ✅ Beta — parameterized. SQLi 3 вектор бүгд хаагдана.
  private async listBeta(query: ProductsQuery): Promise<{ items: Array<Product> }> {
    const clauses: string[] = ['1=1'];
    const params: unknown[] = [];
    if (query.search !== undefined) {
      params.push(`%${query.search}%`);
      clauses.push(`name LIKE $${params.length}`);
    }
    if (query.category !== undefined) {
      params.push(Number(query.category));
      clauses.push(`category_id = $${params.length}`);
    }
    if (query.min_price !== undefined) {
      params.push(Number(query.min_price));
      clauses.push(`price >= $${params.length}`);
    }
    if (query.max_price !== undefined) {
      params.push(Number(query.max_price));
      clauses.push(`price <= $${params.length}`);
    }
    params.push(this.parseLimit(query.limit));
    const sql =
      `SELECT id, name, description, price, category_id FROM products ` +
      `WHERE ${clauses.join(' AND ')} ORDER BY id ASC LIMIT $${params.length}`;
    const result = await this.pool.query<ProductRow>(sql, params);
    return { items: result.rows.map(mapProduct) };
  }

  async get(id: number): Promise<{ product: Product }> {
    // Дэлгэрэнгүй харах endpoint нь халдлагын гол цэг биш — parameterized.
    const result = await this.pool.query<ProductRow>(
      'SELECT id, name, description, price, category_id FROM products WHERE id = $1 LIMIT 1',
      [id],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException('Бараа олдсонгүй');
    return { product: mapProduct(row) };
  }

  private parseLimit(raw?: string): number {
    const n = raw === undefined ? 50 : Number(raw);
    if (!Number.isFinite(n) || n <= 0) return 50;
    return Math.min(50, Math.floor(n));
  }
}

export interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number;
  category_id: number | null;
}

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    category_id: row.category_id,
  };
}
