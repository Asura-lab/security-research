import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { TargetsService } from './targets.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminController],
  providers: [TargetsService],
})
export class AdminModule {}
