import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtGuard } from '../auth/guards';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { UpdateProfileDto } from './profile.dto';
import { ProfileService } from './profile.service';

@Controller('api/profile')
@UseGuards(JwtGuard)
export class ProfileController {
  constructor(private readonly service: ProfileService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.service.get(user);
  }

  @Put()
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.service.update(user, dto);
  }
}
