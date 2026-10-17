import type { AssessmentStage } from '../routes/assessments-logic';
import type { AdministrationPolicy } from '../lib/api';
import { DEFAULT_ADMINISTRATION_POLICY, exceedsSlaWindow } from '../routes/administration-logic';

export const STAGE_ORDER: AssessmentStage[] = [
  'request',
  'eligibility',
  'planning',
  'assessment',
  'result',
  'decision',
  'follow_up',
  'closed',
];

export const STAGE_LABELS: Record<AssessmentStage, string> = {
  request: 'Request',
  eligibility: 'Eligibility',
  planning: 'Planning',
  assessment: 'Assessment',
  result: 'Result',
  decision: 'Decision',
  follow_up: 'Follow-up',
  closed: 'Closed',
};

export const ACTION_DUE_SOON_DAYS = 14;
export const REASSESSMENT_DAYS = 30;

const startOfDay = (value: Date | string): number => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

export function daysUntil(iso: string | null | undefined, now = new Date()): number | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return Math.round((startOfDay(date) - startOfDay(now)) / 86400000);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function stageCounts<T extends { stage: AssessmentStage }>(cases: T[] = []) {
  return STAGE_ORDER.map((key) => ({
    key,
    label: STAGE_LABELS[key],
    count: cases.filter((item) => item.stage === key).length,
  }));
}

export function bottleneckStage<T extends { stage: AssessmentStage }>(cases: T[] = []) {
  const open = stageCounts(cases).filter((stage) => stage.key !== 'closed' && stage.count > 0);
  if (!open.length) return null;
  return open.reduce((best, stage) => (stage.count > best.count ? stage : best)).key;
}

export function slaRiskCases<T extends { stage: AssessmentStage; stageEnteredAt?: string | null }>(
  cases: T[] = [],
  slaWindows: AdministrationPolicy['slaWindows'] = DEFAULT_ADMINISTRATION_POLICY.slaWindows,
  now = new Date(),
): T[] {
  return cases.filter((item) =>
    exceedsSlaWindow(item.stage.toUpperCase(), item.stageEnteredAt, { slaWindows }, now),
  );
}

export function sidebarCounts({
  cases = [],
  workItems = [],
  plans = [],
}: {
  cases?: Array<{ employeeId?: string | null; employeeName: string }>;
  workItems?: Array<{ caseId: string }>;
  plans?: Array<{ archived?: boolean }>;
} = {}) {
  return {
    myWork: new Set(workItems.map((item) => item.caseId)).size,
    assessments: cases.length,
    employees: new Set(cases.map((item) => item.employeeId || item.employeeName)).size,
    development: plans.filter((plan) => !plan.archived).length,
  };
}
