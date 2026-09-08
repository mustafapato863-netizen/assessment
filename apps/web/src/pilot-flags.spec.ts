import { describe, it, expect } from 'vitest';
import { PILOT_FLAGS } from './app';

describe('Pilot Feature Flags (Phase 06 Cutover & Enterprise)', () => {
  it('evaluates calibration feature flag according to VITE_FEATURE_CALIBRATION environment', () => {
    const expected = import.meta.env.VITE_FEATURE_CALIBRATION === 'true';
    expect(PILOT_FLAGS.calibration).toBe(expected);
  });

  it('correctly configures calibration route presence based on feature flag state', () => {
    const defaultNavItems = [
      'overview',
      'tasks',
      'cases',
      'employees',
      'development',
      'insights',
      ...(PILOT_FLAGS.calibration ? ['calibration'] : []),
      'notifications',
    ];

    if (PILOT_FLAGS.calibration) {
      expect(defaultNavItems).toContain('calibration');
      expect(defaultNavItems).toHaveLength(8);
    } else {
      expect(defaultNavItems).not.toContain('calibration');
      expect(defaultNavItems).toHaveLength(7);
    }
  });
});
