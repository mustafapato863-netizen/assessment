import { HttpException, HttpStatus } from '@nestjs/common';
import { currentCorrelationId } from '../common/correlation.context';

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
      const retryAfterSeconds = Math.max(1, Math.ceil((lockedUntil - now) / 1000));
      const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
      throw new HttpException(
        {
          error: {
            code: 'SIGN_IN_LOCKED',
            message: `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
            retryAfterSeconds,
            correlationId: currentCorrelationId(),
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

  private normalize(key: unknown): string {
    return typeof key === 'string' ? key.trim().toLowerCase() : '';
  }

  private lockedUntil(store: Map<string, Window>, key: string, now: number) {
    if (!key) return 0;
    const entry = store.get(key);
    if (!entry) return 0;
    if (entry.lockedUntil <= now && now - entry.firstFailureAt > this.windowMs) {
      store.delete(key);
      return 0;
    }
    return entry.lockedUntil;
  }

  private bump(store: Map<string, Window>, key: string, max: number, now: number) {
    if (!key) return;
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
    if (store.size > 10_000) {
      for (const [storedKey, value] of store) {
        if (value.lockedUntil <= now && now - value.firstFailureAt > this.windowMs) {
          store.delete(storedKey);
        }
      }
    }
  }
}

export const loginThrottle = new LoginThrottle();
