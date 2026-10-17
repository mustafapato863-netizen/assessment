import { STAGE_LABELS, STAGE_ORDER } from '../shared/definitions';

export const FILTER_ALL = '';

export interface InsightCase {
  id: string;
  caseId: string;
  employeeName: string;
  department: string;
  position: string;
  reason: string;
  stage: keyof typeof STAGE_LABELS;
  statusLabel: string;
  requestedAt: string;
}

export interface InsightFilters {
  reason?: string;
  dept?: string;
  stage?: string;
  status?: string;
}

export interface CountRow {
  key: string;
  label: string;
  count: number;
  percent: number;
  barPercent: number;
}

export function applyFilters<T extends InsightCase>(
  cases: T[],
  { reason, dept, stage, status }: InsightFilters,
): T[] {
  return cases.filter(
    (item) =>
      (!reason || item.reason === reason) &&
      (!dept || item.department === dept) &&
      (!stage || item.stage === stage) &&
      (!status || item.statusLabel === status),
  );
}

export function filterOptions(cases: InsightCase[]) {
  const unique = (getValue: (item: InsightCase) => string) =>
    [...new Set(cases.map(getValue).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return {
    reasons: unique((item) => item.reason),
    departments: unique((item) => item.department),
    stages: STAGE_ORDER.filter((stage) => cases.some((item) => item.stage === stage)),
    statuses: unique((item) => item.statusLabel),
  };
}

export function countBy<T>(
  cases: T[],
  getKey: (item: T) => string | null | undefined,
  {
    labelOf = (key: string) => key,
    order,
    includeKeys = [],
  }: {
    labelOf?: (key: string) => string;
    order?: readonly string[];
    includeKeys?: readonly string[];
  } = {},
): CountRow[] {
  const total = cases.length;
  const counts = new Map<string, number>(includeKeys.map((key) => [key, 0]));
  for (const item of cases) {
    const key = getKey(item);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const rows = [...counts].map(([key, count]) => ({
    key,
    label: labelOf(key),
    count,
    percent: total ? Math.round((count / total) * 100) : 0,
    barPercent: 0,
  }));

  if (order) {
    rows.sort((a, b) => {
      const aOrder = order.indexOf(a.key);
      const bOrder = order.indexOf(b.key);
      return (
        (aOrder < 0 ? Number.MAX_SAFE_INTEGER : aOrder) -
          (bOrder < 0 ? Number.MAX_SAFE_INTEGER : bOrder) || a.label.localeCompare(b.label)
      );
    });
  } else {
    rows.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }

  const max = Math.max(1, ...rows.map((row) => row.count));
  return rows.map((row) => ({ ...row, barPercent: Math.round((row.count / max) * 100) }));
}

export const byStage = (cases: InsightCase[]) =>
  countBy(cases, (item) => item.stage, {
    labelOf: (key) => STAGE_LABELS[key as keyof typeof STAGE_LABELS] ?? key,
    includeKeys: STAGE_ORDER,
    order: STAGE_ORDER,
  });

export const byStatus = (cases: InsightCase[]) => countBy(cases, (item) => item.statusLabel);

export const byReason = (cases: InsightCase[], allReasons: string[] = []) =>
  countBy(cases, (item) => item.reason, { includeKeys: allReasons });

export const byDepartment = (cases: InsightCase[]) => countBy(cases, (item) => item.department);

export function topN<T>(rows: T[], n = 6): { shown: T[]; hidden: number } {
  return { shown: rows.slice(0, n), hidden: Math.max(0, rows.length - n) };
}

export function insightsKpis(
  cases: InsightCase[],
  { developmentCount = 0 }: { developmentCount?: number } = {},
) {
  const closed = cases.filter((item) => item.stage === 'closed').length;
  const pending = cases.filter(
    (item) => /pending/i.test(item.statusLabel || '') || item.stage === 'decision',
  ).length;
  return {
    total: cases.length,
    active: cases.length - closed,
    pending,
    inDevelopment: developmentCount,
  };
}

const escapeCsvCell = (value: string | number): string => {
  let cell = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(cell)) cell = `'${cell}`;
  return `"${cell.replace(/"/g, '""')}"`;
};

export function aggregatesToCsv(
  sections: Array<{ title: string; rows: Array<Pick<CountRow, 'label' | 'count' | 'percent'>> }>,
): string {
  const lines = [['Section', 'Label', 'Count', 'Percent'].map(escapeCsvCell).join(',')];
  for (const section of sections) {
    for (const row of section.rows) {
      lines.push(
        [section.title, row.label, row.count, `${row.percent}%`].map(escapeCsvCell).join(','),
      );
    }
  }
  return lines.join('\r\n');
}

export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
  const anchor = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
