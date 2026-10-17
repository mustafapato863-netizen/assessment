import type { AdministrationPolicy } from '../lib/api';

export const DEFAULT_ADMINISTRATION_POLICY: AdministrationPolicy = {
  version: 'v2026.1',
  cbiWeight: 40,
  caseStudyWeight: 35,
  simulationWeight: 25,
  passingScore: 75,
  blindGrading: true,
  autoEscalate: true,
  slaWindows: {
    eligibilityHours: 48,
    assessorHours: 120,
    committeeHours: 72,
  },
  updatedAt: null,
};

export function policyWeightTotal(policy: AdministrationPolicy): number {
  return policy.cbiWeight + policy.caseStudyWeight + policy.simulationWeight;
}

export function policyValidationErrors(policy: AdministrationPolicy): string[] {
  const errors: string[] = [];
  const weights = [policy.cbiWeight, policy.caseStudyWeight, policy.simulationWeight];
  if (weights.some((value) => !Number.isFinite(value) || value < 0 || value > 100)) {
    errors.push('Each scoring weight must be between 0% and 100%.');
  }
  if (policyWeightTotal(policy) !== 100) {
    const weightDelta = 100 - policyWeightTotal(policy);
    errors.push(
      `Scoring weights must total 100%. Adjust ${Math.abs(weightDelta)}% ${weightDelta > 0 ? 'more' : 'less'}.`,
    );
  }
  if (
    !Number.isFinite(policy.passingScore) ||
    policy.passingScore < 0 ||
    policy.passingScore > 100
  ) {
    errors.push('Minimum passing score must be between 0% and 100%.');
  }
  const windows = Object.values(policy.slaWindows);
  if (windows.some((value) => !Number.isFinite(value) || value < 1)) {
    errors.push('Every SLA window must be at least 1 hour.');
  }
  return errors;
}

export function totalSlaHours(policy: AdministrationPolicy): number {
  const { eligibilityHours, assessorHours, committeeHours } = policy.slaWindows;
  return eligibilityHours + assessorHours + committeeHours;
}

export function policyChanges(
  previous: AdministrationPolicy,
  next: AdministrationPolicy,
): Array<{ label: string; oldValue: string; newValue: string }> {
  const fields: Array<{ key: keyof AdministrationPolicy; label: string }> = [
    { key: 'cbiWeight', label: 'CBI weight' },
    { key: 'caseStudyWeight', label: 'Case study weight' },
    { key: 'simulationWeight', label: 'Simulation weight' },
    { key: 'passingScore', label: 'Minimum passing score' },
    { key: 'blindGrading', label: 'Two-assessor blind consensus' },
    { key: 'autoEscalate', label: 'Automatic SLA escalation' },
  ];
  const changes = fields.flatMap(({ key, label }) => {
    const oldValue = previous[key];
    const newValue = next[key];
    return oldValue === newValue
      ? []
      : [{ label, oldValue: formatPolicyValue(oldValue), newValue: formatPolicyValue(newValue) }];
  });
  const slaFields: Array<{ key: keyof AdministrationPolicy['slaWindows']; label: string }> = [
    { key: 'eligibilityHours', label: 'Eligibility SLA' },
    { key: 'assessorHours', label: 'Assessor SLA' },
    { key: 'committeeHours', label: 'Committee SLA' },
  ];
  for (const { key, label } of slaFields) {
    const oldValue = previous.slaWindows[key];
    const newValue = next.slaWindows[key];
    if (oldValue !== newValue)
      changes.push({ label, oldValue: `${oldValue} hours`, newValue: `${newValue} hours` });
  }
  return changes;
}

export function slaWindowHoursForStage(
  stage: string,
  policy: Pick<AdministrationPolicy, 'slaWindows'>,
): number | null {
  if (stage === 'ELIGIBILITY') return policy.slaWindows.eligibilityHours;
  if (stage === 'ASSESSMENT' || stage === 'RESULT') return policy.slaWindows.assessorHours;
  if (stage === 'DECISION' || stage === 'RECOMMENDATION' || stage === 'APPROVAL') {
    return policy.slaWindows.committeeHours;
  }
  return null;
}

export function exceedsSlaWindow(
  stage: string,
  stageEnteredAt: string | null | undefined,
  policy: Pick<AdministrationPolicy, 'slaWindows'>,
  now = new Date(),
): boolean {
  const windowHours = slaWindowHoursForStage(stage, policy);
  const enteredAt = stageEnteredAt ? new Date(stageEnteredAt).getTime() : Number.NaN;
  return (
    windowHours !== null &&
    Number.isFinite(enteredAt) &&
    now.getTime() - enteredAt > windowHours * 60 * 60 * 1000
  );
}

function formatPolicyValue(value: string | number | boolean | object | null | undefined): string {
  if (typeof value === 'boolean') return value ? 'On' : 'Off';
  if (typeof value === 'number') return `${value}%`;
  return value == null ? '—' : String(value);
}
