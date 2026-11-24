export interface AuditQueryFilters {
  search?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export const queryKeys = {
  overview: () => ['overview'] as const,
  tasks: () => ['tasks'] as const,
  cases: (search = '') => ['cases', search] as const,
  caseDetail: (caseId: string) => ['case', caseId] as const,
  casePlan: (caseId: string) => ['case', caseId, 'plan'] as const,
  caseEvents: (caseId: string) => ['case', caseId, 'events'] as const,
  caseScorecard: (caseId: string) => ['case', caseId, 'scorecard'] as const,
  caseResult: (caseId: string) => ['case', caseId, 'result'] as const,
  caseRecommendation: (caseId: string) => ['case', caseId, 'recommendation'] as const,
  caseApprovals: (caseId: string) => ['case', caseId, 'approvals'] as const,
  caseDevelopment: (caseId: string) => ['case', caseId, 'development'] as const,
  caseAttachments: (caseId: string) => ['case', caseId, 'attachments'] as const,
  developmentPlans: () => ['development-plans'] as const,
  assessorAssignments: () => ['assessor-assignments'] as const,
  myResults: () => ['my-results'] as const,
  calibrationMatrix: (department = '') => ['calibration-matrix', department] as const,
  adminAccounts: () => ['admin', 'accounts'] as const,
  adminRolesMatrix: () => ['admin', 'roles-matrix'] as const,
  adminPolicy: () => ['admin', 'policy'] as const,
  adminAudit: (filters: AuditQueryFilters) => ['admin', 'audit', filters] as const,
  accessAccounts: () => ['access', 'accounts'] as const,
  assessorOptions: () => ['access', 'assessor-options'] as const,
  healthReady: () => ['health', 'ready'] as const,
};
