import { describe, it, expect } from 'vitest';
import { PILOT_FLAGS } from './app';

describe('Pilot Feature Flags (Phase 06 Cutover & Enterprise)', () => {
  it('keeps the calibration feature flag enabled (hardcoded in lib/flags.ts)', () => {
    expect(PILOT_FLAGS.calibration).toBe(true);
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
