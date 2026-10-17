import { describe, expect, it } from 'vitest';
import {
  calculateScorecard,
  defaultScorecardConfig,
  scorecardRatingKey,
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

// Small config without knockouts so the bands can be tested in isolation.
const simple: ScorecardConfig = {
  technicalWeight: 50,
  behavioralWeight: 50,
  technical: [
    {
      code: 'T',
      name: 'Technical',
      weight: 1,
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
      weight: 1,
      criteria: [{ code: 'c', name: 'C', standard: '', weight: 1 }],
    },
  ],
};

describe('calculateScorecard', () => {
  it('scores a uniform rating as that rating (no saturation at low ratings)', () => {
    for (const value of [1, 2, 3, 4, 5]) {
      expect(score(simple, [uniform(simple, value)]).overall).toBeCloseTo(value, 6);
    }
  });

  it('maps overall bands to result codes', () => {
    expect(score(simple, [uniform(simple, 1)]).resultCode).toBe('NOT_READY');
    expect(score(simple, [uniform(simple, 2.99)]).resultCode).toBe('NOT_READY');
    expect(score(simple, [uniform(simple, 3)]).resultCode).toBe('READY_WITH_DEVELOPMENT');
    expect(score(simple, [uniform(simple, 3.99)]).resultCode).toBe('READY_WITH_DEVELOPMENT');
    expect(score(simple, [uniform(simple, 4)]).resultCode).toBe('READY_NOW');
    expect(score(simple, [uniform(simple, 5)]).resultCode).toBe('READY_NOW');
  });

  it('applies criterion weights within a dimension', () => {
    // a=5 (w1), b=1 (w3) -> technical = (5 + 3) / 4 = 2; behavioral c=4 -> overall 3
    const result = score(simple, [
      { 'T:a': { score: 5 }, 'T:b': { score: 1 }, 'B:c': { score: 4 } },
    ]);
    expect(result.technical).toBeCloseTo(2, 6);
    expect(result.behavioral).toBeCloseTo(4, 6);
    expect(result.overall).toBeCloseTo(3, 6);
  });

  it('averages complete submissions across assessors', () => {
    const result = score(simple, [uniform(simple, 5), uniform(simple, 3)]);
    expect(result.completeCount).toBe(2);
    expect(result.overall).toBeCloseTo(4, 6);
  });

  it('returns INCOMPLETE when no assessor submitted every criterion', () => {
    const partial = { 'T:a': { score: 5 } };
    expect(score(simple, [partial]).resultCode).toBe('INCOMPLETE');
  });

  it('forces NOT_READY when a knockout criterion is rated below the threshold', () => {
    const withKnockout: ScorecardConfig = {
      ...simple,
      technical: [
        {
          ...simple.technical[0]!,
          criteria: [
            { ...simple.technical[0]!.criteria[0]!, knockout: true },
            simple.technical[0]!.criteria[1]!,
          ],
        },
      ],
    };
    const strong = uniform(withKnockout, 5);
    expect(score(withKnockout, [strong]).resultCode).toBe('READY_NOW');
    const failed = { ...strong, 'T:a': { score: 1.5 } };
    const result = score(withKnockout, [failed]);
    expect(result.knockout).toBe(true);
    expect(result.resultCode).toBe('NOT_READY');
    // One assessor triggering the knockout is enough.
    expect(score(withKnockout, [strong, failed]).knockout).toBe(true);
    // Exactly at the threshold is not a knockout.
    expect(score(withKnockout, [{ ...strong, 'T:a': { score: 2 } }]).knockout).toBe(false);
  });

  it('does not rate a weak candidate on the default config as READY_NOW', () => {
    // Regression: with a per-question target of 1, every rating >= 1 scored 5/5.
    for (const value of [2, 2.5]) {
      const result = score(defaultScorecardConfig, [uniform(defaultScorecardConfig, value)]);
      expect(result.overall).toBeCloseTo(value, 6);
      expect(result.resultCode).toBe('NOT_READY');
    }
    expect(score(defaultScorecardConfig, [uniform(defaultScorecardConfig, 3.5)]).resultCode).toBe(
      'READY_WITH_DEVELOPMENT',
    );
  });
});
