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
import { gzipSync } from 'node:zlib';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';
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

/** Lightweight zero-dependency JSON gzip compression for payloads >= 1 KB. */
function jsonGzipMiddleware(req: Request, res: Response, next: NextFunction): void {
  const acceptEncoding = req.headers['accept-encoding'];
  if (typeof acceptEncoding !== 'string' || !acceptEncoding.includes('gzip')) {
    return next();
  }
  const origJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    try {
      if (res.headersSent) return origJson(body);
      const serialized = JSON.stringify(body);
      if (!serialized || serialized.length < 1024) {
        return origJson(body);
      }
      const compressed = gzipSync(serialized);
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Vary', 'Accept-Encoding');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Length', compressed.length);
      return res.send(compressed);
    } catch {
      return origJson(body);
    }
  }) as Response['json'];
  next();
}

async function bootstrap() {
  initObservability();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.enableShutdownHooks();

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.disable('x-powered-by');
  expressApp.set('trust proxy', trustProxySetting(process.env.TRUST_PROXY));

  app.enableCors({
    origin: createCorsOriginChecker(process.env.CORS_ALLOWED_ORIGINS),
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: CORS_ALLOWED_HEADERS,
    exposedHeaders: CORS_EXPOSED_HEADERS,
  });

  app.use(securityHeadersMiddleware);
  app.use(rateLimiterMiddleware);
  app.use(jsonGzipMiddleware);
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const port = Number(process.env.PORT ?? 8080);
  await app.listen(port);
}

validateProductionEnvironment();
void bootstrap();
