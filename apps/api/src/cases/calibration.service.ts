import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CalibrationCandidate,
  CalibrationCell,
  CalibrationMatrixResponse,
  CalibrationPerformanceLevel,
  CalibrationPotentialLevel,
  CaseStage,
  CaseStatus,
  ResultCode,
  SCORECARD_READY_NOW_THRESHOLD,
  SCORECARD_READY_WITH_DEVELOPMENT_THRESHOLD,
  calculateScorecard,
  defaultScorecardConfig,
  scorecardConfigSchema,
  scorecardRatingsSchema,
} from '@assessflow/contracts';
import { Prisma } from '@assessflow/database';
import { PrismaService } from '../database/prisma.service';
import { getActorContext } from '../auth';
import { caseScopeWhere } from '../access/access-accounts.service';

interface NineBoxDef {
  boxIndex: number;
  label: string;
  description: string;
  targetPercentage: number;
}

const NINE_BOX_DEFINITIONS: NineBoxDef[] = [
  {
    boxIndex: 1,
    label: 'Underperformer',
    description:
      'Low performance & low potential. Requires immediate performance remediation or reassignment.',
    targetPercentage: 5,
  },
  {
    boxIndex: 2,
    label: 'Effective Performer',
    description:
      'Medium performance & low potential. Solid contributor in current role; focus on tactical retention.',
    targetPercentage: 10,
  },
  {
    boxIndex: 3,
    label: 'Trusted Specialist',
    description:
      'High performance & low potential. Deep functional mastery; preserve institutional knowledge.',
    targetPercentage: 10,
  },
  {
    boxIndex: 4,
    label: 'Inconsistent Contributor',
    description:
      'Low performance & medium potential. Coach to remove execution blockers or clarify expectations.',
    targetPercentage: 8,
  },
  {
    boxIndex: 5,
    label: 'Core Contributor',
    description:
      'Medium performance & medium potential. Reliable core talent; expand cross-functional impact.',
    targetPercentage: 25,
  },
  {
    boxIndex: 6,
    label: 'High Performer',
    description:
      'High performance & medium potential. Strong readiness for near-term scope growth or Lateral Move.',
    targetPercentage: 15,
  },
  {
    boxIndex: 7,
    label: 'Rough Diamond',
    description:
      'Low performance & high potential. High capability ceiling but requires immediate delivery stabilization.',
    targetPercentage: 5,
  },
  {
    boxIndex: 8,
    label: 'Future Leader',
    description:
      'Medium performance & high potential. High growth velocity; prioritize targeted leadership sponsorship.',
    targetPercentage: 12,
  },
  {
    boxIndex: 9,
    label: 'Star / Top Talent',
    description:
      'High performance & high potential. Succession-ready enterprise leadership pipeline.',
    targetPercentage: 10,
  },
];

export function scoreBand(score: number): CalibrationPerformanceLevel;
export function scoreBand(score: number | null): CalibrationPerformanceLevel | null;
export function scoreBand(score: number | null): CalibrationPerformanceLevel | null {
  if (score === null) return null;
  if (score >= SCORECARD_READY_NOW_THRESHOLD) return 'HIGH';
  if (score >= SCORECARD_READY_WITH_DEVELOPMENT_THRESHOLD) return 'MEDIUM';
  return 'LOW';
}

export function calculateBoxIndex(
  perf: CalibrationPerformanceLevel,
  pot: CalibrationPotentialLevel,
): number;
export function calculateBoxIndex(
  perf: CalibrationPerformanceLevel | null,
  pot: CalibrationPotentialLevel | null,
): number | null;
export function calculateBoxIndex(
  perf: CalibrationPerformanceLevel | null,
  pot: CalibrationPotentialLevel | null,
): number | null {
  if (!perf || !pot) return null;
  const matrix: Record<CalibrationPotentialLevel, Record<CalibrationPerformanceLevel, number>> = {
    LOW: { LOW: 1, MEDIUM: 2, HIGH: 3 },
    MEDIUM: { LOW: 4, MEDIUM: 5, HIGH: 6 },
    HIGH: { LOW: 7, MEDIUM: 8, HIGH: 9 },
  };
  return matrix[pot][perf];
}

const classifyBand = scoreBand;
const resolveBoxIndex = calculateBoxIndex;

const AXES = {
  performance: 'Technical scorecard score (proxy until annual performance ratings are imported)',
  potential: 'Behavioral / leadership scorecard score',
  lowBelow: SCORECARD_READY_WITH_DEVELOPMENT_THRESHOLD,
  highFrom: SCORECARD_READY_NOW_THRESHOLD,
};

const round2 = (value: number) => Math.round(value * 100) / 100;

@Injectable()
export class CalibrationService {
  constructor(private readonly prisma: PrismaService) {}

  async getMatrix(departmentFilter?: string): Promise<CalibrationMatrixResponse> {
    if (departmentFilter && departmentFilter.length > 120) {
      throw new BadRequestException('Department filter exceeds maximum length.');
    }
    const normalizedDepartment = departmentFilter?.trim();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rawCases: any[] = [];

    if (this.prisma.enabled) {
      const actor = getActorContext();
      rawCases = await this.prisma.assessmentCase.findMany({
        where: {
          AND: [
            { status: { notIn: ['DRAFT', 'CANCELLED'] } },
            { candidateType: { not: 'NEW_CANDIDATE' } },
            caseScopeWhere(actor) as Prisma.AssessmentCaseWhereInput,
            ...(normalizedDepartment && normalizedDepartment !== 'ALL'
              ? [{ departmentSnapshot: normalizedDepartment }]
              : []),
          ],
        },
        include: {
          employee: { select: { externalId: true, displayName: true, currentLevel: true } },
          plan: { select: { scorecardConfig: true } },
          scorecards: {
            where: { submittedAt: { not: null } },
            select: { ratings: true },
          },
          resultRevisions: {
            orderBy: { revision: 'desc' },
            take: 1,
            select: {
              finalizedAt: true,
              reopenedAt: true,
              resultCode: true,
              scorecardSummary: true,
            },
          },
          recommendationRevisions: {
            orderBy: { revision: 'desc' },
            take: 1,
            select: { code: true },
          },
        },
      });
    }

    const candidates = rawCases.map((c) => this.mapCaseToCandidate(c));
    const placed = candidates.filter((c) => c.boxIndex !== null);
    const unplaced = candidates.filter((c) => c.boxIndex === null);
    const totalCandidates = candidates.length;

    const grid: CalibrationCell[] = NINE_BOX_DEFINITIONS.map((def) => {
      const matching = placed.filter((c) => c.boxIndex === def.boxIndex);
      const actualPercentage = placed.length
        ? Math.round((matching.length / placed.length) * 100)
        : 0;
      return {
        boxIndex: def.boxIndex,
        label: def.label,
        description: def.description,
        targetPercentage: def.targetPercentage,
        actualPercentage,
        candidates: matching,
      };
    });

    const readyNowCount = candidates.filter((c) => c.resultCode === 'READY_NOW').length;
    const readyWithDevelopmentCount = candidates.filter(
      (c) => c.resultCode === 'READY_WITH_DEVELOPMENT',
    ).length;
    const notReadyCount = candidates.filter((c) => c.resultCode === 'NOT_READY').length;
    const pendingCount =
      totalCandidates - (readyNowCount + readyWithDevelopmentCount + notReadyCount);

    const deptMap = new Map<
      string,
      { total: number; readyNow: number; readyWithDevelopment: number; notReady: number }
    >();
    for (const c of candidates) {
      const entry = deptMap.get(c.department) ?? {
        total: 0,
        readyNow: 0,
        readyWithDevelopment: 0,
        notReady: 0,
      };
      entry.total++;
      if (c.resultCode === 'READY_NOW') entry.readyNow++;
      else if (c.resultCode === 'READY_WITH_DEVELOPMENT') entry.readyWithDevelopment++;
      else if (c.resultCode === 'NOT_READY') entry.notReady++;
      deptMap.set(c.department, entry);
    }

    return {
      cohortName: 'Talent calibration',
      evaluatedAt: new Date().toISOString(),
      totalCandidates,
      placedCandidates: placed.length,
      axes: AXES,
      distributionSummary: {
        readyNowCount,
        readyWithDevelopmentCount,
        notReadyCount,
        pendingCount,
      },
      departmentBreakdown: Array.from(deptMap.entries()).map(([department, stats]) => ({
        department,
        ...stats,
      })),
      grid,
      unplaced,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapCaseToCandidate(c: any): CalibrationCandidate {
    const latestRevision = c.resultRevisions?.[0];
    const resultIsEffective = Boolean(latestRevision?.finalizedAt) && !latestRevision?.reopenedAt;
    const resultCode: ResultCode | null = resultIsEffective
      ? (latestRevision.resultCode ?? null)
      : null;

    const submissions = (c.scorecards ?? []) as Array<{ ratings: unknown }>;
    let technicalScore: number | null = null;
    let behavioralScore: number | null = null;
    let scoredResultCode: ResultCode | null = null;
    let knockout = false;
    let scoreSource: 'SCORECARD' | 'RESULT_SUMMARY' | null = null;

    if (resultIsEffective && submissions.length) {
      const parsedConfig = c.plan?.scorecardConfig
        ? scorecardConfigSchema.safeParse(c.plan.scorecardConfig)
        : null;
      const config = parsedConfig?.success ? parsedConfig.data : defaultScorecardConfig;
      const validSubmissions = submissions.flatMap((submission) => {
        const parsedRatings = scorecardRatingsSchema.safeParse(submission.ratings);
        return parsedRatings.success ? [{ ratings: parsedRatings.data, submitted: true }] : [];
      });
      if (validSubmissions.length) {
        const scored = calculateScorecard(config, validSubmissions);
        if (scored.completeCount > 0) {
          technicalScore = round2(scored.technical ?? 0);
          behavioralScore = round2(scored.behavioral ?? 0);
          scoredResultCode = scored.resultCode;
          knockout = scored.knockout;
          scoreSource = 'SCORECARD';
        }
      }
    }

    if (resultIsEffective && scoreSource === null) {
      const stored = (latestRevision.scorecardSummary ?? {}) as {
        technical?: unknown;
        behavioral?: unknown;
        knockout?: unknown;
      };
      const valid = (value: unknown): value is number =>
        typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 5;
      if (valid(stored.technical) && valid(stored.behavioral)) {
        technicalScore = round2(stored.technical);
        behavioralScore = round2(stored.behavioral);
        knockout = Boolean(stored.knockout);
        scoreSource = 'RESULT_SUMMARY';
      }
    }

    const performanceBand = scoreBand(technicalScore);
    const potentialBand = scoreBand(behavioralScore);
    const boxIndex = calculateBoxIndex(performanceBand, potentialBand);
    const boxDef =
      boxIndex !== null ? NINE_BOX_DEFINITIONS.find((b) => b.boxIndex === boxIndex) : null;

    let readinessLabel = 'Pending Assessment';
    if (resultCode === 'READY_NOW') readinessLabel = 'Ready Now';
    else if (resultCode === 'READY_WITH_DEVELOPMENT') readinessLabel = 'With Development';
    else if (resultCode === 'NOT_READY') readinessLabel = 'Not Ready';

    let unplacedReason: string | null = null;
    if (boxIndex === null) {
      unplacedReason = latestRevision?.reopenedAt
        ? 'Result reopened'
        : !resultIsEffective
          ? 'Result not finalized'
          : 'No scorecard scores recorded for this result';
    }

    return {
      id: c.id,
      caseId: c.id,
      caseCode: c.caseCode,
      employeeId: c.employee?.externalId ?? c.employeeId,
      displayName: c.employee?.displayName ?? 'Unknown Employee',
      department: c.departmentSnapshot,
      currentRole: c.currentRoleSnapshot,
      currentLevel: c.employee?.currentLevel ?? null,
      targetRole: c.targetRoleSnapshot,
      targetLevel: c.targetLevelSnapshot ?? null,
      status: c.status as CaseStatus,
      stage: c.stage as CaseStage,
      resultCode,
      recommendationCode: c.recommendationRevisions?.[0]?.code ?? null,
      technicalScore,
      behavioralScore,
      performanceBand,
      potentialBand,
      boxIndex,
      boxLabel: boxDef?.label ?? null,
      readinessLabel,
      scoredResultCode,
      scoreSource,
      knockout,
      unplacedReason,
      tenureMonths: null,
    };
  }
}
