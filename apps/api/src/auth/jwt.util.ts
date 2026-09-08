import crypto from 'node:crypto';
import { AppRole, AuthActor, normalizeRole } from './auth.types';

export interface JwtHeader {
  alg: string;
  typ?: string;
  kid?: string;
}

export interface JwtClaims {
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  oid?: string;
  name?: string;
  preferred_username?: string;
  email?: string;
  roles?: string[] | string;
  groups?: string[] | string;
  role?: string[] | string;
  scp?: string;
  [key: string]: unknown;
}

export interface VerifyJwtOptions {
  issuer?: string;
  clientId?: string;
  publicKey?: string | crypto.KeyObject;
  secret?: string;
  skipSignatureVerify?: boolean;
  clockToleranceSec?: number;
}

export interface DecodedJwt {
  header: JwtHeader;
  payload: JwtClaims;
  signature: string;
  signedContent: string;
}

/**
 * Splits and decodes a raw JWT string into header, payload, and signature.
 */
export function decodeJwt(token: string): DecodedJwt {
  if (typeof token !== 'string' || !token.trim()) {
    throw new Error('JWT must be a non-empty string');
  }

  const parts = token.trim().split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed JWT: must contain exactly 3 dot-separated parts');
  }

  const [headerB64, payloadB64, signature] = parts as [string, string, string];

  let header: JwtHeader;
  try {
    const headerStr = Buffer.from(headerB64, 'base64url').toString('utf8');
    header = JSON.parse(headerStr);
  } catch {
    throw new Error('Malformed JWT header: invalid base64url or JSON');
  }

  let payload: JwtClaims;
  try {
    const payloadStr = Buffer.from(payloadB64, 'base64url').toString('utf8');
    payload = JSON.parse(payloadStr);
  } catch {
    throw new Error('Malformed JWT payload: invalid base64url or JSON');
  }

  return {
    header,
    payload,
    signature,
    signedContent: `${headerB64}.${payloadB64}`,
  };
}

/**
 * Extracts normalized AppRoles from JWT claims.
 */
export function extractRolesFromClaims(payload: JwtClaims): AppRole[] {
  const candidates: string[] = [];

  // Check roles claim (array or string)
  if (Array.isArray(payload.roles)) {
    candidates.push(...payload.roles.map(String));
  } else if (typeof payload.roles === 'string') {
    candidates.push(...payload.roles.split(','));
  }

  // Check role claim
  if (Array.isArray(payload.role)) {
    candidates.push(...payload.role.map(String));
  } else if (typeof payload.role === 'string') {
    candidates.push(...payload.role.split(','));
  }

  // Check groups claim
  if (Array.isArray(payload.groups)) {
    candidates.push(...payload.groups.map(String));
  } else if (typeof payload.groups === 'string') {
    candidates.push(...payload.groups.split(','));
  }

  // Check scp (scope) claim
  if (typeof payload.scp === 'string') {
    candidates.push(...payload.scp.split(' '));
  }

  const roles = new Set<AppRole>();
  for (const candidate of candidates) {
    const normalized = normalizeRole(candidate);
    if (normalized) {
      roles.add(normalized);
    }
  }

  return [...roles];
}

/**
 * Verifies JWT signature and claims using standard node:crypto.
 * Derives and returns an AuthActor ({ id, name, roles }).
 */
export function verifyEntraJwt(token: string, options: VerifyJwtOptions): AuthActor {
  const { header, payload, signature, signedContent } = decodeJwt(token);

  // 1. Signature Verification
  if (!options.skipSignatureVerify) {
    const alg = header.alg?.toUpperCase();
    if (alg === 'RS256') {
      const pubKey = options.publicKey ?? process.env.ENTRA_PUBLIC_KEY;
      if (!pubKey) {
        // If signature check is required but no key provided, fail
        throw new Error('Public key required to verify RS256 signature');
      }

      const sigBuffer = Buffer.from(signature, 'base64url');
      const valid = crypto.verify(
        'RSA-SHA256',
        Buffer.from(signedContent, 'utf8'),
        pubKey,
        sigBuffer,
      );

      if (!valid) {
        throw new Error('JWT signature verification failed');
      }
    } else if (alg === 'HS256') {
      const secret =
        options.secret ?? process.env.ENTRA_CLIENT_SECRET ?? process.env.ENTRA_SIGNING_KEY;
      if (!secret) {
        throw new Error('Secret required to verify HS256 signature');
      }

      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(signedContent);
      const expectedSig = hmac.digest();
      const actualSig = Buffer.from(signature, 'base64url');

      if (
        expectedSig.length !== actualSig.length ||
        !crypto.timingSafeEqual(expectedSig, actualSig)
      ) {
        throw new Error('JWT signature verification failed');
      }
    } else {
      throw new Error(`Unsupported JWT algorithm: ${header.alg}`);
    }
  }

  // 2. Claim Validation
  const now = Math.floor(Date.now() / 1000);
  const tolerance = options.clockToleranceSec ?? 60;

  // Expiration check
  if (typeof payload.exp === 'number') {
    if (now > payload.exp + tolerance) {
      throw new Error(`Token has expired (exp: ${payload.exp}, now: ${now})`);
    }
  }

  // Not Before check
  if (typeof payload.nbf === 'number') {
    if (now < payload.nbf - tolerance) {
      throw new Error(`Token is not active yet (nbf: ${payload.nbf}, now: ${now})`);
    }
  }

  // Issuer check
  if (options.issuer) {
    const expectedIssuer = options.issuer.trim().replace(/\/+$/, '');
    const actualIssuer = (payload.iss ?? '').trim().replace(/\/+$/, '');
    if (expectedIssuer !== actualIssuer) {
      throw new Error(`Issuer mismatch: expected '${expectedIssuer}', received '${actualIssuer}'`);
    }
  }

  // Audience check
  if (options.clientId) {
    const expectedAud = options.clientId.trim();
    const actualAud = payload.aud;
    const matches = Array.isArray(actualAud)
      ? actualAud.map((a) => String(a).trim()).includes(expectedAud)
      : typeof actualAud === 'string' && actualAud.trim() === expectedAud;

    if (!matches) {
      throw new Error(
        `Audience mismatch: expected '${expectedAud}', received '${JSON.stringify(actualAud)}'`,
      );
    }
  }

  // 3. Derive Actor
  const id = (payload.oid || payload.sub || payload.uid) as string | undefined;
  if (!id || !String(id).trim()) {
    throw new Error('Token is missing user identifier claim (oid or sub required)');
  }

  const name = (payload.name || payload.preferred_username || payload.email || id) as string;

  const roles = extractRolesFromClaims(payload);

  return {
    id: String(id).trim(),
    name: String(name).trim(),
    roles,
  };
}

/**
 * Test helper: signs a JWT payload with an RSA private key or HMAC secret.
 */
export function createTestJwt(
  payload: Partial<JwtClaims>,
  options: {
    privateKey?: string | crypto.KeyObject;
    secret?: string;
    alg?: 'RS256' | 'HS256';
    header?: Partial<JwtHeader>;
  } = {},
): string {
  const alg = options.alg ?? (options.privateKey ? 'RS256' : 'HS256');
  const header: JwtHeader = {
    alg,
    typ: 'JWT',
    ...options.header,
  };

  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signedContent = `${headerB64}.${payloadB64}`;

  let signatureB64: string;
  if (alg === 'RS256') {
    if (!options.privateKey) {
      throw new Error('privateKey is required for RS256 test JWT creation');
    }
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signedContent);
    signatureB64 = sign.sign(options.privateKey, 'base64url');
  } else {
    const secret = options.secret ?? 'test-secret';
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(signedContent);
    signatureB64 = hmac.digest('base64url');
  }

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}
