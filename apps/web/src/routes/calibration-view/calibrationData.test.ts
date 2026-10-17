import { describe, expect, it } from 'vitest';
import type { CalibrationCandidate as ApiCandidate, CalibrationCell } from '@assessflow/contracts';
import { mapCalibrationCandidates } from './calibrationData';

function apiCandidate(overrides: Partial<ApiCandidate> = {}): ApiCandidate {
  return {
    id: 'case-123',
    caseId: 'case-123',
    caseCode: 'AF-2026-123',
    employeeId: 'employee-123',
    displayName: 'Amina Hassan',
    department: 'Finance',
    currentRole: 'Analyst',
    currentLevel: 'L3',
    targetRole: 'Senior Analyst',
    targetLevel: 'L4',
    status: 'PENDING_RESULT',
    stage: 'ASSESSMENT',
    resultCode: null,
    recommendationCode: null,
    performanceBand: 'MEDIUM',
    potentialBand: 'MEDIUM',
    boxIndex: 5,
    boxLabel: 'Core Player',
    readinessLabel: 'ASSESSMENT IN PROGRESS',
    tenureMonths: 12,
    ...overrides,
  };
}

describe('mapCalibrationCandidates', () => {
  it('maps current API fields and suppresses fallback boxes for unevaluated candidates', () => {
    const evaluated = apiCandidate({
      id: 'case-456',
      caseId: 'case-456',
      resultCode: 'READY_NOW',
      readinessLabel: 'READY NOW',
      performanceBand: 'HIGH',
      potentialBand: 'HIGH',
      boxIndex: 9,
    });
    const unevaluated = apiCandidate();
    const cell: CalibrationCell = {
      boxIndex: 5,
      label: 'Core Player',
      description: 'Core performance.',
      targetPercentage: 10,
      actualPercentage: 50,
      candidates: [evaluated, unevaluated],
    };

    const result = mapCalibrationCandidates({
      cohortName: 'FY2026 Q3 Calibration',
      evaluatedAt: '2026-10-09T00:00:00.000Z',
      totalCandidates: 2,
      distributionSummary: {
        readyNowCount: 1,
        readyWithDevelopmentCount: 0,
        notReadyCount: 0,
        pendingCount: 1,
      },
      departmentBreakdown: [],
      grid: [cell],
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      name: 'Amina Hassan',
      department: 'Finance',
      currentLevel: 'L3',
      targetLevel: 'L4',
      box: 9,
      performance: 'high',
      potential: 'high',
      href: '#/cases/case-456',
    });
    expect(result[1]).toMatchObject({
      readiness: 'ASSESSMENT IN PROGRESS',
      box: null,
      performance: null,
      potential: null,
    });
  });

  it('does not make generated demo candidates link to nonexistent case pages', () => {
    const demo = apiCandidate({ id: 'mock-cal-1', caseId: 'mock-case-1' });
    const cell: CalibrationCell = {
      boxIndex: 5,
      label: 'Core Player',
      description: 'Core performance.',
      targetPercentage: 10,
      actualPercentage: 100,
      candidates: [demo],
    };
    const matrix = {
      cohortName: 'FY2026 Q3 Calibration',
      evaluatedAt: '2026-10-09T00:00:00.000Z',
      totalCandidates: 1,
      distributionSummary: {
        readyNowCount: 0,
        readyWithDevelopmentCount: 0,
        notReadyCount: 0,
        pendingCount: 1,
      },
      departmentBreakdown: [],
      grid: [cell],
    };

    expect(mapCalibrationCandidates(matrix)[0]?.href).toBeUndefined();
  });
});
