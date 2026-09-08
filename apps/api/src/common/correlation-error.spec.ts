import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { createRateLimiterMiddleware } from './security.middleware';
import { authMiddleware } from '../auth/auth.middleware';
import { RolesGuard } from '../auth/roles.guard';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';

describe('API Error Correlation ID Invariant Verification', () => {
  describe('429 Rate Limiter Errors', () => {
    it('always includes correlationId in rate limited error responses', () => {
      const limiter = createRateLimiterMiddleware({ windowMs: 10_000, maxRequests: 1 });
      const req = {
        method: 'POST',
        path: '/api/v1/assessflow/cases',
        headers: { 'x-correlation-id': 'trace-rate-429' },
        ip: '192.168.1.50',
      } as unknown as Request;

      let statusCode = 0;
      let errorBody: any = null;
      const headers: Record<string, string> = {};

      const res = {
        setHeader: (k: string, v: string) => {
          headers[k.toLowerCase()] = v;
        },
        getHeader: (k: string) => headers[k.toLowerCase()],
        status: (code: number) => {
          statusCode = code;
          return res;
        },
        json: (payload: any) => {
          errorBody = payload;
        },
      } as unknown as Response;

      // 1st request succeeds
      limiter(req, res, () => {});
      // 2nd request exceeds limit
      limiter(req, res, () => {});

      expect(statusCode).toBe(429);
      expect(errorBody).toBeDefined();
      expect(errorBody.error).toBeDefined();
      expect(errorBody.error.code).toBe('RATE_LIMITED');
      expect(errorBody.error.correlationId).toBe('trace-rate-429');
    });
  });

  describe('401 Authentication Errors', () => {
    it('includes correlationId when Entra is enabled and Authorization header is missing', () => {
      process.env.ENTRA_ISSUER_URL = 'https://login.microsoftonline.com/tenant-123/v2.0';
      process.env.ENTRA_CLIENT_ID = 'app-client-123';

      const headers: Record<string, string> = {};
      let statusCode = 0;
      let errorBody: any = null;

      const req = {
        path: '/api/v1/assessflow/cases',
        headers: { 'x-correlation-id': 'corr-auth-missing' },
      } as unknown as Request;

      const res = {
        setHeader: (k: string, v: string) => {
          headers[k.toLowerCase()] = v;
        },
        getHeader: (k: string) => headers[k.toLowerCase()],
        status: (code: number) => {
          statusCode = code;
          return res;
        },
        json: (payload: any) => {
          errorBody = payload;
        },
      } as unknown as Response;

      authMiddleware(req, res, () => {});

      expect(statusCode).toBe(401);
      expect(errorBody.error.code).toBe('UNAUTHORIZED');
      expect(errorBody.error.correlationId).toBe('corr-auth-missing');

      delete process.env.ENTRA_ISSUER_URL;
      delete process.env.ENTRA_CLIENT_ID;
    });

    it('generates a new correlationId if not provided in request', () => {
      process.env.ENTRA_ISSUER_URL = 'https://login.microsoftonline.com/tenant-123/v2.0';
      process.env.ENTRA_CLIENT_ID = 'app-client-123';

      const headers: Record<string, string> = {};
      let errorBody: any = null;

      const req = {
        path: '/api/v1/assessflow/cases',
        headers: {},
      } as unknown as Request;

      const res = {
        setHeader: (k: string, v: string) => {
          headers[k.toLowerCase()] = v;
        },
        getHeader: (k: string) => headers[k.toLowerCase()],
        status: () => res,
        json: (payload: any) => {
          errorBody = payload;
        },
      } as unknown as Response;

      authMiddleware(req, res, () => {});

      expect(errorBody.error.code).toBe('UNAUTHORIZED');
      expect(errorBody.error.correlationId).toMatch(/^corr-[0-9a-f-]+/);

      delete process.env.ENTRA_ISSUER_URL;
      delete process.env.ENTRA_CLIENT_ID;
    });
  });

  describe('403 Authorization Guard Errors', () => {
    it('includes correlationId when role check fails', () => {
      const reflector = {
        getAllAndOverride: (key: string) => {
          if (key === 'roles') return ['HRAdmin'];
          return undefined;
        },
      } as unknown as Reflector;

      const guard = new RolesGuard(reflector);

      const headers: Record<string, string> = {};
      let statusCode = 0;
      let errorBody: any = null;

      const req = {
        headers: {
          'x-correlation-id': 'trace-guard-403',
          'x-actor-roles': 'Requester',
        },
        actor: { id: 'user-1', name: 'User 1', roles: ['Requester'] },
      } as unknown as Request;

      const res = {
        setHeader: (k: string, v: string) => {
          headers[k.toLowerCase()] = v;
        },
        getHeader: (k: string) => headers[k.toLowerCase()],
        status: (code: number) => {
          statusCode = code;
          return res;
        },
        json: (payload: any) => {
          errorBody = payload;
        },
      } as unknown as Response;

      const context = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => req,
          getResponse: () => res,
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(context)).toThrowError();

      try {
        guard.canActivate(context);
      } catch (err: any) {
        const response = err.getResponse ? err.getResponse() : err;
        expect(response.error).toBeDefined();
        expect(response.error.code).toBe('FORBIDDEN');
        expect(response.error.correlationId).toBe('trace-guard-403');
      }
    });
  });
});
