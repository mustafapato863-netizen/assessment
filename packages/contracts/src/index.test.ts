import { describe, expect, it } from 'vitest';
import { createCaseSchema, eligibilityDecisionSchema } from './index';

describe('AssessFlow contracts', () => {
  it('accepts a complete case request', () => {
    const result = createCaseSchema.safeParse({
      employeeId: 'emp-001',
      employeeName: 'Mona Hassan',
      department: 'Product',
      currentRole: 'Senior Specialist',
      assessmentReason: 'PROMOTION',
      targetRole: 'Team Lead',
      targetLevel: 'L5',
      justification: 'The employee is ready to lead a larger cross-functional scope.',
      priority: 'NORMAL',
    });

    expect(result.success).toBe(true);
  });

  it('requires an expected version for decisions', () => {
    expect(eligibilityDecisionSchema.safeParse({ decision: 'ELIGIBLE' }).success).toBe(false);
  });
});
