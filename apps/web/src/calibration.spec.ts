import { describe, it, expect } from 'vitest';
import { NINE_BOX_DEFINITIONS } from './lib/calibration-constants';

describe('Talent Calibration 9-Box Grid Specs', () => {
  it('defines exactly 9 cells with target percentages totaling 100%', () => {
    expect(NINE_BOX_DEFINITIONS).toHaveLength(9);
    const totalTarget = NINE_BOX_DEFINITIONS.reduce((acc, def) => acc + def.targetPercentage, 0);
    expect(totalTarget).toBe(100);
  });

  it('correctly maps Star box as index 9 with High Performance and High Potential', () => {
    const starBox = NINE_BOX_DEFINITIONS.find((b) => b.boxIndex === 9);
    expect(starBox).toBeDefined();
    expect(starBox?.perf).toBe('HIGH');
    expect(starBox?.pot).toBe('HIGH');
    expect(starBox?.label).toContain('Star');
  });

  it('correctly maps Underperformer box as index 1 with Low Performance and Low Potential', () => {
    const underperformerBox = NINE_BOX_DEFINITIONS.find((b) => b.boxIndex === 1);
    expect(underperformerBox).toBeDefined();
    expect(underperformerBox?.perf).toBe('LOW');
    expect(underperformerBox?.pot).toBe('LOW');
    expect(underperformerBox?.label).toContain('Underperformer');
  });
});
