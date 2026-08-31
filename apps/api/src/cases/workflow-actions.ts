import type { AvailableAction, CaseStatus } from '@assessflow/contracts';

export function actionsForStatus(status: CaseStatus): AvailableAction[] {
  if (status === 'DRAFT') {
    return [
      {
        code: 'SUBMIT',
        label: 'Submit for eligibility',
        kind: 'primary',
        enabled: true,
        consequences: ['Creates an eligibility review task for HR / Talent.'],
        nextOwner: 'HR / Talent',
        auditEvent: 'CASE_SUBMITTED',
      },
    ];
  }
  if (status === 'PENDING_ELIGIBILITY') {
    return [
      {
        code: 'DECIDE_ELIGIBILITY',
        label: 'Review eligibility',
        kind: 'primary',
        enabled: true,
        prerequisites: ['Review every blocking criterion and policy source.'],
        nextOwner: 'Assessment Coordinator',
        auditEvent: 'ELIGIBILITY_DECIDED',
      },
      { code: 'OPEN_CASE', label: 'Open case', kind: 'secondary', enabled: true },
    ];
  }
  if (status === 'NOT_ELIGIBLE') {
    return [
      {
        code: 'REQUEST_OVERRIDE',
        label: 'Request override',
        kind: 'secondary',
        enabled: true,
        requiresConfirmation: true,
        confirmationSeverity: 'standard',
        prerequisites: ['Provide a policy-backed business reason.'],
        nextOwner: 'HR Governance',
        auditEvent: 'ELIGIBILITY_OVERRIDE_REQUESTED',
      },
    ];
  }
  if (status === 'READY_FOR_PLANNING') {
    return [
      {
        code: 'OPEN_PLANNING',
        label: 'Open planning task',
        kind: 'primary',
        enabled: true,
        nextOwner: 'Assessment Coordinator',
        auditEvent: 'PLANNING_OPENED',
      },
    ];
  }
  return [{ code: 'OPEN_CASE', label: 'Open case', kind: 'secondary', enabled: true }];
}
