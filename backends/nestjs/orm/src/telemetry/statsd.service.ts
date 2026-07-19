// Datadog dogstatsd клиент. DD_AGENT_HOST-гүй бол disabled (халдлагын script-т enterprise
// шаардлагагүй тул локал туршилтад алгасаж болно).

import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { StatsD } from 'hot-shots';
import { APP_CONFIG, AppConfig, VARIANT_NAME } from '../config';

@Injectable()
export class StatsdService implements OnModuleDestroy {
  private readonly logger = new Logger(StatsdService.name);
  private readonly client: StatsD | null;
  private readonly baseTags: readonly string[];

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.baseTags = [
      `variant:${VARIANT_NAME}`,
      `implementation:${config.implementation}`,
    ];
    if (!config.telemetry.enabled) {
      this.client = null;
      this.logger.warn('DD_AGENT_HOST өгөгдөөгүй — statsd disabled');
      return;
    }
    this.client = new StatsD({
      host: config.telemetry.host,
      port: config.telemetry.port,
      globalTags: this.baseTags.slice(),
      errorHandler: (err) => this.logger.warn(`statsd алдаа: ${err.message}`),
    });
  }

  timing(metric: string, ms: number, tags: readonly string[] = []): void {
    this.client?.timing(metric, ms, tags.slice());
  }

  increment(metric: string, tags: readonly string[] = []): void {
    this.client?.increment(metric, 1, tags.slice());
  }

  onModuleDestroy(): void {
    this.client?.close();
  }
}
