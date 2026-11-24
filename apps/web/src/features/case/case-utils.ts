import type {
  AdminReopenStageInput,
  AssessmentCaseDetail,
  ResultCode,
  ScorecardConfig,
  ScorecardIssueSummary,
  ScorecardKnockoutCheck,
  ScorecardRatings,
} from '@assessflow/contracts';

export const PAST_ELIGIBILITY_STATUSES = [
  'READY_FOR_PLANNING',
  'PLANNING',
  'SCHEDULED',
  'IN_PROGRESS',
  'PENDING_RESULT',
  'RESULT_FINALIZED',
  'PENDING_RECOMMENDATION',
  'PENDING_APPROVAL',
  'APPROVED',
  'DEVELOPMENT_IN_PROGRESS',
  'REASSESSMENT_DUE',
  'CLOSED',
];

export const PAST_PLANNING_STATUSES = [
  'PLANNING',
  'SCHEDULED',
  'IN_PROGRESS',
  'PENDING_RESULT',
  'RESULT_FINALIZED',
  'PENDING_RECOMMENDATION',
  'PENDING_APPROVAL',
  'APPROVED',
  'DEVELOPMENT_IN_PROGRESS',
  'REASSESSMENT_DUE',
  'CLOSED',
];

export const PAST_ASSESSMENT_STATUSES = [
  'PENDING_RESULT',
  'RESULT_FINALIZED',
  'PENDING_RECOMMENDATION',
  'PENDING_APPROVAL',
  'APPROVED',
  'DEVELOPMENT_IN_PROGRESS',
  'REASSESSMENT_DUE',
  'CLOSED',
];

export const PAST_RESULT_STATUSES = [
  'RESULT_FINALIZED',
  'PENDING_RECOMMENDATION',
  'PENDING_APPROVAL',
  'APPROVED',
  'DEVELOPMENT_IN_PROGRESS',
  'REASSESSMENT_DUE',
  'CLOSED',
];

export const PAST_DECISION_STATUSES = [
  'APPROVED',
  'DEVELOPMENT_IN_PROGRESS',
  'REASSESSMENT_DUE',
  'CLOSED',
];

export interface ScorecardResponse {
  config: ScorecardConfig;
  mySubmission: {
    ratings: ScorecardRatings;
    submittedAt: string | null;
    assessorName: string;
  } | null;
  assignedAssessorCount: number;
  canReviseSubmission: boolean;
  submissions: Array<{ assessorName: string; submitted: boolean; submittedAt: string | null }>;
  aggregate: {
    completeCount: number;
    resultCode: ResultCode;
    technical?: number;
    behavioral?: number;
    overall?: number;
    knockout: boolean;
    technicalWeight: number;
    behavioralWeight: number;
    technicalIssues: ScorecardIssueSummary[];
    behavioralIssues: ScorecardIssueSummary[];
    knockoutChecks: ScorecardKnockoutCheck[];
  } | null;
  canEditWeights: boolean;
}

export interface AssessmentSummaryData {
  completeCount: number;
  technical?: number;
  behavioral?: number;
  overall?: number;
  knockout: boolean;
  technicalWeight: number;
  behavioralWeight: number;
  technicalIssues: ScorecardIssueSummary[];
  behavioralIssues: ScorecardIssueSummary[];
  knockoutChecks: ScorecardKnockoutCheck[];
  resultCode?: ResultCode;
  assessorRecommendation?: string;
}

export interface ResultData {
  resultCode?: ResultCode;
  evidenceSummary?: string;
  strengths?: string | null;
  gaps?: string | null;
  reopenedAt?: string | null;
  reopenReason?: string | null;
  scorecardSummary?: {
    completeCount: number;
    technical?: number;
    behavioral?: number;
    overall?: number;
    knockout: boolean;
    technicalWeight?: number;
    behavioralWeight?: number;
    technicalIssues?: ScorecardIssueSummary[];
    behavioralIssues?: ScorecardIssueSummary[];
    knockoutChecks?: ScorecardKnockoutCheck[];
    assessorRecommendation?: string;
  } | null;
  finalizedBy?: string;
  finalizedAt?: string;
  rationale?: string;
}

export interface PlanData {
  leadAssessor?: string | null;
  complexityBand?: string | null;
  methods?: Array<{
    methodCode: string;
    methodLabel?: string;
    required?: boolean;
    durationMin?: number | null;
  }>;
}

export interface EventItem {
  id: string;
  status: string;
  startsAt?: string;
  endsAt?: string;
  location?: string;
  meetingLink?: string | null;
  assessors?: Array<{ userId?: string; displayName?: string; role?: string }>;
}

export interface ApprovalStepItem {
  id: string;
  sequence: number;
  role: string;
  approverName?: string | null;
  decision: 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED';
  comment?: string | null;
  decidedAt?: string | null;
}

export interface DevelopmentData {
  id?: string;
  ownerName?: string;
  actionPlan?: string | null;
  learningManagementSystem?: string | null;
  targetDate?: string;
  status?: string;
  actions?: Array<{
    id?: string;
    title: string;
    ownerName: string;
    status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
    dueDate?: string;
    evidenceNote?: string | null;
  }>;
}

export function getAvailableAction(caseDetail: AssessmentCaseDetail, code: string) {
  return caseDetail.availableActions.find((action) => action.code === code);
}

export function eligibilityCriterionLabel(label: string) {
  return label === 'Active PIP or disciplinary action'
    ? 'No active PIP or disciplinary action'
    : label;
}

export function stageTabLabel(stage?: AssessmentCaseDetail['adminEditStage']) {
  if (stage === 'RECOMMENDATION' || stage === 'APPROVAL') return 'Decision';
  if (stage === 'FOLLOW_UP') return 'Follow-up';
  if (stage === 'PLANNING') return 'Plan';
  if (!stage) return 'Stage';
  return `${stage.charAt(0)}${stage.slice(1).toLowerCase()}`;
}

export function completedStagesBefore(
  status: AssessmentCaseDetail['status'],
): AdminReopenStageInput['stage'][] {
  const stages: AdminReopenStageInput['stage'][] = [];
  if (status !== 'DRAFT' && status !== 'CANCELLED') stages.push('REQUEST');
  if (!['DRAFT', 'SUBMITTED', 'PENDING_ELIGIBILITY', 'CANCELLED'].includes(status)) {
    stages.push('ELIGIBILITY');
  }
  if (
    ![
      'DRAFT',
      'SUBMITTED',
      'PENDING_ELIGIBILITY',
      'NOT_ELIGIBLE',
      'READY_FOR_PLANNING',
      'CANCELLED',
    ].includes(status)
  ) {
    stages.push('PLANNING');
  }
  if (
    [
      'PENDING_RESULT',
      'RESULT_FINALIZED',
      'PENDING_RECOMMENDATION',
      'PENDING_APPROVAL',
      'APPROVED',
      'DEVELOPMENT_IN_PROGRESS',
      'REASSESSMENT_DUE',
      'CLOSED',
    ].includes(status)
  ) {
    stages.push('ASSESSMENT');
  }
  if (PAST_RESULT_STATUSES.includes(status)) stages.push('RESULT');
  if (['PENDING_APPROVAL', ...PAST_DECISION_STATUSES].includes(status)) {
    stages.push('RECOMMENDATION');
  }
  if (['REASSESSMENT_DUE', 'CLOSED'].includes(status)) stages.push('FOLLOW_UP');
  return stages;
}

export function computeElapsedStageLabel(
  requestedAt: string,
  stageEnteredAt?: string | null,
  status?: string,
): string {
  if (status === 'CLOSED') return 'Sealed';
  if (status === 'CANCELLED') return 'Cancelled';
  if (status === 'NOT_ELIGIBLE') return 'SLA Paused';
  const anchor = stageEnteredAt || requestedAt;
  const parsed = new Date(anchor);
  if (Number.isNaN(parsed.getTime())) return 'Active';
  const days = Math.max(0, Math.floor((Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24)));
  if (days === 0) return 'Entered today';
  if (days === 1) return '1 day in stage';
  return `${days} days in stage`;
}

export const STAGE_SELECTOR_MAP: Record<string, string> = {
  Request: '.case-summary',
  Eligibility: '.decision-panel, .override-panel, .decision-summary-panel',
  Plan: '.plan-panel',
  Assessment: '.events-panel, .evidence-panel',
  Result: '.result-panel',
  Decision: '.recommendation-panel, .approval-panel, .decision-panel',
  'Follow-up': '.development-panel, .close-panel',
};
