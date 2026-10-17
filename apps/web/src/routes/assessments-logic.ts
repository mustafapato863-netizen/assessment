export type AssessmentTab = 'all' | 'eligibility' | 'in_assessment' | 'pending_approval' | 'completed';
export type AssessmentStage =
  | 'request'
  | 'eligibility'
  | 'planning'
  | 'assessment'
  | 'result'
  | 'decision'
  | 'follow_up'
  | 'closed';

export interface AssessmentListCase {
  id: string;
  employeeId?: string;
  caseId: string;
  employeeName: string;
  department: string;
  position: string;
  reason: string;
  stage: AssessmentStage;
  statusLabel: string;
  owner: string;
  requestedAt: string;
  href: string;
}

export interface AssessmentFilters {
  tab: AssessmentTab;
  stage: AssessmentStage | '';
  q: string;
  dept: string;
}

export const TABS: Array<{
  key: AssessmentTab;
  label: string;
  stages: AssessmentStage[] | null;
}> = [
  { key: 'all', label: 'All cases', stages: null },
  { key: 'eligibility', label: 'Eligibility screen', stages: ['eligibility'] },
  { key: 'in_assessment', label: 'In assessment', stages: ['planning', 'assessment'] },
  { key: 'pending_approval', label: 'Pending approval', stages: ['decision'] },
  { key: 'completed', label: 'Completed', stages: ['closed'] },
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

const validTabs: AssessmentTab[] = TABS.map(({ key }) => key);
const validStages = Object.keys(STAGE_LABELS) as AssessmentStage[];
const legacyStageMap: Record<string, AssessmentStage> = {
  REQUEST: 'request',
  ELIGIBILITY: 'eligibility',
  PLANNING: 'planning',
  ASSESSMENT: 'assessment',
  RESULT: 'result',
  DECISION: 'decision',
  RECOMMENDATION: 'decision',
  APPROVAL: 'decision',
  FOLLOW_UP: 'follow_up',
  CLOSED: 'closed',
};

// Read the HashRouter query, e.g. #/assessments?stage=result&tab=in_assessment.
export function readFilters(hash = window.location.hash): AssessmentFilters {
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  const params = new URLSearchParams(query);
  const tabValue = params.get('tab') as AssessmentTab | null;
  const rawStage = params.get('stage') || '';
  const stageValue = (validStages.includes(rawStage as AssessmentStage)
    ? rawStage
    : legacyStageMap[rawStage]) as AssessmentStage | undefined;
  return {
    tab: tabValue && validTabs.includes(tabValue) ? tabValue : 'all',
    stage: stageValue && validStages.includes(stageValue) ? stageValue : '',
    q: params.get('q') || params.get('search') || '',
    dept: params.get('dept') || '',
  };
}

export function writeFilters(next: AssessmentFilters): void {
  // Keep whichever HashRouter page is active, whether reached through /assessments or /cases.
  const base = window.location.hash.split('?')[0] || '#/assessments';
  const params = new URLSearchParams();
  Object.entries(next).forEach(([key, value]) => {
    if (value && value !== 'all') params.set(key, value);
  });
  const query = params.toString();
  window.location.hash = query ? `${base}?${query}` : base;
}

export function filterCases(
  cases: AssessmentListCase[],
  { tab, stage, q, dept }: AssessmentFilters,
): AssessmentListCase[] {
  const tabStages = TABS.find((item) => item.key === tab)?.stages;
  const needle = q.trim().toLowerCase();
  return cases.filter((item) => {
    if (tabStages && !tabStages.includes(item.stage)) return false;
    if (stage && item.stage !== stage) return false;
    if (dept && item.department !== dept) return false;
    if (!needle) return true;
    return [item.caseId, item.employeeName, item.department, item.reason, item.position]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(needle));
  });
}

export function tabCounts(cases: AssessmentListCase[]): Record<AssessmentTab, number> {
  return TABS.reduce(
    (counts, item) => ({
      ...counts,
      [item.key]: item.stages
        ? cases.filter((assessment) => item.stages!.includes(assessment.stage)).length
        : cases.length,
    }),
    {} as Record<AssessmentTab, number>,
  );
}

export function stageChip(item: AssessmentListCase): { text: string; tone: string } {
  const stage = STAGE_LABELS[item.stage] || item.stage;
  const text = item.statusLabel ? `${stage} · ${item.statusLabel}` : stage;
  const status = item.statusLabel.toLowerCase();
  let tone = 'indigo';
  if (item.stage === 'closed' || status === 'closed') tone = 'gray';
  else if (status.includes('ready')) tone = 'teal';
  else if (status.includes('progress')) tone = 'amber';
  return { text, tone };
}

export function formatRequested(iso: string, now = new Date()): { date: string; ago: string } {
  const date = new Date(iso);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const requestedDay = new Date(date);
  requestedDay.setHours(0, 0, 0, 0);
  const days = Math.max(0, Math.round((today.getTime() - requestedDay.getTime()) / 86400000));
  return {
    date: date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
    ago: days === 0 ? 'Today' : `${days}d ago`,
  };
}

export const PAGE_SIZE = 8;

export function paginate<T>(list: T[], page: number, size = PAGE_SIZE): {
  items: T[];
  page: number;
  pages: number;
} {
  const pages = Math.max(1, Math.ceil(list.length / size));
  const safe = Math.min(Math.max(1, page), pages);
  return { items: list.slice((safe - 1) * size, safe * size), page: safe, pages };
}

export function bottleneckStage(cases: AssessmentListCase[]): AssessmentStage | null {
  const counts: Partial<Record<AssessmentStage, number>> = {};
  cases
    .filter((item) => item.stage !== 'closed')
    .forEach((item) => {
      counts[item.stage] = (counts[item.stage] || 0) + 1;
    });
  return (
    Object.entries(counts).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0] as
      | AssessmentStage
      | undefined
  ) ?? null;
}
