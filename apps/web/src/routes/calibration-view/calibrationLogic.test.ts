import { describe, expect, it } from 'vitest';
import {
  boxOf,
  boxStats,
  candidatesToCsv,
  departmentBenchmark,
  formatLevel,
  matches,
  normalizeReadiness,
  readState,
  readinessCounts,
  sortCandidates,
  type CalibrationCandidate,
} from './calibrationLogic';

const candidate = (
  id: number,
  readiness: string | undefined,
  extra: Partial<CalibrationCandidate> = {},
): CalibrationCandidate => ({
  id: String(id),
  name: `Employee ${id}`,
  department: 'HR',
  box: 5,
  readiness,
  ...extra,
});

describe('normalizeReadiness', () => {
  it('maps known labels and counts unknown or empty values as pending', () => {
    expect(normalizeReadiness('Ready With Development')).toBe('with_development');
    expect(normalizeReadiness('with dev')).toBe('with_development');
    expect(normalizeReadiness('Ready now')).toBe('ready_now');
    expect(normalizeReadiness('ASSESSMENT IN PROGRESS')).toBe('pending_evaluation');
    expect(normalizeReadiness(undefined)).toBe('pending_evaluation');
    expect(normalizeReadiness('???')).toBe('pending_evaluation');
  });
});

describe('formatLevel', () => {
  it('always prefixes numeric levels with L', () => {
    expect(formatLevel(7)).toBe('L7');
    expect(formatLevel('5')).toBe('L5');
    expect(formatLevel('l3')).toBe('L3');
    expect(formatLevel('')).toBe('');
  });
});

describe('boxOf', () => {
  it('uses a box or derives it from performance and potential', () => {
    expect(boxOf({ box: 9 })).toBe(9);
    expect(boxOf({ performance: 'low', potential: 'low' })).toBe(1);
    expect(boxOf({ performance: 'high', potential: 'high' })).toBe(9);
    expect(boxOf({ performance: 'high', potential: 'medium' })).toBe(6);
    expect(boxOf({})).toBeNull();
  });
});

describe('counts', () => {
  const list = [
    candidate(1, 'ready_now'),
    candidate(2, 'with_development'),
    candidate(3, 'not_ready'),
    candidate(4, undefined),
    candidate(5, 'unknown', { box: 9 }),
    candidate(6, 'ready_now', { box: undefined }),
  ];

  it('readiness counts sum to the cohort size', () => {
    const counts = readinessCounts(list);
    expect(counts.reduce((total, row) => total + row.count, 0)).toBe(list.length);
    expect(counts.find((row) => row.key === 'pending_evaluation')?.count).toBe(2);
  });

  it('counts placed and unplaced candidates to the cohort size', () => {
    const stats = boxStats(list);
    const placed = Object.values(stats.boxes).reduce((total, box) => total + box.count, 0);
    expect(placed + stats.unplaced).toBe(list.length);
    expect(stats.unplaced).toBe(1);
  });

  it('keeps every department row complete and marks small groups', () => {
    const rows = departmentBenchmark([
      candidate(1, 'ready_now'),
      candidate(2, 'not_ready'),
      candidate(3, undefined, { department: 'IT' }),
    ]);
    rows.forEach((row) => {
      expect(row.ready_now + row.with_development + row.not_ready + row.pending_evaluation).toBe(
        row.total,
      );
    });
    expect(rows.find((row) => row.department === 'IT')?.small).toBe(true);
    expect(rows.find((row) => row.department === 'HR')?.rate).toBe(50);
  });
});

describe('sorting, filtering, CSV, and URL state', () => {
  it('sorts ready-now candidates first and then by name', () => {
    const sorted = sortCandidates([candidate(2, 'not_ready'), candidate(1, 'ready_now')]);
    expect(sorted.map((item) => item.id)).toEqual(['1', '2']);
  });

  it('searches candidate name and department', () => {
    expect(matches(candidate(1, 'ready_now'), { q: 'employee 1' })).toBe(true);
    expect(matches(candidate(1, 'ready_now'), { dept: 'IT' })).toBe(false);
  });

  it('exports the requested columns, escapes formulas, and excludes notes/evidence', () => {
    const csv = candidatesToCsv([
      candidate(1, 'ready_now', {
        name: '=evil',
        currentLevel: 3,
        targetLevel: 6,
        evidenceNote: 'private evidence',
      } as Partial<CalibrationCandidate> & { evidenceNote: string }),
    ]);
    expect(csv.split('\n')[0]).toBe(
      '"Candidate","Department","Current level","Target level","Target role","Box","Box name","Readiness"',
    );
    expect(csv).toContain('"\'=evil"');
    expect(csv).toContain('"L3","L6"');
    expect(csv).not.toContain('private evidence');
  });

  it('parses hash-route filters', () => {
    expect(readState('#/calibration?box=9&status=not_ready&view=table')).toMatchObject({
      box: 9,
      status: 'not_ready',
      view: 'table',
    });
  });
});
