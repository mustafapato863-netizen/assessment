import { describe, expect, it } from 'vitest';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { ROUTE_PERMISSIONS } from './permissions.map';
import { AppRole, AuthActor } from './auth.types';
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

  const req = {
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
          message: expect.stringContaining(
            "Actor 'assessor-10' with roles [Assessor] does not have required role [Admin, HR]",
          ),
          correlationId: 'trace-403-matrix',
        },
      });
    }
  });

  describe('RACI Matrix allow/deny verification per route', () => {
    // 1. Planning Finalization (Coordinator, HR, Admin)
    it('PLAN_FINALIZE: allows Coordinator and HR; denies Requester, Assessor, BusinessApprover, Auditor', () => {
      const guard = createGuardWithReflector({
        requiredRoles: [...ROUTE_PERMISSIONS.PLAN_FINALIZE],
      });

      // Allowed
      expect(
        guard.canActivate(
          createMockExecutionContext({ actor: { id: 'u1', name: 'U1', roles: ['Coordinator'] } }),
        ),
      ).toBe(true);
      expect(
        guard.canActivate(
          createMockExecutionContext({ actor: { id: 'u2', name: 'U2', roles: ['HR'] } }),
        ),
      ).toBe(true);
      expect(
        guard.canActivate(
          createMockExecutionContext({ actor: { id: 'u3', name: 'U3', roles: ['Admin'] } }),
        ),
      ).toBe(true);

      // Denied
      for (const role of [
        'Requester',
        'Assessor',
        'PanelLead',
        'BusinessApprover',
        'Auditor',
      ] as AppRole[]) {
        expect(() =>
          guard.canActivate(
            createMockExecutionContext({ actor: { id: 'u', name: 'U', roles: [role] } }),
          ),
        ).toThrow(ForbiddenException);
      }
    });

    // 2. Eligibility Decision (HR, Admin)
    it('ELIGIBILITY_DECIDE: allows HR, Admin; denies Requester, Coordinator, Assessor, BusinessApprover, Auditor', () => {
      const guard = createGuardWithReflector({
        requiredRoles: [...ROUTE_PERMISSIONS.ELIGIBILITY_DECIDE],
      });

      // Allowed
      expect(
        guard.canActivate(
          createMockExecutionContext({ actor: { id: 'u1', name: 'U1', roles: ['HR'] } }),
        ),
      ).toBe(true);
      expect(
        guard.canActivate(
          createMockExecutionContext({ actor: { id: 'u2', name: 'U2', roles: ['Admin'] } }),
        ),
      ).toBe(true);

      // Denied
      for (const role of [
        'Requester',
        'Coordinator',
        'Assessor',
        'PanelLead',
        'BusinessApprover',
        'Auditor',
      ] as AppRole[]) {
        expect(() =>
          guard.canActivate(
            createMockExecutionContext({ actor: { id: 'u', name: 'U', roles: [role] } }),
          ),
        ).toThrow(ForbiddenException);
      }
    });

    // 3. Evidence Submission (Assessor, PanelLead, HR, Admin)
    it('EVIDENCE_SUBMIT: allows Assessor, PanelLead, HR, Admin; denies Requester, Coordinator, BusinessApprover, Auditor', () => {
      const guard = createGuardWithReflector({
        requiredRoles: [...ROUTE_PERMISSIONS.EVIDENCE_SUBMIT],
      });

      // Allowed
      expect(
        guard.canActivate(
          createMockExecutionContext({ actor: { id: 'u1', name: 'U1', roles: ['Assessor'] } }),
        ),
      ).toBe(true);
      expect(
        guard.canActivate(
          createMockExecutionContext({ actor: { id: 'u2', name: 'U2', roles: ['PanelLead'] } }),
        ),
      ).toBe(true);
      expect(
        guard.canActivate(
          createMockExecutionContext({ actor: { id: 'u3', name: 'U3', roles: ['HR'] } }),
        ),
      ).toBe(true);

      // Denied
      for (const role of ['Requester', 'Coordinator', 'BusinessApprover', 'Auditor'] as AppRole[]) {
        expect(() =>
          guard.canActivate(
            createMockExecutionContext({ actor: { id: 'u', name: 'U', roles: [role] } }),
          ),
        ).toThrow(ForbiddenException);
      }
    });

    // 4. Result Finalization (PanelLead, HR, Admin)
    it('RESULT_FINALIZE: allows PanelLead, HR, Admin; denies Assessor, Requester, Coordinator, BusinessApprover, Auditor', () => {
      const guard = createGuardWithReflector({
        requiredRoles: [...ROUTE_PERMISSIONS.RESULT_FINALIZE],
      });

      // Allowed
      expect(
        guard.canActivate(
          createMockExecutionContext({ actor: { id: 'u1', name: 'U1', roles: ['PanelLead'] } }),
        ),
      ).toBe(true);
      expect(
        guard.canActivate(
          createMockExecutionContext({ actor: { id: 'u2', name: 'U2', roles: ['HR'] } }),
        ),
      ).toBe(true);

      // Denied
      for (const role of [
        'Assessor',
        'Requester',
        'Coordinator',
        'BusinessApprover',
        'Auditor',
      ] as AppRole[]) {
        expect(() =>
          guard.canActivate(
            createMockExecutionContext({ actor: { id: 'u', name: 'U', roles: [role] } }),
          ),
        ).toThrow(ForbiddenException);
      }
    });

    // 5. Approval Decision (BusinessApprover, HR, Admin)
    it('APPROVAL_DECIDE: allows BusinessApprover, HR, Admin; denies Requester, Coordinator, Assessor, PanelLead, Auditor', () => {
      const guard = createGuardWithReflector({
        requiredRoles: [...ROUTE_PERMISSIONS.APPROVAL_DECIDE],
      });

      // Allowed
      expect(
        guard.canActivate(
          createMockExecutionContext({
            actor: { id: 'u1', name: 'U1', roles: ['BusinessApprover'] },
          }),
        ),
      ).toBe(true);
      expect(
        guard.canActivate(
          createMockExecutionContext({ actor: { id: 'u2', name: 'U2', roles: ['HR'] } }),
        ),
      ).toBe(true);

      // Denied
      for (const role of [
        'Requester',
        'Coordinator',
        'Assessor',
        'PanelLead',
        'Auditor',
      ] as AppRole[]) {
        expect(() =>
          guard.canActivate(
            createMockExecutionContext({ actor: { id: 'u', name: 'U', roles: [role] } }),
          ),
        ).toThrow(ForbiddenException);
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
