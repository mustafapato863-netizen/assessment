import { describe, expect, it } from 'vitest';
import { canAddManualAssessor, manualAssessorProblem } from './assessor-input';

const base = { existingEmails: ['a@saudigerman.com'], total: 1 };

describe('manual assessor input', () => {
  it('accepts only @saudigerman.com emails, trimmed and case-insensitive', () => {
    expect(
      canAddManualAssessor({
        ...base,
        name: 'Ziad Elamary',
        email: ' Ziad.Elamary@SaudiGerman.com ',
      }),
    ).toBe(true);
    expect(canAddManualAssessor({ ...base, name: 'Ziad Elamary', email: 'ziad@gmail.com' })).toBe(
      false,
    );
    expect(manualAssessorProblem({ ...base, name: 'Ziad', email: 'ziad@gmail.com' })).toBe('email');
    expect(canAddManualAssessor({ ...base, name: 'Nadia', email: 'nadia@saudigerman.com' })).toBe(
      true,
    );
  });
  it('explains why it is disabled', () => {
    expect(manualAssessorProblem({ ...base, name: 'A', email: 'x@saudigerman.com' })).toBe('name');
    expect(manualAssessorProblem({ ...base, name: 'Ahmed', email: 'not-an-email' })).toBe('email');
    expect(manualAssessorProblem({ ...base, name: 'Ahmed', email: 'A@SaudiGerman.com' })).toBe(
      'duplicate',
    );
    expect(
      manualAssessorProblem({ ...base, total: 20, name: 'Ahmed', email: 'b@saudigerman.com' }),
    ).toBe('limit');
    expect(manualAssessorProblem({ ...base, name: '', email: '' })).toBeNull();
    expect(canAddManualAssessor({ ...base, name: 'Ahmed', email: '' })).toBe(false);
  });
});
