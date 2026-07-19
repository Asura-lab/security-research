// Prisma ORM хувилбарын Overposting туршилтын endpoint.
//
// Alpha (default):
//   Prisma `update({ where, data })`-т `data`-ыг DTO-с шууд буулгавал ORM түвшинд ямар
//   ч хамгаалалт үгүй. NestJS-ийн ValidationPipe (whitelist:false) нь `role`,
//   `is_admin`, `targets`-г accept болгож `data`-т үлдээнэ. Prisma `update` нь
//   схемт хамааралгүй талбарыг татгалзана, тэгэхээр raw хэлбэрээр `role`,
//   `isAdmin`-ыг тайлан бичихээс өөр аргагүй.
//
// Beta (fixed):
//   `whitelist: true, forbidNonWhitelisted: true` — ирээгүй талбарыг 400-аар шидэнэ.
//   Service нь зөвхөн `name`, `address`-ыг заана.

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../config';
import { PrismaService } from '../db/prisma.service';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { UpdateProfileDto } from './profile.dto';

export interface ProfileDto {
  user_id: number;
  username: string;
  email: string;
  role: 'customer' | 'admin';
  is_admin: boolean;
  address: string | null;
}

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async get(user: AuthenticatedUser): Promise<{ profile: ProfileDto }> {
    return { profile: await this.fetchUser(user.id) };
  }

  async update(user: AuthenticatedUser, dto: UpdateProfileDto): Promise<{ profile: ProfileDto }> {
    if (this.config.implementation === 'beta') {
      await this.updateBeta(user, dto);
    } else {
      await this.updateAlpha(user, dto);
    }
    return { profile: await this.fetchUser(user.id) };
  }

  private async updateAlpha(user: AuthenticatedUser, dto: UpdateProfileDto): Promise<void> {
    const data: {
      username?: string;
      address?: string;
      role?: string;
      isAdmin?: boolean;
    } = {};
    if (dto.name !== undefined) data.username = dto.name;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.is_admin !== undefined) data.isAdmin = dto.is_admin;
    if (Object.keys(data).length > 0) {
      await this.prisma.user.update({ where: { id: user.id }, data });
    }

    if (dto.targets && dto.targets.length > 0) {
      const targets = await this.prisma.profileTarget.findMany({
        where: { userId: user.id },
      });
      const byLabel = new Map(targets.map((t) => [t.targetLabel, t]));
      for (const overpost of dto.targets) {
        const target = byLabel.get(overpost.label);
        if (!target) continue;
        if (!/^you are hacked$/i.test(overpost.value)) continue;
        await this.prisma.profileTarget.update({
          where: { id: target.id },
          data: {
            targetValue: `You are hacked | ${target.targetNonce}`,
            updatedAt: new Date(),
          },
        });
      }
    }
  }

  private async updateBeta(user: AuthenticatedUser, dto: UpdateProfileDto): Promise<void> {
    const data: { username?: string; address?: string } = {};
    if (dto.name !== undefined) data.username = dto.name;
    if (dto.address !== undefined) data.address = dto.address;
    if (Object.keys(data).length === 0) return;
    await this.prisma.user.update({ where: { id: user.id }, data });
  }

  private async fetchUser(userId: number): Promise<ProfileDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isAdmin: true,
        address: true,
      },
    });
    if (!user) throw new NotFoundException('Хэрэглэгч олдсонгүй');
    return {
      user_id: user.id,
      username: user.username,
      email: user.email,
      role: (user.role === 'admin' ? 'admin' : 'customer') as 'customer' | 'admin',
      is_admin: user.isAdmin,
      address: user.address,
    };
  }
}
