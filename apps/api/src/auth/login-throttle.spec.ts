import { HttpException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { LoginThrottle } from './login-throttle';

const MIN = 60_000;

function lockedCode(fn: () => void) {
  try {
    fn();
    return null;
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(429);
    return ((error as HttpException).getResponse() as { error: { code: string } }).error.code;
  }
}

describe('LoginThrottle', () => {
  it('locks an account after the failure limit and unlocks after the lock period', () => {
    const throttle = new LoginThrottle({ maxAccountFailures: 3, lockMs: 15 * MIN });
    const t0 = 1_000_000;
    for (let i = 0; i < 2; i++) throttle.recordFailure('User@Example.com', '10.0.0.1', t0);
    expect(lockedCode(() => throttle.assertAllowed('user@example.com', '10.0.0.2', t0))).toBeNull();
    throttle.recordFailure('user@example.com', '10.0.0.1', t0);
    // Locked regardless of IP or email casing.
    expect(lockedCode(() => throttle.assertAllowed('USER@example.com', '10.0.0.9', t0 + MIN))).toBe(
      'SIGN_IN_LOCKED',
    );
    expect(
      lockedCode(() => throttle.assertAllowed('user@example.com', '10.0.0.9', t0 + 16 * MIN)),
    ).toBeNull();
  });

  it('locks an IP that sprays many accounts', () => {
    const throttle = new LoginThrottle({ maxIpFailures: 4, maxAccountFailures: 100 });
    for (let i = 0; i < 4; i++) throttle.recordFailure(`user${i}@example.com`, '10.0.0.5', 0);
    expect(lockedCode(() => throttle.assertAllowed('fresh@example.com', '10.0.0.5', 1))).toBe(
      'SIGN_IN_LOCKED',
    );
    expect(lockedCode(() => throttle.assertAllowed('fresh@example.com', '10.0.0.6', 1))).toBeNull();
  });

  it('forgets old failures outside the window and clears on success', () => {
    const throttle = new LoginThrottle({ maxAccountFailures: 3, windowMs: 15 * MIN });
    throttle.recordFailure('a@example.com', undefined, 0);
    throttle.recordFailure('a@example.com', undefined, 0);
    // Window expired: the next failure starts a new count.
    throttle.recordFailure('a@example.com', undefined, 20 * MIN);
    expect(
      lockedCode(() => throttle.assertAllowed('a@example.com', undefined, 20 * MIN)),
    ).toBeNull();
    throttle.recordFailure('a@example.com', undefined, 20 * MIN);
    throttle.recordSuccess('a@example.com');
    throttle.recordFailure('a@example.com', undefined, 20 * MIN);
    expect(
      lockedCode(() => throttle.assertAllowed('a@example.com', undefined, 20 * MIN)),
    ).toBeNull();
  });
});
