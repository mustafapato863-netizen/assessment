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
import { authMiddleware } from './auth';
import { initObservability } from './common/observability';
import {
  createCorsOriginChecker,
  CORS_ALLOWED_HEADERS,
  CORS_EXPOSED_HEADERS,
} from './common/cors.util';

async function bootstrap() {
  initObservability();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const corsAllowed =
    process.env.CORS_ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGINS;

  app.enableCors({
    origin: createCorsOriginChecker(corsAllowed),
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: CORS_ALLOWED_HEADERS,
    exposedHeaders: CORS_EXPOSED_HEADERS,
  });

  app.use(securityHeadersMiddleware);
  app.use(rateLimiterMiddleware);
  app.use(authMiddleware);
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const port = Number(process.env.PORT ?? 8080);
  await app.listen(port);
}

void bootstrap();
