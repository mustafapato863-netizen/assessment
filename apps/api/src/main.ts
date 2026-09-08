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

  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

void bootstrap();
