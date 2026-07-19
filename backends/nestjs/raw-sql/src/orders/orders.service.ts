// BOLA туршилтын гол endpoint — Raw хувилбар.
//
// Alpha (default): `WHERE id = <n>` — ownership check байхгүй. Attacker өөр
// хэрэглэгчийн захиалгыг GET/PUT/DELETE-ээр хандаж чадна.
//   - GET  → victim-ийн `order_targets` marker хариунд илэрнэ (data disclosure)
//   - PUT  → status-ыг `"You are hacked"` болгоход `order_targets.target_value`-т
//            `"You are hacked | <nonce>"` бичигдэнэ.
//   - DELETE → `order_targets.target_value`-т `"DELETED by hacker | <nonce>"`
//              бичээд order-ыг устгана.
//
// Beta (fixed): `WHERE id = <n> AND user_id = <uid>` — өөр хэрэглэгчийн захиалга 404.
//
// Vulnerable string interpolation зориудаар үлдээсэн — BOLA-ийн ownership guard-ыг
// SQLi-ээс тусад нь хэмжих боломжтой (Alpha хувилбар нь SQLi-д ч гэсэн эмзэг).

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../config';
import { PgPool } from '../db/pool';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { CreateOrderDto, UpdateOrderDto } from './orders.dto';

interface OrderRow {
  id: number;
  user_id: number;
  status: string;
  total: string;
}

interface OrderItemRow {
  product_id: number;
  quantity: number;
  unit_price: string;
}

export interface OrderDto {
  id: number;
  user_id: number;
  status: string;
  total: number;
  items: Array<{ product_id: number; quantity: number; unit_price: number }>;
}

interface OrderTargetRow {
  id: number;
  order_id: number;
  target_value: string;
  target_nonce: string;
  target_label: string;
  vector: 'bola_put' | 'bola_delete';
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly pool: PgPool,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateOrderDto): Promise<{ order: OrderDto }> {
    return this.pool.withClient(async (client) => {
      await client.query('BEGIN');
      try {
        const created = await client.query<{ id: number }>(
          `INSERT INTO orders (user_id, status, total) VALUES ($1, 'pending', 0) RETURNING id`,
          [user.id],
        );
        const orderId = created.rows[0]?.id;
        if (orderId === undefined) throw new Error('order үүсэхгүй байна');
        let total = 0;
        for (const item of dto.items) {
          const priceResult = await client.query<{ price: string }>(
            'SELECT price FROM products WHERE id = $1',
            [item.product_id],
          );
          const priceRow = priceResult.rows[0];
          if (!priceRow) throw new NotFoundException(`Бараа ${item.product_id} олдсонгүй`);
          const unitPrice = Number(priceRow.price);
          total += unitPrice * item.quantity;
          await client.query(
            `INSERT INTO order_items (order_id, product_id, quantity, unit_price)
             VALUES ($1, $2, $3, $4)`,
            [orderId, item.product_id, item.quantity, unitPrice],
          );
        }
        await client.query('UPDATE orders SET total = $1 WHERE id = $2', [total, orderId]);
        await client.query('COMMIT');
        return { order: await this.fetchOrder(orderId) };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    });
  }

  async getById(user: AuthenticatedUser, id: number): Promise<{ order: OrderDto }> {
    const row = await this.findOrder(user, id);
    if (!row) throw new NotFoundException('Захиалга олдсонгүй');
    return { order: await this.mapOrder(row) };
  }

  async update(user: AuthenticatedUser, id: number, dto: UpdateOrderDto): Promise<{ order: OrderDto }> {
    const row = await this.findOrder(user, id);
    if (!row) throw new NotFoundException('Захиалга олдсонгүй');

    // ⚠️ Alpha: string interpolation. Attacker-ийн `"You are hacked"` шууд бичигдэнэ.
    if (this.config.implementation === 'beta') {
      await this.pool.query('UPDATE orders SET status = $1 WHERE id = $2 AND user_id = $3', [
        dto.status,
        id,
        user.id,
      ]);
    } else {
      await this.pool.query(`UPDATE orders SET status = '${dto.status}' WHERE id = ${id}`);
    }

    // BOLA PUT marker mutation — status утга `"You are hacked"` бол `order_targets.target_value`-ыг
    // strict eq marker болгоно.
    await this.applyBolaWriteMarker(id, 'bola_put', dto.status);
    return { order: await this.fetchOrder(id) };
  }

  async remove(user: AuthenticatedUser, id: number): Promise<void> {
    const row = await this.findOrder(user, id);
    if (!row) throw new NotFoundException('Захиалга олдсонгүй');
    // DELETE-ийн өмнө marker хадгалж, дараа нь order устгана. `order_targets`-т
    // `ON DELETE CASCADE` тул marker цуг устахаас сэргийлэхийн тулд target-ыг өөр
    // order-руу шилжүүлэлгүй, эхлээд `target_value`-г бичээд дараа нь captured-
    // snapshot-т үлдээх зорилготой байна. Хэрэгжүүлэлт: markerыг save-хэдэн үлдээх
    // үүднээс `order_targets`-т `order_id`-г NULL болгож болохгүй (schema-д NOT NULL).
    //   → Тиймээс DELETE-ийн үед target-ыг зөвхөн marker хэлбэрээр `target_value`-т
    //     хадгалж, `order_id`-г тухайн устгагдах орденорд зурж дараа нь `orders`
    //     мөрийг устгана. Detection endpoint (`/api/admin/targets/status`) нь
    //     `orders JOIN`-гүй тул `deleted=true` flag-ыг order оршиж байгаа эсэхээр
    //     тодорхойлно.
    //
    //   Гэвч `order_targets.order_id FK ON DELETE CASCADE`-ээс болж order-ыг устгахад
    //   target цуг устана. Үүнээс сэргийлж marker-ыг устгахаас өмнө bulldog хадгалж,
    //   орденорыг устгахын өмнө FK constraint-ыг зөвшөөрөх шаардлагатай. Тохирох
    //   шийдэл: BOLA_DELETE marker-ыг устгахаас өмнө `target_snapshots`-т хадгална.

    const target = await this.findWriteTarget(id, 'bola_delete');

    if (this.config.implementation === 'beta') {
      await this.pool.query('DELETE FROM orders WHERE id = $1 AND user_id = $2', [id, user.id]);
    } else {
      await this.pool.query(`DELETE FROM orders WHERE id = ${id}`);
    }

    if (target) {
      // order устсаны дараа target нь CASCADE-ээр устсан. Marker-ыг snapshot-т үлдээж
      // detection нь болдог: value = "DELETED by hacker | <nonce>".
      const markerValue = `DELETED by hacker | ${target.target_nonce}`;
      await this.pool.query(
        `INSERT INTO target_snapshots (snapshot_id, target_label, value_before, value_after)
         VALUES ($1, $2, $3, $4)`,
        [
          `bola-delete-${id}-${Date.now()}`,
          target.target_label,
          target.target_value,
          markerValue,
        ],
      );
    }
  }

  // ================================================================
  // Дотоод туслах функцүүд
  // ================================================================

  // Alpha/Beta ялгаа — ownership check.
  private async findOrder(user: AuthenticatedUser, id: number): Promise<OrderRow | null> {
    let sql: string;
    let params: unknown[];
    if (this.config.implementation === 'beta') {
      sql = 'SELECT id, user_id, status, total FROM orders WHERE id = $1 AND user_id = $2 LIMIT 1';
      params = [id, user.id];
    } else {
      // ⚠️ Alpha: ownership check байхгүй, зөвхөн id.
      sql = `SELECT id, user_id, status, total FROM orders WHERE id = ${id} LIMIT 1`;
      params = [];
    }
    const result = await this.pool.query<OrderRow>(sql, params);
    return result.rows[0] ?? null;
  }

  private async fetchOrder(id: number): Promise<OrderDto> {
    const orderResult = await this.pool.query<OrderRow>(
      'SELECT id, user_id, status, total FROM orders WHERE id = $1 LIMIT 1',
      [id],
    );
    const row = orderResult.rows[0];
    if (!row) throw new NotFoundException('Захиалга олдсонгүй');
    return this.mapOrder(row);
  }

  private async mapOrder(row: OrderRow): Promise<OrderDto> {
    const itemsResult = await this.pool.query<OrderItemRow>(
      'SELECT product_id, quantity, unit_price FROM order_items WHERE order_id = $1 ORDER BY id',
      [row.id],
    );
    return {
      id: row.id,
      user_id: row.user_id,
      status: row.status,
      total: Number(row.total),
      items: itemsResult.rows.map((r) => ({
        product_id: r.product_id,
        quantity: r.quantity,
        unit_price: Number(r.unit_price),
      })),
    };
  }

  private async findWriteTarget(orderId: number, vector: 'bola_put' | 'bola_delete'): Promise<OrderTargetRow | null> {
    const result = await this.pool.query<OrderTargetRow>(
      `SELECT id, order_id, target_value, target_nonce, target_label, vector
       FROM order_targets WHERE order_id = $1 AND vector = $2 LIMIT 1`,
      [orderId, vector],
    );
    return result.rows[0] ?? null;
  }

  private async applyBolaWriteMarker(orderId: number, vector: 'bola_put', statusValue: string): Promise<void> {
    // BOLA PUT marker: attacker `"You are hacked"`-г илгээсэн үед marker "You are hacked | <nonce>"
    // болно. Бусад утга бол marker хэвээр (`"you will change this data"`).
    if (!/^you are hacked$/i.test(statusValue)) return;
    const target = await this.findWriteTarget(orderId, vector);
    if (!target) return;
    const markerValue = `You are hacked | ${target.target_nonce}`;
    await this.pool.query('UPDATE order_targets SET target_value = $1, updated_at = NOW() WHERE id = $2', [
      markerValue,
      target.id,
    ]);
  }
}
