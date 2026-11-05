// Pure helpers for the first-admin bootstrap. No database access here, so they can be
// tested without a running database (see bootstrap-admin-core.test.mjs).
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';

// Must match apps/api/src/auth/password.util.ts so the API can verify the hash.
const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

// Same limits as the API's password rules (access-accounts.service.ts).
export const ADMIN_PASSWORD_MIN_LENGTH = 12;
export const ADMIN_PASSWORD_MAX_LENGTH = 256;
export const DEFAULT_ALLOWED_EMAIL_DOMAIN = 'saudigerman.com';
export const DEFAULT_ADMIN_NAME = 'System Administrator';

/**
 * Reads and checks BOOTSTRAP_ADMIN_* from `env`. Throws one Error listing every problem.
 * The password itself is never included in an error message.
 */
export function readBootstrapInput(env) {
  const problems = [];
  const domain = (env.ACCESS_ALLOWED_EMAIL_DOMAIN || DEFAULT_ALLOWED_EMAIL_DOMAIN)
    .trim()
    .toLowerCase();
  const email = (env.BOOTSTRAP_ADMIN_EMAIL ?? '').trim().toLowerCase();
  if (!email) {
    problems.push('BOOTSTRAP_ADMIN_EMAIL is required.');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    problems.push('BOOTSTRAP_ADMIN_EMAIL must be a valid email address.');
  } else if (!email.endsWith(`@${domain}`)) {
    problems.push(`BOOTSTRAP_ADMIN_EMAIL must end with @${domain}, the domain the API accepts.`);
  }

  const password = env.BOOTSTRAP_ADMIN_PASSWORD ?? '';
  if (!password) {
    problems.push('BOOTSTRAP_ADMIN_PASSWORD is required.');
  } else if (password.length < ADMIN_PASSWORD_MIN_LENGTH) {
    problems.push(`BOOTSTRAP_ADMIN_PASSWORD must be at least ${ADMIN_PASSWORD_MIN_LENGTH} characters.`);
  } else if (password.length > ADMIN_PASSWORD_MAX_LENGTH) {
    problems.push(`BOOTSTRAP_ADMIN_PASSWORD cannot be longer than ${ADMIN_PASSWORD_MAX_LENGTH} characters.`);
  }

  if (problems.length > 0) throw new Error(problems.join('\n'));

  return {
    email,
    displayName: (env.BOOTSTRAP_ADMIN_NAME ?? '').trim() || DEFAULT_ADMIN_NAME,
    password,
  };
}

/** Produces `scrypt:<salt>:<key>`, the format verifyPassword in the API expects. */
export async function hashBootstrapPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

/** True only when BOOTSTRAP_ADMIN_RESET is "true" (any letter case). */
export function isPasswordResetRequested(env) {
  return (env.BOOTSTRAP_ADMIN_RESET ?? '').trim().toLowerCase() === 'true';
}

/**
 * Data for the AccessAccount row. The operator chose the password, so the account does
 * not have to change it at first sign-in.
 */
export function buildAdminAccount(input, passwordHash) {
  return {
    email: input.email,
    displayName: input.displayName,
    passwordHash,
    mustChangePassword: false,
    roles: ['Admin'],
    scopeType: 'ORGANIZATION',
    scopeValues: [],
    active: true,
    createdBy: 'bootstrap-admin',
  };
}
