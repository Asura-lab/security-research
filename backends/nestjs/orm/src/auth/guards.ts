// AuthGuard('jwt') болон RolesGuard. Detection endpoint нь admin шаардана.

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { AuthenticatedUser } from './jwt.strategy';

export const JwtGuard = AuthGuard('jwt');

export const ROLES_META = 'roles';
export const Roles = (...roles: Array<AuthenticatedUser['role']>) =>
  SetMetadata(ROLES_META, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Array<AuthenticatedUser['role']>>(
      ROLES_META,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;
    const req = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (!req.user) throw new ForbiddenException('Хандалт хориотой');
    if (!required.includes(req.user.role)) {
      throw new ForbiddenException('Хандалт хориотой');
    }
    return true;
  }
}
