import { z } from 'zod';

export * from './scorecard';

export type { z } from 'zod';

export const assessmentReasons = [
  'PROMOTION',
  'INTERNAL_MOBILITY',
  'ROLE_REALIGNMENT',
  'EXTERNAL_RECRUITMENT',
] as const;
export type AssessmentReason = (typeof assessmentReasons)[number];

export const candidateTypes = ['INTERNAL_EMPLOYEE', 'NEW_CANDIDATE'] as const;
export type CandidateType = (typeof candidateTypes)[number];
export const hiringOutcomes = ['PENDING', 'JOINED', 'NOT_JOINED'] as const;
export type HiringOutcome = (typeof hiringOutcomes)[number];
export const hiringOutcomeReasons = [
  'ASSESSMENT',
  'OFFER_DECLINED',
  'ROLE_CANCELLED',
  'OTHER',
] as const;
export type HiringOutcomeReason = (typeof hiringOutcomeReasons)[number];

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

export const criterionResults = ['MET', 'NOT_MET', 'NOT_CHECKED', 'NOT_APPLICABLE'] as const;
export type CriterionResultCode = (typeof criterionResults)[number];

export const resultCodes = [
  'READY_NOW',
  'READY_WITH_DEVELOPMENT',
  'NOT_READY',
  'INCOMPLETE',
] as const;
export type ResultCode = (typeof resultCodes)[number];

export const createCaseSchema = z
  .object({
    candidateType: z.enum(candidateTypes).default('INTERNAL_EMPLOYEE'),
    // Staff number. Required for internal employees; optional for external candidates.
    employeeId: z.string().trim().max(60).optional().default(''),
    employeeName: z.string().trim().min(2).max(120),
    candidateEmail: z.string().trim().email().max(254).optional().or(z.literal('')),
    department: z.string().trim().min(2).max(120),
    currentRole: z.string().trim().max(160).optional(),
    currentLevel: z.string().trim().max(80).optional(),
    assessmentReason: z.enum(assessmentReasons),
    targetRole: z.string().trim().min(2).max(160),
    targetLevel: z.string().trim().min(1).max(80),
    justification: z.string().trim().min(20).max(4000),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH']).default('NORMAL'),
  })
  .superRefine((data, ctx) => {
    if (
      data.candidateType === 'NEW_CANDIDATE' &&
      data.assessmentReason !== 'EXTERNAL_RECRUITMENT'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['assessmentReason'],
        message: 'New candidates must use External Recruitment as the assessment reason',
      });
    }
    if (
      data.candidateType === 'INTERNAL_EMPLOYEE' &&
      data.assessmentReason === 'EXTERNAL_RECRUITMENT'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['assessmentReason'],
        message: 'External Recruitment is only for new candidates',
      });
    }
    if (data.candidateType === 'INTERNAL_EMPLOYEE') {
      if (!data.employeeId || data.employeeId.toLowerCase() === 'emp-new') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['employeeId'],
          message: 'Enter the employee ID (staff number)',
        });
      }
      if (!data.currentRole || data.currentRole.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['currentRole'],
          message: 'Enter the current role',
        });
      }
      if (!data.currentLevel) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['currentLevel'],
          message: 'Choose the current level',
        });
      }
    }
    if (data.candidateType === 'NEW_CANDIDATE' && !data.candidateEmail) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['candidateEmail'],
        message: 'Enter the candidate email',
      });
    }
  });
export type CreateCaseInput = z.input<typeof createCaseSchema>;

export const eligibilityDecisionSchema = z.object({
  decision: z.enum(eligibilityDecisions),
  reason: z.string().max(2000).optional(),
  criteria: z
    .array(
      z.object({
        code: z.string().min(1).max(40),
        result: z.enum(criterionResults),
      }),
    )
    .max(20)
    .optional(),
  expectedVersion: z.number().int().positive(),
});
export type EligibilityDecisionInput = z.infer<typeof eligibilityDecisionSchema>;

export const overrideRequestSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, 'Enter an override justification (at least 5 characters).')
    .max(2000),
  expectedVersion: z.number().int().positive().optional(),
});
export type OverrideRequestInput = z.infer<typeof overrideRequestSchema>;

export const adminReopenableStages = [
  'REQUEST',
  'ELIGIBILITY',
  'PLANNING',
  'ASSESSMENT',
  'RESULT',
  'RECOMMENDATION',
  'FOLLOW_UP',
] as const;
export type AdminReopenableStage = (typeof adminReopenableStages)[number];

export const adminReopenStageSchema = z.object({
  stage: z.enum(adminReopenableStages),
  reason: z.string().trim().min(10).max(2000),
  expectedVersion: z.number().int().positive(),
});
export type AdminReopenStageInput = z.infer<typeof adminReopenStageSchema>;

export const adminEditRequestSchema = z.object({
  targetRole: z.string().trim().min(2).max(160),
  targetLevel: z.string().trim().min(1).max(80),
  justification: z.string().trim().min(20).max(4000),
  reason: z.string().trim().min(10).max(2000),
  expectedVersion: z.number().int().positive(),
});
export type AdminEditRequestInput = z.infer<typeof adminEditRequestSchema>;

export const updateEmployeeNameSchema = z.object({
  displayName: z.string().trim().min(2, 'Enter the employee name.').max(120),
  reason: z.string().trim().min(10, 'Give a reason of at least 10 characters.').max(500),
});
export type UpdateEmployeeNameInput = z.infer<typeof updateEmployeeNameSchema>;

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

export const scheduleEventSchema = z
  .object({
    planMethodId: z.string().uuid().optional(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime().optional(),
    timezone: z.string().min(1).max(80).optional(),
    location: z.string().max(200).optional(),
    meetingLink: z
      .string()
      .max(500)
      .refine((value) => !value || /^https?:\/\//i.test(value.trim()), {
        message: 'Meeting link must use http:// or https://',
      })
      .optional(),
    assessors: z
      .array(z.object({ userId: z.string().min(1), displayName: z.string().min(1).max(120) }))
      .max(20)
      .optional(),
    expectedVersion: z.number().int().positive(),
  })
  .superRefine((data, ctx) => {
    if (data.endsAt && new Date(data.endsAt).getTime() <= new Date(data.startsAt).getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endsAt'],
        message: 'Session end time must be after the start time',
      });
    }
  });
export type ScheduleEventInput = z.infer<typeof scheduleEventSchema>;

export const saveEvidenceSchema = z.object({
  summary: z.string().min(20).max(8000),
  strengths: z.string().max(4000).optional(),
  gaps: z.string().max(4000).optional(),
  expectedVersion: z.number().int().positive().optional(),
});
export type SaveEvidenceInput = z.infer<typeof saveEvidenceSchema>;

export const assessorRecommendationCodes = [
  'READY_FOR_PROMOTION',
  'ACTING_FOR_3_MONTHS',
  'FIT_FOR_CURRENT_POSITION',
  'UNFIT_FOR_CURRENT_POSITION',
  'NOT_READY_FOR_PROMOTION',
  'DOWNGRADE',
  'REPLACEMENT',
] as const;
export type AssessorRecommendationCode = (typeof assessorRecommendationCodes)[number];

export const finalizeResultSchema = z.object({
  resultCode: z.enum(resultCodes).optional(),
  assessorRecommendation: z.enum(assessorRecommendationCodes).optional(),
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

export const reviseScorecardSchema = z.object({
  reason: z.string().trim().min(3, 'Enter a reason of at least 3 characters.').max(500),
});
export type ReviseScorecardInput = z.infer<typeof reviseScorecardSchema>;

export const feedbackVisibilitySchema = z.object({
  visible: z.boolean(),
});
export type FeedbackVisibilityInput = z.infer<typeof feedbackVisibilitySchema>;

export const updateAssessorRecommendationSchema = z.object({
  code: z.enum(assessorRecommendationCodes),
  reason: z.string().trim().min(3).max(500),
  expectedVersion: z.number().int().positive(),
});
export type UpdateAssessorRecommendationInput = z.infer<typeof updateAssessorRecommendationSchema>;

export const submitRecommendationSchema = z.object({
  code: z.string().min(1).max(40),
  rationale: z.string().min(20).max(8000),
  requiresDevelopment: z.boolean().default(false),
  requiresManagerActionPlan: z.boolean().default(false),
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

export const updateDevelopmentSchema = z
  .object({
    actionPlan: z.string().max(8000).optional(),
    learningManagementSystem: z.string().max(8000).optional(),
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
    hiringOutcome: z.enum(hiringOutcomes).optional(),
    hiringOutcomeReason: z.enum(hiringOutcomeReasons).nullable().optional(),
    expectedVersion: z.number().int().positive(),
  })
  .superRefine((data, ctx) => {
    if (data.hiringOutcome === 'NOT_JOINED' && !data.hiringOutcomeReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['hiringOutcomeReason'],
        message: 'Choose why the candidate did not join',
      });
    }
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

// ==========================================
// Auth, Access Control & Administration Schemas
// ==========================================

export const authLoginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.').max(254),
  password: z.string().min(1, 'Enter your password.').max(256),
});
export type AuthLoginInput = z.infer<typeof authLoginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.').max(256),
    newPassword: z
      .string()
      .min(12, 'Password must be at least 12 characters.')
      .max(256, 'Password must be at most 256 characters.'),
    confirmPassword: z.string().max(256).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.newPassword === data.currentPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['newPassword'],
        message: 'Choose a new password that differs from your current one.',
      });
    }
    if (typeof data.confirmPassword === 'string' && data.confirmPassword !== data.newPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'Passwords do not match.',
      });
    }
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const appRoleNames = [
  'Employee',
  'EmployeeManager',
  'Requester',
  'Manager',
  'Coordinator',
  'Assessor',
  'PanelLead',
  'HR',
  'BusinessApprover',
  'Auditor',
  'Admin',
] as const;
export type AppRoleName = (typeof appRoleNames)[number];

export const accessScopeTypes = [
  'NONE',
  'SELF',
  'DIRECT_REPORTS',
  'DEPARTMENTS',
  'ASSIGNED',
  'ORGANIZATION',
] as const;
export type AccessScopeType = (typeof accessScopeTypes)[number];

export const adminCreateAccountSchema = z.object({
  email: z.string().trim().email('Enter a valid company email address.').max(254),
  displayName: z.string().trim().min(1, 'Display name is required.').max(120),
  roles: z.array(z.string().min(1)).min(1, 'Select at least one role.').max(10),
  scopeType: z.enum(accessScopeTypes),
  scopeValues: z.array(z.string().trim()).max(100).default([]),
  active: z.boolean().optional().default(true),
  password: z.string().min(12).max(256).optional(),
});
export type AdminCreateAccountInput = z.infer<typeof adminCreateAccountSchema>;

export const adminUpdateAccountSchema = z.object({
  email: z.string().trim().email('Enter a valid company email address.').max(254).optional(),
  displayName: z.string().trim().min(1, 'Display name is required.').max(120).optional(),
  roles: z.array(z.string().min(1)).min(1).max(10).optional(),
  scopeType: z.enum(accessScopeTypes).optional(),
  scopeValues: z.array(z.string().trim()).max(100).optional(),
  active: z.boolean().optional(),
  password: z.string().min(12).max(256).optional(),
});
export type AdminUpdateAccountInput = z.infer<typeof adminUpdateAccountSchema>;

export const slaWindowsSchema = z.object({
  eligibilityHours: z.number().int().min(1).max(720),
  assessorHours: z.number().int().min(1).max(720),
  committeeHours: z.number().int().min(1).max(720),
});

export const administrationPolicySchema = z
  .object({
    version: z.string().min(1).max(40).optional(),
    updatedAt: z.string().optional(),
    cbiWeight: z.number().int().min(0).max(100),
    caseStudyWeight: z.number().int().min(0).max(100),
    simulationWeight: z.number().int().min(0).max(100),
    passingScore: z.number().min(0).max(100),
    blindGrading: z.boolean(),
    autoEscalate: z.boolean(),
    slaWindows: slaWindowsSchema,
  })
  .superRefine((policy, ctx) => {
    const total = policy.cbiWeight + policy.caseStudyWeight + policy.simulationWeight;
    if (total !== 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cbiWeight'],
        message: `Scoring weights must total 100% (currently ${total}%).`,
      });
    }
  });

export const adminPolicyEnforceSchema = z.object({
  policy: administrationPolicySchema,
  reason: z.string().trim().max(2000).optional(),
});
export type AdminPolicyEnforceInput = z.infer<typeof adminPolicyEnforceSchema>;

export interface RolePermissionMatrixEntry {
  role: AppRoleName;
  label: string;
  description: string;
  allowedScopes: AccessScopeType[];
  defaultHome: string;
  pages: string[];
  capabilities: string[];
  restrictions: string[];
}

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
  candidateType: CandidateType;
  candidateEmail?: string | null;
  hiringOutcome: HiringOutcome;
  hiringOutcomeReason?: HiringOutcomeReason | null;
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
  stageEnteredAt?: string;
  ageLabel: string;
  version: number;
  adminEditStage?: CaseStage | null;
  scoringEnabled: boolean;
  availableActions: AvailableAction[];
}

export interface AssessmentCaseDetail extends AssessmentCaseSummary {
  justification: string;
  feedbackReleasedAt?: string | null;
  eligibility?: {
    policyVersion: string;
    criteria: Array<{
      code: string;
      label: string;
      blocking: boolean;
      result: CriterionResultCode;
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

export interface OverviewNavCounts {
  activeCases: number;
  openTasks: number;
  employees: number;
  activeDevelopment: number;
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
    dueAt?: string | null;
    taskType?: string;
    priority: 'HIGH' | 'NORMAL' | 'LOW';
  }>;
  pipeline: Array<{ label: string; value: number; tone: 'indigo' | 'teal' | 'violet' | 'warning' }>;
  slaWindows: {
    eligibilityHours: number;
    assessorHours: number;
    committeeHours: number;
  };
  navCounts?: OverviewNavCounts;
}

export const DEFAULT_SLA_WINDOWS = {
  eligibilityHours: 48,
  assessorHours: 120,
  committeeHours: 72,
} as const;

export interface DevelopmentActionDto {
  id: string;
  title: string;
  ownerName: string;
  dueDate?: string | null;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  evidenceNote?: string | null;
  completedAt?: string | null;
}

export interface DevelopmentPlanWithCaseDto {
  id: string;
  caseId: string;
  ownerName: string;
  actionPlan?: string | null;
  learningManagementSystem?: string | null;
  targetDate?: string | null;
  status: string;
  actions: DevelopmentActionDto[];
  caseSummary?: {
    caseCode: string;
    employeeId: string;
    employeeName: string;
    department: string;
    targetRole: string;
    status: CaseStatus;
    candidateType: CandidateType;
    hiringOutcome: HiringOutcome;
    hiringOutcomeReason?: HiringOutcomeReason | null;
  };
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
  fileName: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .refine((value) => !/[\\/]/.test(value) && !value.includes('..'), {
      message: 'File name must not contain path separators or traversal sequences.',
    }),
  contentType: z.string().trim().min(1).max(120),
  sizeBytes: z
    .number()
    .int()
    .positive('File size must be greater than 0 bytes')
    .max(MAX_ATTACHMENT_SIZE_BYTES, 'File size exceeds 10MB maximum limit'),
  classification: z.string().trim().min(1, 'Classification is required').max(80),
  storageKey: z.string().min(1).max(500).optional(),
  contentBase64: z.string().max(15_000_000).optional(),
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
  /** Null when the case did not capture the employee's current level. */
  currentLevel: string | null;
  targetRole: string;
  targetLevel: string | null;
  status: CaseStatus;
  stage: CaseStage;
  resultCode?: ResultCode | null;
  recommendationCode?: string | null;
  /** Weighted average Technical score (0-5) from submitted scorecards. */
  technicalScore?: number | null;
  /** Weighted average Behavioral score (0-5) from submitted scorecards. */
  behavioralScore?: number | null;
  /** Null placement means the candidate is listed in `unplaced`, not on the grid. */
  performanceBand: CalibrationPerformanceLevel | null;
  potentialBand: CalibrationPotentialLevel | null;
  boxIndex: number | null; // 1 to 9 (1 = Underperformer, 9 = Star) when placed
  boxLabel: string | null;
  readinessLabel: string;
  /** Result the current scorecards give (may differ from the finalized result above). */
  scoredResultCode?: ResultCode | null;
  /** Where the placement scores came from: re-scored scorecards, or the scores stored on an imported result. */
  scoreSource?: 'SCORECARD' | 'RESULT_SUMMARY' | null;
  /** True when any assessor flagged a knockout on a submitted scorecard. */
  knockout?: boolean;
  /** Reason a candidate is not on the grid (e.g. result not finalized). */
  unplacedReason?: string | null;
  /** Not tracked yet; kept for compatibility and always null. */
  tenureMonths: number | null;
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
  /** Placed plus unplaced candidates in the viewer's scope. */
  totalCandidates: number;
  /** Candidates on the grid; cell percentages are relative to this. */
  placedCandidates?: number;
  /** How each axis is derived, for display next to the grid. */
  axes?: {
    performance: string;
    potential: string;
    lowBelow: number;
    highFrom: number;
  };
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
  /** In-scope candidates without a finalized, scored result. */
  unplaced?: CalibrationCandidate[];
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
