// JWT payload → req.user. Contract-т заасан { user_id, role } хэлбэрээр буцаана.

import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { APP_CONFIG, AppConfig } from '../config';

export interface AuthenticatedUser {
  id: number;
  role: 'customer' | 'admin';
}

interface JwtPayload {
  sub: number;
  role: 'customer' | 'admin';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwt.secret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    return { id: payload.sub, role: payload.role };
  }
}
