import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
} from '@nestjs/common';
import { Prisma } from '@assessflow/database';
import { describe, expect, it, vi } from 'vitest';
import { HttpExceptionFilter } from './http-exception.filter';

function createMockHost(correlationId = 'corr-test-1') {
  const headers: Record<string, string | number> = {};
  let statusCode = 200;
  let body: unknown;

  const response = {
    setHeader: vi.fn((k: string, v: string | number) => {
      headers[k.toLowerCase()] = v;
    }),
    status: vi.fn((code: number) => {
      statusCode = code;
      return response;
    }),
    json: vi.fn((payload: unknown) => {
      body = payload;
      return response;
    }),
  };

  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ correlationId, headers: {} }),
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  return {
    host,
    getResult: () => ({ statusCode, body: body as Record<string, any>, headers }),
  };
}

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  it('normalizes NestJS HttpException with string or array message into error envelope', () => {
    const mock = createMockHost('corr-abc');
    filter.catch(new BadRequestException('Bad field value'), mock.host);
    const { statusCode, body, headers } = mock.getResult();
    expect(statusCode).toBe(400);
    expect(headers['x-correlation-id']).toBe('corr-abc');
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('Bad field value');
    expect(body.error.correlationId).toBe('corr-abc');
  });

  it('propagates Retry-After header when HttpException carries retryAfterSeconds', () => {
    const mock = createMockHost('corr-rate');
    const exc = new HttpException(
      { error: { code: 'RATE_LIMITED', message: 'Too many requests', retryAfterSeconds: 42 } },
      HttpStatus.TOO_MANY_REQUESTS,
    );
    filter.catch(exc, mock.host);
    const { statusCode, body, headers } = mock.getResult();
    expect(statusCode).toBe(429);
    expect(headers['retry-after']).toBe(42);
    expect(body.error.code).toBe('RATE_LIMITED');
  });

  it('formats ZodError issues into fieldErrors with VALIDATION_ERROR code', () => {
    const mock = createMockHost('corr-zod');
    const zodErr = Object.assign(new Error('Validation failed'), {
      name: 'ZodError',
      issues: [{ message: 'Must be a valid @saudigerman.com email' }],
      flatten: () => ({ fieldErrors: { email: ['Must be a valid @saudigerman.com email'] } }),
    });
    filter.catch(zodErr, mock.host);
    const { statusCode, body } = mock.getResult();
    expect(statusCode).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('Must be a valid @saudigerman.com email');
    expect(body.error.fieldErrors.email?.length).toBeGreaterThan(0);
  });

  it('maps Prisma P2023/P2025 to 404 RESOURCE_NOT_FOUND and P2002 to 409 CONFLICT', () => {
    const notFoundMock = createMockHost('corr-nf');
    const p2023 = new Prisma.PrismaClientKnownRequestError('Invalid uuid', {
      code: 'P2023',
      clientVersion: '6.0.0',
    });
    filter.catch(p2023, notFoundMock.host);
    expect(notFoundMock.getResult().statusCode).toBe(404);
    expect(notFoundMock.getResult().body.error.code).toBe('RESOURCE_NOT_FOUND');

    const conflictMock = createMockHost('corr-cf');
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique failed', {
      code: 'P2002',
      clientVersion: '6.0.0',
    });
    filter.catch(p2002, conflictMock.host);
    expect(conflictMock.getResult().statusCode).toBe(409);
    expect(conflictMock.getResult().body.error.code).toBe('CONFLICT');
  });

  it('hides internal details on unexpected 500 errors', () => {
    const mock = createMockHost('corr-500');
    filter.catch(new Error('secret db connection string'), mock.host);
    const { statusCode, body } = mock.getResult();
    expect(statusCode).toBe(500);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).not.toContain('secret db');
  });

  it('preserves structured ConflictException metadata', () => {
    const mock = createMockHost('corr-409');
    filter.catch(
      new ConflictException({ code: 'STALE_VERSION', message: 'Refresh first' }),
      mock.host,
    );
    const { statusCode, body } = mock.getResult();
    expect(statusCode).toBe(409);
    expect(body.error.code).toBe('STALE_VERSION');
    expect(body.error.message).toBe('Refresh first');
  });
});
