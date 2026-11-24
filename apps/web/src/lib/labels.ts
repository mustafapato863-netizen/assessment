export type View =
  | 'overview'
  | 'tasks'
  | 'cases'
  | 'employees'
  | 'development'
  | 'insights'
  | 'assessor'
  | 'access'
  | 'my-result'
  | 'admin'
  | 'case'
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
  access: 'Manage access',
  calibration: 'Calibration',
  workspace: 'Assessment Workspace',
  cycle: 'Talent cycle · Live',
  search: 'Search cases, employees, tasks…',
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

export function getGreeting(name?: string | null): string {
  const hour = new Date().getHours();
  const salutation = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = name?.trim().split(/\s+/)[0];
  return firstName ? `${salutation}, ${firstName}` : salutation;
}

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
  READY_WITH_DEV: 'Ready with development',
  READY_WITH_DEVELOPMENT: 'Ready with development',
  NOT_READY: 'Not ready',
  INCOMPLETE: 'Incomplete',
  ACCELERATED: 'Accelerated',
  CLEAN: 'Clean',
  SCANNING: 'Scanning',
  REJECTED: 'Rejected',
  FAILED: 'Scan failed',
  PENDING: 'Pending',
  CHANGES_REQUESTED: 'Changes requested',
  NOT_STARTED: 'Not started',
  COMPLETED: 'Completed',
  MET: 'Met',
  NOT_MET: 'Not met',
  NOT_APPLICABLE: 'Not applicable',
};

export const resultCodeLabels: Record<string, string> = {
  READY_NOW: 'Ready now',
  READY_WITH_DEV: 'Ready with development',
  READY_WITH_DEVELOPMENT: 'Ready with development',
  NOT_READY: 'Not ready',
  INCOMPLETE: 'Incomplete',
  ACCELERATED: 'Accelerated',
};

export const reasonLabels: Record<string, string> = {
  PROMOTION: 'Promotion',
  INTERNAL_MOBILITY: 'Internal mobility',
  ROLE_REALIGNMENT: 'Role realignment',
  EXTERNAL_RECRUITMENT: 'External recruitment',
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
      'COMPLETED',
      'MET',
    ].includes(status)
  ) {
    return 'success';
  }
  if (
    ['NOT_ELIGIBLE', 'CANCELLED', 'NOT_READY', 'REJECTED', 'FAILED', 'NOT_MET'].includes(status)
  ) {
    return 'danger';
  }
  if (
    [
      'PENDING_ELIGIBILITY',
      'PENDING_APPROVAL',
      'REASSESSMENT_DUE',
      'READY_WITH_DEV',
      'READY_WITH_DEVELOPMENT',
      'INCOMPLETE',
      'CHANGES_REQUESTED',
      'PENDING',
    ].includes(status)
  ) {
    return 'warning';
  }
  if (['PENDING_RECOMMENDATION'].includes(status)) return 'decision';
  if (['DEVELOPMENT_IN_PROGRESS', 'SCHEDULED', 'SCANNING', 'IN_PROGRESS'].includes(status)) {
    return 'teal';
  }
  return 'info';
}
