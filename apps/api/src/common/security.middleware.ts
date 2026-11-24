import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { runWithCorrelationId } from './correlation.context';

const SAFE_CORRELATION_ID = /^[a-zA-Z0-9._-]{1,64}$/;
const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
const HEAVY_GET_PREFIXES = [
  '/api/v1/assessflow/admin/audit',
  '/api/v1/assessflow/calibration/matrix',
];

/**
 * Global Security Headers & Request Correlation Middleware.
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(),microphone=(),geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  }

  const rawPath = req.path || req.originalUrl?.split('?')[0] || req.url?.split('?')[0] || '';
  if (rawPath.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, private');
  }

  const rawHeader = req.headers['x-correlation-id'] ?? req.headers['X-Correlation-ID'];
  const candidate = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  const trimmed = typeof candidate === 'string' ? candidate.trim() : '';
  const correlationId = SAFE_CORRELATION_ID.test(trimmed) ? trimmed : `corr-${randomUUID()}`;

  res.setHeader('x-correlation-id', correlationId);
  req.headers['x-correlation-id'] = correlationId;
  (req as unknown as { correlationId?: string }).correlationId = correlationId;

  runWithCorrelationId(correlationId, () => next());
}

export const securityMiddleware = securityHeadersMiddleware;
export const correlationIdMiddleware = securityHeadersMiddleware;

export interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export interface RateLimiterOptions {
  windowMs?: number;
  maxRequests?: number;
  sweepIntervalMs?: number;
}

export interface RateLimiterHandler {
  (req: Request, res: Response, next: NextFunction): void;
  store: Map<string, RateLimitEntry>;
  sweep: (now?: number) => void;
  stopSweep: () => void;
}

/**
 * Lightweight in-memory fixed-window rate limiter middleware.
 * Covers all mutating methods under /api/v1/assessflow and heavy read queries.
 */
export function createRateLimiterMiddleware(options?: RateLimiterOptions): RateLimiterHandler {
  const windowMs = options?.windowMs ?? 60_000;
  const maxRequests = options?.maxRequests ?? 120;
  const sweepIntervalMs = options?.sweepIntervalMs ?? 60_000;

  const store = new Map<string, RateLimitEntry>();

  const sweep = (now = Date.now()) => {
    for (const [ip, entry] of store.entries()) {
      if (now >= entry.resetTime) {
        store.delete(ip);
      }
    }
  };

  const sweepTimer = setInterval(() => {
    sweep();
  }, sweepIntervalMs);

  if (sweepTimer.unref) {
    sweepTimer.unref();
  }

  const handler = ((req: Request, res: Response, next: NextFunction): void => {
    const rawPath = req.path || req.originalUrl?.split('?')[0] || req.url?.split('?')[0] || '';
    const normalizedPath = rawPath.replace(/\/+/g, '/');

    if (!normalizedPath.startsWith('/api/v1/assessflow')) {
      return next();
    }

    const isMutating = MUTATING_METHODS.has(req.method);
    const isHeavyGet =
      req.method === 'GET' &&
      HEAVY_GET_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix));

    if (!isMutating && !isHeavyGet) {
      return next();
    }

    const clientIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    const now = Date.now();
    let record = store.get(clientIp);

    if (!record || now >= record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      store.set(clientIp, record);
      return next();
    }

    record.count += 1;

    if (record.count > maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
      res.setHeader('Retry-After', retryAfterSeconds);

      const correlationId =
        (res.getHeader('x-correlation-id') as string) ||
        (req.headers['x-correlation-id'] as string) ||
        `corr-${randomUUID()}`;

      res.setHeader('x-correlation-id', correlationId);

      const errorPayload = {
        error: {
          code: 'RATE_LIMITED',
          message: 'Rate limit exceeded. Please try again later.',
          correlationId,
        },
      };

      if (typeof res.status === 'function') {
        res.status(429);
      } else {
        res.statusCode = 429;
      }

      if (typeof res.json === 'function') {
        res.json(errorPayload);
        return;
      }

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(errorPayload));
      return;
    }

    return next();
  }) as RateLimiterHandler;

  handler.store = store;
  handler.sweep = sweep;
  handler.stopSweep = () => clearInterval(sweepTimer);

  return handler;
}

export const rateLimiterMiddleware = createRateLimiterMiddleware();
