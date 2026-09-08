import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { APP_ROLES, AppRole, AuthActor, normalizeRole } from './auth.types';
import { ROLES_KEY, IS_PUBLIC_KEY } from './roles.decorator';
import { getActorContext, setActorContext } from './actor.context';
import { verifyEntraJwt } from './jwt.util';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Check if endpoint is marked @Public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    // 2. Read required roles from route metadata
    const requiredRoles = this.reflector.getAllAndOverride<AppRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles specified on endpoint, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const correlationId =
      (request as unknown as { correlationId?: string })?.correlationId ||
      (request.headers?.['x-correlation-id'] as string) ||
      `corr-${randomUUID()}`;

    // 3. Resolve actor (from middleware or fallback resolution)
    let actor =
      (request as unknown as { actor?: AuthActor })?.actor ||
      (request as unknown as { user?: AuthActor })?.user;

    if (!actor) {
      actor = this.resolveActorFromRequest(request, correlationId);
      (request as unknown as { actor?: AuthActor }).actor = actor;
      (request as unknown as { user?: AuthActor }).user = actor;
      setActorContext(actor);
    }

    // 4. Role Authorization Check
    const hasRole = requiredRoles.some((role) => actor.roles.includes(role));
    if (!hasRole) {
      throw new ForbiddenException({
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Actor '${actor.id}' with roles [${actor.roles.join(', ')}] does not have required role [${requiredRoles.join(', ')}].`,
          correlationId,
        },
      });
    }

    return true;
  }

  private resolveActorFromRequest(req: Request, correlationId: string): AuthActor {
    const entraIssuer = process.env.ENTRA_ISSUER_URL?.trim();
    const entraClientId = process.env.ENTRA_CLIENT_ID?.trim();
    const isEntraEnabled = Boolean(entraIssuer && entraClientId);

    if (isEntraEnabled) {
      const rawAuth = req.headers?.['authorization'] ?? req.headers?.['Authorization'];
      const authHeader = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;

      if (
        !authHeader ||
        typeof authHeader !== 'string' ||
        !authHeader.toLowerCase().startsWith('bearer ')
      ) {
        throw new UnauthorizedException({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authorization header with Bearer token is required',
            correlationId,
          },
        });
      }

      const token = authHeader.slice(7).trim();
      if (!token) {
        throw new UnauthorizedException({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Bearer token must not be empty',
            correlationId,
          },
        });
      }

      try {
        return verifyEntraJwt(token, {
          issuer: entraIssuer,
          clientId: entraClientId,
          publicKey: process.env.ENTRA_PUBLIC_KEY,
          secret: process.env.ENTRA_CLIENT_SECRET ?? process.env.ENTRA_SIGNING_KEY,
          skipSignatureVerify: process.env.ENTRA_SKIP_SIGNATURE_VERIFY === 'true',
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Invalid or expired token';
        throw new UnauthorizedException({
          error: {
            code: 'UNAUTHORIZED',
            message,
            correlationId,
          },
        });
      }
    }

    // Local stub path
    const rawActorId = req.headers?.['x-actor-id'] ?? req.headers?.['X-Actor-ID'];
    const actorIdCandidate = Array.isArray(rawActorId) ? rawActorId[0] : rawActorId;
    const actorId =
      typeof actorIdCandidate === 'string' && actorIdCandidate.trim().length > 0
        ? actorIdCandidate.trim()
        : 'demo-user';

    const rawActorName = req.headers?.['x-actor-name'] ?? req.headers?.['X-Actor-Name'];
    const actorNameCandidate = Array.isArray(rawActorName) ? rawActorName[0] : rawActorName;
    const actorName =
      typeof actorNameCandidate === 'string' && actorNameCandidate.trim().length > 0
        ? actorNameCandidate.trim()
        : actorId === 'demo-user'
          ? 'Demo user'
          : actorId;

    const rawRoles = req.headers?.['x-actor-roles'] ?? req.headers?.['X-Actor-Roles'];
    const rolesCandidate = Array.isArray(rawRoles) ? rawRoles.join(',') : rawRoles;

    let roles: AppRole[];
    if (typeof rolesCandidate === 'string' && rolesCandidate.trim().length > 0) {
      const parsedRoles = rolesCandidate
        .split(',')
        .map((r) => normalizeRole(r.trim()))
        .filter((r): r is AppRole => r !== undefined);

      roles = parsedRoles.length > 0 ? parsedRoles : ['Requester'];
    } else {
      roles = [...APP_ROLES];
    }

    return { id: actorId, name: actorName, roles };
  }
}
