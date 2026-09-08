import type {
  AssessmentCaseDetail,
  AssessmentCaseSummary,
  AttachmentScanStatus,
  AttachmentSummary,
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
} from '@assessflow/contracts';
import { getActiveUser } from './auth';

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

function resolveBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && envUrl.startsWith('/')) {
    return envUrl;
  }
  if (import.meta.env.VITE_USE_API_PROXY === 'true') {
    return '/api/v1/assessflow';
  }
  if (typeof window !== 'undefined') {
    const isLocalhost =
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    // When running on a remote cloud domain, never call localhost
    if (!isLocalhost && (!envUrl || envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
      return 'https://endrec.zainx.cloud/api/v1/assessflow';
    }
  }
  return envUrl || '/api/v1/assessflow';
}

let activeBaseUrl = resolveBaseUrl();

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
  let response: Response;
  const currentBase = activeBaseUrl;

  try {
    response = await fetch(`${currentBase}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch (err) {
    // If direct request to remote host failed (e.g. Hostinger domain blocked by ISP/firewall/CORS),
    // and we're not already on the relative proxy path, attempt fallback to relative /api/v1/assessflow
    if (
      typeof window !== 'undefined' &&
      currentBase.startsWith('http') &&
      currentBase !== '/api/v1/assessflow'
    ) {
      console.warn(
        `[API] Direct request to ${currentBase}${path} failed (${err instanceof Error ? err.message : 'Network error'}). Attempting fallback to relative proxy /api/v1/assessflow...`,
      );
      try {
        response = await fetch(`/api/v1/assessflow${path}`, {
          ...init,
          headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
        });
        activeBaseUrl = '/api/v1/assessflow';
      } catch {
        throw err;
      }
    } else {
      throw err;
    }
  }

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
  overview: () => request<OverviewResponse>('/overview'),
  tasks: () => request<OverviewResponse['tasks']>('/tasks'),
  cases: (search = '') =>
    request<AssessmentCaseSummary[]>(
      `/cases${search ? `?search=${encodeURIComponent(search)}` : ''}`,
    ),
  caseDetail: (id: string) => request<AssessmentCaseDetail>(`/cases/${id}`),
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
