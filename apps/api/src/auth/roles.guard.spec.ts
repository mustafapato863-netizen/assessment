import { describe, expect, it } from 'vitest';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { ROUTE_PERMISSIONS } from './permissions.map';
import { APP_ROLES, AppRole, AuthActor } from './auth.types';
import { IS_PUBLIC_KEY, ROLES_KEY } from './roles.decorator';

function createMockExecutionContext(options: {
  actor?: AuthActor;
  requiredRoles?: AppRole[];
  isPublic?: boolean;
  correlationId?: string;
}): ExecutionContext {
  const reflectorValues: Record<string, unknown> = {};
  if (options.requiredRoles) {
    reflectorValues[ROLES_KEY] = options.requiredRoles;
  }
  if (options.isPublic !== undefined) {
    reflectorValues[IS_PUBLIC_KEY] = options.isPublic;
  }

  // Role checks are synchronous for read requests; command requests add async
  // admin-edit/scope checks that are covered by API integration tests.
  const req = {
    method: 'GET',
    actor: options.actor,
    user: options.actor,
    correlationId: options.correlationId ?? 'corr-test-rbac',
    headers: { 'x-correlation-id': options.correlationId ?? 'corr-test-rbac' },
  };

  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function createGuardWithReflector(metadata: {
  requiredRoles?: AppRole[];
  isPublic?: boolean;
}): RolesGuard {
  const reflector = {
    getAllAndOverride: (key: string) => {
      if (key === IS_PUBLIC_KEY) return metadata.isPublic;
      if (key === ROLES_KEY) return metadata.requiredRoles;
      return undefined;
    },
  } as unknown as Reflector;

  return new RolesGuard(reflector);
}

describe('RolesGuard & RACI Matrix', () => {
  it('allows access to public endpoints without role checks', () => {
    const guard = createGuardWithReflector({ isPublic: true, requiredRoles: ['Admin'] });
    const context = createMockExecutionContext({
      actor: { id: 'user-1', name: 'User 1', roles: ['Requester'] },
      isPublic: true,
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows access when no roles are required on route', () => {
    const guard = createGuardWithReflector({ requiredRoles: [] });
    const context = createMockExecutionContext({
      actor: { id: 'user-1', name: 'User 1', roles: ['Auditor'] },
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('denies access with structured 403 ForbiddenException when actor lacks role', () => {
    const guard = createGuardWithReflector({ requiredRoles: ['Admin', 'HR'] });
    const context = createMockExecutionContext({
      actor: { id: 'assessor-10', name: 'Assessor Ten', roles: ['Assessor'] },
      correlationId: 'trace-403-matrix',
    });

    try {
      guard.canActivate(context);
      expect.unreachable('Should have thrown ForbiddenException');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const response = (err as ForbiddenException).getResponse();
      expect(response).toEqual({
        error: {
          code: 'FORBIDDEN',
          message: expect.stringContaining("Actor 'assessor-10' does not have a required role"),
          correlationId: 'trace-403-matrix',
        },
      });
    }
  });

  describe('RACI Matrix allow/deny verification per route', () => {
    // Access model agreed 2026-10-17: Assessor and Admin run the workflow,
    // managers (Requester) raise requests for their team, HR and Business
    // approvers decide their own step, everyone else reads in scope.
    const EXPECTED: Record<string, AppRole[]> = {
      CASE_CREATE: ['Requester', 'Assessor', 'Admin'],
      CASE_SUBMIT: ['Requester', 'Assessor', 'Admin'],
      ELIGIBILITY_DECIDE: ['Assessor', 'Admin'],
      ELIGIBILITY_OVERRIDE: ['Assessor', 'Admin'],
      PLAN_FINALIZE: ['Assessor', 'Admin'],
      EVENT_SCHEDULE: ['Assessor', 'Admin'],
      EVIDENCE_SAVE: ['Assessor', 'PanelLead', 'Admin'],
      EVIDENCE_SUBMIT: ['Assessor', 'PanelLead', 'Admin'],
      RESULT_FINALIZE: ['Assessor', 'Admin'],
      RESULT_REOPEN: ['Assessor', 'Admin'],
      RECOMMENDATION_SUBMIT: ['Assessor', 'Admin'],
      APPROVAL_DECIDE: ['HR', 'BusinessApprover', 'Admin'],
      DEVELOPMENT_UPDATE: ['Assessor', 'Admin'],
      REASSESSMENT_SCHEDULE: ['Assessor', 'Admin'],
      CASE_CLOSE: ['Assessor', 'Admin'],
      ATTACHMENT_UPLOAD: ['Requester', 'Assessor', 'PanelLead', 'Admin'],
    };

    for (const [permission, allowed] of Object.entries(EXPECTED)) {
      it(`${permission}: allows only ${allowed.join(', ')}`, () => {
        const guard = createGuardWithReflector({
          requiredRoles: [...ROUTE_PERMISSIONS[permission as keyof typeof ROUTE_PERMISSIONS]],
        });
        for (const role of APP_ROLES) {
          const run = () =>
            guard.canActivate(
              createMockExecutionContext({ actor: { id: 'u', name: 'U', roles: [role] } }),
            );
          if (allowed.includes(role)) expect(run()).toBe(true);
          else expect(run).toThrow(ForbiddenException);
        }
      });
    }

    it('Assessor can never approve (segregation of duties)', () => {
      expect(ROUTE_PERMISSIONS.APPROVAL_DECIDE).not.toContain('Assessor');
    });

    it('HR and Business approvers have no write access besides approval', () => {
      for (const [permission, roles] of Object.entries(EXPECTED)) {
        if (permission === 'APPROVAL_DECIDE') continue;
        expect(roles).not.toContain('HR');
        expect(roles).not.toContain('BusinessApprover');
      }
    });

    // 6. Auditor (Read-only Role)
    it('Auditor role: allowed on view queries, denied on all command mutations', () => {
      const auditorActor: AuthActor = { id: 'auditor-1', name: 'Audit User', roles: ['Auditor'] };

      // Allowed read routes
      for (const permission of [
        ROUTE_PERMISSIONS.OVERVIEW,
        ROUTE_PERMISSIONS.TASKS,
        ROUTE_PERMISSIONS.CASE_LIST,
        ROUTE_PERMISSIONS.CASE_GET,
        ROUTE_PERMISSIONS.PLAN_GET,
        ROUTE_PERMISSIONS.EVENT_LIST,
        ROUTE_PERMISSIONS.RESULT_GET,
        ROUTE_PERMISSIONS.RECOMMENDATION_GET,
        ROUTE_PERMISSIONS.APPROVAL_LIST,
        ROUTE_PERMISSIONS.DEVELOPMENT_GET,
      ]) {
        const guard = createGuardWithReflector({ requiredRoles: [...permission] });
        expect(guard.canActivate(createMockExecutionContext({ actor: auditorActor }))).toBe(true);
      }

      // Denied command routes
      for (const mutation of [
        ROUTE_PERMISSIONS.CASE_CREATE,
        ROUTE_PERMISSIONS.CASE_SUBMIT,
        ROUTE_PERMISSIONS.ELIGIBILITY_DECIDE,
        ROUTE_PERMISSIONS.PLAN_FINALIZE,
        ROUTE_PERMISSIONS.EVIDENCE_SUBMIT,
        ROUTE_PERMISSIONS.RESULT_FINALIZE,
        ROUTE_PERMISSIONS.RESULT_REOPEN,
        ROUTE_PERMISSIONS.RECOMMENDATION_SUBMIT,
        ROUTE_PERMISSIONS.APPROVAL_DECIDE,
        ROUTE_PERMISSIONS.DEVELOPMENT_UPDATE,
        ROUTE_PERMISSIONS.REASSESSMENT_SCHEDULE,
        ROUTE_PERMISSIONS.CASE_CLOSE,
      ]) {
        const guard = createGuardWithReflector({ requiredRoles: [...mutation] });
        expect(() =>
          guard.canActivate(createMockExecutionContext({ actor: auditorActor })),
        ).toThrow(ForbiddenException);
      }
    });
  });
});
