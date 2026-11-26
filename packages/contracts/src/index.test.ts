import { describe, expect, it } from 'vitest';
import { createCaseSchema, eligibilityDecisionSchema, finalizeResultSchema } from './index';

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

describe('finalizeResultSchema', () => {
  it.each(['Strong', 'Appointable with development', 'Not appointable', 'Strong – ready now'])(
    'accepts the recommendation label %s',
    (assessorRecommendation) => {
      const parsed = finalizeResultSchema.safeParse({
        resultCode: 'READY_NOW',
        assessorRecommendation,
        evidenceSummary: 'ok',
        expectedVersion: 3,
      });
      expect(parsed.success).toBe(true);
    },
  );
  it('still accepts legacy codes and omitted recommendation, rejects empty text', () => {
    expect(
      finalizeResultSchema.safeParse({
        assessorRecommendation: 'READY_FOR_PROMOTION',
        expectedVersion: 1,
      }).success,
    ).toBe(true);
    expect(finalizeResultSchema.safeParse({ expectedVersion: 1 }).success).toBe(true);
    expect(
      finalizeResultSchema.safeParse({ assessorRecommendation: '   ', expectedVersion: 1 }).success,
    ).toBe(false);
  });
});
