import { Injectable } from '@nestjs/common';
import {
  calculateScorecard,
  defaultScorecardConfig,
  scorecardConfigSchema,
  scorecardRatingsSchema,
  SCORECARD_READY_NOW_THRESHOLD,
  SCORECARD_READY_WITH_DEVELOPMENT_THRESHOLD,
  type CalibrationCell,
  type CalibrationCandidate,
  type CalibrationMatrixResponse,
  type CalibrationPerformanceLevel,
  type CalibrationPotentialLevel,
  type ResultCode,
} from '@assessflow/contracts';
import type { Prisma } from '@assessflow/database';
import { PrismaService } from '../database/prisma.service';
import { caseScopeWhere } from '../access/access-accounts.service';
import { getActorContext } from '../auth/actor.context';

const NINE_BOX_DEFINITIONS: Array<{
  boxIndex: number;
  label: string;
  description: string;
  targetPercentage: number;
  perf: CalibrationPerformanceLevel;
  pot: CalibrationPotentialLevel;
}> = [
  {
    boxIndex: 1,
    label: 'Underperformer',
    description: 'Low performance and low potential. Action plan or exit needed.',
    targetPercentage: 5,
    perf: 'LOW',
    pot: 'LOW',
  },
  {
    boxIndex: 2,
    label: 'Effective Performer',
    description: 'Steady current output with specialized or bounded scope.',
    targetPercentage: 10,
    perf: 'MEDIUM',
    pot: 'LOW',
  },
  {
    boxIndex: 3,
    label: 'Trusted Professional',
    description: 'Exceptional domain execution with focus in current band.',
    targetPercentage: 15,
    perf: 'HIGH',
    pot: 'LOW',
  },
  {
    boxIndex: 4,
    label: 'Inconsistent Contributor',
    description: 'Demonstrates capacity bursts but lacks role consistency.',
    targetPercentage: 10,
    perf: 'LOW',
    pot: 'MEDIUM',
  },
  {
    boxIndex: 5,
    label: 'Core Player',
    description: 'Solid performance with healthy readiness for next level.',
    targetPercentage: 25,
    perf: 'MEDIUM',
    pot: 'MEDIUM',
  },
  {
    boxIndex: 6,
    label: 'High Performer',
    description: 'Consistently exceeds expectations with strong growth potential.',
    targetPercentage: 15,
    perf: 'HIGH',
    pot: 'MEDIUM',
  },
  {
    boxIndex: 7,
    label: 'Rough Diamond',
    description: 'High leadership capacity requiring tactical skill development.',
    targetPercentage: 5,
    perf: 'LOW',
    pot: 'HIGH',
  },
  {
    boxIndex: 8,
    label: 'High Achiever',
    description: 'Exceeds goals and capable of taking lateral or scale leadership.',
    targetPercentage: 10,
    perf: 'MEDIUM',
    pot: 'HIGH',
  },
  {
    boxIndex: 9,
    label: 'Star / Future Leader',
    description: 'Top-tier performance and highest growth readiness across the org.',
    targetPercentage: 5,
    perf: 'HIGH',
    pot: 'HIGH',
  },
];

/**
 * Axis bands use the same cut-offs as the overall result so the grid and the
 * result code tell one story: below 3 = LOW, 3 to <4 = MEDIUM, 4+ = HIGH.
 */
export function scoreBand(score: number): CalibrationPerformanceLevel {
  if (score >= SCORECARD_READY_NOW_THRESHOLD) return 'HIGH';
  if (score >= SCORECARD_READY_WITH_DEVELOPMENT_THRESHOLD) return 'MEDIUM';
  return 'LOW';
}

export function calculateBoxIndex(
  perf: CalibrationPerformanceLevel,
  pot: CalibrationPotentialLevel,
): number {
  const matrix: Record<CalibrationPotentialLevel, Record<CalibrationPerformanceLevel, number>> = {
    LOW: { LOW: 1, MEDIUM: 2, HIGH: 3 },
    MEDIUM: { LOW: 4, MEDIUM: 5, HIGH: 6 },
    HIGH: { LOW: 7, MEDIUM: 8, HIGH: 9 },
  };
  return matrix[pot][perf];
}

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rawCases: any[] = [];

    if (this.prisma.enabled) {
      const actor = getActorContext();
      rawCases = await this.prisma.assessmentCase.findMany({
        where: {
          AND: [
            { status: { notIn: ['DRAFT', 'CANCELLED'] } },
            // The 9-box calibrates internal talent; external recruits are excluded.
            { candidateType: { not: 'NEW_CANDIDATE' } },
            // Same data scope as every other case read.
            caseScopeWhere(actor) as Prisma.AssessmentCaseWhereInput,
            ...(departmentFilter && departmentFilter !== 'ALL'
              ? [{ departmentSnapshot: departmentFilter }]
              : []),
          ],
        },
        include: {
          employee: true,
          plan: { select: { scorecardConfig: true } },
          scorecards: { where: { submittedAt: { not: null } } },
          resultRevisions: { orderBy: { revision: 'desc' }, take: 1 },
          recommendationRevisions: { orderBy: { revision: 'desc' }, take: 1 },
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

    // Re-score from the submitted scorecards so placement always uses the
    // current formula, not a summary stored when the result was finalized.
    const submissions = (c.scorecards ?? []) as Array<{ ratings: unknown }>;
    let technicalScore: number | null = null;
    let behavioralScore: number | null = null;
    if (resultIsEffective && submissions.length) {
      const config = c.plan?.scorecardConfig
        ? scorecardConfigSchema.parse(c.plan.scorecardConfig)
        : defaultScorecardConfig;
      const scored = calculateScorecard(
        config,
        submissions.map((submission) => ({
          ratings: scorecardRatingsSchema.parse(submission.ratings),
          submitted: true,
        })),
      );
      if (scored.completeCount > 0) {
        technicalScore = round2(scored.technical ?? 0);
        behavioralScore = round2(scored.behavioral ?? 0);
      }
    }

    const placedOnGrid = technicalScore !== null && behavioralScore !== null;
    const perf = placedOnGrid ? scoreBand(technicalScore!) : null;
    const pot = placedOnGrid ? scoreBand(behavioralScore!) : null;
    const boxIndex = perf && pot ? calculateBoxIndex(perf, pot) : null;
    const boxDef = boxIndex ? NINE_BOX_DEFINITIONS.find((b) => b.boxIndex === boxIndex) : undefined;

    const unplacedReason = placedOnGrid
      ? null
      : !latestRevision?.finalizedAt
        ? 'Result not finalized yet'
        : latestRevision.reopenedAt
          ? 'Result reopened'
          : 'No complete scorecard (result entered or imported directly)';

    return {
      id: c.id,
      caseId: c.id,
      caseCode: c.caseCode,
      employeeId: c.employee?.externalId ?? c.employeeId,
      displayName: c.employee?.displayName ?? 'Candidate',
      department: c.departmentSnapshot,
      currentRole: c.currentRoleSnapshot,
      currentLevel: c.employee?.currentLevel ?? null,
      targetRole: c.targetRoleSnapshot,
      targetLevel: c.targetLevelSnapshot ?? null,
      status: c.status,
      stage: c.stage,
      resultCode,
      recommendationCode: c.recommendationRevisions?.[0]?.code ?? null,
      technicalScore,
      behavioralScore,
      performanceBand: perf,
      potentialBand: pot,
      boxIndex,
      boxLabel: boxDef?.label ?? null,
      readinessLabel: resultCode ? resultCode.replace(/_/g, ' ') : 'PENDING EVALUATION',
      unplacedReason,
      tenureMonths: null,
    };
  }
}
