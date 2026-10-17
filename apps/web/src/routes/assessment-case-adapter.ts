import type { AssessmentCaseSummary, CaseStage } from '@assessflow/contracts';
import { reasonLabels, statusLabels } from '../lib/labels';
import type { AssessmentListCase, AssessmentStage } from './assessments-logic';

const stageMap: Record<CaseStage, AssessmentStage> = {
  REQUEST: 'request',
  ELIGIBILITY: 'eligibility',
  PLANNING: 'planning',
  ASSESSMENT: 'assessment',
  RESULT: 'result',
  RECOMMENDATION: 'decision',
  APPROVAL: 'decision',
  FOLLOW_UP: 'follow_up',
  CLOSED: 'closed',
};

export function mapAssessmentCase(item: AssessmentCaseSummary): AssessmentListCase {
  return {
    id: item.id,
    employeeId: item.employeeId,
    caseId: item.caseCode,
    employeeName: item.employeeName,
    department: item.department || 'Unassigned',
    position: item.targetRole || item.currentRole || '—',
    reason: reasonLabels[item.assessmentReason] ?? item.assessmentReason,
    stage: stageMap[item.stage],
    statusLabel: statusLabels[item.status] ?? item.status.replace(/_/g, ' '),
    owner: item.owner || 'Unassigned',
    requestedAt: item.requestedAt,
    href: `#/cases/${encodeURIComponent(item.id)}`,
  };
}

export function mapCasesForEmployeeStats(cases: AssessmentCaseSummary[]) {
  return cases.map((item) => ({
    id: item.id,
    employeeId: item.employeeId,
    employeeName: item.employeeName,
    department: item.department || 'Unassigned',
    position: item.targetRole || item.currentRole || '—',
    requestedAt: item.requestedAt,
  }));
}
