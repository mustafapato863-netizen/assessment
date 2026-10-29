import { describe, expect, it } from 'vitest';
import { createCaseSchema } from './index';

const internal = {
  candidateType: 'INTERNAL_EMPLOYEE' as const,
  employeeId: '10452',
  employeeName: 'Mahmoud ElRawy',
  department: 'RCM',
  currentRole: 'RCM Manager',
  currentLevel: 'L5',
  assessmentReason: 'PROMOTION' as const,
  targetRole: 'RCM Director',
  targetLevel: 'L6',
  justification: 'Ready to take on the wider RCM scope this cycle.',
  priority: 'NORMAL' as const,
};

describe('createCaseSchema employee ID', () => {
  it('accepts an internal employee with a staff number', () => {
    expect(createCaseSchema.safeParse(internal).success).toBe(true);
  });

  it('refuses an internal employee without a staff number', () => {
    for (const employeeId of ['', '   ', 'emp-new', 'EMP-NEW']) {
      const result = createCaseSchema.safeParse({ ...internal, employeeId });
      expect(result.success).toBe(false);
      expect(JSON.stringify(result)).toMatch(/employee ID/i);
    }
  });

  it('does not require a staff number for a new candidate', () => {
    const result = createCaseSchema.safeParse({
      ...internal,
      candidateType: 'NEW_CANDIDATE',
      employeeId: 'emp-new',
      assessmentReason: 'EXTERNAL_RECRUITMENT',
      candidateEmail: 'candidate@example.com',
      currentRole: undefined,
      currentLevel: undefined,
    });
    expect(result.success).toBe(true);
  });
});
