import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { AppRole, AuthActor, normalizeRole } from './auth.types';
import { ROLES_KEY, IS_PUBLIC_KEY } from './roles.decorator';
import { setActorContext } from './actor.context';
import { verifyAppToken, type VerifiedAppActor } from './app-token.util';
import { isDevHeaderAuthEnabled } from './dev-auth';
import { PrismaService } from '../database/prisma.service';
import { caseScopeWhere } from '../access/access-accounts.service';
import { isUuid } from '../common/uuid.util';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<AppRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<Request>();
    const correlationId =
      (request as unknown as { correlationId?: string })?.correlationId ||
      (request.headers?.['x-correlation-id'] as string) ||
      `corr-${randomUUID()}`;
    const existingActor =
      (request as unknown as { actor?: AuthActor })?.actor ||
      (request as unknown as { user?: AuthActor })?.user;

    const rawAuth = request.headers?.authorization;
    const authHeader = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;
    const rawRoleHeader = request.headers?.['x-actor-role'] ?? request.headers?.['x-actor-roles'];
    const hasExplicitLocalRole =
      typeof rawRoleHeader === 'string'
        ? rawRoleHeader.trim().length > 0
        : Boolean(rawRoleHeader?.length);
    const adminOnlyRoute = requiredRoles?.length === 1 && requiredRoles[0] === 'Admin';
    const entraEnabled = Boolean(
      process.env.ENTRA_ISSUER_URL?.trim() && process.env.ENTRA_CLIENT_ID?.trim(),
    );
    const devHeaderAuth = isDevHeaderAuthEnabled();

    if (
      adminOnlyRoute &&
      !entraEnabled &&
      !(typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) &&
      !hasExplicitLocalRole
    ) {
      throw new ForbiddenException({
        error: {
          code: 'FORBIDDEN',
          message: 'An explicit System admin identity is required for this endpoint.',
          correlationId,
        },
      });
    }

    // Verified Entra actor (middleware or test harness).
    if (existingActor && entraEnabled && process.env.NODE_ENV !== 'production') {
      return this.authorize(existingActor, requiredRoles, correlationId, request);
    }

    if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
      return this.resolveAppActor(authHeader.slice(7).trim()).then((actor) => {
        (request as unknown as { actor?: AuthActor }).actor = actor;
        (request as unknown as { user?: AuthActor }).user = actor;
        setActorContext(actor);
        return this.authorize(actor, requiredRoles, correlationId, request, true);
      });
    }

    if (existingActor && devHeaderAuth) {
      return this.authorize(existingActor, requiredRoles, correlationId, request);
    }

    if (!devHeaderAuth) {
      throw new UnauthorizedException('A valid AssessFlow sign-in is required.');
    }

    // Local development only (DEV_AUTH_HEADERS=true): header-based demo actor.
    const actor = this.resolveLocalActor(request);
    (request as unknown as { actor?: AuthActor }).actor = actor;
    (request as unknown as { user?: AuthActor }).user = actor;
    setActorContext(actor);
    return this.authorize(actor, requiredRoles, correlationId, request);
  }

  private async resolveAppActor(token: string): Promise<AuthActor> {
    let tokenActor: VerifiedAppActor;
    try {
      tokenActor = verifyAppToken(token);
    } catch {
      throw new UnauthorizedException('Your session is invalid or expired. Please sign in again.');
    }
    if (!this.prisma?.enabled) {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('Account storage is not available.');
      }
      return tokenActor;
    }
    if (!isUuid(tokenActor.id)) {
      throw new UnauthorizedException('Your session is invalid or expired. Please sign in again.');
    }
    const account = await this.prisma.accessAccount.findUnique({ where: { id: tokenActor.id } });
    if (!account || !account.active) {
      throw new UnauthorizedException(
        'This account is disabled. Please contact your administrator.',
      );
    }
    const changedAt =
      'passwordChangedAt' in account && account.passwordChangedAt
        ? new Date(account.passwordChangedAt as Date | string)
        : null;
    if (
      changedAt &&
      typeof tokenActor.tokenIssuedAt === 'number' &&
      tokenActor.tokenIssuedAt < Math.floor(changedAt.getTime() / 1000)
    ) {
      throw new UnauthorizedException('Your password was recently changed. Please sign in again.');
    }
    return {
      id: account.id,
      name: account.displayName,
      email: account.email,
      roles: account.roles.map(normalizeRole).filter((role): role is AppRole => Boolean(role)),
      scopeType: account.scopeType,
      scopeValues: account.scopeValues,
      mustChangePassword: account.mustChangePassword,
    };
  }

  private authorize(
    actor: AuthActor,
    requiredRoles: AppRole[] | undefined,
    correlationId: string,
    request?: Request,
    enforceScope = false,
  ): boolean | Promise<boolean> {
    const isPasswordChangeRequest =
      request?.method === 'POST' &&
      request.path?.replace(/\/+$/, '').endsWith('/auth/change-password');
    if (actor.mustChangePassword && !isPasswordChangeRequest) {
      throw new ForbiddenException({
        error: {
          code: 'PASSWORD_CHANGE_REQUIRED',
          message: 'Change your temporary password before continuing.',
          correlationId,
        },
      });
    }
    const hasRole =
      !requiredRoles?.length || requiredRoles.some((role) => actor.roles.includes(role));
    if (!hasRole) {
      throw new ForbiddenException({
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Actor '${actor.id}' does not have a required role.`,
          correlationId,
        },
      });
    }
    const isWriteRequest = Boolean(request && request.method !== 'GET');
    if (request && (isWriteRequest || enforceScope)) {
      return this.resolveAndAssertCaseAccess(
        actor,
        request,
        correlationId,
        isWriteRequest,
        enforceScope,
      ).then(() => true);
    }
    return true;
  }

  private notFoundCase(correlationId: string): NotFoundException {
    return new NotFoundException({
      error: {
        code: 'CASE_NOT_FOUND',
        message: 'This assessment case could not be found.',
        correlationId,
      },
    });
  }

  private notFoundAttachment(correlationId: string): NotFoundException {
    return new NotFoundException({
      error: {
        code: 'ATTACHMENT_NOT_FOUND',
        message: 'This attachment could not be found.',
        correlationId,
      },
    });
  }

  /**
   * Resolves caseId once from route params/body (validating UUIDs before Prisma lookups)
   * and enforces both ADMIN_EDIT_ONLY restrictions and row-level case scope in one query.
   */
  private async resolveAndAssertCaseAccess(
    actor: AuthActor,
    request: Request,
    correlationId: string,
    checkAdminEdit: boolean,
    checkScope: boolean,
  ): Promise<void> {
    if (!this.prisma?.enabled) return;

    const params = (request.params ?? {}) as Record<string, string | undefined>;
    const body = (request.body ?? undefined) as { caseId?: unknown } | undefined;

    let caseId: string | undefined;
    if (params.caseId !== undefined) {
      if (!isUuid(params.caseId)) throw this.notFoundCase(correlationId);
      caseId = params.caseId;
    } else if (body?.caseId !== undefined) {
      if (!isUuid(body.caseId)) throw this.notFoundCase(correlationId);
      caseId = body.caseId;
    } else if (params.eventId !== undefined) {
      if (!isUuid(params.eventId)) throw this.notFoundCase(correlationId);
      caseId = (
        await this.prisma.assessmentEvent.findUnique({
          where: { id: params.eventId },
          select: { caseId: true },
        })
      )?.caseId;
      if (!caseId) throw this.notFoundCase(correlationId);
    } else if (params.stepId !== undefined) {
      if (!isUuid(params.stepId)) throw this.notFoundCase(correlationId);
      caseId = (
        await this.prisma.approvalStep.findUnique({
          where: { id: params.stepId },
          select: { caseId: true },
        })
      )?.caseId;
      if (!caseId) throw this.notFoundCase(correlationId);
    } else if (params.attachmentId !== undefined) {
      if (!isUuid(params.attachmentId)) throw this.notFoundAttachment(correlationId);
      caseId = (
        await this.prisma.attachment.findUnique({
          where: { id: params.attachmentId },
          select: { caseId: true },
        })
      )?.caseId;
      if (!caseId) throw this.notFoundAttachment(correlationId);
    }

    if (!caseId) return;

    const record = await this.prisma.assessmentCase.findUnique({
      where: { id: caseId },
      select: { id: true, adminEditStage: true },
    });
    if (!record) {
      if (checkScope) throw this.notFoundCase(correlationId);
      return;
    }

    if (checkAdminEdit && record.adminEditStage && !actor.roles.includes('Admin')) {
      throw new ForbiddenException({
        error: {
          code: 'ADMIN_EDIT_ONLY',
          message: 'This stage was reopened for Admin editing. Other roles have read-only access.',
          correlationId,
        },
      });
    }

    if (checkScope) {
      const scopeMatch = await this.prisma.assessmentCase.findFirst({
        where: { AND: [{ id: caseId }, caseScopeWhere(actor)] },
        select: { id: true },
      });
      if (!scopeMatch) {
        throw this.notFoundCase(correlationId);
      }
    }
  }

  private resolveLocalActor(req: Request): AuthActor {
    const rawActorId = req.headers?.['x-actor-id'] ?? req.headers?.['X-Actor-ID'];
    const actorIdCandidate = Array.isArray(rawActorId) ? rawActorId[0] : rawActorId;
    const id =
      typeof actorIdCandidate === 'string' && actorIdCandidate.trim()
        ? actorIdCandidate.trim()
        : 'demo-user';
    const rawActorName = req.headers?.['x-actor-name'] ?? req.headers?.['X-Actor-Name'];
    const nameCandidate = Array.isArray(rawActorName) ? rawActorName[0] : rawActorName;
    const name =
      typeof nameCandidate === 'string' && nameCandidate.trim() ? nameCandidate.trim() : id;
    const rawRoles =
      req.headers?.['x-actor-roles'] ??
      req.headers?.['X-Actor-Roles'] ??
      req.headers?.['x-actor-role'] ??
      req.headers?.['X-Actor-Role'];
    const rolesCandidate = Array.isArray(rawRoles) ? rawRoles.join(',') : rawRoles;
    const roles =
      typeof rolesCandidate === 'string' && rolesCandidate.trim()
        ? rolesCandidate
            .split(',')
            .map((value) => normalizeRole(value.trim()))
            .filter((role): role is AppRole => Boolean(role))
        : ([
            'Requester',
            'Manager',
            'HR',
            'Coordinator',
            'Assessor',
            'PanelLead',
            'BusinessApprover',
            'Admin',
            'Auditor',
            'Employee',
          ] as AppRole[]);
    return { id, name, roles, scopeType: 'ORGANIZATION', scopeValues: [] };
  }
}
