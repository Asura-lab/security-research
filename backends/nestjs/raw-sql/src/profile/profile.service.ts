// Overposting туршилтын гол цэг.
//
// Alpha (default):
//   - `role`, `is_admin` талбарууд accept болно → users-т нэмэлт UPDATE
//   - `targets[]` талбар accept болно → profile_targets marker mutation
//
// Beta (fixed):
//   - `whitelist: true, forbidNonWhitelisted: true` (main.ts-д тохируулна)
//   - Backend түвшин ч гэсэн зөвхөн `name`, `address` талбарыг зөвшөөрнө
//
// Alpha хэвлэлд `role`/`is_admin`/`targets`-ыг UPDATE-ээр шууд бичиж байна —
// mass assignment vulnerability-ийн бодит хэлбэр.

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../config';
import { PgPool } from '../db/pool';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { UpdateProfileDto } from './profile.dto';

interface UserRow {
  id: number;
  username: string;
  email: string;
  role: 'customer' | 'admin';
  is_admin: boolean;
  address: string | null;
}

interface ProfileTargetRow {
  id: number;
  target_label: string;
  target_nonce: string;
}

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
    private readonly pool: PgPool,
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

  // ⚠️ Alpha — mass assignment. Ирсэн бүх талбарыг accept.
  private async updateAlpha(user: AuthenticatedUser, dto: UpdateProfileDto): Promise<void> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (dto.name !== undefined) {
      params.push(dto.name);
      clauses.push(`username = $${params.length}`);
    }
    if (dto.address !== undefined) {
      params.push(dto.address);
      clauses.push(`address = $${params.length}`);
    }
    // Overposting variant 1/2: role, is_admin шууд UPDATE
    if (dto.role !== undefined) {
      params.push(dto.role);
      clauses.push(`role = $${params.length}`);
    }
    if (dto.is_admin !== undefined) {
      params.push(dto.is_admin);
      clauses.push(`is_admin = $${params.length}`);
    }
    if (clauses.length > 0) {
      params.push(user.id);
      await this.pool.query(
        `UPDATE users SET ${clauses.join(', ')} WHERE id = $${params.length}`,
        params,
      );
    }

    // Overposting variant 3: profile_targets marker mutation
    if (dto.targets && dto.targets.length > 0) {
      const targets = await this.pool.query<ProfileTargetRow>(
        'SELECT id, target_label, target_nonce FROM profile_targets WHERE user_id = $1',
        [user.id],
      );
      const byLabel = new Map(targets.rows.map((r) => [r.target_label, r]));
      for (const overpost of dto.targets) {
        const target = byLabel.get(overpost.label);
        if (!target) continue;
        if (!/^you are hacked$/i.test(overpost.value)) continue;
        const marker = `You are hacked | ${target.target_nonce}`;
        await this.pool.query(
          'UPDATE profile_targets SET target_value = $1, updated_at = NOW() WHERE id = $2',
          [marker, target.id],
        );
      }
    }
  }

  // ✅ Beta — зөвхөн зөвшөөрөгдсөн талбарууд.
  private async updateBeta(user: AuthenticatedUser, dto: UpdateProfileDto): Promise<void> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (dto.name !== undefined) {
      params.push(dto.name);
      clauses.push(`username = $${params.length}`);
    }
    if (dto.address !== undefined) {
      params.push(dto.address);
      clauses.push(`address = $${params.length}`);
    }
    if (clauses.length === 0) return;
    params.push(user.id);
    await this.pool.query(
      `UPDATE users SET ${clauses.join(', ')} WHERE id = $${params.length}`,
      params,
    );
  }

  private async fetchUser(userId: number): Promise<ProfileDto> {
    const result = await this.pool.query<UserRow>(
      'SELECT id, username, email, role, is_admin, address FROM users WHERE id = $1 LIMIT 1',
      [userId],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException('Хэрэглэгч олдсонгүй');
    return {
      user_id: row.id,
      username: row.username,
      email: row.email,
      role: row.role,
      is_admin: row.is_admin,
      address: row.address,
    };
  }
}
