import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AuthActor } from './auth.types';

interface AppTokenClaims extends AuthActor {
  exp: number;
  iat: number;
}

function signingSecret(): string {
  const configured = process.env.AUTH_JWT_SECRET?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_JWT_SECRET must be configured in production.');
  }
  return 'assessflow-local-development-secret-change-before-deployment';
}

function sign(content: string): string {
  return createHmac('sha256', signingSecret()).update(content).digest('base64url');
}

export function createAppToken(actor: AuthActor): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const claims: AppTokenClaims = { ...actor, iat: now, exp: now + 8 * 60 * 60 };
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const content = `${header}.${payload}`;
  return `${content}.${sign(content)}`;
}

export function verifyAppToken(token: string): AuthActor {
  const [headerPart, payloadPart, signature, extra] = token.split('.');
  if (!headerPart || !payloadPart || !signature || extra) throw new Error('Invalid session token.');
  const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8')) as {
    alg?: string;
  };
  if (header.alg !== 'HS256') throw new Error('Invalid session token.');
  const content = `${headerPart}.${payloadPart}`;
  const expected = Buffer.from(sign(content), 'base64url');
  const actual = Buffer.from(signature, 'base64url');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error('Invalid session token.');
  }
  const claims = JSON.parse(
    Buffer.from(payloadPart, 'base64url').toString('utf8'),
  ) as AppTokenClaims;
  if (!claims.exp || claims.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error('Session token expired.');
  }
  return {
    id: claims.id,
    name: claims.name,
    email: claims.email,
    roles: claims.roles,
    scopeType: claims.scopeType,
    scopeValues: claims.scopeValues,
  };
}
