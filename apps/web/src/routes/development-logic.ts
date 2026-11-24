import type { AssessmentListCase, AssessmentStage } from './assessments-logic';
import {
  ACTION_DUE_SOON_DAYS,
  REASSESSMENT_DAYS,
  daysUntil,
  formatDate,
} from '../shared/definitions';

export {
  ACTION_DUE_SOON_DAYS,
  REASSESSMENT_DAYS,
  daysUntil,
  formatDate,
} from '../shared/definitions';

export type DevelopmentActionStatus = 'not_started' | 'in_progress' | 'completed';

export interface DevelopmentAction {
  id: string;
  title: string;
  owner: string;
  dueDate: string | null;
  status: DevelopmentActionStatus;
  evidenceNote: string;
}

export interface DevelopmentPlan {
  id: string;
  caseId: string;
  employeeName: string;
  department: string;
  reason: string;
  targetRole: string;
  targetCompletion: string | null;
  reassessmentDate: string | null;
  requestedAt: string;
  owner: string;
  stage: AssessmentStage;
  archived: boolean;
  href: string;
  actions: DevelopmentAction[];
}

export const ACTION_STATUSES: Array<{ value: DevelopmentActionStatus; label: string }> = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
];

export function statusLabel(status: DevelopmentActionStatus | string): string {
  return ACTION_STATUSES.find((item) => item.value === status)?.label ?? status;
}

export function normalizeActionStatus(status: string | null | undefined): DevelopmentActionStatus {
  const normalized = status?.toLowerCase();
  if (normalized === 'completed') return 'completed';
  if (normalized === 'in_progress') return 'in_progress';
  return 'not_started';
}

export function planProgress(actions: DevelopmentAction[] = []) {
  const done = actions.filter((action) => action.status === 'completed').length;
  const total = actions.length;
  return {
    done,
    total,
    percent: total ? Math.round((done / total) * 100) : 0,
    complete: total > 0 && done === total,
  };
}

export function dueInfo(
  action: DevelopmentAction,
  now = new Date(),
  planTargetCompletion?: string | null,
): { tone: string; text: string } {
  const dueDate = action.dueDate ?? planTargetCompletion ?? null;
  if (action.status === 'completed') {
    return { tone: 'done', text: dueDate ? `Due ${formatDate(dueDate)}` : 'Done' };
  }
  const days = daysUntil(dueDate, now);
  if (days === null) return { tone: 'neutral', text: 'No due date' };
  if (days < 0) return { tone: 'overdue', text: `Overdue · ${-days}d` };
  if (days === 0) return { tone: 'soon', text: 'Due today' };
  if (days <= ACTION_DUE_SOON_DAYS) return { tone: 'soon', text: `Due in ${days}d` };
  return { tone: 'neutral', text: `Due ${formatDate(dueDate)}` };
}

export function developmentKpis(plans: DevelopmentPlan[], now = new Date()) {
  const active = plans.filter((plan) => !plan.archived);
  const actions = active.flatMap((plan) => plan.actions || []);
  const done = actions.filter((action) => action.status === 'completed').length;
  const dueSoon = active.reduce(
    (count, plan) =>
      count +
      plan.actions.filter((action) => {
        if (action.status === 'completed') return false;
        const days = daysUntil(action.dueDate ?? plan.targetCompletion, now);
        return days !== null && days <= ACTION_DUE_SOON_DAYS;
      }).length,
    0,
  );
  const reassessments = active.filter((plan) => {
    const days = daysUntil(plan.reassessmentDate, now);
    return days !== null && days <= REASSESSMENT_DAYS;
  }).length;
  return { activePlans: active.length, actions: actions.length, done, dueSoon, reassessments };
}

export function validateAction({
  title = '',
  owner = '',
  dueDate = '',
}: {
  title?: string;
  owner?: string;
  dueDate?: string;
}): { valid: boolean; errors: Partial<Record<'title' | 'owner' | 'dueDate', string>> } {
  const errors: Partial<Record<'title' | 'owner' | 'dueDate', string>> = {};
  if (title.trim().length < 3) errors.title = 'Enter a title with at least 3 characters.';
  if (owner.trim().length < 2) errors.owner = 'Enter an owner with at least 2 characters.';
  if (dueDate && Number.isNaN(Date.parse(dueDate))) errors.dueDate = 'Enter a valid date.';
  return { valid: Object.keys(errors).length === 0, errors };
}

export interface DevelopmentPlanData {
  id?: string;
  caseId?: string;
  ownerName?: string | null;
  targetDate?: string | null;
  status?: string | null;
  actions?: Array<{
    id?: string;
    title: string;
    ownerName: string;
    dueDate?: string | null;
    status?: string | null;
    evidenceNote?: string | null;
  }>;
}

export function mapDevelopmentPlan(
  caseItem: AssessmentListCase,
  plan: DevelopmentPlanData | null,
): DevelopmentPlan {
  const targetCompletion = plan?.targetDate ?? null;
  return {
    id: caseItem.id,
    caseId: caseItem.caseId,
    employeeName: caseItem.employeeName,
    department: caseItem.department,
    reason: caseItem.reason,
    targetRole: caseItem.position,
    targetCompletion,
    reassessmentDate: targetCompletion,
    requestedAt: caseItem.requestedAt,
    owner: plan?.ownerName || caseItem.owner,
    stage: caseItem.stage,
    archived: plan?.status?.toUpperCase() === 'ARCHIVED',
    href: caseItem.href,
    actions: (plan?.actions ?? []).map((action, index) => ({
      id: action.id ?? `${caseItem.id}-action-${index}`,
      title: action.title,
      owner: action.ownerName,
      dueDate: action.dueDate ?? null,
      status: normalizeActionStatus(action.status),
      evidenceNote: action.evidenceNote ?? '',
    })),
  };
}

export function readSelected(hash = window.location.hash): string {
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  const params = new URLSearchParams(query);
  return params.get('id') || params.get('caseId') || '';
}

export function writeSelected(id: string): void {
  const base = window.location.hash.split('?')[0] || '#/development';
  window.location.hash = id ? `${base}?id=${encodeURIComponent(id)}` : base;
}
