import { describe, expect, it } from 'vitest';
import { getRemainingTime } from './overview-utils';

describe('getRemainingTime', () => {
  it('uses the same whole-day rounding for the count and label', () => {
    expect(getRemainingTime(7, 5.25)).toEqual({ daysRemaining: 1, label: '1d left' });
  });

  it('shows Due today when less than one full day remains', () => {
    expect(getRemainingTime(7, 6.25)).toEqual({ daysRemaining: 0, label: 'Due today' });
  });

  it('shows Due today when the target day has arrived or passed', () => {
    expect(getRemainingTime(3, 3)).toEqual({ daysRemaining: 0, label: 'Due today' });
    expect(getRemainingTime(3, 4)).toEqual({ daysRemaining: 0, label: 'Due today' });
  });
});
