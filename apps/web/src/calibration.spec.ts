import { describe, it, expect } from 'vitest';
import { BOXES, BOX_GRID, boxOf } from './routes/calibration-view/calibrationLogic';

describe('Talent Calibration 9-Box Grid Specs', () => {
  it('defines all 9 named boxes in a 3x3 potential x performance matrix', () => {
    const flatBoxes = BOX_GRID.flat();
    expect(flatBoxes).toHaveLength(9);
    expect([...flatBoxes].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const idx of flatBoxes) {
      expect(BOXES[idx]?.name).toBeTruthy();
    }
  });

  it('maps High Performance + High Potential to Box 9 (Star / Future Leader)', () => {
    expect(boxOf({ performance: 'high', potential: 'high' })).toBe(9);
    expect(BOXES[9]?.name).toContain('Star');
  });

  it('maps Low Performance + Low Potential to Box 1 (Underperformer)', () => {
    expect(boxOf({ performance: 'low', potential: 'low' })).toBe(1);
    expect(BOXES[1]?.name).toContain('Underperformer');
  });
});
