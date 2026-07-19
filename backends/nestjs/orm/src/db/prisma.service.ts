// Prisma клиент wrapper. Prisma нь бүх параметржүүлэлтийг автомат хийдэг —
// тиймээс SQLi 3 вектор бүгд хаагдана (Alpha хувилбарт ч гэсэн).
//
// Beta хувилбарт зөвхөн ownership check-ын логик өөрчлөгдөнө (orders, profile),
// Prisma-ийн API-д ямар нэг өөрчлөлт байхгүй.

import {
  Global,
  Inject,
  Injectable,
  Module,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { APP_CONFIG, AppConfig, loadConfig } from '../config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    super({
      datasources: { db: { url: config.databaseUrl } },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

@Global()
@Module({
  providers: [
    { provide: APP_CONFIG, useFactory: loadConfig },
    PrismaService,
  ],
  exports: [PrismaService, APP_CONFIG],
})
export class DbModule {}
