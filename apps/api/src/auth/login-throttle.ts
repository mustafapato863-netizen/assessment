import { HttpException, HttpStatus } from '@nestjs/common';

interface Window {
  failures: number;
  firstFailureAt: number;
  lockedUntil: number;
}

export interface LoginThrottleOptions {
  /** Failed attempts for one account before it is temporarily locked. */
  maxAccountFailures?: number;
  /** Failed attempts from one IP (any account) before that IP is locked. */
  maxIpFailures?: number;
  /** Window in which failures are counted. */
  windowMs?: number;
  /** How long a lock lasts. */
  lockMs?: number;
}

/**
 * Brute-force protection for sign-in and password change.
 *
 * Counts failures per account and per client IP inside a rolling window and
 * locks either key for a cooling-off period once the limit is reached. A
 * successful sign-in clears the account counter.
 *
 * In-memory: correct for a single API instance. With several replicas, move the
 * counters to Redis or the AccessAccount table so the limit is shared.
 */
export class LoginThrottle {
  private readonly accounts = new Map<string, Window>();
  private readonly ips = new Map<string, Window>();
  private readonly maxAccountFailures: number;
  private readonly maxIpFailures: number;
  private readonly windowMs: number;
  private readonly lockMs: number;

  constructor(options: LoginThrottleOptions = {}) {
    this.maxAccountFailures = options.maxAccountFailures ?? 5;
    this.maxIpFailures = options.maxIpFailures ?? 20;
    this.windowMs = options.windowMs ?? 15 * 60_000;
    this.lockMs = options.lockMs ?? 15 * 60_000;
  }

  /** Throws 429 if the account or IP is currently locked. */
  assertAllowed(accountKey: string, ip: string | undefined, now = Date.now()) {
    const lockedUntil = Math.max(
      this.lockedUntil(this.accounts, this.normalize(accountKey), now),
      ip ? this.lockedUntil(this.ips, ip, now) : 0,
    );
    if (lockedUntil > now) {
      const minutes = Math.max(1, Math.ceil((lockedUntil - now) / 60_000));
      throw new HttpException(
        {
          error: {
            code: 'SIGN_IN_LOCKED',
            message: `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  recordFailure(accountKey: string, ip: string | undefined, now = Date.now()) {
    this.bump(this.accounts, this.normalize(accountKey), this.maxAccountFailures, now);
    if (ip) this.bump(this.ips, ip, this.maxIpFailures, now);
  }

  recordSuccess(accountKey: string) {
    this.accounts.delete(this.normalize(accountKey));
  }

  private normalize(key: string) {
    return key.trim().toLowerCase();
  }

  private lockedUntil(store: Map<string, Window>, key: string, now: number) {
    const entry = store.get(key);
    if (!entry) return 0;
    if (entry.lockedUntil <= now && now - entry.firstFailureAt > this.windowMs) {
      store.delete(key);
      return 0;
    }
    return entry.lockedUntil;
  }

  private bump(store: Map<string, Window>, key: string, max: number, now: number) {
    let entry = store.get(key);
    if (!entry || (entry.lockedUntil <= now && now - entry.firstFailureAt > this.windowMs)) {
      entry = { failures: 0, firstFailureAt: now, lockedUntil: 0 };
    }
    entry.failures += 1;
    if (entry.failures >= max) {
      entry.lockedUntil = now + this.lockMs;
      entry.failures = 0;
      entry.firstFailureAt = now;
    }
    store.set(key, entry);
    // Keep memory bounded if someone sprays random keys.
    if (store.size > 10_000) {
      for (const [storedKey, value] of store) {
        if (value.lockedUntil <= now && now - value.firstFailureAt > this.windowMs) {
          store.delete(storedKey);
        }
      }
    }
  }
}

/** Shared instance for the API process. */
export const loginThrottle = new LoginThrottle();
