import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

/**
 * Global Security Headers & Request Correlation Middleware.
 *
 * Sets hardened HTTP response headers on every response:
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: DENY
 * - Referrer-Policy: no-referrer
 * - Permissions-Policy: camera=(),microphone=(),geolocation=()
 * - Cross-Origin-Opener-Policy: same-origin
 * - Strict-Transport-Security: max-age=31536000 (production only)
 *
 * Propagates request correlation ID:
 * - Reads incoming x-correlation-id header or generates `corr-<randomUUID>`
 * - Sets x-correlation-id response header
 * - Stashes correlationId on req.headers and req.correlationId for downstream access
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

  const rawHeader = req.headers['x-correlation-id'] ?? req.headers['X-Correlation-ID'];
  const candidate = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  const correlationId =
    typeof candidate === 'string' && candidate.trim().length > 0
      ? candidate.trim()
      : `corr-${randomUUID()}`;

  res.setHeader('x-correlation-id', correlationId);
  req.headers['x-correlation-id'] = correlationId;
  (req as unknown as { correlationId?: string }).correlationId = correlationId;

  next();
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
 *
 * Applied ONLY to POST command routes under /api/v1/assessflow (skips GET/health).
 * Defaults to 120 requests per minute per client IP.
 * Responds with HTTP 429 and structured error shape:
 * { error: { code: 'RATE_LIMITED', message, correlationId } }
 *
 * NOTE (Production Follow-up):
 * For multi-instance, horizontally-scaled production environments, replace this
 * in-memory Map store with a distributed rate limiter backed by Redis (e.g. using
 * Redis INCR with EXPIRE, a sliding-window Lua script, or @nestjs-throttler with
 * a Redis storage provider) so that rate limits are shared across all cluster nodes.
 */
export function createRateLimiterMiddleware(options?: RateLimiterOptions): RateLimiterHandler {
  const windowMs = options?.windowMs ?? 60_000; // 1 minute window
  const maxRequests = options?.maxRequests ?? 120; // 120 requests per window
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
    // Applied ONLY to POST command routes under /api/v1/assessflow (skip GET, health, etc.)
    if (req.method !== 'POST') {
      return next();
    }

    const rawPath = req.path || req.originalUrl?.split('?')[0] || req.url?.split('?')[0] || '';
    const normalizedPath = rawPath.replace(/\/+/g, '/');

    if (!normalizedPath.startsWith('/api/v1/assessflow')) {
      return next();
    }

    // Resolve client IP
    const forwarded = req.headers['x-forwarded-for'];
    const forwardedIp =
      typeof forwarded === 'string'
        ? forwarded.split(',')[0]?.trim()
        : Array.isArray(forwarded)
          ? forwarded[0]?.split(',')[0]?.trim()
          : undefined;

    const clientIp = forwardedIp || req.ip || req.socket?.remoteAddress || '127.0.0.1';

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
