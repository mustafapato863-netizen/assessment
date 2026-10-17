export const READINESS = [
  { key: 'ready_now', label: 'Ready now', color: '#0f766e', bg: '#ccfbf1', fg: '#115e59' },
  {
    key: 'with_development',
    label: 'With development',
    color: '#b45309',
    bg: '#fef3c7',
    fg: '#92400e',
  },
  { key: 'not_ready', label: 'Not ready', color: '#b42318', bg: '#fee2e2', fg: '#991b1b' },
  {
    key: 'pending_evaluation',
    label: 'Pending evaluation',
    color: '#8a90a6',
    bg: '#eef0f5',
    fg: '#454a61',
  },
] as const;

export type ReadinessKey = (typeof READINESS)[number]['key'];
export type CandidateLevel = string | number | null | undefined;

export interface CalibrationCandidate {
  id: string;
  name: string;
  department: string;
  currentLevel?: CandidateLevel;
  targetLevel?: CandidateLevel;
  currentRole?: string;
  targetRole?: string;
  readiness?: string | null;
  box?: number | string | null;
  performance?: string | null;
  potential?: string | null;
  href?: string;
  caseCode?: string;
  technicalScore?: number | null;
  behavioralScore?: number | null;
  /** Readiness the current scorecards give, when it differs from the finalized result. */
  scoredReadiness?: string | null;
  knockout?: boolean;
}

export interface CalibrationState {
  box: number;
  status: ReadinessKey | '';
  dept: string;
  q: string;
  view: 'matrix' | 'table';
}

export interface ReadinessCount {
  key: ReadinessKey;
  label: string;
  color: string;
  bg: string;
  fg: string;
  count: number;
  percent: number;
}

export interface BoxSummary {
  box: number;
  name: string;
  desc: string;
  count: number;
  percent: number;
  candidates: CalibrationCandidate[];
}

export interface BoxStats {
  boxes: Record<number, BoxSummary>;
  unplaced: number;
  maxCount: number;
}

export interface DepartmentBenchmarkRow extends Record<ReadinessKey, number> {
  department: string;
  total: number;
  rate: number;
  small: boolean;
}

const ALIASES: Record<string, ReadinessKey> = {
  ready_now: 'ready_now',
  ready_with_development: 'with_development',
  with_development: 'with_development',
  with_dev: 'with_development',
  not_ready: 'not_ready',
  pending_evaluation: 'pending_evaluation',
  pending: 'pending_evaluation',
  assessment_in_progress: 'pending_evaluation',
  pending_result: 'pending_evaluation',
};

export function normalizeReadiness(value: string | null | undefined): ReadinessKey {
  const key = String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
  return ALIASES[key] ?? 'pending_evaluation';
}

export function readinessMeta(key: ReadinessKey) {
  return READINESS.find((readiness) => readiness.key === key) ?? READINESS[3];
}

export function formatLevel(value: CandidateLevel): string {
  if (value === null || value === undefined || value === '') return '';
  const level = String(value).trim();
  if (/^l\d+$/i.test(level)) return `L${level.slice(1)}`;
  if (/^\d+$/.test(level)) return `L${level}`;
  return level;
}

export const BOXES: Record<number, { name: string; desc: string }> = {
  1: {
    name: 'Underperformer',
    desc: 'Low performance and low potential. Action plan or exit needed.',
  },
  2: { name: 'Effective Performer', desc: 'Steady output with specialized or bounded scope.' },
  3: {
    name: 'Trusted Professional',
    desc: 'Exceptional domain execution within the current band.',
  },
  4: { name: 'Inconsistent Contributor', desc: 'Capacity bursts but lacks role consistency.' },
  5: { name: 'Core Player', desc: 'Solid performance with healthy readiness for next level.' },
  6: {
    name: 'High Performer',
    desc: 'Consistently exceeds expectations, strong growth potential.',
  },
  7: {
    name: 'Rough Diamond',
    desc: 'High leadership capacity requiring tactical skill development.',
  },
  8: { name: 'High Achiever', desc: 'Exceeds goals and capable of lateral or scale leadership.' },
  9: { name: 'Star / Future Leader', desc: 'Top-tier performance and highest growth readiness.' },
};

export const BOX_GRID = [
  [7, 8, 9],
  [4, 5, 6],
  [1, 2, 3],
] as const;
export const POTENTIAL_LABELS = ['High potential', 'Medium potential', 'Low potential'] as const;
export const PERFORMANCE_LABELS = [
  'Low performance',
  'Medium performance',
  'High performance',
] as const;
const LEVEL_INDEX: Record<string, number> = { low: 0, medium: 1, high: 2 };

export function boxOf(candidate: Pick<CalibrationCandidate, 'box' | 'performance' | 'potential'>) {
  const box = Number(candidate.box);
  if (Number.isInteger(box) && box >= 1 && box <= 9) return box;
  const performance = LEVEL_INDEX[String(candidate.performance ?? '').toLowerCase()];
  const potential = LEVEL_INDEX[String(candidate.potential ?? '').toLowerCase()];
  return performance === undefined || potential === undefined
    ? null
    : potential * 3 + performance + 1;
}

const READINESS_ORDER = Object.fromEntries(
  READINESS.map((readiness, index) => [readiness.key, index]),
) as Record<ReadinessKey, number>;

export function sortCandidates<T extends CalibrationCandidate>(list: T[]): T[] {
  return [...list].sort(
    (left, right) =>
      READINESS_ORDER[normalizeReadiness(left.readiness)] -
        READINESS_ORDER[normalizeReadiness(right.readiness)] || left.name.localeCompare(right.name),
  );
}

export function matches(
  candidate: CalibrationCandidate,
  { q = '', dept = '' }: { q?: string; dept?: string },
): boolean {
  if (dept && candidate.department !== dept) return false;
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [
    candidate.name,
    candidate.department,
    candidate.targetRole,
    candidate.currentRole,
    candidate.id,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(needle));
}

export function byReadiness<T extends CalibrationCandidate>(list: T[], key: string): T[] {
  return key ? list.filter((candidate) => normalizeReadiness(candidate.readiness) === key) : list;
}

export function readinessCounts(list: CalibrationCandidate[]): ReadinessCount[] {
  const counts = Object.fromEntries(READINESS.map(({ key }) => [key, 0])) as Record<
    ReadinessKey,
    number
  >;
  list.forEach((candidate) => {
    counts[normalizeReadiness(candidate.readiness)] += 1;
  });
  return READINESS.map((readiness) => ({
    ...readiness,
    count: counts[readiness.key],
    percent: list.length ? Math.round((counts[readiness.key] / list.length) * 100) : 0,
  }));
}

export function boxStats(list: CalibrationCandidate[]): BoxStats {
  const candidatesByBox = new Map<number, CalibrationCandidate[]>(
    Object.keys(BOXES).map((key) => [Number(key), []]),
  );
  let unplaced = 0;
  list.forEach((candidate) => {
    const box = boxOf(candidate);
    if (box === null) {
      unplaced += 1;
      return;
    }
    candidatesByBox.get(box)?.push(candidate);
  });

  const boxes = Object.fromEntries(
    [...candidatesByBox].map(([box, candidates]) => [
      box,
      {
        box,
        ...BOXES[box],
        count: candidates.length,
        percent: list.length ? Math.round((candidates.length / list.length) * 100) : 0,
        candidates: sortCandidates(candidates),
      },
    ]),
  ) as Record<number, BoxSummary>;

  return {
    boxes,
    unplaced,
    maxCount: Math.max(1, ...[...candidatesByBox.values()].map((candidates) => candidates.length)),
  };
}

export function departmentBenchmark(list: CalibrationCandidate[]): DepartmentBenchmarkRow[] {
  const departments = new Map<string, DepartmentBenchmarkRow>();
  list.forEach((candidate) => {
    const department = candidate.department || 'Unassigned';
    const row = departments.get(department) ?? {
      department,
      total: 0,
      ready_now: 0,
      with_development: 0,
      not_ready: 0,
      pending_evaluation: 0,
      rate: 0,
      small: false,
    };
    row.total += 1;
    row[normalizeReadiness(candidate.readiness)] += 1;
    departments.set(department, row);
  });

  return [...departments.values()]
    .map((row) => ({
      ...row,
      rate: Math.round((row.ready_now / row.total) * 100),
      small: row.total < 3,
    }))
    .sort(
      (left, right) => right.total - left.total || left.department.localeCompare(right.department),
    );
}

export const departments = (list: CalibrationCandidate[]) =>
  [...new Set(list.map((candidate) => candidate.department).filter(Boolean))].sort();

export function readState(hash = window.location.hash): CalibrationState {
  const params = new URLSearchParams(hash.includes('?') ? hash.split('?').slice(1).join('?') : '');
  const status = params.get('status') ?? '';
  const validStatus = READINESS.some((readiness) => readiness.key === status)
    ? (status as ReadinessKey)
    : '';
  return {
    box: Number(params.get('box')) || 0,
    status: validStatus,
    dept: params.get('dept') ?? '',
    q: params.get('q') ?? '',
    view: params.get('view') === 'table' ? 'table' : 'matrix',
  };
}

export function writeState(
  next: CalibrationState,
  { replace = false }: { replace?: boolean } = {},
) {
  const base = window.location.hash.split('?')[0] || '#/calibration';
  const params = new URLSearchParams();
  Object.entries(next).forEach(([key, value]) => {
    if (value && value !== 'matrix') params.set(key, String(value));
  });
  const query = params.toString();
  const hash = query ? `${base}?${query}` : base;
  if (replace) window.history.replaceState(null, '', hash);
  else window.location.hash = hash;
}

export function paginate<T>(list: T[], page: number, size = 10) {
  const pages = Math.max(1, Math.ceil(list.length / size));
  const safePage = Math.min(Math.max(1, page), pages);
  return {
    items: list.slice((safePage - 1) * size, safePage * size),
    page: safePage,
    pages,
  };
}

const escapeCsvCell = (value: string | number): string => {
  let cell = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(cell)) cell = `'${cell}`;
  return `"${cell.replace(/"/g, '""')}"`;
};

export function candidatesToCsv(list: CalibrationCandidate[]): string {
  const headers = [
    'Candidate',
    'Department',
    'Current level',
    'Target level',
    'Target role',
    'Box',
    'Box name',
    'Readiness',
  ];
  const rows = list.map((candidate) => {
    const box = boxOf(candidate);
    return [
      candidate.name,
      candidate.department,
      formatLevel(candidate.currentLevel),
      formatLevel(candidate.targetLevel),
      candidate.targetRole ?? '',
      box ? `Box ${box}` : '',
      box ? (BOXES[box]?.name ?? '') : '',
      readinessMeta(normalizeReadiness(candidate.readiness)).label,
    ];
  });
  return [headers, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\n');
}

export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
  const anchor = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
