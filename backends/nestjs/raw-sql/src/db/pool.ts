// `pg` Pool wrapper — Raw SQL хувилбарын гол цэг.
//
// Онцлог: `.query(sql, params?)`-ыг ил тод буулгасан.
//   - Raw хувилбарт зарим модуль (products search, orders WHERE) параметрлэлгүй
//     string interpolation ашиглана — vulnerable-by-design.
//   - Бусад модуль (auth login, order_items insert) parameterized query ашиглана —
//     эдгээр нь SQLi туршилтын гол цэг биш тул зориуд сул хийгээгүй.

import { Global, Inject, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { APP_CONFIG, AppConfig, loadConfig } from '../config';

@Injectable()
export class PgPool implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.pool = new Pool({
      host: config.postgres.host,
      port: config.postgres.port,
      user: config.postgres.user,
      password: config.postgres.password,
      database: config.postgres.database,
      max: 10,
      idleTimeoutMillis: 30_000,
    });
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(sql, params as unknown[] | undefined);
  }

  async withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: loadConfig,
    },
    PgPool,
  ],
  exports: [PgPool, APP_CONFIG],
})
export class DbModule {}
