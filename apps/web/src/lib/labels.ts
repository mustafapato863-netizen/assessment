export type View =
  | 'overview'
  | 'tasks'
  | 'cases'
  | 'employees'
  | 'development'
  | 'insights'
  | 'admin'
  | 'case'
  | 'notifications'
  | 'calibration';

export const DEFAULT_LOCALE = 'en';

export const copy = {
  overview: 'Overview',
  tasks: 'My work',
  cases: 'Assessments',
  employees: 'Employees',
  development: 'Development',
  insights: 'Insights',
  admin: 'Administration',
  calibration: 'Calibration',
  workspace: 'Assessment Workspace',
  cycle: 'FY26 Talent Cycle · Egypt',
  search: 'Search cases, employees, tasks…',
  greeting: 'Good morning, Sarah',
  subtitle: 'Here is what needs your attention today.',
  newRequest: 'New assessment',
  viewAll: 'View all',
  active: 'Active assessments',
  pendingEligibility: 'Pending eligibility',
  pendingApprovals: 'Pending approvals',
  overdue: 'Overdue follow-up',
  attention: 'Your attention',
  pipeline: 'Workflow pipeline',
  recent: 'Recent assessment cases',
  open: 'Open',
  request: 'Request',
  signOut: 'Sign out',
} as const;

export type Copy = typeof copy;

export const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  PENDING_ELIGIBILITY: 'Pending eligibility',
  NOT_ELIGIBLE: 'Not eligible',
  READY_FOR_PLANNING: 'Ready for planning',
  PLANNING: 'Planning',
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In progress',
  PENDING_RESULT: 'Pending result',
  RESULT_FINALIZED: 'Result finalized',
  PENDING_RECOMMENDATION: 'Pending recommendation',
  PENDING_APPROVAL: 'Pending approval',
  APPROVED: 'Approved',
  DEVELOPMENT_IN_PROGRESS: 'Development in progress',
  REASSESSMENT_DUE: 'Reassessment due',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
  READY_NOW: 'Ready now',
  READY_WITH_DEV: 'Ready with dev',
  NOT_READY: 'Not ready',
  ACCELERATED: 'Accelerated',
  CLEAN: 'Clean',
  SCANNING: 'Scanning',
  REJECTED: 'Rejected',
  FAILED: 'Scan failed',
};

export const resultCodeLabels: Record<string, string> = {
  READY_NOW: 'Ready now',
  READY_WITH_DEV: 'Ready with dev',
  NOT_READY: 'Not ready',
  ACCELERATED: 'Accelerated',
};

export const reasonLabels: Record<string, string> = {
  PROMOTION: 'Promotion',
  INTERNAL_MOBILITY: 'Internal mobility',
  ROLE_REALIGNMENT: 'Role realignment',
};

export function statusTone(status: string) {
  if (
    [
      'APPROVED',
      'RESULT_FINALIZED',
      'READY_FOR_PLANNING',
      'READY_NOW',
      'ACCELERATED',
      'CLEAN',
    ].includes(status)
  )
    return 'success';
  if (['NOT_ELIGIBLE', 'CANCELLED', 'NOT_READY', 'REJECTED', 'FAILED'].includes(status))
    return 'danger';
  if (
    [
      'PENDING_ELIGIBILITY',
      'PENDING_APPROVAL',
      'REASSESSMENT_DUE',
      'READY_WITH_DEV',
      'PENDING',
    ].includes(status)
  )
    return 'warning';
  if (['PENDING_RECOMMENDATION'].includes(status)) return 'decision';
  if (['DEVELOPMENT_IN_PROGRESS', 'SCHEDULED', 'SCANNING'].includes(status)) return 'teal';
  return 'info';
}
