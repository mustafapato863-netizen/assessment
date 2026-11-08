import { describe, expect, it } from 'vitest';
import { apiErrorMessage } from './api';

describe('apiErrorMessage', () => {
  it('reads Nest default exception bodies used by sign-in', () => {
    expect(
      apiErrorMessage({
        message: 'Invalid email or password.',
        error: 'Unauthorized',
        statusCode: 401,
      }),
    ).toBe('Invalid email or password.');
  });

  it('prefers the domain error message and joins class-validator messages', () => {
    expect(
      apiErrorMessage({
        error: {
          code: 'SIGN_IN_LOCKED',
          message: 'Too many failed attempts. Try again in 15 minutes.',
        },
      }),
    ).toBe('Too many failed attempts. Try again in 15 minutes.');
    expect(
      apiErrorMessage({ message: ['email must be an email', 'password should not be empty'] }),
    ).toBe('email must be an email password should not be empty');
  });

  it('falls back when the body has no message', () => {
    expect(apiErrorMessage(null)).toBe('The request could not be completed.');
    expect(apiErrorMessage({ error: 'Unauthorized' })).toBe('The request could not be completed.');
  });
});
