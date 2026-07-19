// Хүсэлт бүрд `http.request.duration` timing metric илгээх middleware.
// Datadog dashboard-т `variant`, `implementation`, `route`, `status` тагаар groupBy хийж болно.

import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { StatsdService } from './statsd.service';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly statsd: StatsdService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      const route = req.route?.path ?? req.baseUrl + req.path;
      this.statsd.timing('http.request.duration', durationMs, [
        `route:${route}`,
        `method:${req.method}`,
        `status:${res.statusCode}`,
      ]);
      this.statsd.increment('http.request.count', [
        `route:${route}`,
        `status:${res.statusCode}`,
      ]);
    });
    next();
  }
}
