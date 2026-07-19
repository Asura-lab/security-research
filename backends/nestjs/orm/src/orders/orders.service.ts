// Prisma ORM хувилбарын BOLA туршилтын endpoint.
//
// Alpha: `findUnique({ where: { id } })` — ownership check байхгүй.
// Beta:  `findFirst({ where: { id, userId } })` — өөр хэрэглэгчийн захиалга null.
//
// Prisma-ийн `update({ where: { id } })` нь compound key байхгүй тул
// ownership-ыг үзэх өөр туслах query шаардлагатай. Beta нь `updateMany`-аар
// `where: { id, userId }`-ыг заах чадвартай.
//
// SQL Injection боломж байхгүй (Prisma нь parameterized).

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { APP_CONFIG, AppConfig } from '../config';
import { PrismaService } from '../db/prisma.service';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { CreateOrderDto, UpdateOrderDto } from './orders.dto';

export interface OrderDto {
  id: number;
  user_id: number;
  status: string;
  total: number;
  items: Array<{ product_id: number; quantity: number; unit_price: number }>;
}

type OrderWithItems = Prisma.OrderGetPayload<{
  include: { items: true };
}>;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateOrderDto): Promise<{ order: OrderDto }> {
    const productIds = dto.items.map((i) => i.product_id);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, price: true },
    });
    const priceByProduct = new Map(products.map((p) => [p.id, p.price.toNumber()]));
    for (const item of dto.items) {
      if (!priceByProduct.has(item.product_id)) {
        throw new NotFoundException(`Бараа ${item.product_id} олдсонгүй`);
      }
    }
    const itemsPayload = dto.items.map((item) => ({
      productId: item.product_id,
      quantity: item.quantity,
      unitPrice: new Prisma.Decimal(priceByProduct.get(item.product_id)!),
    }));
    const total = dto.items.reduce(
      (sum, item) => sum + (priceByProduct.get(item.product_id) ?? 0) * item.quantity,
      0,
    );
    const created = await this.prisma.order.create({
      data: {
        userId: user.id,
        status: 'pending',
        total: new Prisma.Decimal(total),
        items: { create: itemsPayload },
      },
      include: { items: true },
    });
    return { order: this.mapOrder(created) };
  }

  async getById(user: AuthenticatedUser, id: number): Promise<{ order: OrderDto }> {
    const order = await this.findOrder(user, id);
    if (!order) throw new NotFoundException('Захиалга олдсонгүй');
    return { order: this.mapOrder(order) };
  }

  async update(
    user: AuthenticatedUser,
    id: number,
    dto: UpdateOrderDto,
  ): Promise<{ order: OrderDto }> {
    const existing = await this.findOrder(user, id);
    if (!existing) throw new NotFoundException('Захиалга олдсонгүй');

    if (this.config.implementation === 'beta') {
      // Ownership-ыг compound WHERE-т заана.
      await this.prisma.order.updateMany({
        where: { id, userId: user.id },
        data: { status: dto.status },
      });
    } else {
      // ⚠️ Alpha: `where: { id }` — ownership check байхгүй.
      await this.prisma.order.update({ where: { id }, data: { status: dto.status } });
    }

    await this.applyBolaWriteMarker(id, 'bola_put', dto.status);

    const refreshed = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!refreshed) throw new NotFoundException('Захиалга олдсонгүй');
    return { order: this.mapOrder(refreshed) };
  }

  async remove(user: AuthenticatedUser, id: number): Promise<void> {
    const existing = await this.findOrder(user, id);
    if (!existing) throw new NotFoundException('Захиалга олдсонгүй');

    // BOLA DELETE marker: устгахаас өмнө snapshot-т үлдээнэ.
    const target = await this.prisma.orderTarget.findFirst({
      where: { orderId: id, vector: 'bola_delete' },
    });

    if (this.config.implementation === 'beta') {
      const del = await this.prisma.order.deleteMany({ where: { id, userId: user.id } });
      if (del.count === 0) throw new NotFoundException('Захиалга олдсонгүй');
    } else {
      await this.prisma.order.delete({ where: { id } });
    }

    if (target) {
      const markerValue = `DELETED by hacker | ${target.targetNonce}`;
      await this.prisma.targetSnapshot.create({
        data: {
          snapshotId: `bola-delete-${id}-${Date.now()}`,
          targetLabel: target.targetLabel,
          valueBefore: target.targetValue,
          valueAfter: markerValue,
        },
      });
    }
  }

  private async findOrder(user: AuthenticatedUser, id: number): Promise<OrderWithItems | null> {
    if (this.config.implementation === 'beta') {
      return this.prisma.order.findFirst({
        where: { id, userId: user.id },
        include: { items: true },
      });
    }
    return this.prisma.order.findUnique({ where: { id }, include: { items: true } });
  }

  private async applyBolaWriteMarker(
    orderId: number,
    vector: 'bola_put',
    statusValue: string,
  ): Promise<void> {
    if (!/^you are hacked$/i.test(statusValue)) return;
    const target = await this.prisma.orderTarget.findFirst({
      where: { orderId, vector },
    });
    if (!target) return;
    await this.prisma.orderTarget.update({
      where: { id: target.id },
      data: { targetValue: `You are hacked | ${target.targetNonce}`, updatedAt: new Date() },
    });
  }

  private mapOrder(order: OrderWithItems): OrderDto {
    return {
      id: order.id,
      user_id: order.userId,
      status: order.status,
      total: order.total.toNumber(),
      items: order.items.map((item) => ({
        product_id: item.productId ?? 0,
        quantity: item.quantity,
        unit_price: item.unitPrice.toNumber(),
      })),
    };
  }
}
