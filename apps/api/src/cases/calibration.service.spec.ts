import { describe, expect, it } from 'vitest';
import { CalibrationService } from './calibration.service';

describe('CalibrationService', () => {
  const persistedCases = [
    {
      id: 'case-engineering',
      caseCode: 'AF-2026-00101',
      employeeId: 'employee-engineering',
      employee: { externalId: 'EMP-101', displayName: 'Real Engineering Candidate' },
      departmentSnapshot: 'Engineering',
      currentRoleSnapshot: 'Engineer',
      currentLevelSnapshot: 'L3',
      targetRoleSnapshot: 'Senior Engineer',
      targetLevelSnapshot: 'L4',
      status: 'RESULT_FINALIZED',
      stage: 'RESULT',
      resultRevisions: [{ resultCode: 'READY_NOW' }],
      recommendationRevisions: [],
    },
    {
      id: 'case-product',
      caseCode: 'AF-2026-00102',
      employeeId: 'employee-product',
      employee: { externalId: 'EMP-102', displayName: 'Real Product Candidate' },
      departmentSnapshot: 'Product',
      currentRoleSnapshot: 'Analyst',
      currentLevelSnapshot: 'L3',
      targetRoleSnapshot: 'Lead',
      targetLevelSnapshot: 'L4',
      status: 'RESULT_FINALIZED',
      stage: 'RESULT',
      resultRevisions: [{ resultCode: 'NOT_READY' }],
      recommendationRevisions: [],
    },
  ];
  const fakePrisma: any = {
    enabled: true,
    assessmentCase: {
      findMany: async ({ where }: { where: { departmentSnapshot?: string } }) =>
        persistedCases.filter(
          (candidate) =>
            !where.departmentSnapshot || candidate.departmentSnapshot === where.departmentSnapshot,
        ),
    },
  };
  const service = new CalibrationService(fakePrisma);

  it('builds the 9-box matrix from persisted cases only', async () => {
    const matrix = await service.getMatrix();
    expect(matrix.grid).toHaveLength(9);
    expect(matrix.totalCandidates).toBe(persistedCases.length);
    expect(matrix.cohortName).toContain('Calibration');
    expect(matrix.grid.flatMap((cell) => cell.candidates).map((candidate) => candidate.caseId)).toEqual(
      expect.arrayContaining(persistedCases.map((candidate) => candidate.id)),
    );
  });

  it('filters candidates by department when specified', async () => {
    const productMatrix = await service.getMatrix('Product');
    for (const cell of productMatrix.grid) {
      for (const candidate of cell.candidates) {
        expect(candidate.department).toBe('Product');
      }
    }
  });

  it('computes realistic actual percentage across cells', async () => {
    const matrix = await service.getMatrix();
    const sumCandidates = matrix.grid.reduce((acc, cell) => acc + cell.candidates.length, 0);
    expect(sumCandidates).toBe(matrix.totalCandidates);
  });
});
