// Backend бүрд ижил env унших дэлгэц.
//   POSTGRES_HOST, PORT, USER, PASSWORD, DB — DB pool-т
//   JWT_SECRET — auth
//   DD_AGENT_HOST, DD_DOGSTATSD_PORT — telemetry (заавал биш)
//   IMPLEMENTATION — 'alpha' (default) эсвэл 'beta' (fixed) — R5 feature flag

export const VARIANT_NAME = 'nestjs-raw';
export const HTTP_PORT = 3001;

export interface AppConfig {
  postgres: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  telemetry: {
    host: string;
    port: number;
    enabled: boolean;
  };
  implementation: 'alpha' | 'beta';
}

export function loadConfig(): AppConfig {
  const impl = process.env.IMPLEMENTATION === 'beta' ? 'beta' : 'alpha';
  return {
    postgres: {
      host: process.env.POSTGRES_HOST ?? 'localhost',
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      user: process.env.POSTGRES_USER ?? 'postgres',
      password: process.env.POSTGRES_PASSWORD ?? 'research123',
      database: process.env.POSTGRES_DB ?? 'shop',
    },
    jwt: {
      secret: process.env.JWT_SECRET ?? 'research-jwt-secret',
      expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    },
    telemetry: {
      host: process.env.DD_AGENT_HOST ?? 'datadog',
      port: Number(process.env.DD_DOGSTATSD_PORT ?? 8125),
      enabled: process.env.DD_AGENT_HOST !== undefined,
    },
    implementation: impl,
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');
