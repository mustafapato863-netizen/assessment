import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ADMINISTRATION_POLICY,
  exceedsSlaWindow,
  policyChanges,
  policyValidationErrors,
  policyWeightTotal,
  slaWindowHoursForStage,
  totalSlaHours,
} from './administration-logic';

describe('administration policy logic', () => {
  it('validates weights without redistributing them', () => {
    const policy = { ...DEFAULT_ADMINISTRATION_POLICY, cbiWeight: 38 };
    expect(policyWeightTotal(policy)).toBe(98);
    expect(policyValidationErrors(policy)).toContain(
      'Scoring weights must total 100%. Adjust 2% more.',
    );
    expect(policy.cbiWeight).toBe(38);
  });

  it('requires every SLA window to be at least one hour', () => {
    const policy = {
      ...DEFAULT_ADMINISTRATION_POLICY,
      slaWindows: { ...DEFAULT_ADMINISTRATION_POLICY.slaWindows, committeeHours: 0 },
    };
    expect(policyValidationErrors(policy)).toContain('Every SLA window must be at least 1 hour.');
  });

  it('sums SLA windows and maps review stages to the same policy values', () => {
    expect(totalSlaHours(DEFAULT_ADMINISTRATION_POLICY)).toBe(240);
    expect(slaWindowHoursForStage('ELIGIBILITY', DEFAULT_ADMINISTRATION_POLICY)).toBe(48);
    expect(slaWindowHoursForStage('ASSESSMENT', DEFAULT_ADMINISTRATION_POLICY)).toBe(120);
    expect(slaWindowHoursForStage('DECISION', DEFAULT_ADMINISTRATION_POLICY)).toBe(72);
    expect(slaWindowHoursForStage('APPROVAL', DEFAULT_ADMINISTRATION_POLICY)).toBe(72);
    expect(slaWindowHoursForStage('PLANNING', DEFAULT_ADMINISTRATION_POLICY)).toBeNull();
  });

  it('marks risk only after the configured stage window has passed', () => {
    const now = new Date('2026-10-12T12:00:00Z');
    expect(
      exceedsSlaWindow('ELIGIBILITY', '2026-10-10T11:59:59Z', DEFAULT_ADMINISTRATION_POLICY, now),
    ).toBe(true);
    expect(
      exceedsSlaWindow('ELIGIBILITY', '2026-10-10T12:00:00Z', DEFAULT_ADMINISTRATION_POLICY, now),
    ).toBe(false);
    expect(
      exceedsSlaWindow('PLANNING', '2026-10-01T00:00:00Z', DEFAULT_ADMINISTRATION_POLICY, now),
    ).toBe(false);
  });

  it('reports the direction needed when weights exceed 100%', () => {
    const policy = { ...DEFAULT_ADMINISTRATION_POLICY, cbiWeight: 45 };
    expect(policyValidationErrors(policy)).toContain(
      'Scoring weights must total 100%. Adjust 5% less.',
    );
  });

  it('lists old and new policy values for save confirmation', () => {
    const next = {
      ...DEFAULT_ADMINISTRATION_POLICY,
      cbiWeight: 45,
      slaWindows: { ...DEFAULT_ADMINISTRATION_POLICY.slaWindows, eligibilityHours: 60 },
    };
    expect(policyChanges(DEFAULT_ADMINISTRATION_POLICY, next)).toEqual([
      { label: 'CBI weight', oldValue: '40%', newValue: '45%' },
      { label: 'Eligibility SLA', oldValue: '48 hours', newValue: '60 hours' },
    ]);
  });
});
