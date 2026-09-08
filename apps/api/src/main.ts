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

async function bootstrap() {
  initObservability();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.use(securityHeadersMiddleware);
  app.use(rateLimiterMiddleware);
  app.use(authMiddleware);

  const corsAllowed = process.env.CORS_ALLOWED_ORIGINS;
  let corsOrigin: boolean | ((origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void) = true;

  if (corsAllowed && corsAllowed.trim() !== '' && corsAllowed.trim() !== '*') {
    const allowedList = corsAllowed.split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean);
    corsOrigin = (origin, callback) => {
      // Allow requests with no origin (such as server-to-server, curl, mobile apps)
      if (!origin) {
        return callback(null, true);
      }
      const normalizedOrigin = origin.trim().replace(/\/$/, '');
      if (allowedList.includes(normalizedOrigin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    };
  }

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-correlation-id', 'idempotency-key'],
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

void bootstrap();
