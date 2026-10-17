import { z } from 'zod';
import type { ResultCode } from './index';

export interface ScorecardCriterion {
  code: string;
  ratingKey?: string;
  name: string;
  standard: string;
  weight: number;
  knockout?: boolean;
}

export interface ScorecardDimension {
  code: string;
  name: string;
  weight: number;
  criteria: ScorecardCriterion[];
}

export interface ScorecardConfig {
  technicalLabel?: string;
  behavioralLabel?: string;
  technicalWeight: number;
  behavioralWeight: number;
  technical: ScorecardDimension[];
  behavioral: ScorecardDimension[];
}

export interface ScorecardRating {
  /** Points earned on the question: 0 up to the question weight (e.g. 2.5 of 3). Not multiplied by the weight. */
  score?: number;
  evidence?: string;
  /** Set by the assessor on this question. Any knockout forces NOT_READY, whatever the scores. */
  knockout?: boolean;
}

export type ScorecardRatings = Record<string, ScorecardRating>;

/**
 * Each question's weight is its maximum points (default 1). The assessor
 * enters the points earned directly, from 0 up to that weight, in steps of
 * 0.01 (e.g. 2.5 of 3). An issue's target is the sum of its question weights;
 * its actual is the sum of the points entered. The issue score on the 0-5
 * scale is actual / target x 5.
 */
export const SCORECARD_DEFAULT_QUESTION_WEIGHT = 1;
/** Quick-pick fractions of the question weight shown as buttons (0, 1/4, 1/2, 3/4, full). */
export const SCORECARD_QUICK_FRACTIONS = [0, 0.25, 0.5, 0.75, 1] as const;

/** Points are valid when 0 <= points <= question weight, with at most two decimals. */
export function isValidQuestionScore(score: unknown, questionWeight: number): score is number {
  return (
    typeof score === 'number' &&
    Number.isFinite(score) &&
    score >= 0 &&
    score <= questionWeight + 1e-9 &&
    Math.abs(Math.round(score * 100) - score * 100) < 1e-6
  );
}
/** Overall score bands (0-5) mapped to result codes. */
export const SCORECARD_READY_NOW_THRESHOLD = 4;
export const SCORECARD_READY_WITH_DEVELOPMENT_THRESHOLD = 3;

const dimension = (
  code: string,
  name: string,
  weight: number,
  criteria: Array<[string, string, string, boolean?]>,
): ScorecardDimension => ({
  code,
  name,
  weight,
  criteria: criteria.map(([criterionCode, criterionName, standard, knockout]) => ({
    code: criterionCode,
    ratingKey: `${code}:${criterionCode}`,
    name: criterionName,
    standard,
    weight: 1,
    ...(knockout ? { knockout: true } : {}),
  })),
});

export function scorecardRatingKey(group: ScorecardDimension, criterion: ScorecardCriterion) {
  return criterion.ratingKey ?? `${group.code}:${criterion.code}`;
}

const issueWeights = [15, 15, 15, 15, 10, 30] as const;

export const defaultScorecardConfig: ScorecardConfig = {
  technicalLabel: 'TECHNICAL',
  behavioralLabel: 'BEHAVIORAL',
  technicalWeight: 50,
  behavioralWeight: 50,
  technical: [
    dimension('T1', 'Patient Flow & Waiting Times', issueWeights[0], [
      [
        '1.1',
        'OPD Patient Flow & Scheduling',
        'Diagnoses bottlenecks across visit stages and designs a repeatable daily flow model.',
      ],
      [
        '1.2',
        'Operational Analytics',
        'Separates demand drivers from supply constraints using operational data.',
      ],
      [
        '1.3',
        'Queue & Capacity Management',
        'Handles peak overload through smoothing, sequencing and capacity levers.',
      ],
      ['1.4', 'Demand Forecasting', 'Reads the demand curve and matches capacity templates to it.'],
    ]),
    dimension('T2', 'Access & Appointments', issueWeights[1], [
      [
        '2.1',
        'Access Management',
        'Explains the access-versus-utilisation paradox and targets the third-next-available wait.',
      ],
      [
        '2.2',
        'Appointment & Scheduling Optimisation',
        'Redesigns booking channels, reminders, overbooking rules and slot templates.',
      ],
      [
        '2.3',
        'Demand-Capacity Matching',
        'Aligns slot supply to demand and reduces no-show impact safely.',
      ],
    ]),
    dimension('T3', 'Staffing & Team Leadership', issueWeights[2], [
      [
        '3.1',
        'Workforce & Roster Planning',
        'Realigns the roster to demand and reduces avoidable overtime using data.',
      ],
      [
        '3.2',
        'Demand-Based Staffing',
        'Builds a sustainable skill mix and transparent, fair rostering rules.',
      ],
    ]),
    dimension('T4', 'Cross-Functional Dependencies', issueWeights[3], [
      [
        '4.1',
        'Patient-Journey / Process Mapping',
        'Maps the end-to-end journey and identifies high-impact handoffs.',
      ],
      [
        '4.2',
        'Cross-Functional Operations',
        'Proposes practical fixes to lab, radiology, insurance and pharmacy handoffs.',
      ],
      [
        '4.3',
        'SLA & Handoff Design',
        'Designs workable SLAs and joint mechanisms with departments outside OPD control.',
      ],
    ]),
    dimension('T5', 'Patient Experience & Complaints', issueWeights[4], [
      [
        '5.1',
        'Service Standardisation',
        'Standardises patient experience across clinics with measurable standards.',
      ],
      [
        '5.2',
        'Complaint & Feedback Systems',
        'Builds a complaint and feedback loop that closes repeat issues.',
      ],
      [
        '5.3',
        'Patient-Experience Operations',
        'Links satisfaction to operational causes and fixes them operationally.',
      ],
    ]),
    dimension('T6', 'Convergent OPD Crisis (capstone)', issueWeights[5], [
      [
        '6.1',
        'Crisis Operations Management',
        'Stabilises the department while protecting patient access and safety.',
        true,
      ],
      [
        '6.2',
        'Data-Driven Decision Making',
        'Uses operational snapshots to sequence decisions and choose measures.',
      ],
      [
        '6.3',
        'Capacity & Bottleneck Management',
        'Resolves volume and booking bottlenecks without compromising safety.',
      ],
    ]),
  ],
  behavioral: [
    dimension('B1', 'Patient Flow & Waiting Times', issueWeights[0], [
      [
        'MC.9',
        'Analytical Problem Solving',
        'Finds root causes in operational data and fixes the system, not the incident.',
      ],
      [
        'MC.4',
        'Planning & Organizing',
        'Translates goals into a structured operating plan and resource allocation.',
      ],
      [
        'MC.8',
        'Decision-Making',
        'Makes timely, evidence-based decisions and escalates appropriately.',
      ],
    ]),
    dimension('B2', 'Access & Appointments', issueWeights[1], [
      [
        'MC.4',
        'Planning & Organizing',
        'Designs a coherent access model and organises the change in working methods.',
      ],
      [
        'MC.6',
        'Change Management',
        'Leads new booking behaviours and brings staff and patients through change.',
      ],
      [
        'CC.1',
        'Empathy & Emotional Intelligence',
        'Keeps patient access central while balancing utilisation and patient need.',
      ],
    ]),
    dimension('B3', 'Staffing & Team Leadership', issueWeights[2], [
      ['MC.1', 'Leadership', 'Sets direction and gets results through others.'],
      ['MC.3', 'Delegation', 'Allocates work and authority fairly while retaining accountability.'],
      ['MC.2', 'People Development', 'Coaches and develops the team and builds career pathways.'],
      [
        'CC.6',
        'Teamwork & Collaboration',
        'Restores a collaborative, fair team climate and resolves conflict constructively.',
      ],
    ]),
    dimension('B4', 'Cross-Functional Dependencies', issueWeights[3], [
      [
        'MC.7',
        'Organizational Sensitivity',
        'Reads cross-functional dynamics and builds influence outside direct control.',
      ],
      [
        'MC.1',
        'Leadership',
        'Aligns partner departments around shared service goals without direct authority.',
      ],
      [
        'MC.10',
        'Commercial Awareness',
        'Understands revenue impact of leakage and protects operational value.',
      ],
    ]),
    dimension('B5', 'Patient Experience & Complaints', issueWeights[4], [
      [
        'CC.1',
        'Empathy & Emotional Intelligence',
        'Designs experience around patients and frontline reality.',
      ],
      [
        'CC.5',
        'Accountability & Ownership',
        'Owns OPD patient experience and clinic accountability.',
        true,
      ],
      ['MC.6', 'Change Management', 'Embeds service standards so improvement holds over time.'],
    ]),
    dimension('B6', 'Convergent OPD Crisis (capstone)', issueWeights[5], [
      [
        'MC.8',
        'Decision-Making',
        'Sequences stabilisation decisions under pressure and escalates appropriately.',
      ],
      ['MC.1', 'Leadership', 'Holds a stretched team together and protects standards.'],
      [
        'CC.4',
        'Commitment to Excellence',
        'Sustains service, safety and resilience through a surge.',
      ],
      ['CC.5', 'Accountability & Ownership', 'Owns the department response and outcomes.', true],
      ['MC.6', 'Change Management', 'Manages operational change without losing safety or access.'],
    ]),
  ],
};

export const scorecardConfigSchema = z.object({
  technicalLabel: z.string().min(1).max(80).optional(),
  behavioralLabel: z.string().min(1).max(80).optional(),
  technicalWeight: z.number().min(0).max(1000),
  behavioralWeight: z.number().min(0).max(1000),
  technical: z
    .array(
      z.object({
        code: z.string().min(1).max(20),
        name: z.string().min(1).max(160),
        weight: z.number().min(0).max(1000),
        criteria: z
          .array(
            z.object({
              code: z.string().min(1).max(20),
              ratingKey: z.string().min(1).max(60).optional(),
              name: z.string().min(1).max(160),
              standard: z.string().min(1).max(2000),
              weight: z.number().min(0).max(1000),
              knockout: z.boolean().optional(),
            }),
          )
          .min(1)
          .max(40),
      }),
    )
    .min(1)
    .max(12),
  behavioral: z
    .array(
      z.object({
        code: z.string().min(1).max(20),
        name: z.string().min(1).max(160),
        weight: z.number().min(0).max(1000),
        criteria: z
          .array(
            z.object({
              code: z.string().min(1).max(20),
              ratingKey: z.string().min(1).max(60).optional(),
              name: z.string().min(1).max(160),
              standard: z.string().min(1).max(2000),
              weight: z.number().min(0).max(1000),
              knockout: z.boolean().optional(),
            }),
          )
          .min(1)
          .max(40),
      }),
    )
    .min(1)
    .max(12),
});

export const scorecardRatingsSchema = z.record(
  z.string().min(1).max(60),
  z.object({
    // Points earned, 0 up to the question weight (checked by the API against
    // the config). Out-of-range scores count as unanswered.
    score: z.number().finite().min(0).max(1000).optional(),
    evidence: z.string().max(4000).optional(),
    knockout: z.boolean().optional(),
  }),
);

/** Weight problems that block saving scorecard settings (each set must total 100%). */
export function scorecardWeightProblems(config: ScorecardConfig): string[] {
  const total = (values: number[]) => values.reduce((sum, value) => sum + value, 0);
  const off = (value: number) => Math.abs(value - 100) > 0.001;
  const problems: string[] = [];
  const split = config.technicalWeight + config.behavioralWeight;
  if (off(split)) problems.push(`Technical and Behavioral weights total ${split}% (must be 100%).`);
  const technical = total(config.technical.map((group) => group.weight));
  if (off(technical))
    problems.push(
      `${config.technicalLabel ?? 'Technical'} issue weights total ${technical}% (must be 100%).`,
    );
  const behavioral = total(config.behavioral.map((group) => group.weight));
  if (off(behavioral))
    problems.push(
      `${config.behavioralLabel ?? 'Behavioral'} issue weights total ${behavioral}% (must be 100%).`,
    );
  return problems;
}

export const scorecardSubmissionSchema = z.object({
  ratings: scorecardRatingsSchema,
  submit: z.boolean().default(false),
});

export interface ScorecardIssueSummary {
  code: string;
  name: string;
  weight: number;
  actual: number;
  target: number;
  score: number;
}

export interface ScorecardKnockoutCheck {
  code: string;
  name: string;
  issueName: string;
  actual: number | null;
  target: number;
  triggered: boolean;
}

export function calculateScorecard(
  config: ScorecardConfig,
  submissions: Array<{ ratings: ScorecardRatings; submitted: boolean }>,
) {
  const criterionEntries = [...config.technical, ...config.behavioral].flatMap((group) =>
    group.criteria.map((criterion) => ({
      criterion,
      group,
      ratingKey: scorecardRatingKey(group, criterion),
    })),
  );
  const completeSubmissions = submissions.filter(
    (submission) =>
      submission.submitted &&
      criterionEntries.every((entry) =>
        isValidQuestionScore(submission.ratings[entry.ratingKey]?.score, entry.criterion.weight),
      ),
  );
  if (!completeSubmissions.length) {
    return {
      completeCount: 0,
      resultCode: 'INCOMPLETE' as ResultCode,
      knockout: false,
      technicalWeight: config.technicalWeight,
      behavioralWeight: config.behavioralWeight,
      technicalIssues: [] as ScorecardIssueSummary[],
      behavioralIssues: [] as ScorecardIssueSummary[],
      knockoutChecks: [] as ScorecardKnockoutCheck[],
    };
  }

  const perRater = completeSubmissions.map((submission) => {
    const scoreDimension = (dimensions: ScorecardDimension[]) => {
      const dimensionScores = dimensions.map((group) => {
        const rated = group.criteria.map((criterion) => ({
          criterion,
          score: submission.ratings[scorecardRatingKey(group, criterion)]!.score as number,
        }));
        // Target = sum of question weights; actual = sum of points entered.
        const target = rated.reduce((sum, item) => sum + item.criterion.weight, 0);
        const actual = rated.reduce((sum, item) => sum + item.score, 0);
        const attainment = target ? actual / target : 0;
        const score = Math.min(1, attainment) * 5;
        return {
          group,
          score,
          issue: {
            code: group.code,
            name: group.name,
            weight: group.weight,
            actual,
            target,
            score,
          },
        };
      });
      const totalWeight = dimensionScores.reduce((sum, item) => sum + item.group.weight, 0);
      return {
        score: totalWeight
          ? dimensionScores.reduce((sum, item) => sum + item.score * item.group.weight, 0) /
            totalWeight
          : 0,
        issues: dimensionScores.map((item) => item.issue),
      };
    };
    const technical = scoreDimension(config.technical);
    const behavioral = scoreDimension(config.behavioral);
    const totalWeight = config.technicalWeight + config.behavioralWeight;
    const overall = totalWeight
      ? (technical.score * config.technicalWeight + behavioral.score * config.behavioralWeight) /
        totalWeight
      : 0;
    return {
      technical: technical.score,
      behavioral: behavioral.score,
      overall,
      technicalIssues: technical.issues,
      behavioralIssues: behavioral.issues,
    };
  });
  const average = (key: 'technical' | 'behavioral' | 'overall') =>
    perRater.reduce((sum, rating) => sum + rating[key], 0) / perRater.length;
  const technicalIssues = config.technical.map((group, index) => {
    const scores = perRater.map((rating) => rating.technicalIssues[index]!);
    const actual = scores.reduce((sum, score) => sum + score.actual, 0) / scores.length;
    const target = scores[0]!.target;
    return {
      ...scores[0]!,
      actual,
      score: target ? Math.min(actual / target, 1) * 5 : 0,
    };
  });
  const behavioralIssues = config.behavioral.map((group, index) => {
    const scores = perRater.map((rating) => rating.behavioralIssues[index]!);
    const actual = scores.reduce((sum, score) => sum + score.actual, 0) / scores.length;
    const target = scores[0]!.target;
    return {
      ...scores[0]!,
      actual,
      score: target ? Math.min(actual / target, 1) * 5 : 0,
    };
  });
  // Knockout is a flag the assessor sets on a question, independent of its score.
  // actual = number of assessors who flagged it; any flag triggers.
  const knockoutChecks: ScorecardKnockoutCheck[] = criterionEntries.flatMap(
    ({ criterion, group, ratingKey }) => {
      const flaggedBy = completeSubmissions.filter(
        (submission) => submission.ratings[ratingKey]?.knockout === true,
      ).length;
      return flaggedBy
        ? [
            {
              code: criterion.code,
              name: criterion.name,
              issueName: group.name,
              actual: flaggedBy,
              target: 0,
              triggered: true,
            },
          ]
        : [];
    },
  );
  const knockout = knockoutChecks.some((check) => check.triggered);
  const overall = average('overall');
  const resultCode: ResultCode = knockout
    ? 'NOT_READY'
    : overall >= SCORECARD_READY_NOW_THRESHOLD
      ? 'READY_NOW'
      : overall >= SCORECARD_READY_WITH_DEVELOPMENT_THRESHOLD
        ? 'READY_WITH_DEVELOPMENT'
        : 'NOT_READY';
  return {
    completeCount: completeSubmissions.length,
    technical: average('technical'),
    behavioral: average('behavioral'),
    overall,
    knockout,
    resultCode,
    technicalWeight: config.technicalWeight,
    behavioralWeight: config.behavioralWeight,
    technicalIssues,
    behavioralIssues,
    knockoutChecks,
  };
}
