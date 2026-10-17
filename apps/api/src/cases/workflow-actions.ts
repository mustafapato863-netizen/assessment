import type { AvailableAction, CaseStatus } from '@assessflow/contracts';
import { ROUTE_PERMISSIONS } from '../auth/permissions.map';
import type { AppRole } from '../auth/auth.types';

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
  if (status === 'SUBMITTED' || status === 'PENDING_ELIGIBILITY') {
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
        code: 'FINALIZE_PLAN',
        label: 'Finalize assessment plan',
        kind: 'primary',
        enabled: true,
        prerequisites: [
          'Select at least one method (CBI, Case Study / Work Sample, Roleplay, Assessment Center).',
        ],
        consequences: ['Opens event scheduling for assessors.'],
        nextOwner: 'Assessment Coordinator',
        auditEvent: 'PLAN_FINALIZED',
      },
    ];
  }
  if (status === 'PLANNING') {
    return [
      {
        code: 'SCHEDULE_EVENT',
        label: 'Schedule assessment event',
        kind: 'primary',
        enabled: true,
        prerequisites: ['Finalized plan with at least one method.'],
        nextOwner: 'Assessment Coordinator',
        auditEvent: 'EVENT_SCHEDULED',
      },
      { code: 'OPEN_CASE', label: 'Open case', kind: 'secondary', enabled: true },
    ];
  }
  if (status === 'SCHEDULED') {
    return [
      {
        code: 'SUBMIT_EVIDENCE',
        label: 'Submit assessor evidence',
        kind: 'primary',
        enabled: true,
        prerequisites: ['Independent evidence per assigned event.'],
        nextOwner: 'Assessor',
        auditEvent: 'EVIDENCE_SUBMITTED',
      },
      {
        code: 'SCHEDULE_EVENT',
        label: 'Schedule another event',
        kind: 'secondary',
        enabled: true,
        nextOwner: 'Assessment Coordinator',
        auditEvent: 'EVENT_SCHEDULED',
      },
    ];
  }
  if (status === 'IN_PROGRESS') {
    return [
      {
        code: 'FINALIZE_RESULT',
        label: 'Finalize result',
        kind: 'primary',
        enabled: true,
        prerequisites: ['All required evidence submitted.'],
        consequences: ['Result is versioned and locked for recommendation.'],
        nextOwner: 'Panel Lead',
        auditEvent: 'RESULT_FINALIZED',
      },
      {
        code: 'SUBMIT_EVIDENCE',
        label: 'Submit more evidence',
        kind: 'secondary',
        enabled: true,
        nextOwner: 'Assessor',
        auditEvent: 'EVIDENCE_SUBMITTED',
      },
    ];
  }
  if (status === 'PENDING_RESULT') {
    return [
      {
        code: 'FINALIZE_RESULT',
        label: 'Finalize result',
        kind: 'primary',
        enabled: true,
        prerequisites: ['At least one complete assessor scorecard is submitted.'],
        consequences: ['Moves the case to recommendation and approval.'],
        nextOwner: 'Panel Lead',
        auditEvent: 'RESULT_FINALIZED',
      },
      { code: 'OPEN_CASE', label: 'Open case', kind: 'secondary', enabled: true },
    ];
  }
  if (status === 'RESULT_FINALIZED') {
    return [
      {
        code: 'SUBMIT_RECOMMENDATION',
        label: 'Submit recommendation',
        kind: 'primary',
        enabled: true,
        prerequisites: ['Finalized result with a valid result code.'],
        consequences: ['Starts sequential HR then Business approval.'],
        nextOwner: 'Business Owner',
        auditEvent: 'RECOMMENDATION_SUBMITTED',
      },
      {
        code: 'REOPEN_RESULT',
        label: 'Reopen result',
        kind: 'secondary',
        enabled: true,
        requiresConfirmation: true,
        confirmationSeverity: 'standard',
        prerequisites: ['Provide a reason for reopening.'],
        nextOwner: 'Panel Lead',
        auditEvent: 'RESULT_REOPENED',
      },
    ];
  }
  if (status === 'PENDING_RECOMMENDATION') {
    return [
      {
        code: 'SUBMIT_RECOMMENDATION',
        label: 'Submit recommendation',
        kind: 'primary',
        enabled: true,
        nextOwner: 'Business Owner',
        auditEvent: 'RECOMMENDATION_SUBMITTED',
      },
    ];
  }
  if (status === 'PENDING_APPROVAL') {
    return [
      {
        code: 'DECIDE_APPROVAL',
        label: 'Decide approval step',
        kind: 'primary',
        enabled: true,
        prerequisites: ['Current step assigned to you and still pending.'],
        nextOwner: 'Approver',
        auditEvent: 'APPROVAL_DECIDED',
      },
      { code: 'OPEN_CASE', label: 'Open case', kind: 'secondary', enabled: true },
    ];
  }
  if (status === 'APPROVED') {
    return [
      {
        code: 'UPDATE_DEVELOPMENT',
        label: 'Update development plan',
        kind: 'primary',
        enabled: true,
        nextOwner: 'Manager',
        auditEvent: 'DEVELOPMENT_UPDATED',
      },
      {
        code: 'SCHEDULE_REASSESSMENT',
        label: 'Schedule reassessment',
        kind: 'secondary',
        enabled: true,
        nextOwner: 'HR / Talent',
        auditEvent: 'REASSESSMENT_SCHEDULED',
      },
      {
        code: 'CLOSE_CASE',
        label: 'Close case',
        kind: 'secondary',
        enabled: true,
        requiresConfirmation: true,
        confirmationSeverity: 'standard',
        prerequisites: ['Feedback acknowledged and follow-up owned.'],
        nextOwner: 'HR / Talent',
        auditEvent: 'CASE_CLOSED',
      },
    ];
  }
  if (status === 'DEVELOPMENT_IN_PROGRESS') {
    return [
      {
        code: 'UPDATE_DEVELOPMENT',
        label: 'Update development plan',
        kind: 'primary',
        enabled: true,
        nextOwner: 'Manager',
        auditEvent: 'DEVELOPMENT_UPDATED',
      },
      {
        code: 'CLOSE_CASE',
        label: 'Close case',
        kind: 'secondary',
        enabled: true,
        requiresConfirmation: true,
        confirmationSeverity: 'standard',
        nextOwner: 'HR / Talent',
        auditEvent: 'CASE_CLOSED',
      },
    ];
  }
  if (status === 'REASSESSMENT_DUE' || status === 'CLOSED' || status === 'CANCELLED') {
    return [
      {
        code: 'SCHEDULE_REASSESSMENT',
        label: 'Schedule reassessment',
        kind: 'primary',
        enabled: status !== 'CANCELLED',
        reason: status === 'CANCELLED' ? 'Cancelled cases cannot be reassessed.' : undefined,
        nextOwner: 'HR / Talent',
        auditEvent: 'REASSESSMENT_SCHEDULED',
      },
      { code: 'OPEN_CASE', label: 'Open case', kind: 'secondary', enabled: true },
    ];
  }
  return [{ code: 'OPEN_CASE', label: 'Open case', kind: 'secondary', enabled: true }];
}

/** Route permission that governs each workflow action shown in the UI. */
const ACTION_PERMISSIONS: Record<string, keyof typeof ROUTE_PERMISSIONS> = {
  SUBMIT: 'CASE_SUBMIT',
  DECIDE_ELIGIBILITY: 'ELIGIBILITY_DECIDE',
  REQUEST_OVERRIDE: 'ELIGIBILITY_OVERRIDE',
  FINALIZE_PLAN: 'PLAN_FINALIZE',
  SCHEDULE_EVENT: 'EVENT_SCHEDULE',
  SUBMIT_EVIDENCE: 'EVIDENCE_SUBMIT',
  FINALIZE_RESULT: 'RESULT_FINALIZE',
  REOPEN_RESULT: 'RESULT_REOPEN',
  SUBMIT_RECOMMENDATION: 'RECOMMENDATION_SUBMIT',
  DECIDE_APPROVAL: 'APPROVAL_DECIDE',
  UPDATE_DEVELOPMENT: 'DEVELOPMENT_UPDATE',
  SCHEDULE_REASSESSMENT: 'REASSESSMENT_SCHEDULE',
  CLOSE_CASE: 'CASE_CLOSE',
};

/**
 * Actions for a status, limited to what the viewer's roles may run. Read-only
 * viewers get only navigation actions, so the UI shows no buttons that would
 * fail with 403. The server still enforces every command independently.
 */
export function actionsForActor(status: CaseStatus, roles: readonly AppRole[]): AvailableAction[] {
  return actionsForStatus(status).filter((action) => {
    const permission = ACTION_PERMISSIONS[action.code];
    if (!permission) return true;
    const allowed = ROUTE_PERMISSIONS[permission] as readonly AppRole[];
    return allowed.some((role) => roles.includes(role));
  });
}
