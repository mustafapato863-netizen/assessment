import type {
  AssessmentCaseDetail,
  AssessmentCaseSummary,
  AttachmentScanStatus,
  AttachmentSummary,
  AdminReopenStageInput,
  AdminEditRequestInput,
  UpdateEmployeeNameInput,
  CalibrationMatrixResponse,
  CloseCaseInput,
  CopilotBiasCheckInput,
  CopilotBiasCheckResponse,
  CopilotSuggestActionsInput,
  CopilotSuggestActionsResponse,
  CopilotSynthesizeInput,
  CopilotSynthesizeResponse,
  CreateAttachmentInput,
  CreateCaseInput,
  DecideApprovalInput,
  EligibilityDecisionInput,
  FinalizePlanInput,
  FinalizeResultInput,
  OverviewResponse,
  ReopenResultInput,
  SaveEvidenceInput,
  ScheduleEventInput,
  ScheduleReassessmentInput,
  SubmitRecommendationInput,
  UpdateDevelopmentInput,
  ScorecardConfig,
  ScorecardRatings,
} from '@assessflow/contracts';
import { getActiveUser, getAuthToken } from './auth';

export type EventScheduleResult = AssessmentCaseDetail & { eventId: string };

export type EvidenceSaveResult = AssessmentCaseDetail & {
  evidenceId: string;
  submitted: boolean;
};

export type ApprovalStepDecisionResult = AssessmentCaseDetail & {
  stepId: string;
};

export type ReassessmentScheduleResult = AssessmentCaseDetail & {
  linkId: string;
  sourceCaseId: string;
};

export interface RequestOptions {
  actorId?: string;
  idempotencyKey?: string;
}

export type AccessRole =
  | 'Requester'
  | 'Manager'
  | 'HR'
  | 'Coordinator'
  | 'Assessor'
  | 'PanelLead'
  | 'BusinessApprover'
  | 'Admin'
  | 'Auditor'
  | 'Employee'
  | 'EmployeeManager';

export type AccessScope =
  | 'NONE'
  | 'ORGANIZATION'
  | 'DEPARTMENTS'
  | 'DIRECT_REPORTS'
  | 'ASSIGNED'
  | 'SELF';

export interface AccessAccount {
  id: string;
  entraObjectId?: string | null;
  email: string;
  displayName: string;
  roles: AccessRole[];
  scopeType: AccessScope;
  scopeValues: string[];
  active: boolean;
  mustChangePassword?: boolean;
}

export interface AdministrationPolicy {
  version: string;
  cbiWeight: number;
  caseStudyWeight: number;
  simulationWeight: number;
  passingScore: number;
  blindGrading: boolean;
  autoEscalate: boolean;
  slaWindows: {
    eligibilityHours: number;
    assessorHours: number;
    committeeHours: number;
  };
  updatedAt?: string | null;
}

export interface AdminAuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  reason: string | null;
  hash: string | null;
  integrity: 'Not verified';
}

export interface AdminAuditPage {
  items: AdminAuditEvent[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminAccessCreateResult {
  account: AccessAccount;
  temporaryPassword: string;
}

export interface AdminPasswordResetResult {
  temporaryPassword: string;
}

export interface SignedInAccount {
  id: string;
  name: string;
  email: string;
  roles: AccessRole[];
  scopeType: AccessScope;
  scopeValues: string[];
  mustChangePassword?: boolean;
}

export interface AssessorAssignment {
  eventId: string;
  caseId: string;
  caseCode: string;
  employeeName: string;
  department: string;
  currentRole: string;
  targetRole: string;
  targetLevel: string | null;
  feedbackReleasedAt: string | null;
  caseStatus: string;
  eventStatus: string;
  startsAt: string | null;
  endsAt: string | null;
  timezone: string | null;
  location: string | null;
  method: string;
  evidenceStatus: 'NOT_STARTED' | 'DRAFT' | 'SUBMITTED';
  evidence: { summary: string; strengths: string | null; gaps: string | null } | null;
}

export interface MyResult {
  caseId: string;
  caseCode: string;
  assessmentReason: string;
  targetRole: string;
  targetLevel: string | null;
  resultCode: string;
  rationale: string | null;
  finalizedAt: string;
}

export interface AssessorAccountOption {
  id: string;
  displayName: string;
  email: string;
  roles: AccessRole[];
}

function resolveBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL?.trim();
  if (!envUrl) {
    throw new Error(
      'VITE_API_URL is not configured. Set it to the AssessFlow API base URL before starting the web app.',
    );
  }
  return envUrl;
}

const activeBaseUrl = resolveBaseUrl();

export const baseUrl = activeBaseUrl;
export function getBaseUrl(): string {
  return activeBaseUrl;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly code = 'REQUEST_FAILED',
    readonly fieldErrors: Record<string, string[]> = {},
    readonly scanStatus?: string,
    readonly scanReason?: string | null,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const currentBase = activeBaseUrl;
  const activeUser = getActiveUser();
  const localActorHeaders: Record<string, string> = getAuthToken()
    ? {}
    : {
        'x-actor-id': activeUser.actorId || 'demo-user',
        'x-actor-role': activeUser.role,
        'x-actor-name': activeUser.name,
      };

  const response = await fetch(`${currentBase}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
      ...localActorHeaders,
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json()) as T & {
    error?: {
      code?: string;
      message?: string;
      fieldErrors?: Record<string, string[]>;
      scanStatus?: string;
      scanReason?: string | null;
    };
  };
  if (!response.ok) {
    throw new ApiRequestError(
      payload.error?.message ?? 'The request could not be completed.',
      payload.error?.code,
      payload.error?.fieldErrors,
      payload.error?.scanStatus,
      payload.error?.scanReason,
    );
  }
  return payload;
}

function commandHeaders(
  actorIdOrOptions?: string | RequestOptions,
  idempotencyKey?: string,
): Record<string, string> {
  const activeUser = getActiveUser();
  let actorId = activeUser.actorId || 'hr-partner';
  let finalKey = idempotencyKey;

  if (typeof actorIdOrOptions === 'string') {
    if (actorIdOrOptions.trim() && actorIdOrOptions !== 'demo-user') {
      actorId = actorIdOrOptions;
    }
  } else if (actorIdOrOptions && typeof actorIdOrOptions === 'object') {
    if (actorIdOrOptions.actorId?.trim() && actorIdOrOptions.actorId !== 'demo-user') {
      actorId = actorIdOrOptions.actorId;
    }
    if (actorIdOrOptions.idempotencyKey?.trim()) {
      finalKey = actorIdOrOptions.idempotencyKey;
    }
  }

  const headers: Record<string, string> = {
    'x-actor-id': actorId,
    'x-actor-role': activeUser.role,
    'x-actor-name': activeUser.name,
  };
  if (finalKey) {
    headers['Idempotency-Key'] = finalKey;
  }
  return headers;
}

export const api = {
  authenticate: (email: string, password: string) =>
    request<{ token: string; user: SignedInAccount }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  accessAccounts: () => request<AccessAccount[]>('/access/accounts'),
  assessorAccounts: () => request<AssessorAccountOption[]>('/access/accounts/assessor-options'),
  createAccessAccount: (
    input: Omit<AccessAccount, 'id' | 'active'> & { active?: boolean; password: string },
  ) => request<AccessAccount>('/access/accounts', { method: 'POST', body: JSON.stringify(input) }),
  updateAccessAccount: (id: string, input: Partial<AccessAccount> & { password?: string }) =>
    request<AccessAccount>(`/access/accounts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  removeAccessAccount: (id: string) =>
    request<{ id: string; removed: boolean }>(`/access/accounts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  adminAccessAccounts: () => request<AccessAccount[]>('/admin/accounts'),
  adminCreateAccessAccount: (input: Omit<AccessAccount, 'id' | 'active'>) =>
    request<AdminAccessCreateResult>('/admin/accounts', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  adminUpdateAccessAccount: (id: string, input: Partial<AccessAccount>) =>
    request<AccessAccount>(`/admin/accounts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  adminDeactivateAccessAccount: (id: string) =>
    request<AccessAccount>(`/admin/accounts/${encodeURIComponent(id)}/deactivate`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  adminResetAccessPassword: (id: string) =>
    request<AdminPasswordResetResult>(`/admin/accounts/${encodeURIComponent(id)}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  adminPolicy: () => request<AdministrationPolicy>('/admin/policy'),
  enforceAdminPolicy: (input: { policy: AdministrationPolicy; reason?: string }) =>
    request<AdministrationPolicy>('/admin/policy/enforce', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  adminAudit: (
    filters: {
      search?: string;
      action?: string;
      from?: string;
      to?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ) => {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') query.set(key, String(value));
    });
    return request<AdminAuditPage>(`/admin/audit?${query.toString()}`);
  },
  changeTemporaryPassword: (
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
  ) =>
    request<{ changed: true }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    }),
  overview: () => request<OverviewResponse>('/overview'),
  assessorAssignments: () => request<AssessorAssignment[]>('/assessor/assignments'),
  myResults: () => request<MyResult[]>('/me/results'),
  setFeedbackVisibility: (caseId: string, visible: boolean) =>
    request<{ caseId: string; visible: boolean; feedbackReleasedAt: string | null }>(
      `/cases/${encodeURIComponent(caseId)}/feedback-visibility`,
      { method: 'POST', body: JSON.stringify({ visible }) },
    ),
  tasks: () => request<OverviewResponse['tasks']>('/tasks'),
  cases: (search = '') =>
    request<AssessmentCaseSummary[]>(
      `/cases${search ? `?search=${encodeURIComponent(search)}` : ''}`,
    ),
  caseDetail: (id: string) => request<AssessmentCaseDetail>(`/cases/${id}`),
  reopenCompletedStage: (id: string, input: AdminReopenStageInput) =>
    request<AssessmentCaseDetail>(`/cases/${id}/stages/reopen`, {
      method: 'POST',
      headers: commandHeaders(),
      body: JSON.stringify(input),
    }),
  updateEmployeeName: (caseId: string, input: UpdateEmployeeNameInput) =>
    request<AssessmentCaseDetail>(`/cases/${caseId}/employee-name`, {
      method: 'PATCH',
      headers: commandHeaders(),
      body: JSON.stringify(input),
    }),
  updateReopenedRequest: (id: string, input: AdminEditRequestInput) =>
    request<AssessmentCaseDetail>(`/cases/${id}/request`, {
      method: 'PATCH',
      headers: commandHeaders(),
      body: JSON.stringify(input),
    }),
  scorecard: <T = unknown>(caseId: string) => request<T>(`/cases/${caseId}/scorecard`),
  updateScorecardConfig: (caseId: string, config: ScorecardConfig) =>
    request<{ config: ScorecardConfig; canEditWeights: boolean }>(
      `/cases/${caseId}/scorecard/config`,
      { method: 'PATCH', body: JSON.stringify(config) },
    ),
  saveScorecard: (caseId: string, ratings: ScorecardRatings, submit: boolean) =>
    request<{ saved: boolean; submitted: boolean }>(`/cases/${caseId}/scorecard`, {
      method: 'POST',
      body: JSON.stringify({ ratings, submit }),
    }),
  reviseScorecard: (caseId: string, reason: string) =>
    request<{ reopened: boolean }>(`/cases/${caseId}/scorecard/revise`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  createCase: (
    input: CreateCaseInput,
    actorId: string | RequestOptions = 'demo-user',
    idempotencyKey?: string,
  ) =>
    request<AssessmentCaseDetail>('/cases', {
      method: 'POST',
      headers: commandHeaders(actorId, idempotencyKey),
      body: JSON.stringify(input),
    }),
  submitCase: (
    id: string,
    expectedVersion: number,
    actorId: string | RequestOptions = 'demo-user',
    idempotencyKey?: string,
  ) =>
    request<AssessmentCaseDetail>(`/cases/${id}/submit`, {
      method: 'POST',
      headers: commandHeaders(actorId, idempotencyKey),
      body: JSON.stringify({ expectedVersion }),
    }),
  decideEligibility: (
    id: string,
    input: EligibilityDecisionInput,
    actorId: string | RequestOptions = 'demo-user',
    idempotencyKey?: string,
  ) =>
    request<AssessmentCaseDetail>(`/cases/${id}/eligibility/decision`, {
      method: 'POST',
      headers: commandHeaders(actorId, idempotencyKey),
      body: JSON.stringify(input),
    }),
  requestOverride: (
    id: string,
    reason: string,
    actorId: string | RequestOptions = 'demo-user',
    idempotencyKey?: string,
  ) =>
    request<AssessmentCaseDetail>(`/cases/${id}/eligibility/override-request`, {
      method: 'POST',
      headers: commandHeaders(actorId, idempotencyKey),
      body: JSON.stringify({ reason }),
    }),
  finalizePlan: (
    caseId: string,
    input: FinalizePlanInput,
    actorId: string | RequestOptions = 'demo-user',
    idempotencyKey?: string,
  ) =>
    request<AssessmentCaseDetail>(`/cases/${caseId}/plan/finalize`, {
      method: 'POST',
      headers: commandHeaders(actorId, idempotencyKey),
      body: JSON.stringify(input),
    }),
  getPlan: <T = unknown>(caseId: string) => request<T>(`/cases/${caseId}/plan`),
  scheduleEvent: (
    caseId: string,
    input: ScheduleEventInput,
    actorId: string | RequestOptions = 'demo-user',
    idempotencyKey?: string,
  ) =>
    request<EventScheduleResult>(`/cases/${caseId}/events`, {
      method: 'POST',
      headers: commandHeaders(actorId, idempotencyKey),
      body: JSON.stringify(input),
    }),
  listEvents: <T = unknown>(caseId: string) => request<T[]>(`/cases/${caseId}/events`),
  saveEvidenceDraft: (
    eventId: string,
    input: SaveEvidenceInput,
    actorId: string | RequestOptions = 'demo-user',
    idempotencyKey?: string,
  ) =>
    request<EvidenceSaveResult>(`/events/${eventId}/evidence`, {
      method: 'POST',
      headers: commandHeaders(actorId, idempotencyKey),
      body: JSON.stringify(input),
    }),
  submitEvidence: (
    eventId: string,
    input: SaveEvidenceInput,
    actorId: string | RequestOptions = 'demo-user',
    idempotencyKey?: string,
  ) =>
    request<EvidenceSaveResult>(`/events/${eventId}/evidence/submit`, {
      method: 'POST',
      headers: commandHeaders(actorId, idempotencyKey),
      body: JSON.stringify(input),
    }),
  finalizeResult: (
    caseId: string,
    input: FinalizeResultInput,
    actorId: string | RequestOptions = 'demo-user',
    idempotencyKey?: string,
  ) =>
    request<AssessmentCaseDetail>(`/cases/${caseId}/result/finalize`, {
      method: 'POST',
      headers: commandHeaders(actorId, idempotencyKey),
      body: JSON.stringify(input),
    }),
  reopenResult: (
    caseId: string,
    input: ReopenResultInput,
    actorId: string | RequestOptions = 'demo-user',
    idempotencyKey?: string,
  ) =>
    request<AssessmentCaseDetail>(`/cases/${caseId}/result/reopen`, {
      method: 'POST',
      headers: commandHeaders(actorId, idempotencyKey),
      body: JSON.stringify(input),
    }),
  updateAssessorRecommendation: (
    caseId: string,
    input: { code: string; reason: string; expectedVersion: number },
  ) =>
    request<{ code: string }>(`/cases/${caseId}/result/assessor-recommendation`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  getResult: <T = unknown>(caseId: string) => request<T>(`/cases/${caseId}/result`),
  submitRecommendation: (
    caseId: string,
    input: SubmitRecommendationInput,
    actorId: string | RequestOptions = 'demo-user',
    idempotencyKey?: string,
  ) =>
    request<AssessmentCaseDetail>(`/cases/${caseId}/recommendation`, {
      method: 'POST',
      headers: commandHeaders(actorId, idempotencyKey),
      body: JSON.stringify(input),
    }),
  getRecommendation: <T = unknown>(caseId: string) => request<T>(`/cases/${caseId}/recommendation`),
  decideApprovalStep: (
    stepId: string,
    input: DecideApprovalInput,
    actorId: string | RequestOptions = 'demo-user',
    idempotencyKey?: string,
  ) =>
    request<ApprovalStepDecisionResult>(`/approval-steps/${stepId}/decision`, {
      method: 'POST',
      headers: commandHeaders(actorId, idempotencyKey),
      body: JSON.stringify(input),
    }),
  listApprovalSteps: <T = unknown>(caseId: string) =>
    request<T[]>(`/cases/${caseId}/approval-steps`),
  updateDevelopment: (
    caseId: string,
    input: UpdateDevelopmentInput,
    actorId: string | RequestOptions = 'demo-user',
    idempotencyKey?: string,
  ) =>
    request<AssessmentCaseDetail>(`/cases/${caseId}/development`, {
      method: 'POST',
      headers: commandHeaders(actorId, idempotencyKey),
      body: JSON.stringify(input),
    }),
  getDevelopment: <T = unknown>(caseId: string) => request<T>(`/cases/${caseId}/development`),
  scheduleReassessment: (
    caseId: string,
    input: ScheduleReassessmentInput,
    actorId: string | RequestOptions = 'demo-user',
    idempotencyKey?: string,
  ) =>
    request<ReassessmentScheduleResult>(`/cases/${caseId}/reassessment`, {
      method: 'POST',
      headers: commandHeaders(actorId, idempotencyKey),
      body: JSON.stringify(input),
    }),
  closeCase: (
    caseId: string,
    input: CloseCaseInput,
    actorId: string | RequestOptions = 'demo-user',
    idempotencyKey?: string,
  ) =>
    request<AssessmentCaseDetail>(`/cases/${caseId}/close`, {
      method: 'POST',
      headers: commandHeaders(actorId, idempotencyKey),
      body: JSON.stringify(input),
    }),
  createAttachment: (
    input: CreateAttachmentInput,
    actorId: string | RequestOptions = 'demo-user',
    idempotencyKey?: string,
  ) =>
    request<AttachmentSummary>('/attachments', {
      method: 'POST',
      headers: commandHeaders(actorId, idempotencyKey),
      body: JSON.stringify(input),
    }),
  getAttachment: (attachmentId: string) =>
    request<AttachmentSummary>(`/attachments/${attachmentId}`),
  previewAttachment: async (attachmentId: string) => {
    try {
      return await request<{
        id: string;
        fileName: string;
        contentType: string;
        scanStatus: AttachmentScanStatus;
        previewUrl: string;
      }>(`/attachments/${attachmentId}/preview`);
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'SCAN_NOT_CLEAN') {
        throw err;
      }
      throw err;
    }
  },
  getCalibrationMatrix: (department?: string) =>
    request<CalibrationMatrixResponse>(
      `/calibration/matrix${department ? `?department=${encodeURIComponent(department)}` : ''}`,
    ),
  copilotSynthesize: (caseId: string, input: CopilotSynthesizeInput = {}) =>
    request<CopilotSynthesizeResponse>(`/cases/${caseId}/copilot/synthesize`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  copilotBiasCheck: (caseId: string, input: CopilotBiasCheckInput) =>
    request<CopilotBiasCheckResponse>(`/cases/${caseId}/copilot/bias-check`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  copilotSuggestActions: (caseId: string, input: CopilotSuggestActionsInput = {}) =>
    request<CopilotSuggestActionsResponse>(`/cases/${caseId}/copilot/suggest-actions`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};
