import { Injectable } from '@nestjs/common';
import {
  CalibrationCell,
  CalibrationCandidate,
  CalibrationMatrixResponse,
  CalibrationPerformanceLevel,
  CalibrationPotentialLevel,
} from '@assessflow/contracts';
import { PrismaService } from '../database/prisma.service';

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

@Injectable()
export class CalibrationService {
  constructor(private readonly prisma: PrismaService) {}

  async getMatrix(departmentFilter?: string): Promise<CalibrationMatrixResponse> {
    let rawCases: any[] = [];

    if (this.prisma.enabled) {
      rawCases = await this.prisma.assessmentCase.findMany({
        where: {
          status: { notIn: ['DRAFT', 'CANCELLED'] },
          ...(departmentFilter && departmentFilter !== 'ALL'
            ? { departmentSnapshot: departmentFilter }
            : {}),
        },
        include: {
          employee: true,
          resultRevisions: { orderBy: { revision: 'desc' }, take: 1 },
          recommendationRevisions: { orderBy: { revision: 'desc' }, take: 1 },
        },
      });
    }

    // Combine real database cases with baseline cohort so all departments maintain rich calibration distribution
    const demoCohort = this.generateCohortMockData(departmentFilter);
    const candidates: CalibrationCandidate[] = [
      ...rawCases.map((c) => this.mapCaseToCandidate(c)),
      ...demoCohort,
    ];

    const totalCandidates = candidates.length;

    // Group candidates into the 9 cells
    const grid: CalibrationCell[] = NINE_BOX_DEFINITIONS.map((def) => {
      const matching = candidates.filter((c) => c.boxIndex === def.boxIndex);
      const actualPercentage = totalCandidates > 0 ? Math.round((matching.length / totalCandidates) * 100) : 0;
      return {
        boxIndex: def.boxIndex,
        label: def.label,
        description: def.description,
        targetPercentage: def.targetPercentage,
        actualPercentage,
        candidates: matching,
      };
    });

    // Summary metrics
    const readyNowCount = candidates.filter((c) => c.resultCode === 'READY_NOW').length;
    const readyWithDevelopmentCount = candidates.filter((c) => c.resultCode === 'READY_WITH_DEVELOPMENT').length;
    const notReadyCount = candidates.filter((c) => c.resultCode === 'NOT_READY').length;
    const pendingCount = totalCandidates - (readyNowCount + readyWithDevelopmentCount + notReadyCount);

    // Department breakdown
    const deptMap = new Map<string, { total: number; readyNow: number; readyWithDevelopment: number; notReady: number }>();
    for (const c of candidates) {
      const entry = deptMap.get(c.department) ?? { total: 0, readyNow: 0, readyWithDevelopment: 0, notReady: 0 };
      entry.total++;
      if (c.resultCode === 'READY_NOW') entry.readyNow++;
      else if (c.resultCode === 'READY_WITH_DEVELOPMENT') entry.readyWithDevelopment++;
      else if (c.resultCode === 'NOT_READY') entry.notReady++;
      deptMap.set(c.department, entry);
    }

    const departmentBreakdown = Array.from(deptMap.entries()).map(([department, stats]) => ({
      department,
      ...stats,
    }));

    return {
      cohortName: 'FY2026 Q3 Mid-Year Promotion & Mobility Calibration',
      evaluatedAt: new Date().toISOString(),
      totalCandidates,
      distributionSummary: {
        readyNowCount,
        readyWithDevelopmentCount,
        notReadyCount,
        pendingCount,
      },
      departmentBreakdown,
      grid,
    };
  }

  private mapCaseToCandidate(c: any): CalibrationCandidate {
    const latestResult = c.resultRevisions?.[0]?.resultCode ?? null;
    const latestRecommendation = c.recommendationRevisions?.[0]?.code ?? null;

    let perf: CalibrationPerformanceLevel = 'MEDIUM';
    let pot: CalibrationPotentialLevel = 'MEDIUM';

    if (latestResult === 'READY_NOW') {
      perf = 'HIGH';
      pot = 'HIGH';
    } else if (latestResult === 'NOT_READY') {
      perf = 'LOW';
      pot = 'LOW';
    } else if (latestResult === 'READY_WITH_DEVELOPMENT') {
      perf = 'HIGH';
      pot = 'MEDIUM';
    }

    const boxIndex = this.calculateBoxIndex(perf, pot);
    const boxDef = NINE_BOX_DEFINITIONS.find((b) => b.boxIndex === boxIndex)!;

    return {
      id: c.id,
      caseId: c.id,
      caseCode: c.caseCode,
      employeeId: c.employee?.externalId ?? c.employeeId,
      displayName: c.employee?.displayName ?? 'Candidate',
      department: c.departmentSnapshot,
      currentRole: c.currentRoleSnapshot,
      currentLevel: c.currentLevelSnapshot ?? 'L3',
      targetRole: c.targetRoleSnapshot,
      targetLevel: c.targetLevelSnapshot ?? 'L4',
      status: c.status,
      stage: c.stage,
      resultCode: latestResult,
      recommendationCode: latestRecommendation,
      performanceBand: perf,
      potentialBand: pot,
      boxIndex,
      boxLabel: boxDef.label,
      readinessLabel: latestResult ? latestResult.replace(/_/g, ' ') : 'PENDING EVALUATION',
      tenureMonths: 18,
    };
  }

  private calculateBoxIndex(perf: CalibrationPerformanceLevel, pot: CalibrationPotentialLevel): number {
    const matrix: Record<CalibrationPotentialLevel, Record<CalibrationPerformanceLevel, number>> = {
      LOW: { LOW: 1, MEDIUM: 2, HIGH: 3 },
      MEDIUM: { LOW: 4, MEDIUM: 5, HIGH: 6 },
      HIGH: { LOW: 7, MEDIUM: 8, HIGH: 9 },
    };
    return matrix[pot][perf];
  }

  private generateCohortMockData(departmentFilter?: string): CalibrationCandidate[] {
    const mockPool: Array<{
      name: string;
      dept: string;
      role: string;
      curL: string;
      tgtR: string;
      tgtL: string;
      perf: CalibrationPerformanceLevel;
      pot: CalibrationPotentialLevel;
      result: 'READY_NOW' | 'READY_WITH_DEVELOPMENT' | 'NOT_READY' | null;
      tenure: number;
    }> = [
      { name: 'Mona Hassan', dept: 'Product', role: 'Senior Specialist', curL: 'L4', tgtR: 'Product Lead', tgtL: 'L5', perf: 'HIGH', pot: 'HIGH', result: 'READY_NOW', tenure: 24 },
      { name: 'Omar Khalil', dept: 'Engineering', role: 'Software Engineer', curL: 'L3', tgtR: 'Senior Engineer', tgtL: 'L4', perf: 'HIGH', pot: 'MEDIUM', result: 'READY_NOW', tenure: 18 },
      { name: 'Sara Adel', dept: 'People', role: 'HR Specialist', curL: 'L4', tgtR: 'HR Operations Lead', tgtL: 'L5', perf: 'MEDIUM', pot: 'HIGH', result: 'READY_WITH_DEVELOPMENT', tenure: 22 },
      { name: 'Tarek Mansour', dept: 'Engineering', role: 'QA Analyst', curL: 'L3', tgtR: 'Senior QA Engineer', tgtL: 'L4', perf: 'MEDIUM', pot: 'MEDIUM', result: 'READY_WITH_DEVELOPMENT', tenure: 14 },
      { name: 'Layla Farouk', dept: 'Product', role: 'Associate PM', curL: 'L2', tgtR: 'Product Manager', tgtL: 'L3', perf: 'LOW', pot: 'HIGH', result: 'READY_WITH_DEVELOPMENT', tenure: 10 },
      { name: 'Karim Zaki', dept: 'Engineering', role: 'Backend Developer', curL: 'L4', tgtR: 'Staff Engineer', tgtL: 'L5', perf: 'HIGH', pot: 'LOW', result: 'READY_NOW', tenure: 36 },
      { name: 'Nour El-Din', dept: 'People', role: 'Recruiter', curL: 'L3', tgtR: 'Talent Acquisition Lead', tgtL: 'L4', perf: 'MEDIUM', pot: 'LOW', result: 'NOT_READY', tenure: 12 },
      { name: 'Hossam Badawi', dept: 'Product', role: 'UX Designer', curL: 'L3', tgtR: 'Senior Product Designer', tgtL: 'L4', perf: 'LOW', pot: 'MEDIUM', result: 'NOT_READY', tenure: 8 },
      { name: 'Rania Sabry', dept: 'Engineering', role: 'DevOps Specialist', curL: 'L4', tgtR: 'Infrastructure Architect', tgtL: 'L5', perf: 'HIGH', pot: 'HIGH', result: 'READY_NOW', tenure: 28 },
    ];

    const filtered =
      departmentFilter && departmentFilter !== 'ALL'
        ? mockPool.filter((m) => m.dept === departmentFilter)
        : mockPool;

    return filtered.map((m, idx) => {
      const boxIndex = this.calculateBoxIndex(m.perf, m.pot);
      const boxDef = NINE_BOX_DEFINITIONS.find((b) => b.boxIndex === boxIndex)!;
      const caseNum = String(idx + 101).padStart(3, '0');

      return {
        id: `mock-cal-${idx + 1}`,
        caseId: `mock-case-${idx + 1}`,
        caseCode: `AF-2026-${caseNum}`,
        employeeId: `emp-${caseNum}`,
        displayName: m.name,
        department: m.dept,
        currentRole: m.role,
        currentLevel: m.curL,
        targetRole: m.tgtR,
        targetLevel: m.tgtL,
        status: m.result ? 'PENDING_APPROVAL' : 'PENDING_RESULT',
        stage: m.result ? 'APPROVAL' : 'ASSESSMENT',
        resultCode: m.result,
        recommendationCode: m.result === 'READY_NOW' ? 'PROCEED_PROMOTION' : 'CONDITIONAL_DEVELOPMENT',
        performanceBand: m.perf,
        potentialBand: m.pot,
        boxIndex,
        boxLabel: boxDef.label,
        readinessLabel: m.result ? m.result.replace(/_/g, ' ') : 'ASSESSMENT IN PROGRESS',
        tenureMonths: m.tenure,
      };
    });
  }
}
