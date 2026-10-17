import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { caseStatuses } from '@assessflow/contracts';
import { actionsForActor, actionsForStatus } from './workflow-actions';
import { CasesService } from './cases.service';
import type { AuthActor } from '../auth';

const codes = (status: Parameters<typeof actionsForActor>[0], roles: AuthActor['roles']) =>
  actionsForActor(status, roles).map((action) => action.code);

describe('actionsForActor', () => {
  it('keeps every workflow action for an Assessor except approval', () => {
    for (const status of caseStatuses) {
      const all = actionsForStatus(status).map((action) => action.code);
      expect(codes(status, ['Assessor'])).toEqual(all.filter((code) => code !== 'DECIDE_APPROVAL'));
    }
  });

  it('shows read-only roles navigation only', () => {
    for (const role of ['Auditor', 'Coordinator', 'Manager', 'EmployeeManager'] as const) {
      for (const status of caseStatuses) {
        expect(codes(status, [role]).every((code) => code === 'OPEN_CASE')).toBe(true);
      }
    }
  });

  it('shows the approval action to HR and Business approvers only while pending approval', () => {
    expect(codes('PENDING_APPROVAL', ['HR'])).toContain('DECIDE_APPROVAL');
    expect(codes('PENDING_APPROVAL', ['BusinessApprover'])).toContain('DECIDE_APPROVAL');
    expect(codes('PENDING_ELIGIBILITY', ['HR'])).not.toContain('DECIDE_ELIGIBILITY');
  });

  it('lets a manager (Requester) submit their draft but nothing later', () => {
    expect(codes('DRAFT', ['Requester'])).toEqual(
      actionsForStatus('DRAFT')
        .map((action) => action.code)
        .filter((code) => code === 'SUBMIT' || code === 'OPEN_CASE'),
    );
    expect(codes('PENDING_RECOMMENDATION', ['Requester'])).not.toContain('SUBMIT_RECOMMENDATION');
  });
});

describe('Manager request scope', () => {
  const request = {
    employeeId: 'emp-001',
    employeeName: 'Mona Hassan',
    department: 'Product',
    currentRole: 'Senior Specialist',
    currentLevel: 'L4',
    assessmentReason: 'PROMOTION' as const,
    targetRole: 'Team Lead',
    targetLevel: 'L5',
    justification: 'The employee is ready to lead a larger cross-functional scope.',
    priority: 'NORMAL' as const,
  };
  const manager = (scopeType: string, scopeValues: string[] = []): AuthActor => ({
    id: 'mgr-1',
    name: 'Manager',
    roles: ['Requester'],
    scopeType,
    scopeValues,
  });

  it('rejects a manager without an assigned team', () => {
    expect(() => new CasesService().create(request, manager('NONE'))).toThrow(ForbiddenException);
  });

  it('rejects requests outside the manager’s direct reports', () => {
    expect(() =>
      new CasesService().create(request, manager('DIRECT_REPORTS', ['emp-999'])),
    ).toThrow(ForbiddenException);
  });

  it('accepts a request for a direct report', () => {
    const created = new CasesService().create(request, manager('DIRECT_REPORTS', ['emp-001']));
    expect(created).toMatchObject({ status: 'DRAFT' });
  });
});
