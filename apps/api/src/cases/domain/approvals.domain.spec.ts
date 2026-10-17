import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { AppRole } from '../../auth/auth.types';
import { caseScopeWhere, taskAssigneeIdsFor } from '../../access/access-accounts.service';
import { ApprovalsDomain } from './approvals.domain';

const check =
  (
    actor: { id: string; roles: AppRole[] },
    stepRole: string,
    conflicts: { actorId: string; reason: string }[] = [],
  ) =>
  () =>
    ApprovalsDomain.assertSegregationOfDuties({
      actor,
      stepRole,
      conflicts,
      correlationId: 'corr-test',
    });

const codeOf = (fn: () => void) => {
  try {
    fn();
    return null;
  } catch (error) {
    expect(error).toBeInstanceOf(ForbiddenException);
    return ((error as ForbiddenException).getResponse() as { error: { code: string } }).error.code;
  }
};

describe('Approval segregation of duties', () => {
  it('lets the matching role decide each step', () => {
    expect(check({ id: 'hr-1', roles: ['HR'] }, 'HR')).not.toThrow();
    expect(check({ id: 'ba-1', roles: ['BusinessApprover'] }, 'BUSINESS')).not.toThrow();
    expect(check({ id: 'admin-1', roles: ['Admin'] }, 'BUSINESS')).not.toThrow();
  });

  it('rejects an approver without the step role', () => {
    expect(codeOf(check({ id: 'hr-1', roles: ['HR'] }, 'BUSINESS'))).toBe('APPROVER_ROLE_REQUIRED');
    expect(codeOf(check({ id: 'ba-1', roles: ['BusinessApprover'] }, 'HR'))).toBe(
      'APPROVER_ROLE_REQUIRED',
    );
    expect(codeOf(check({ id: 'as-1', roles: ['Assessor'] }, 'HR'))).toBe('APPROVER_ROLE_REQUIRED');
  });

  it('blocks anyone who scored, finalized, recommended, or decided the other step', () => {
    for (const reason of [
      'scored the candidate',
      'finalized the assessment result',
      'submitted the recommendation',
      'decided the other approval step',
    ]) {
      expect(
        codeOf(check({ id: 'admin-1', roles: ['Admin'] }, 'HR', [{ actorId: 'admin-1', reason }])),
      ).toBe('SEGREGATION_OF_DUTIES');
    }
  });

  it('allows an approver when the conflicts belong to other people', () => {
    expect(
      check({ id: 'hr-2', roles: ['HR'] }, 'HR', [
        { actorId: 'assessor-1', reason: 'scored the candidate' },
        { actorId: 'hr-1', reason: 'submitted the recommendation' },
      ]),
    ).not.toThrow();
  });
});

describe('Role task queues and assigned scope', () => {
  it('includes role queues in the task assignees an actor works', () => {
    expect(taskAssigneeIdsFor({ id: 'u1', name: 'U', roles: ['BusinessApprover'] })).toEqual([
      'u1',
      'business-approver',
    ]);
    expect(taskAssigneeIdsFor({ id: 'u2', name: 'U', roles: ['HR'] })).toEqual([
      'u2',
      'hr-talent',
      'hr-approver',
    ]);
  });

  it('lets an assigned-scope approver see cases waiting on their step role', () => {
    const where = caseScopeWhere({
      id: 'ba-1',
      name: 'Approver',
      roles: ['BusinessApprover'],
      scopeType: 'ASSIGNED',
      scopeValues: [],
    }) as { OR: unknown[] };
    expect(where.OR).toContainEqual({
      approvalSteps: { some: { decision: 'PENDING', role: { in: ['BUSINESS'] } } },
    });
  });

  it('does not widen assigned scope for roles that are not approvers', () => {
    const where = caseScopeWhere({
      id: 'pl-1',
      name: 'Panel lead',
      roles: ['PanelLead'],
      scopeType: 'ASSIGNED',
      scopeValues: [],
    }) as { OR: unknown[] };
    expect(where.OR).toHaveLength(3);
  });
});
