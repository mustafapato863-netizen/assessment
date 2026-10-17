import { describe, expect, it } from 'vitest';
import {
  calculateScorecard,
  defaultScorecardConfig,
  scorecardRatingKey,
  scorecardWeightProblems,
  type ScorecardConfig,
  type ScorecardRatings,
} from './scorecard';

const allKeys = (config: ScorecardConfig) =>
  [...config.technical, ...config.behavioral].flatMap((group) =>
    group.criteria.map((criterion) => scorecardRatingKey(group, criterion)),
  );

const uniform = (config: ScorecardConfig, score: number): ScorecardRatings =>
  Object.fromEntries(allKeys(config).map((key) => [key, { score }]));

const score = (config: ScorecardConfig, ratings: ScorecardRatings[]) =>
  calculateScorecard(
    config,
    ratings.map((r) => ({ ratings: r, submitted: true })),
  );

const simple: ScorecardConfig = {
  technicalWeight: 50,
  behavioralWeight: 50,
  technical: [
    {
      code: 'T',
      name: 'Technical',
      weight: 100,
      criteria: [
        { code: 'a', name: 'A', standard: '', weight: 1 },
        { code: 'b', name: 'B', standard: '', weight: 3 },
      ],
    },
  ],
  behavioral: [
    {
      code: 'B',
      name: 'Behavioral',
      weight: 100,
      criteria: [{ code: 'c', name: 'C', standard: '', weight: 1 }],
    },
  ],
};

describe('calculateScorecard (questions scored 0 to 1)', () => {
  it('converts the share of the target achieved to a 0-5 score', () => {
    for (const value of [0, 0.25, 0.5, 0.75, 1]) {
      expect(score(simple, [uniform(simple, value)]).overall).toBeCloseTo(value * 5, 6);
    }
  });

  it('uses the sum of question weights as the issue target', () => {
    // a=1 (w1), b=0.5 (w3): actual 2.5 of target 4 -> 62.5% -> 3.125
    const result = score(simple, [
      { 'T:a': { score: 1 }, 'T:b': { score: 0.5 }, 'B:c': { score: 1 } },
    ]);
    expect(result.technicalIssues[0]).toMatchObject({ actual: 2.5, target: 4 });
    expect(result.technical).toBeCloseTo(3.125, 6);
    expect(result.behavioral).toBeCloseTo(5, 6);
  });

  it('maps the overall score to result bands', () => {
    expect(score(simple, [uniform(simple, 0.5)]).resultCode).toBe('NOT_READY'); // 2.5
    expect(score(simple, [uniform(simple, 0.6)]).resultCode).toBe('READY_WITH_DEVELOPMENT'); // 3
    expect(score(simple, [uniform(simple, 0.75)]).resultCode).toBe('READY_WITH_DEVELOPMENT'); // 3.75
    expect(score(simple, [uniform(simple, 0.8)]).resultCode).toBe('READY_NOW'); // 4
  });

  it('averages complete submissions across assessors', () => {
    expect(score(simple, [uniform(simple, 1), uniform(simple, 0.6)]).overall).toBeCloseTo(4, 6);
  });

  it('treats out-of-range scores (old 0-5 drafts) as unanswered', () => {
    expect(score(simple, [uniform(simple, 3)]).resultCode).toBe('INCOMPLETE');
  });

  it('knockout is a flag set by the assessor, independent of the score', () => {
    const full = uniform(simple, 1);
    expect(score(simple, [full]).knockout).toBe(false);
    const flagged = { ...full, 'T:a': { score: 1, knockout: true } };
    const result = score(simple, [flagged]);
    expect(result.knockout).toBe(true);
    expect(result.resultCode).toBe('NOT_READY');
    expect(result.overall).toBeCloseTo(5, 6);
    expect(result.knockoutChecks).toEqual([
      expect.objectContaining({ code: 'a', triggered: true, actual: 1 }),
    ]);
    // A low score alone does not trigger a knockout.
    expect(score(simple, [{ ...full, 'T:a': { score: 0 } }]).knockout).toBe(false);
  });

  it('scores the default workbook config on the same scale', () => {
    expect(score(defaultScorecardConfig, [uniform(defaultScorecardConfig, 1)]).resultCode).toBe(
      'READY_NOW',
    );
    expect(score(defaultScorecardConfig, [uniform(defaultScorecardConfig, 0.25)]).resultCode).toBe(
      'NOT_READY',
    );
  });
});

describe('scorecardWeightProblems', () => {
  it('accepts the default config (each set totals 100%)', () => {
    expect(scorecardWeightProblems(defaultScorecardConfig)).toEqual([]);
  });

  it('reports each set that does not total 100%', () => {
    const broken: ScorecardConfig = {
      ...simple,
      technicalWeight: 60,
      technical: [{ ...simple.technical[0]!, weight: 90 }],
    };
    const problems = scorecardWeightProblems(broken);
    expect(problems).toHaveLength(2);
    expect(problems.join(' ')).toMatch(/110%/);
    expect(problems.join(' ')).toMatch(/90%/);
  });
});
