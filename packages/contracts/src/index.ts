import { z } from 'zod';

export type { z } from 'zod';

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

export const planMethodSchema = z.object({
  methodCode: z.string().min(1).max(40),
  methodLabel: z.string().min(1).max(120).optional(),
  required: z.boolean().default(true),
  durationMin: z.number().int().positive().max(1440).optional(),
});

export const finalizePlanSchema = z.object({
  methods: z.array(planMethodSchema).min(1).max(10),
  leadAssessor: z.string().min(2).max(120).optional(),
  complexityBand: z.string().min(1).max(40).optional(),
  deviationReason: z.string().max(2000).optional(),
  expectedVersion: z.number().int().positive(),
});
export type FinalizePlanInput = z.infer<typeof finalizePlanSchema>;

export const scheduleEventSchema = z.object({
  planMethodId: z.string().uuid().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
  timezone: z.string().min(1).max(80).optional(),
  location: z.string().max(200).optional(),
  meetingLink: z.string().max(500).optional(),
  assessors: z
    .array(z.object({ userId: z.string().min(1), displayName: z.string().min(1).max(120) }))
    .max(20)
    .optional(),
  expectedVersion: z.number().int().positive(),
});
export type ScheduleEventInput = z.infer<typeof scheduleEventSchema>;

export const saveEvidenceSchema = z.object({
  summary: z.string().min(20).max(8000),
  strengths: z.string().max(4000).optional(),
  gaps: z.string().max(4000).optional(),
  expectedVersion: z.number().int().positive().optional(),
});
export type SaveEvidenceInput = z.infer<typeof saveEvidenceSchema>;

export const finalizeResultSchema = z.object({
  resultCode: z.enum(resultCodes),
  evidenceSummary: z.string().max(4000).optional(),
  strengths: z.string().max(4000).optional(),
  gaps: z.string().max(4000).optional(),
  developmentFocus: z.string().max(4000).optional(),
  expectedVersion: z.number().int().positive(),
});
export type FinalizeResultInput = z.infer<typeof finalizeResultSchema>;

export const reopenResultSchema = z.object({
  reason: z.string().min(10).max(2000),
  expectedVersion: z.number().int().positive(),
});
export type ReopenResultInput = z.infer<typeof reopenResultSchema>;

export const submitRecommendationSchema = z.object({
  code: z.string().min(1).max(40),
  rationale: z.string().min(20).max(8000),
  requiresDevelopment: z.boolean().default(false),
  requiresReassessment: z.boolean().default(false),
  targetDate: z.string().datetime().optional(),
  expectedVersion: z.number().int().positive(),
});
export type SubmitRecommendationInput = z.infer<typeof submitRecommendationSchema>;

export const approvalDecisions = ['APPROVED', 'CHANGES_REQUESTED', 'REJECTED'] as const;

export const decideApprovalSchema = z.object({
  decision: z.enum(approvalDecisions),
  comment: z.string().max(4000).optional(),
  expectedVersion: z.number().int().positive().optional(),
});
export type DecideApprovalInput = z.infer<typeof decideApprovalSchema>;

export const updateDevelopmentSchema = z.object({
  actions: z
    .array(
      z.object({
        title: z.string().min(3).max(200),
        ownerName: z.string().min(2).max(120),
        dueDate: z.string().datetime().optional(),
        status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']).default('NOT_STARTED'),
        evidenceNote: z.string().max(2000).optional(),
      }),
    )
    .max(30)
    .optional(),
  targetDate: z.string().datetime().optional(),
  expectedVersion: z.number().int().positive(),
});
export type UpdateDevelopmentInput = z.infer<typeof updateDevelopmentSchema>;

export const scheduleReassessmentSchema = z.object({
  reason: z.string().min(10).max(2000),
  targetDate: z.string().datetime().optional(),
  expectedVersion: z.number().int().positive(),
});
export type ScheduleReassessmentInput = z.infer<typeof scheduleReassessmentSchema>;

export const closeCaseSchema = z.object({
  expectedVersion: z.number().int().positive(),
});
export type CloseCaseInput = z.infer<typeof closeCaseSchema>;

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

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
] as const;

export const ALLOWED_ATTACHMENT_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.jpg',
  '.jpeg',
  '.png',
] as const;

export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB (10,485,760 bytes)

export const attachmentScanStatuses = [
  'PENDING',
  'SCANNING',
  'CLEAN',
  'REJECTED',
  'FAILED',
] as const;
export type AttachmentScanStatus = (typeof attachmentScanStatuses)[number];

export function isAllowedAttachmentType(fileName: string, contentType: string): boolean {
  const normalizedMime = contentType.toLowerCase().trim();
  const hasAllowedMime =
    ALLOWED_ATTACHMENT_MIME_TYPES.includes(
      normalizedMime as (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number],
    ) ||
    normalizedMime === 'image/jpg' ||
    normalizedMime === 'image/pjpeg';

  const lastDot = fileName.lastIndexOf('.');
  if (lastDot === -1) return false;
  const ext = fileName.slice(lastDot).toLowerCase().trim();
  const hasAllowedExt = ALLOWED_ATTACHMENT_EXTENSIONS.includes(
    ext as (typeof ALLOWED_ATTACHMENT_EXTENSIONS)[number],
  );

  return hasAllowedMime && hasAllowedExt;
}

export const createAttachmentSchema = z.object({
  caseId: z.string().uuid(),
  evidenceId: z.string().uuid().optional(),
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(120),
  sizeBytes: z
    .number()
    .int()
    .positive('File size must be greater than 0 bytes')
    .max(MAX_ATTACHMENT_SIZE_BYTES, 'File size exceeds 10MB maximum limit'),
  classification: z.string().min(1, 'Classification is required').max(80),
  storageKey: z.string().min(1).max(500).optional(),
});
export type CreateAttachmentInput = z.infer<typeof createAttachmentSchema>;

export interface AttachmentSummary {
  id: string;
  caseId: string;
  evidenceId?: string | null;
  classification: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  storageKey: string;
  scanStatus: AttachmentScanStatus;
  scanReason?: string | null;
  createdBy: string;
  createdAt: string;
  scannedAt?: string | null;
  downloadUrl?: string | null;
  previewUrl?: string | null;
}

// ==========================================
// Talent Calibration & 9-Box Matrix Contracts (UX-18)
// ==========================================

export const calibrationPerformanceLevels = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type CalibrationPerformanceLevel = (typeof calibrationPerformanceLevels)[number];

export const calibrationPotentialLevels = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type CalibrationPotentialLevel = (typeof calibrationPotentialLevels)[number];

export interface CalibrationCandidate {
  id: string;
  caseId: string;
  caseCode: string;
  employeeId: string;
  displayName: string;
  department: string;
  currentRole: string;
  currentLevel: string;
  targetRole: string;
  targetLevel: string;
  status: CaseStatus;
  stage: CaseStage;
  resultCode?: ResultCode | null;
  recommendationCode?: string | null;
  performanceBand: CalibrationPerformanceLevel;
  potentialBand: CalibrationPotentialLevel;
  boxIndex: number; // 1 to 9 (1 = Underperformer, 9 = Top Talent/Star)
  boxLabel: string;
  readinessLabel: string;
  tenureMonths: number;
}

export interface CalibrationCell {
  boxIndex: number;
  label: string;
  description: string;
  targetPercentage: number;
  actualPercentage: number;
  candidates: CalibrationCandidate[];
}

export interface CalibrationMatrixResponse {
  cohortName: string;
  evaluatedAt: string;
  totalCandidates: number;
  distributionSummary: {
    readyNowCount: number;
    readyWithDevelopmentCount: number;
    notReadyCount: number;
    pendingCount: number;
  };
  departmentBreakdown: Array<{
    department: string;
    total: number;
    readyNow: number;
    readyWithDevelopment: number;
    notReady: number;
  }>;
  grid: CalibrationCell[];
}

// ==========================================
// AI Assessor Copilot Contracts
// ==========================================

export const copilotSynthesizeSchema = z.object({
  targetCompetencies: z.array(z.string()).optional(),
  includeQuotes: z.boolean().optional(),
});
export type CopilotSynthesizeInput = z.infer<typeof copilotSynthesizeSchema>;

export interface CopilotSynthesizeResponse {
  caseId: string;
  executiveSummary: string;
  demonstratedStrengths: Array<{
    competency: string;
    evidenceExcerpt: string;
    confidenceScore: number;
  }>;
  identifiedGaps: Array<{
    competency: string;
    observation: string;
    severity: 'CRITICAL' | 'MODERATE' | 'MINOR';
  }>;
  suggestedOutcome: ResultCode;
  suggestedOutcomeRationale: string;
  generatedAt: string;
}

export const copilotBiasCheckSchema = z.object({
  text: z.string().min(1).max(10000),
});
export type CopilotBiasCheckInput = z.infer<typeof copilotBiasCheckSchema>;

export interface BiasWarning {
  phrase: string;
  category: 'GENDER_CODED' | 'AGE_BIAS' | 'SUBJECTIVE_PERSONALITY' | 'VAGUE_ATTRIBUTION';
  explanation: string;
  objectiveAlternative: string;
}

export interface CopilotBiasCheckResponse {
  clean: boolean;
  riskScore: 'LOW' | 'MEDIUM' | 'HIGH';
  findingsCount: number;
  warnings: BiasWarning[];
  sanitizedSuggestion?: string;
}

export const copilotSuggestActionsSchema = z.object({
  gapTags: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(10).optional(),
});
export type CopilotSuggestActionsInput = z.infer<typeof copilotSuggestActionsSchema>;

export interface SuggestedAction {
  title: string;
  description: string;
  targetWeeks: number;
  category: 'EXPERIENCE' | 'MENTORSHIP' | 'TRAINING' | 'PROJECT_DELIVERY';
  suggestedEvidence: string;
}

export interface CopilotSuggestActionsResponse {
  caseId: string;
  actions: SuggestedAction[];
  generatedAt: string;
}

