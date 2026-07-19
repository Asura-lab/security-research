import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { DbModule } from './db/pool';
import { HealthModule } from './health/health.module';
import { OrdersModule } from './orders/orders.module';
import { ProductsModule } from './products/products.module';
import { ProfileModule } from './profile/profile.module';
import { MetricsMiddleware } from './telemetry/metrics.middleware';
import { TelemetryModule } from './telemetry/telemetry.module';

@Module({
  imports: [
    DbModule,
    TelemetryModule,
    HealthModule,
    AuthModule,
    ProductsModule,
    OrdersModule,
    ProfileModule,
    AdminModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(MetricsMiddleware).forRoutes('*');
  }
}
