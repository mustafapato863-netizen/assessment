import 'reflect-metadata';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
if (typeof process.loadEnvFile === 'function') {
  for (const envPath of ['.env', '../.env', '../../.env']) {
    const fullPath = resolve(process.cwd(), envPath);
    if (existsSync(fullPath)) {
      try {
        process.loadEnvFile(fullPath);
        break;
      } catch {}
    }
  }
}
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import { securityHeadersMiddleware, rateLimiterMiddleware } from './common/security.middleware';
import { initObservability } from './common/observability';
import { validateProductionEnvironment } from './common/environment.validation';
import {
  createCorsOriginChecker,
  CORS_ALLOWED_HEADERS,
  CORS_EXPOSED_HEADERS,
} from './common/cors.util';

/** Express 'trust proxy' value: hop count, true/false, or an address/subnet list. */
function trustProxySetting(raw: string | undefined): number | boolean | string {
  const value = raw?.trim();
  if (!value) return 'loopback, linklocal, uniquelocal';
  if (/^\d+$/.test(value)) return Number(value);
  if (value === 'true' || value === 'false') return value === 'true';
  return value;
}

async function bootstrap() {
  initObservability();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  // Only trust X-Forwarded-For from known proxies so req.ip (rate limits,
  // sign-in lockout) cannot be spoofed. Default trusts private-network proxies
  // (Docker, nginx, a load balancer on the VNet). Set TRUST_PROXY to a hop count
  // or address list if the API sits behind a public CDN or proxy.
  app.getHttpAdapter().getInstance().set('trust proxy', trustProxySetting(process.env.TRUST_PROXY));

  app.enableCors({
    origin: createCorsOriginChecker(process.env.CORS_ALLOWED_ORIGINS),
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: CORS_ALLOWED_HEADERS,
    exposedHeaders: CORS_EXPOSED_HEADERS,
  });

  app.use(securityHeadersMiddleware);
  app.use(rateLimiterMiddleware);
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const port = Number(process.env.PORT ?? 8080);
  await app.listen(port);
}

validateProductionEnvironment();
void bootstrap();
