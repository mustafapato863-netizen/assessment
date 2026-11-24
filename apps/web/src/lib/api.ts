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
  DevelopmentPlanWithCaseDto,
  EligibilityDecisionInput,
  FinalizePlanInput,
  FinalizeResultInput,
  OverviewResponse,
  ReopenResultInput,
  RolePermissionMatrixEntry,
  SaveEvidenceInput,
  ScheduleEventInput,
  ScheduleReassessmentInput,
  SubmitRecommendationInput,
  UpdateDevelopmentInput,
  ScorecardConfig,
  ScorecardRatings,
} from '@assessflow/contracts';
import { getActiveUser, getAuthToken, logout, markTemporaryPasswordChanged } from './auth';

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
  'NONE' | 'ORGANIZATION' | 'DEPARTMENTS' | 'DIRECT_REPORTS' | 'ASSIGNED' | 'SELF';

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
  availableActions?: string[];
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

export interface HealthReadyStatus {
  status: string;
  service?: string;
  version?: string;
  dataStore?: string;
  latencyMs?: number;
  timestamp: string;
}

function resolveBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL?.trim();
  if (!envUrl) {
    return '/api/v1/assessflow';
  }
  return envUrl.replace(/\/+$/, '');
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
    readonly status = 0,
    readonly correlationId?: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

interface ParsedErrorBody {
  error?: {
    code?: string;
    message?: string;
    fieldErrors?: Record<string, string[]>;
    scanStatus?: string;
    scanReason?: string | null;
    correlationId?: string;
    retryAfterSeconds?: number;
  };
  code?: string;
  message?: string | string[];
  fieldErrors?: Record<string, string[]>;
}

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `idemp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function parseErrorAndThrow(
  response: Response,
  path: string,
  hadToken: boolean,
): Promise<never> {
  let body: ParsedErrorBody = {};
  const contentType = response.headers.get('content-type') ?? '';
  try {
    if (contentType.includes('application/json')) {
      body = (await response.json()) as ParsedErrorBody;
    } else {
      const text = await response.text();
      if (text.trim()) body = { message: text.trim().slice(0, 240) };
    }
  } catch {
    body = {};
  }

  if (
    response.status === 401 &&
    hadToken &&
    !path.startsWith('/auth/login') &&
    !path.startsWith('/health')
  ) {
    logout('expired');
  }

  const nested = body.error;
  const flatMessage = Array.isArray(body.message)
    ? body.message.join(', ')
    : typeof body.message === 'string'
      ? body.message
      : undefined;
  const message =
    nested?.message?.trim() ||
    flatMessage?.trim() ||
    (response.status === 401
      ? 'Your session has expired. Please sign in again.'
      : response.status === 403
        ? 'You do not have permission to perform this action.'
        : 'The request could not be completed.');

  throw new ApiRequestError(
    message,
    nested?.code ?? body.code ?? `HTTP_${response.status}`,
    nested?.fieldErrors ?? body.fieldErrors ?? {},
    nested?.scanStatus,
    nested?.scanReason,
    response.status,
    nested?.correlationId ?? response.headers.get('x-correlation-id') ?? undefined,
    nested?.retryAfterSeconds,
  );
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const activeUser = getActiveUser();
  const localActorHeaders: Record<string, string> = token
    ? {}
    : {
        'x-actor-id': activeUser.actorId || 'demo-user',
        'x-actor-role': activeUser.role,
        'x-actor-name': activeUser.name,
      };

  const method = (init?.method ?? 'GET').toUpperCase();
  const isMutating =
    method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE';
  const mergedHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...localActorHeaders,
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  };

  if (isMutating && !path.startsWith('/auth/') && !mergedHeaders['Idempotency-Key']) {
    mergedHeaders['Idempotency-Key'] = generateIdempotencyKey();
  }

  const response = await fetch(`${activeBaseUrl}${path}`, {
    ...init,
    headers: mergedHeaders,
  });

  if (!response.ok) {
    return parseErrorAndThrow(response, path, Boolean(token));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return (await response.text()) as unknown as T;
  }
  return (await response.json()) as T;
}

function commandHeaders(
  actorIdOrOptions?: string | RequestOptions,
  idempotencyKey?: string,
): Record<string, string> {
  const token = getAuthToken();
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

  const headers: Record<string, string> = token
    ? {}
    : {
        'x-actor-id': actorId,
        'x-actor-role': activeUser.role,
        'x-actor-name': activeUser.name,
      };
  headers['Idempotency-Key'] = finalKey?.trim() || generateIdempotencyKey();
  return headers;
}

const enc = (value: string) => encodeURIComponent(value);

export const api = {
  authenticate: (email: string, password: string) =>
    request<{ token: string; user: SignedInAccount }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  healthReady: () => request<HealthReadyStatus>('/health/ready'),
  accessAccounts: () => request<AccessAccount[]>('/access/accounts'),
  assessorAccounts: () => request<AssessorAccountOption[]>('/access/accounts/assessor-options'),
  createAccessAccount: (
    input: Omit<AccessAccount, 'id' | 'active'> & { active?: boolean; password: string },
  ) => request<AccessAccount>('/access/accounts', { method: 'POST', body: JSON.stringify(input) }),
  updateAccessAccount: (id: string, input: Partial<AccessAccount> & { password?: string }) =>
    request<AccessAccount>(`/access/accounts/${enc(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  removeAccessAccount: (id: string) =>
    request<{ id: string; removed: boolean }>(`/access/accounts/${enc(id)}`, {
      method: 'DELETE',
    }),
  adminAccessAccounts: () => request<AccessAccount[]>('/admin/accounts'),
  adminCreateAccessAccount: (input: Omit<AccessAccount, 'id' | 'active'>) =>
    request<AdminAccessCreateResult>('/admin/accounts', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  adminUpdateAccessAccount: (id: string, input: Partial<AccessAccount>) =>
    request<AccessAccount>(`/admin/accounts/${enc(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  adminDeactivateAccessAccount: (id: string) =>
    request<AccessAccount>(`/admin/accounts/${enc(id)}/deactivate`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  adminReactivateAccessAccount: (id: string) =>
    request<AdminAccessCreateResult>(`/admin/accounts/${enc(id)}/reactivate`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  adminResetAccessPassword: (id: string) =>
    request<AdminPasswordResetResult>(`/admin/accounts/${enc(id)}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  adminRolesMatrix: () => request<RolePermissionMatrixEntry[]>('/admin/roles-matrix'),
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
    const qs = query.toString();
    return request<AdminAuditPage>(`/admin/audit${qs ? `?${qs}` : ''}`);
  },
  changeTemporaryPassword: async (
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
  ) => {
    const res = await request<{ changed: true; token?: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    });
    markTemporaryPasswordChanged(res.token);
    return res;
  },
  overview: () => request<OverviewResponse>('/overview'),
  developmentPlans: () => request<DevelopmentPlanWithCaseDto[]>('/development-plans'),
  assessorAssignments: () => request<AssessorAssignment[]>('/assessor/assignments'),
  myResults: () => request<MyResult[]>('/me/results'),
  setFeedbackVisibility: (caseId: string, visible: boolean) =>
    request<{ caseId: string; visible: boolean; feedbackReleasedAt: string | null }>(
      `/cases/${enc(caseId)}/feedback-visibility`,
      { method: 'POST', body: JSON.stringify({ visible }) },
    ),
  tasks: () => request<OverviewResponse['tasks']>('/tasks'),
  cases: (search = '') =>
    request<AssessmentCaseSummary[]>(
      `/cases${search ? `?search=${encodeURIComponent(search)}` : ''}`,
    ),
  caseDetail: (id: string) => request<AssessmentCaseDetail>(`/cases/${enc(id)}`),
  reopenCompletedStage: (id: string, input: AdminReopenStageInput) =>
    request<AssessmentCaseDetail>(`/cases/${enc(id)}/stages/reopen`, {
      method: 'POST',
      headers: commandHeaders(),
      body: JSON.stringify(input),
    }),
  updateEmployeeName: (caseId: string, input: UpdateEmployeeNameInput) =>
    request<AssessmentCaseDetail>(`/cases/${enc(caseId)}/employee-name`, {
      method: 'PATCH',
      headers: commandHeaders(),
      body: JSON.stringify(input),
    }),
  updateReopenedRequest: (id: string, input: AdminEditRequestInput) =>
    request<AssessmentCaseDetail>(`/cases/${enc(id)}/request`, {
      method: 'PATCH',
      headers: commandHeaders(),
      body: JSON.stringify(input),
    }),
  scorecard: <T = unknown>(caseId: string) => request<T>(`/cases/${enc(caseId)}/scorecard`),
  updateScorecardConfig: (caseId: string, config: ScorecardConfig) =>
    request<{ config: ScorecardConfig; canEditWeights: boolean }>(
      `/cases/${enc(caseId)}/scorecard/config`,
      { method: 'PATCH', body: JSON.stringify(config) },
    ),
  saveScorecard: (caseId: string, ratings: ScorecardRatings, submit: boolean) =>
    request<{ saved: boolean; submitted: boolean }>(`/cases/${enc(caseId)}/scorecard`, {
      method: 'POST',
      body: JSON.stringify({ ratings, submit }),
    }),
  reviseScorecard: (caseId: string, reason: string) =>
    request<{ reopened: boolean }>(`/cases/${enc(caseId)}/scorecard/revise`, {
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
    request<AssessmentCaseDetail>(`/cases/${enc(id)}/submit`, {
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
    request<AssessmentCaseDetail>(`/cases/${enc(id)}/eligibility/decision`, {
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
    request<AssessmentCaseDetail>(`/cases/${enc(id)}/eligibility/override-request`, {
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
    request<AssessmentCaseDetail>(`/cases/${enc(caseId)}/plan/finalize`, {
      method: 'POST',
      headers: commandHeaders(actorId, idempotencyKey),
      body: JSON.stringify(input),
    }),
  getPlan: <T = unknown>(caseId: string) => request<T>(`/cases/${enc(caseId)}/plan`),
  scheduleEvent: (
    caseId: string,
    input: ScheduleEventInput,
    actorId: string | RequestOptions = 'demo-user',
    idempotencyKey?: string,
  ) =>
    request<EventScheduleResult>(`/cases/${enc(caseId)}/events`, {
      method: 'POST',
      headers: commandHeaders(actorId, idempotencyKey),
      body: JSON.stringify(input),
    }),
  listEvents: <T = unknown>(caseId: string) => request<T[]>(`/cases/${enc(caseId)}/events`),
  saveEvidenceDraft: (
    eventId: string,
    input: SaveEvidenceInput,
    actorId: string | RequestOptions = 'demo-user',
    idempotencyKey?: string,
  ) =>
    request<EvidenceSaveResult>(`/events/${enc(eventId)}/evidence`, {
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
    request<EvidenceSaveResult>(`/events/${enc(eventId)}/evidence/submit`, {
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
    request<AssessmentCaseDetail>(`/cases/${enc(caseId)}/result/finalize`, {
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
    request<AssessmentCaseDetail>(`/cases/${enc(caseId)}/result/reopen`, {
      method: 'POST',
      headers: commandHeaders(actorId, idempotencyKey),
      body: JSON.stringify(input),
    }),
  updateAssessorRecommendation: (
    caseId: string,
    input: { code: string; reason: string; expectedVersion: number },
  ) =>
    request<{ code: string }>(`/cases/${enc(caseId)}/result/assessor-recommendation`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  getResult: <T = unknown>(caseId: string) => request<T>(`/cases/${enc(caseId)}/result`),
  submitRecommendation: (
    caseId: string,
    input: SubmitRecommendationInput,
    actorId: string | RequestOptions = 'demo-user',
    idempotencyKey?: string,
  ) =>
    request<AssessmentCaseDetail>(`/cases/${enc(caseId)}/recommendation`, {
      method: 'POST',
      headers: commandHeaders(actorId, idempotencyKey),
      body: JSON.stringify(input),
    }),
  getRecommendation: <T = unknown>(caseId: string) =>
    request<T>(`/cases/${enc(caseId)}/recommendation`),
  decideApprovalStep: (
    stepId: string,
    input: DecideApprovalInput,
    actorId: string | RequestOptions = 'demo-user',
    idempotencyKey?: string,
  ) =>
    request<ApprovalStepDecisionResult>(`/approval-steps/${enc(stepId)}/decision`, {
      method: 'POST',
      headers: commandHeaders(actorId, idempotencyKey),
      body: JSON.stringify(input),
    }),
  listApprovalSteps: <T = unknown>(caseId: string) =>
    request<T[]>(`/cases/${enc(caseId)}/approval-steps`),
  updateDevelopment: (
    caseId: string,
    input: UpdateDevelopmentInput,
    actorId: string | RequestOptions = 'demo-user',
    idempotencyKey?: string,
  ) =>
    request<AssessmentCaseDetail>(`/cases/${enc(caseId)}/development`, {
      method: 'POST',
      headers: commandHeaders(actorId, idempotencyKey),
      body: JSON.stringify(input),
    }),
  getDevelopment: <T = unknown>(caseId: string) => request<T>(`/cases/${enc(caseId)}/development`),
  scheduleReassessment: (
    caseId: string,
    input: ScheduleReassessmentInput,
    actorId: string | RequestOptions = 'demo-user',
    idempotencyKey?: string,
  ) =>
    request<ReassessmentScheduleResult>(`/cases/${enc(caseId)}/reassessment`, {
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
    request<AssessmentCaseDetail>(`/cases/${enc(caseId)}/close`, {
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
  caseAttachments: (caseId: string) =>
    request<AttachmentSummary[]>(`/cases/${enc(caseId)}/attachments`),
  getAttachment: (attachmentId: string) =>
    request<AttachmentSummary>(`/attachments/${enc(attachmentId)}`),
  previewAttachment: (attachmentId: string) =>
    request<{
      id: string;
      fileName: string;
      contentType: string;
      scanStatus: AttachmentScanStatus;
      previewUrl: string;
    }>(`/attachments/${enc(attachmentId)}/preview`),
  downloadAttachment: (attachmentId: string) =>
    request<{
      id: string;
      fileName: string;
      contentType: string;
      scanStatus: AttachmentScanStatus;
      downloadUrl: string;
    }>(`/attachments/${enc(attachmentId)}/download`),
  fetchCleanAttachmentBlob: async (
    attachmentId: string,
    mode: 'preview' | 'download' = 'preview',
  ): Promise<Blob> => {
    const token = getAuthToken();
    const activeUser = getActiveUser();
    const response = await fetch(
      `${activeBaseUrl}/attachments/clean/${enc(attachmentId)}?mode=${mode}`,
      {
        headers: token
          ? { Authorization: `Bearer ${token}` }
          : {
              'x-actor-id': activeUser.actorId || 'demo-user',
              'x-actor-role': activeUser.role,
              'x-actor-name': activeUser.name,
            },
      },
    );
    if (!response.ok) {
      return parseErrorAndThrow(response, `/attachments/clean/${attachmentId}`, Boolean(token));
    }
    return response.blob();
  },
  getCalibrationMatrix: (department?: string) =>
    request<CalibrationMatrixResponse>(
      `/calibration/matrix${department ? `?department=${encodeURIComponent(department)}` : ''}`,
    ),
  copilotSynthesize: (caseId: string, input: CopilotSynthesizeInput = {}) =>
    request<CopilotSynthesizeResponse>(`/cases/${enc(caseId)}/copilot/synthesize`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  copilotBiasCheck: (caseId: string, input: CopilotBiasCheckInput) =>
    request<CopilotBiasCheckResponse>(`/cases/${enc(caseId)}/copilot/bias-check`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  copilotSuggestActions: (caseId: string, input: CopilotSuggestActionsInput = {}) =>
    request<CopilotSuggestActionsResponse>(`/cases/${enc(caseId)}/copilot/suggest-actions`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};
