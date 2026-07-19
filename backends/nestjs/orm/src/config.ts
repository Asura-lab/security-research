// NestJS Prisma ORM хувилбарын config. Prisma нь `DATABASE_URL`-ыг шаардана.

export const VARIANT_NAME = 'nestjs-orm';
export const HTTP_PORT = 3002;

export interface AppConfig {
  databaseUrl: string;
  jwt: { secret: string; expiresIn: string };
  telemetry: { host: string; port: number; enabled: boolean };
  implementation: 'alpha' | 'beta';
}

export function loadConfig(): AppConfig {
  const host = process.env.POSTGRES_HOST ?? 'localhost';
  const port = process.env.POSTGRES_PORT ?? '5432';
  const user = process.env.POSTGRES_USER ?? 'postgres';
  const password = process.env.POSTGRES_PASSWORD ?? 'research123';
  const db = process.env.POSTGRES_DB ?? 'shop';
  const databaseUrl =
    process.env.DATABASE_URL ?? `postgresql://${user}:${password}@${host}:${port}/${db}?schema=public`;

  return {
    databaseUrl,
    jwt: {
      secret: process.env.JWT_SECRET ?? 'research-jwt-secret',
      expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    },
    telemetry: {
      host: process.env.DD_AGENT_HOST ?? 'datadog',
      port: Number(process.env.DD_DOGSTATSD_PORT ?? 8125),
      enabled: process.env.DD_AGENT_HOST !== undefined,
    },
    implementation: process.env.IMPLEMENTATION === 'beta' ? 'beta' : 'alpha',
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');
