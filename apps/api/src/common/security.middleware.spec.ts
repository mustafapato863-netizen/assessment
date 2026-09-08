import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import {
  createRateLimiterMiddleware,
  rateLimiterMiddleware,
  securityHeadersMiddleware,
} from './security.middleware';

function createMockReqRes(options?: {
  method?: string;
  url?: string;
  path?: string;
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}) {
  const headers: Record<string, string | string[] | undefined> = {
    ...(options?.headers ?? {}),
  };

  const req = {
    method: options?.method ?? 'GET',
    url: options?.url ?? '/',
    path: options?.path ?? options?.url ?? '/',
    originalUrl: options?.url ?? '/',
    ip: options?.ip ?? '127.0.0.1',
    headers,
    socket: { remoteAddress: options?.ip ?? '127.0.0.1' },
  } as unknown as Request;

  const responseHeaders: Record<string, string | number> = {};
  let statusCode = 200;
  let jsonBody: unknown = undefined;
  let rawBody: string | undefined = undefined;

  const res = {
    statusCode,
    setHeader: vi.fn((key: string, value: string | number) => {
      responseHeaders[key.toLowerCase()] = value;
      return res;
    }),
    getHeader: vi.fn((key: string) => {
      return responseHeaders[key.toLowerCase()];
    }),
    status: vi.fn((code: number) => {
      res.statusCode = code;
      statusCode = code;
      return res;
    }),
    json: vi.fn((body: unknown) => {
      jsonBody = body;
      return res;
    }),
    end: vi.fn((data?: string) => {
      rawBody = data;
      return res;
    }),
  } as unknown as Response & {
    responseHeaders: Record<string, string | number>;
    getJsonBody: () => unknown;
    getStatusCode: () => number;
  };

  Object.defineProperty(res, 'responseHeaders', { get: () => responseHeaders });
  Object.defineProperty(res, 'getJsonBody', { get: () => () => jsonBody });
  Object.defineProperty(res, 'getStatusCode', { get: () => statusCode });

  return { req, res, next: vi.fn() };
}

describe('securityHeadersMiddleware', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('sets required security headers on responses in development/test', () => {
    process.env.NODE_ENV = 'test';
    const { req, res, next } = createMockReqRes();

    securityHeadersMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.responseHeaders['x-content-type-options']).toBe('nosniff');
    expect(res.responseHeaders['x-frame-options']).toBe('DENY');
    expect(res.responseHeaders['referrer-policy']).toBe('no-referrer');
    expect(res.responseHeaders['permissions-policy']).toBe(
      'camera=(),microphone=(),geolocation=()',
    );
    expect(res.responseHeaders['cross-origin-opener-policy']).toBe('same-origin');
    expect(res.responseHeaders['strict-transport-security']).toBeUndefined();
  });

  it('sets Strict-Transport-Security when NODE_ENV is production', () => {
    process.env.NODE_ENV = 'production';
    const { req, res, next } = createMockReqRes();

    securityHeadersMiddleware(req, res, next);

    expect(res.responseHeaders['strict-transport-security']).toBe('max-age=31536000');
  });

  it('generates corr-<uuid> when x-correlation-id is not provided', () => {
    const { req, res, next } = createMockReqRes();

    securityHeadersMiddleware(req, res, next);

    const corrId = res.responseHeaders['x-correlation-id'] as string;
    expect(corrId).toBeDefined();
    expect(corrId.startsWith('corr-')).toBe(true);
    expect(req.headers['x-correlation-id']).toBe(corrId);
    expect((req as unknown as { correlationId?: string }).correlationId).toBe(corrId);
    expect(next).toHaveBeenCalledOnce();
  });

  it('echoes incoming x-correlation-id when provided', () => {
    const { req, res, next } = createMockReqRes({
      headers: { 'x-correlation-id': 'custom-trace-999' },
    });

    securityHeadersMiddleware(req, res, next);

    expect(res.responseHeaders['x-correlation-id']).toBe('custom-trace-999');
    expect(req.headers['x-correlation-id']).toBe('custom-trace-999');
    expect((req as unknown as { correlationId?: string }).correlationId).toBe('custom-trace-999');
  });
});

describe('rateLimiterMiddleware', () => {
  it('skips non-POST requests', () => {
    const { req, res, next } = createMockReqRes({
      method: 'GET',
      url: '/api/v1/assessflow/cases',
      path: '/api/v1/assessflow/cases',
    });

    rateLimiterMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
  });

  it('skips POST requests outside /api/v1/assessflow (e.g. health checks)', () => {
    const { req, res, next } = createMockReqRes({
      method: 'POST',
      url: '/health',
      path: '/health',
    });

    rateLimiterMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
  });

  it('allows POST requests to /api/v1/assessflow within limit', () => {
    const limiter = createRateLimiterMiddleware({
      windowMs: 60_000,
      maxRequests: 3,
    });
    limiter.stopSweep();

    for (let i = 0; i < 3; i++) {
      const { req, res, next } = createMockReqRes({
        method: 'POST',
        url: '/api/v1/assessflow/cases',
        path: '/api/v1/assessflow/cases',
        ip: '10.0.0.1',
      });
      limiter(req, res, next);
      expect(next).toHaveBeenCalledOnce();
    }
  });

  it('blocks requests exceeding limit with 429 and structured error shape', () => {
    const limiter = createRateLimiterMiddleware({
      windowMs: 60_000,
      maxRequests: 2,
    });
    limiter.stopSweep();

    const clientIp = '192.168.1.50';

    // Request 1: allowed
    const req1 = createMockReqRes({
      method: 'POST',
      url: '/api/v1/assessflow/cases',
      path: '/api/v1/assessflow/cases',
      ip: clientIp,
    });
    limiter(req1.req, req1.res, req1.next);
    expect(req1.next).toHaveBeenCalledOnce();

    // Request 2: allowed
    const req2 = createMockReqRes({
      method: 'POST',
      url: '/api/v1/assessflow/cases',
      path: '/api/v1/assessflow/cases',
      ip: clientIp,
    });
    limiter(req2.req, req2.res, req2.next);
    expect(req2.next).toHaveBeenCalledOnce();

    // Request 3: blocked
    const req3 = createMockReqRes({
      method: 'POST',
      url: '/api/v1/assessflow/cases',
      path: '/api/v1/assessflow/cases',
      ip: clientIp,
      headers: { 'x-correlation-id': 'test-corr-429' },
    });
    limiter(req3.req, req3.res, req3.next);

    expect(req3.next).not.toHaveBeenCalled();
    expect(req3.res.statusCode).toBe(429);
    expect(req3.res.responseHeaders['retry-after']).toBeGreaterThan(0);
    expect(req3.res.responseHeaders['x-correlation-id']).toBe('test-corr-429');

    const json = (req3.res as any).getJsonBody();
    expect(json).toEqual({
      error: {
        code: 'RATE_LIMITED',
        message: 'Rate limit exceeded. Please try again later.',
        correlationId: 'test-corr-429',
      },
    });
  });

  it('tracks different client IPs independently', () => {
    const limiter = createRateLimiterMiddleware({
      windowMs: 60_000,
      maxRequests: 1,
    });
    limiter.stopSweep();

    // IP 1: request 1 allowed
    const r1 = createMockReqRes({
      method: 'POST',
      url: '/api/v1/assessflow/cases',
      path: '/api/v1/assessflow/cases',
      ip: '10.0.0.1',
    });
    limiter(r1.req, r1.res, r1.next);
    expect(r1.next).toHaveBeenCalledOnce();

    // IP 1: request 2 blocked
    const r2 = createMockReqRes({
      method: 'POST',
      url: '/api/v1/assessflow/cases',
      path: '/api/v1/assessflow/cases',
      ip: '10.0.0.1',
    });
    limiter(r2.req, r2.res, r2.next);
    expect(r2.next).not.toHaveBeenCalled();
    expect(r2.res.statusCode).toBe(429);

    // IP 2: request 1 allowed (independent quota)
    const r3 = createMockReqRes({
      method: 'POST',
      url: '/api/v1/assessflow/cases',
      path: '/api/v1/assessflow/cases',
      ip: '10.0.0.2',
    });
    limiter(r3.req, r3.res, r3.next);
    expect(r3.next).toHaveBeenCalledOnce();
  });

  it('prunes expired entries during sweep', () => {
    const limiter = createRateLimiterMiddleware({
      windowMs: 100,
      maxRequests: 5,
    });
    limiter.stopSweep();

    const r = createMockReqRes({
      method: 'POST',
      url: '/api/v1/assessflow/cases',
      path: '/api/v1/assessflow/cases',
      ip: '10.1.1.1',
    });
    limiter(r.req, r.res, r.next);
    expect(limiter.store.has('10.1.1.1')).toBe(true);

    // Sweep before expiration: remains
    limiter.sweep(Date.now() - 10);
    expect(limiter.store.has('10.1.1.1')).toBe(true);

    // Sweep after expiration: pruned
    limiter.sweep(Date.now() + 200);
    expect(limiter.store.has('10.1.1.1')).toBe(false);
  });
});
