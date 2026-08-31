import type {
  AssessmentCaseDetail,
  AssessmentCaseSummary,
  CreateCaseInput,
  EligibilityDecisionInput,
  OverviewResponse,
} from '@assessflow/contracts';

const baseUrl = import.meta.env.VITE_API_URL ?? '/api/v1/assessflow';

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly code = 'REQUEST_FAILED',
    readonly fieldErrors: Record<string, string[]> = {},
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const payload = (await response.json()) as T & {
    error?: { code?: string; message?: string; fieldErrors?: Record<string, string[]> };
  };
  if (!response.ok) {
    throw new ApiRequestError(
      payload.error?.message ?? 'The request could not be completed.',
      payload.error?.code,
      payload.error?.fieldErrors,
    );
  }
  return payload;
}

export const api = {
  overview: () => request<OverviewResponse>('/overview'),
  tasks: () => request<OverviewResponse['tasks']>('/tasks'),
  cases: (search = '') =>
    request<AssessmentCaseSummary[]>(
      `/cases${search ? `?search=${encodeURIComponent(search)}` : ''}`,
    ),
  caseDetail: (id: string) => request<AssessmentCaseDetail>(`/cases/${id}`),
  createCase: (input: CreateCaseInput) =>
    request<AssessmentCaseDetail>('/cases', { method: 'POST', body: JSON.stringify(input) }),
  submitCase: (id: string, expectedVersion: number) =>
    request<AssessmentCaseDetail>(`/cases/${id}/submit`, {
      method: 'POST',
      body: JSON.stringify({ expectedVersion }),
    }),
  decideEligibility: (id: string, input: EligibilityDecisionInput) =>
    request<AssessmentCaseDetail>(`/cases/${id}/eligibility/decision`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  requestOverride: (id: string, reason: string) =>
    request<AssessmentCaseDetail>(`/cases/${id}/eligibility/override-request`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
};
