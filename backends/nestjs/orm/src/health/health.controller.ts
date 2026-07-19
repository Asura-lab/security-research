import { Controller, Get, Inject } from '@nestjs/common';
import { APP_CONFIG, AppConfig, VARIANT_NAME } from '../config';

@Controller('health')
export class HealthController {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  @Get()
  status() {
    return {
      status: 'ok' as const,
      variant: VARIANT_NAME,
      implementation: this.config.implementation,
    };
  }
}
