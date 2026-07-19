// NestJS Prisma ORM — auth service. Prisma-ийн parameterized query автомат тул
// SQLi login-д хамааралгүй (Raw хувилбар ч гэсэн auth-т parameterized ашигладаг).

import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { APP_CONFIG, AppConfig } from '../config';
import { PrismaService } from '../db/prisma.service';
import { LoginDto, RegisterDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async register(dto: RegisterDto): Promise<{ user_id: number; username: string; role: 'customer' }> {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ username: dto.username }, { email: dto.email }] },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('username эсвэл email аль хэдийн байна');
    }
    const hash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email,
        passwordHash: hash,
        role: 'customer',
        isAdmin: false,
      },
      select: { id: true, username: true },
    });
    return { user_id: user.id, username: user.username, role: 'customer' };
  }

  async login(
    dto: LoginDto,
  ): Promise<{ access_token: string; role: 'customer' | 'admin'; user_id: number }> {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
      select: { id: true, passwordHash: true, role: true },
    });
    if (!user) throw new UnauthorizedException('Нэвтрэх нэр эсвэл нууц үг буруу');
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Нэвтрэх нэр эсвэл нууц үг буруу');
    const role = (user.role === 'admin' ? 'admin' : 'customer') as 'customer' | 'admin';
    const token = await this.jwt.signAsync(
      { sub: user.id, role },
      { secret: this.config.jwt.secret, expiresIn: this.config.jwt.expiresIn },
    );
    return { access_token: token, role, user_id: user.id };
  }
}
