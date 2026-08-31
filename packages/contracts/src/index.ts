import { z } from 'zod';

export const assessmentReasons = ['PROMOTION', 'INTERNAL_MOBILITY', 'ROLE_REALIGNMENT'] as const;
export type AssessmentReason = (typeof assessmentReasons)[number];

export const caseStages = [
  'REQUEST',
  'ELIGIBILITY',
  'PLANNING',
  'ASSESSMENT',
  'RESULT',
  'RECOMMENDATION',
  'APPROVAL',
  'FOLLOW_UP',
  'CLOSED',
] as const;
export type CaseStage = (typeof caseStages)[number];

export const caseStatuses = [
  'DRAFT',
  'SUBMITTED',
  'PENDING_ELIGIBILITY',
  'NOT_ELIGIBLE',
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
  'CANCELLED',
] as const;
export type CaseStatus = (typeof caseStatuses)[number];

export const eligibilityDecisions = ['ELIGIBLE', 'NOT_ELIGIBLE'] as const;
export type EligibilityDecision = (typeof eligibilityDecisions)[number];

export const resultCodes = [
  'READY_NOW',
  'READY_WITH_DEVELOPMENT',
  'NOT_READY',
  'INCOMPLETE',
] as const;
export type ResultCode = (typeof resultCodes)[number];

export const createCaseSchema = z.object({
  employeeId: z.string().min(1),
  employeeName: z.string().min(2).max(120),
  department: z.string().min(2).max(120),
  currentRole: z.string().min(2).max(160),
  assessmentReason: z.enum(assessmentReasons),
  targetRole: z.string().min(2).max(160),
  targetLevel: z.string().min(1).max(80),
  justification: z.string().min(20).max(4000),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).default('NORMAL'),
});
export type CreateCaseInput = z.infer<typeof createCaseSchema>;

export const eligibilityDecisionSchema = z.object({
  decision: z.enum(eligibilityDecisions),
  reason: z.string().max(2000).optional(),
  expectedVersion: z.number().int().positive(),
});
export type EligibilityDecisionInput = z.infer<typeof eligibilityDecisionSchema>;

export interface AvailableAction {
  code: string;
  label: string;
  kind: 'primary' | 'secondary' | 'danger';
  enabled: boolean;
  reason?: string;
  requiresConfirmation?: boolean;
  confirmationSeverity?: 'standard' | 'destructive';
  prerequisites?: string[];
  consequences?: string[];
  nextOwner?: string;
  auditEvent?: string;
}

export interface AssessmentCaseSummary {
  id: string;
  caseCode: string;
  employeeId: string;
  employeeName: string;
  department: string;
  currentRole: string;
  assessmentReason: AssessmentReason;
  targetRole: string;
  targetLevel: string;
  stage: CaseStage;
  status: CaseStatus;
  owner: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH';
  requestedAt: string;
  ageLabel: string;
  version: number;
  scoringEnabled: false;
  availableActions: AvailableAction[];
}

export interface AssessmentCaseDetail extends AssessmentCaseSummary {
  justification: string;
  eligibility?: {
    policyVersion: string;
    criteria: Array<{
      code: string;
      label: string;
      blocking: boolean;
      result: 'MET' | 'NOT_MET' | 'NOT_CHECKED';
    }>;
    decision?: EligibilityDecision;
    reason?: string;
  };
  activity: Array<{
    id: string;
    actor: string;
    action: string;
    timestamp: string;
    tone: 'info' | 'success' | 'warning' | 'danger';
  }>;
}

export interface OverviewResponse {
  metrics: Array<{
    label: string;
    value: number;
    context: string;
    trend: string;
    tone: 'positive' | 'warning' | 'danger' | 'neutral';
  }>;
  tasks: Array<{
    id: string;
    title: string;
    caseCode: string;
    dueLabel: string;
    priority: 'HIGH' | 'NORMAL' | 'LOW';
  }>;
  pipeline: Array<{ label: string; value: number; tone: 'indigo' | 'teal' | 'violet' | 'warning' }>;
}

export interface ApiErrorShape {
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
    blockingRequirements?: string[];
    correlationId: string;
  };
}
