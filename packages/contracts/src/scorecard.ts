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
  score?: number;
  evidence?: string;
}

export type ScorecardRatings = Record<string, ScorecardRating>;

/** Highest rating an assessor can give a single criterion (scale 0-5). */
export const SCORECARD_MAX_RATING = 5;
/**
 * Per-question reference used for attainment. It must equal the top of the
 * rating scale: a target of 1 on a 0-5 scale saturated every dimension at 5/5
 * as soon as the average rating reached 1, which made almost every complete
 * scorecard READY_NOW.
 */
export const SCORECARD_QUESTION_TARGET = SCORECARD_MAX_RATING;
/** A knockout criterion rated below this by any assessor forces NOT_READY. */
export const SCORECARD_KNOCKOUT_THRESHOLD = 2;
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
    score: z.number().finite().min(0).max(5).optional(),
    evidence: z.string().max(4000).optional(),
  }),
);

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
      criterionEntries.every((criterion) => {
        const score = submission.ratings[criterion.ratingKey]?.score;
        return Number.isFinite(score) && score! >= 0 && score! <= 5;
      }),
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
      knockoutChecks: criterionEntries
        .filter((entry) => entry.criterion.knockout)
        .map(({ criterion, group }) => ({
          code: criterion.code,
          name: criterion.name,
          issueName: group.name,
          actual: null,
          target: SCORECARD_KNOCKOUT_THRESHOLD,
          triggered: false,
        })),
    };
  }

  const perRater = completeSubmissions.map((submission) => {
    const scoreDimension = (dimensions: ScorecardDimension[]) => {
      const dimensionScores = dimensions.map((group) => {
        const rated = group.criteria.map((criterion) => ({
          criterion,
          score: submission.ratings[scorecardRatingKey(group, criterion)]!.score as number,
        }));
        const weightedTarget =
          rated.reduce((sum, item) => sum + item.criterion.weight, 0) * SCORECARD_QUESTION_TARGET;
        const weightedActual = rated.reduce(
          (sum, item) => sum + item.score * item.criterion.weight,
          0,
        );
        const attainment = weightedTarget ? weightedActual / weightedTarget : 0;
        const score = Math.min(1, attainment) * 5;
        const target =
          rated.reduce((sum, item) => sum + item.criterion.weight, 0) * SCORECARD_QUESTION_TARGET;
        const actual = rated.reduce((sum, item) => sum + item.score * item.criterion.weight, 0);
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
  const knockoutChecks = criterionEntries
    .filter((entry) => entry.criterion.knockout)
    .map(({ criterion, group, ratingKey }) => {
      const scores = completeSubmissions.map((submission) => submission.ratings[ratingKey]!.score!);
      const actual = Math.min(...scores);
      return {
        code: criterion.code,
        name: criterion.name,
        issueName: group.name,
        actual,
        target: SCORECARD_KNOCKOUT_THRESHOLD,
        triggered: scores.some((score) => score < SCORECARD_KNOCKOUT_THRESHOLD),
      };
    });
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
