import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { authMiddleware } from './auth.middleware';
import { actorStorage, getActorContext } from './actor.context';
import { createTestJwt } from './jwt.util';
import { APP_ROLES } from './auth.types';

function createMockReqRes(options?: {
  method?: string;
  url?: string;
  path?: string;
  headers?: Record<string, string | string[] | undefined>;
}) {
  const headers: Record<string, string | string[] | undefined> = {
    ...(options?.headers ?? {}),
  };

  const req = {
    method: options?.method ?? 'GET',
    url: options?.url ?? '/api/v1/assessflow/cases',
    path: options?.path ?? options?.url ?? '/api/v1/assessflow/cases',
    originalUrl: options?.url ?? '/api/v1/assessflow/cases',
    headers,
  } as unknown as Request;

  const responseHeaders: Record<string, string | number> = {};
  let statusCode = 200;
  let jsonBody: unknown = undefined;

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

describe('authMiddleware', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.ENTRA_ISSUER_URL;
    delete process.env.ENTRA_CLIENT_ID;
    delete process.env.ENTRA_PUBLIC_KEY;
    delete process.env.ENTRA_SKIP_SIGNATURE_VERIFY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('Auth OFF Path (zero-config local dev)', () => {
    it('defaults to demo-user with all roles when headers are absent', () => {
      const { req, res, next } = createMockReqRes();

      authMiddleware(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(res.statusCode).toBe(200);

      const actor = (req as any).actor;
      expect(actor).toBeDefined();
      expect(actor.id).toBe('demo-user');
      expect(actor.name).toBe('Demo user');
      expect(actor.roles).toEqual([...APP_ROLES]);
    });

    it('reads custom x-actor-id, x-actor-name, and x-actor-roles headers', () => {
      const { req, res, next } = createMockReqRes({
        headers: {
          'x-actor-id': 'custom-dev-1',
          'x-actor-name': 'Dev Lead',
          'x-actor-roles': 'Requester,HR',
        },
      });

      authMiddleware(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      const actor = (req as any).actor;
      expect(actor.id).toBe('custom-dev-1');
      expect(actor.name).toBe('Dev Lead');
      expect(actor.roles).toEqual(['Requester', 'HR']);
    });

    it('threads actor into AsyncLocalStorage (actorStorage) during request', () => {
      const { req, res, next } = createMockReqRes({
        headers: {
          'x-actor-id': 'context-user',
          'x-actor-roles': 'Coordinator',
        },
      });

      let contextActorInsideNext: unknown;
      next.mockImplementation(() => {
        contextActorInsideNext = getActorContext();
      });

      authMiddleware(req, res, next);

      expect(contextActorInsideNext).toEqual({
        id: 'context-user',
        name: 'context-user',
        roles: ['Coordinator'],
      });
    });
  });

  describe('Auth ON Path (Entra ID configured)', () => {
    const issuer = 'https://login.microsoftonline.com/production-tenant/v2.0';
    const clientId = 'entra-client-id-xyz';
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });

    beforeEach(() => {
      process.env.ENTRA_ISSUER_URL = issuer;
      process.env.ENTRA_CLIENT_ID = clientId;
      process.env.ENTRA_PUBLIC_KEY = publicKey.export({ type: 'spki', format: 'pem' }) as string;
    });

    it('denies requests without Authorization header with HTTP 401 and structured error', () => {
      const { req, res, next } = createMockReqRes({
        headers: { 'x-correlation-id': 'test-trace-auth-1' },
      });

      authMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      expect((res as any).getJsonBody()).toEqual({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authorization header with Bearer token is required',
          correlationId: 'test-trace-auth-1',
        },
      });
    });

    it('denies non-Bearer authorization scheme with 401', () => {
      const { req, res, next } = createMockReqRes({
        headers: { authorization: 'Basic dXNlcjpwYXNz' },
      });

      authMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      expect((res as any).getJsonBody().error.code).toBe('UNAUTHORIZED');
    });

    it('denies empty Bearer token with 401', () => {
      const { req, res, next } = createMockReqRes({
        headers: { authorization: 'Bearer ' },
      });

      authMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      expect((res as any).getJsonBody().error.code).toBe('UNAUTHORIZED');
    });

    it('denies invalid/expired Bearer token with 401', () => {
      const expiredToken = createTestJwt(
        {
          oid: 'entra-user-1',
          iss: issuer,
          aud: clientId,
          exp: Math.floor(Date.now() / 1000) - 300,
        },
        { privateKey, alg: 'RS256' },
      );

      const { req, res, next } = createMockReqRes({
        headers: {
          authorization: `Bearer ${expiredToken}`,
          'x-correlation-id': 'trace-expired',
        },
      });

      authMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      const json = (res as any).getJsonBody();
      expect(json.error.code).toBe('UNAUTHORIZED');
      expect(json.error.message).toContain('Token has expired');
      expect(json.error.correlationId).toBe('trace-expired');
    });

    it('verifies valid Bearer token and attaches derived actor', () => {
      const validToken = createTestJwt(
        {
          oid: 'entra-guid-001',
          name: 'Sarah Connor',
          iss: issuer,
          aud: clientId,
          roles: ['PanelLead', 'Assessor'],
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        { privateKey, alg: 'RS256' },
      );

      const { req, res, next } = createMockReqRes({
        headers: { authorization: `Bearer ${validToken}` },
      });

      let actorInsideNext: unknown;
      next.mockImplementation(() => {
        actorInsideNext = getActorContext();
      });

      authMiddleware(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(res.statusCode).toBe(200);

      const expectedActor = {
        id: 'entra-guid-001',
        name: 'Sarah Connor',
        roles: ['PanelLead', 'Assessor'],
      };

      expect((req as any).actor).toEqual(expectedActor);
      expect(actorInsideNext).toEqual(expectedActor);
    });
  });

  describe('Public Endpoints Bypass', () => {
    it('bypasses authentication for /health even when Entra is enabled', () => {
      process.env.ENTRA_ISSUER_URL = 'https://issuer.test';
      process.env.ENTRA_CLIENT_ID = 'client.test';

      const { req, res, next } = createMockReqRes({
        url: '/health',
        path: '/health',
      });

      authMiddleware(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(res.statusCode).toBe(200);
    });

    it('bypasses authentication for /health/ready even when Entra is enabled', () => {
      process.env.ENTRA_ISSUER_URL = 'https://issuer.test';
      process.env.ENTRA_CLIENT_ID = 'client.test';

      const { req, res, next } = createMockReqRes({
        url: '/health/ready',
        path: '/health/ready',
      });

      authMiddleware(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(res.statusCode).toBe(200);
    });
  });
});
