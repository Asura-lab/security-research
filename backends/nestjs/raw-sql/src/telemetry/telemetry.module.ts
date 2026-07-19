import { Module } from '@nestjs/common';
import { StatsdService } from './statsd.service';
import { MetricsMiddleware } from './metrics.middleware';

@Module({
  providers: [StatsdService, MetricsMiddleware],
  exports: [StatsdService, MetricsMiddleware],
})
export class TelemetryModule {}
