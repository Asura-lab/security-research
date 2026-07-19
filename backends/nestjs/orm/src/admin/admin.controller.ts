import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtGuard, Roles, RolesGuard } from '../auth/guards';
import { TargetsService } from './targets.service';

@Controller('api/admin/targets')
@UseGuards(JwtGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly service: TargetsService) {}

  @Get('status')
  list(@Query('label') label?: string) {
    return this.service.list(label);
  }
}
