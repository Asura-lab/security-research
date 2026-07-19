// Auth логик — register + login. Password bcrypt (rounds=12), JWT HS256, 15m exp.
//
// Онцлог:
//   - `login`-д username-ийг parameterized query ашиглана (SQLi-ийн гол цэг биш).
//   - `register`-т conflict шалгалт мөн parameterized.
// Vulnerable string interpolation зөвхөн products хайлт, orders WHERE clause,
// profile Overposting-т байрлана (халдлагын target-тай холбоотой).

import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { APP_CONFIG, AppConfig } from '../config';
import { PgPool } from '../db/pool';
import { LoginDto, RegisterDto } from './auth.dto';

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  role: 'customer' | 'admin';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly pool: PgPool,
    private readonly jwt: JwtService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async register(dto: RegisterDto): Promise<{ user_id: number; username: string; role: 'customer' }> {
    const exists = await this.pool.query<{ id: number }>(
      'SELECT id FROM users WHERE username = $1 OR email = $2 LIMIT 1',
      [dto.username, dto.email],
    );
    if (exists.rowCount && exists.rowCount > 0) {
      throw new ConflictException('username эсвэл email аль хэдийн байна');
    }
    const hash = await bcrypt.hash(dto.password, 12);
    const created = await this.pool.query<{ id: number }>(
      `INSERT INTO users (username, email, password_hash, role, is_admin)
       VALUES ($1, $2, $3, 'customer', FALSE)
       RETURNING id`,
      [dto.username, dto.email, hash],
    );
    const userId = created.rows[0]?.id;
    if (userId === undefined) {
      throw new Error('Хэрэглэгч үүсэхгүй болов');
    }
    return { user_id: userId, username: dto.username, role: 'customer' };
  }

  async login(dto: LoginDto): Promise<{ access_token: string; role: 'customer' | 'admin'; user_id: number }> {
    const result = await this.pool.query<UserRow>(
      'SELECT id, username, password_hash, role FROM users WHERE username = $1 LIMIT 1',
      [dto.username],
    );
    const user = result.rows[0];
    if (!user) throw new UnauthorizedException('Нэвтрэх нэр эсвэл нууц үг буруу');
    const ok = await bcrypt.compare(dto.password, user.password_hash);
    if (!ok) throw new UnauthorizedException('Нэвтрэх нэр эсвэл нууц үг буруу');
    const token = await this.jwt.signAsync(
      { sub: user.id, role: user.role },
      { secret: this.config.jwt.secret, expiresIn: this.config.jwt.expiresIn },
    );
    return { access_token: token, role: user.role, user_id: user.id };
  }
}
