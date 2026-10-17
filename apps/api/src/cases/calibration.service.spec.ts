import { describe, expect, it } from 'vitest';
import { defaultScorecardConfig, scorecardRatingKey } from '@assessflow/contracts';
import { CalibrationService, calculateBoxIndex, scoreBand } from './calibration.service';

/**
 * Ratings giving the requested 0-5 issue scores: each question takes points 0..weight,
 * so a uniform question score of x/5 yields an issue score of x.
 */
function ratings(technical: number, behavioral: number) {
  const out: Record<string, { score: number }> = {};
  for (const group of defaultScorecardConfig.technical)
    for (const c of group.criteria)
      out[scorecardRatingKey(group, c)] = { score: (technical / 5) * c.weight };
  for (const group of defaultScorecardConfig.behavioral)
    for (const c of group.criteria)
      out[scorecardRatingKey(group, c)] = { score: (behavioral / 5) * c.weight };
  return out;
}

function makeCase(
  id: string,
  department: string,
  opts: {
    scores?: [number, number];
    resultCode?: string;
    finalized?: boolean;
    reopened?: boolean;
  } = {},
) {
  const finalized = opts.finalized ?? true;
  return {
    id,
    caseCode: `AF-${id}`,
    employeeId: `emp-${id}`,
    employee: { externalId: `EMP-${id}`, displayName: `Person ${id}`, currentLevel: 'L4' },
    departmentSnapshot: department,
    currentRoleSnapshot: 'Specialist',
    targetRoleSnapshot: 'Lead',
    targetLevelSnapshot: 'L5',
    status: 'RESULT_FINALIZED',
    stage: 'RESULT',
    plan: null,
    scorecards: opts.scores ? [{ ratings: ratings(...opts.scores) }] : [],
    resultRevisions: [
      {
        resultCode: opts.resultCode ?? 'READY_WITH_DEVELOPMENT',
        finalizedAt: finalized ? new Date('2026-10-01') : null,
        reopenedAt: opts.reopened ? new Date('2026-10-02') : null,
      },
    ],
    recommendationRevisions: [],
  };
}

function serviceWith(cases: ReturnType<typeof makeCase>[]) {
  const fakePrisma = {
    enabled: true,
    assessmentCase: {
      findMany: async ({ where }: { where: { AND: Array<Record<string, unknown>> } }) => {
        const dept = where.AND.find((part) => 'departmentSnapshot' in part)?.departmentSnapshot;
        return cases.filter((c) => !dept || c.departmentSnapshot === dept);
      },
    },
  };
  return new CalibrationService(fakePrisma as never);
}

describe('scoreBand / calculateBoxIndex', () => {
  it('uses the result cut-offs (below 3 low, 3 to <4 medium, 4+ high)', () => {
    expect(scoreBand(2.99)).toBe('LOW');
    expect(scoreBand(3)).toBe('MEDIUM');
    expect(scoreBand(3.99)).toBe('MEDIUM');
    expect(scoreBand(4)).toBe('HIGH');
  });

  it('maps performance (x) and potential (y) to all nine boxes', () => {
    const boxes = new Set<number>();
    for (const pot of ['LOW', 'MEDIUM', 'HIGH'] as const)
      for (const perf of ['LOW', 'MEDIUM', 'HIGH'] as const)
        boxes.add(calculateBoxIndex(perf, pot));
    expect([...boxes].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(calculateBoxIndex('HIGH', 'LOW')).toBe(3);
    expect(calculateBoxIndex('LOW', 'HIGH')).toBe(7);
  });
});

describe('CalibrationService', () => {
  it('places candidates from Technical (performance) and Behavioral (potential) scores', async () => {
    const matrix = await serviceWith([
      makeCase('a', 'Engineering', { scores: [4.5, 2.5] }),
      makeCase('b', 'Engineering', { scores: [2, 4.2] }),
      makeCase('c', 'Product', { scores: [3.5, 3.5] }),
    ]).getMatrix();

    const boxOf = (id: string) =>
      matrix.grid.find((cell) => cell.candidates.some((c) => c.caseId === id))?.boxIndex;
    expect(boxOf('a')).toBe(3); // high performance, low potential
    expect(boxOf('b')).toBe(7); // low performance, high potential
    expect(boxOf('c')).toBe(5);
    const a = matrix.grid.flatMap((cell) => cell.candidates).find((c) => c.caseId === 'a')!;
    expect(a.technicalScore).toBe(4.5);
    expect(a.behavioralScore).toBe(2.5);
    expect(a.currentLevel).toBe('L4');
    expect(a.tenureMonths).toBeNull();
    expect(matrix.placedCandidates).toBe(3);
    expect(matrix.axes?.highFrom).toBe(4);
  });

  it('lists unscored, unfinalized and reopened cases as unplaced instead of box 5', async () => {
    const matrix = await serviceWith([
      makeCase('placed', 'Engineering', { scores: [4, 4] }),
      makeCase('imported', 'Engineering', { resultCode: 'READY_NOW' }),
      makeCase('pending', 'Engineering', { scores: [4, 4], finalized: false }),
      makeCase('reopened', 'Engineering', { scores: [4, 4], reopened: true }),
    ]).getMatrix();

    expect(matrix.totalCandidates).toBe(4);
    expect(matrix.placedCandidates).toBe(1);
    expect(matrix.grid.flatMap((cell) => cell.candidates).map((c) => c.caseId)).toEqual(['placed']);
    const reasons = Object.fromEntries(
      (matrix.unplaced ?? []).map((c) => [c.caseId, c.unplacedReason]),
    );
    expect(reasons.imported).toMatch(/No complete scorecard/);
    expect(reasons.pending).toMatch(/not finalized/);
    expect(reasons.reopened).toMatch(/reopened/);
    for (const c of matrix.unplaced ?? []) expect(c.boxIndex).toBeNull();
  });

  it('computes cell percentages against placed candidates only', async () => {
    const matrix = await serviceWith([
      makeCase('x', 'Product', { scores: [4.5, 4.5] }),
      makeCase('y', 'Product', { resultCode: 'NOT_READY' }),
    ]).getMatrix();
    const star = matrix.grid.find((cell) => cell.boxIndex === 9)!;
    expect(star.actualPercentage).toBe(100);
    expect(matrix.distributionSummary.notReadyCount).toBe(1);
  });

  it('filters by department', async () => {
    const matrix = await serviceWith([
      makeCase('e', 'Engineering', { scores: [4, 4] }),
      makeCase('p', 'Product', { scores: [4, 4] }),
    ]).getMatrix('Product');
    expect(matrix.totalCandidates).toBe(1);
    expect(matrix.grid.flatMap((cell) => cell.candidates)[0]!.department).toBe('Product');
  });
});
