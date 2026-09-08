import { describe, expect, it } from 'vitest';
import { CalibrationService } from './calibration.service';

describe('CalibrationService', () => {
  const fakePrisma: any = { enabled: false };
  const service = new CalibrationService(fakePrisma);

  it('generates a 9-box calibration matrix with 9 cells', async () => {
    const matrix = await service.getMatrix();
    expect(matrix.grid).toHaveLength(9);
    expect(matrix.totalCandidates).toBeGreaterThan(0);
    expect(matrix.cohortName).toContain('Calibration');
    expect(matrix.distributionSummary.readyNowCount).toBeGreaterThanOrEqual(0);
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
