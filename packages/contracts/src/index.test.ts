import { describe, expect, it } from 'vitest';
import { createCaseSchema, eligibilityDecisionSchema } from './index';

const internalRequest = {
  employeeId: 'emp-001',
  employeeName: 'Mona Hassan',
  department: 'Product',
  currentRole: 'Senior Specialist',
  currentLevel: 'L4',
  assessmentReason: 'PROMOTION',
  targetRole: 'Team Lead',
  targetLevel: 'L5',
  justification: 'The employee is ready to lead a larger cross-functional scope.',
  priority: 'NORMAL',
} as const;

describe('AssessFlow contracts', () => {
  it('accepts a complete case request', () => {
    expect(createCaseSchema.safeParse(internalRequest).success).toBe(true);
  });

  it('requires the current level for internal employees', () => {
    const { currentLevel: _omit, ...withoutLevel } = internalRequest;
    expect(createCaseSchema.safeParse(withoutLevel).success).toBe(false);
  });

  it('restricts External Recruitment to new candidates with an email', () => {
    expect(
      createCaseSchema.safeParse({ ...internalRequest, assessmentReason: 'EXTERNAL_RECRUITMENT' })
        .success,
    ).toBe(false);
    expect(
      createCaseSchema.safeParse({
        ...internalRequest,
        candidateType: 'NEW_CANDIDATE',
        candidateEmail: 'candidate@example.com',
        currentRole: undefined,
        currentLevel: undefined,
        assessmentReason: 'EXTERNAL_RECRUITMENT',
      }).success,
    ).toBe(true);
  });

  it('requires an expected version for decisions', () => {
    expect(eligibilityDecisionSchema.safeParse({ decision: 'ELIGIBLE' }).success).toBe(false);
  });
});
