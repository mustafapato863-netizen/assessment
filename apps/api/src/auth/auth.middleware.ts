import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { APP_ROLES, AppRole, AuthActor, normalizeRole } from './auth.types';
import { actorStorage } from './actor.context';
import { verifyEntraJwt } from './jwt.util';

/**
 * Resolves correlation ID from request or generates a fallback.
 */
function resolveCorrelationId(req: Request, res: Response): string {
  const existing =
    (res.getHeader('x-correlation-id') as string) ||
    (req as unknown as { correlationId?: string }).correlationId ||
    (req.headers['x-correlation-id'] as string) ||
    (req.headers['X-Correlation-ID'] as string);

  return existing && existing.trim().length > 0 ? existing.trim() : `corr-${randomUUID()}`;
}

/**
 * Entra ID OIDC Authentication Middleware.
 *
 * When ENTRA_ISSUER_URL and ENTRA_CLIENT_ID are set:
 * - Requires Authorization: Bearer <token>
 * - Validates JWT signature and claims (iss, aud, exp, nbf)
 * - Derives { id, name, roles } from claims
 * - Denies unauthenticated requests with HTTP 401:
 *   { error: { code: 'UNAUTHORIZED', message, correlationId } }
 *
 * When ENTRA_ISSUER_URL or ENTRA_CLIENT_ID is unset:
 * - Local development stub path with zero config
 * - Reads identity from headers: x-actor-id (default: demo-user), x-actor-name, x-actor-roles
 * - If x-actor-roles is not specified, grants all app roles to maintain seamless local dev
 *
 * In all cases:
 * - Propagates verified actor into AsyncLocalStorage (actorStorage) for downstream access
 * - Attaches actor to req.actor and req.user
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Preflight OPTIONS requests must bypass authentication to allow CORS handshake
  if (req.method === 'OPTIONS') {
    return next();
  }

  // Public health endpoints bypass authentication
  const rawPath = req.path || req.originalUrl?.split('?')[0] || req.url?.split('?')[0] || '';
  const normalizedPath = rawPath.replace(/\/+/g, '/');

  if (normalizedPath === '/health' || normalizedPath === '/health/ready') {
    return next();
  }

  const entraIssuer = process.env.ENTRA_ISSUER_URL?.trim();
  const entraClientId = process.env.ENTRA_CLIENT_ID?.trim();
  const isEntraEnabled = Boolean(entraIssuer && entraClientId);

  let actor: AuthActor;

  if (isEntraEnabled) {
    const rawAuth = req.headers['authorization'] ?? req.headers['Authorization'];
    const authHeader = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;

    if (
      !authHeader ||
      typeof authHeader !== 'string' ||
      !authHeader.toLowerCase().startsWith('bearer ')
    ) {
      const correlationId = resolveCorrelationId(req, res);
      res.setHeader('x-correlation-id', correlationId);

      const errorPayload = {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authorization header with Bearer token is required',
          correlationId,
        },
      };

      res.status(401).json(errorPayload);
      return;
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      const correlationId = resolveCorrelationId(req, res);
      res.setHeader('x-correlation-id', correlationId);

      const errorPayload = {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Bearer token must not be empty',
          correlationId,
        },
      };

      res.status(401).json(errorPayload);
      return;
    }

    try {
      actor = verifyEntraJwt(token, {
        issuer: entraIssuer,
        clientId: entraClientId,
        publicKey: process.env.ENTRA_PUBLIC_KEY,
        secret: process.env.ENTRA_CLIENT_SECRET ?? process.env.ENTRA_SIGNING_KEY,
        skipSignatureVerify: process.env.ENTRA_SKIP_SIGNATURE_VERIFY === 'true',
      });
    } catch (err: unknown) {
      const correlationId = resolveCorrelationId(req, res);
      res.setHeader('x-correlation-id', correlationId);

      const message = err instanceof Error ? err.message : 'Invalid or expired token';
      const errorPayload = {
        error: {
          code: 'UNAUTHORIZED',
          message,
          correlationId,
        },
      };

      res.status(401).json(errorPayload);
      return;
    }
  } else {
    // Stub path: zero config local development
    const rawActorId = req.headers['x-actor-id'] ?? req.headers['X-Actor-ID'];
    const actorIdCandidate = Array.isArray(rawActorId) ? rawActorId[0] : rawActorId;
    const actorId =
      typeof actorIdCandidate === 'string' && actorIdCandidate.trim().length > 0
        ? actorIdCandidate.trim()
        : 'demo-user';

    const rawActorName = req.headers['x-actor-name'] ?? req.headers['X-Actor-Name'];
    const actorNameCandidate = Array.isArray(rawActorName) ? rawActorName[0] : rawActorName;
    const actorName =
      typeof actorNameCandidate === 'string' && actorNameCandidate.trim().length > 0
        ? actorNameCandidate.trim()
        : actorId === 'demo-user'
          ? 'Demo user'
          : actorId;

    const rawRoles = req.headers['x-actor-roles'] ?? req.headers['X-Actor-Roles'];
    const rolesCandidate = Array.isArray(rawRoles) ? rawRoles.join(',') : rawRoles;

    let roles: AppRole[];
    if (typeof rolesCandidate === 'string' && rolesCandidate.trim().length > 0) {
      const parsedRoles = rolesCandidate
        .split(',')
        .map((r) => normalizeRole(r.trim()))
        .filter((r): r is AppRole => r !== undefined);

      roles = parsedRoles.length > 0 ? parsedRoles : ['Requester'];
    } else {
      // Local dev zero-config default: all roles granted to demo-user
      roles = [...APP_ROLES];
    }

    actor = {
      id: actorId,
      name: actorName,
      roles,
    };
  }

  // Attach actor to request
  (req as unknown as { actor?: AuthActor }).actor = actor;
  (req as unknown as { user?: AuthActor }).user = actor;

  // Run downstream operations in the actor context
  actorStorage.run(actor, () => {
    next();
  });
}
