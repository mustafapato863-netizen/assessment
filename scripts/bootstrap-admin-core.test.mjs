import assert from 'node:assert/strict';
import { scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { test } from 'node:test';
import {
  buildAdminAccount,
  hashBootstrapPassword,
  isPasswordResetRequested,
  readBootstrapInput,
} from './bootstrap-admin-core.mjs';

const scrypt = promisify(scryptCallback);

// Mirrors verifyPassword in apps/api/src/auth/password.util.ts.
async function verifyLikeApi(password, encoded) {
  const [algorithm, salt, storedHex] = encoded.split(':');
  assert.equal(algorithm, 'scrypt');
  const stored = Buffer.from(storedHex, 'hex');
  const actual = await scrypt(password, salt, 64);
  return timingSafeEqual(actual, stored);
}

const validEnv = {
  BOOTSTRAP_ADMIN_EMAIL: 'Admin.Owner@saudigerman.com',
  BOOTSTRAP_ADMIN_PASSWORD: 'correct-horse-battery',
};

test('reports every missing value at once and never echoes a password', () => {
  assert.throws(
    () => readBootstrapInput({ BOOTSTRAP_ADMIN_PASSWORD: 'short' }),
    (error) => {
      assert.match(error.message, /BOOTSTRAP_ADMIN_EMAIL is required/);
      assert.match(error.message, /at least 12 characters/);
      assert.doesNotMatch(error.message, /short/);
      return true;
    },
  );
});

test('requires the email to be on the allowed company domain', () => {
  assert.throws(
    () => readBootstrapInput({ ...validEnv, BOOTSTRAP_ADMIN_EMAIL: 'owner@example.com' }),
    /must end with @saudigerman\.com/,
  );
  assert.throws(
    () => readBootstrapInput({ ...validEnv, BOOTSTRAP_ADMIN_EMAIL: 'not-an-email' }),
    /valid email address/,
  );
});

test('honours ACCESS_ALLOWED_EMAIL_DOMAIN when the API is configured with another domain', () => {
  const input = readBootstrapInput({
    ...validEnv,
    BOOTSTRAP_ADMIN_EMAIL: 'owner@example.com',
    ACCESS_ALLOWED_EMAIL_DOMAIN: 'Example.com',
  });
  assert.equal(input.email, 'owner@example.com');
});

test('enforces the 12 to 256 character password rule', () => {
  assert.throws(
    () => readBootstrapInput({ ...validEnv, BOOTSTRAP_ADMIN_PASSWORD: 'x'.repeat(11) }),
    /at least 12 characters/,
  );
  assert.throws(
    () => readBootstrapInput({ ...validEnv, BOOTSTRAP_ADMIN_PASSWORD: 'x'.repeat(257) }),
    /longer than 256 characters/,
  );
  assert.equal(
    readBootstrapInput({ ...validEnv, BOOTSTRAP_ADMIN_PASSWORD: 'x'.repeat(12) }).password.length,
    12,
  );
});

test('normalises the email, keeps the password exact and defaults the display name', () => {
  const input = readBootstrapInput({ ...validEnv, BOOTSTRAP_ADMIN_PASSWORD: '  spaced pass  ' });
  assert.equal(input.email, 'admin.owner@saudigerman.com');
  assert.equal(input.password, '  spaced pass  ');
  assert.equal(input.displayName, 'System Administrator');
});

test('hashes in the format the API verifies, and only the right password passes', async () => {
  const encoded = await hashBootstrapPassword('correct-horse-battery');
  assert.match(encoded, /^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/);
  assert.equal(await verifyLikeApi('correct-horse-battery', encoded), true);
  assert.equal(await verifyLikeApi('wrong-password-value', encoded), false);
});

test('builds an active Admin account with organisation scope and no forced password change', () => {
  const account = buildAdminAccount(
    { email: 'owner@saudigerman.com', displayName: 'Owner' },
    'scrypt:hash',
  );
  assert.deepEqual(account, {
    email: 'owner@saudigerman.com',
    displayName: 'Owner',
    passwordHash: 'scrypt:hash',
    mustChangePassword: false,
    roles: ['Admin'],
    scopeType: 'ORGANIZATION',
    scopeValues: [],
    active: true,
    createdBy: 'bootstrap-admin',
  });
});

test('password reset needs BOOTSTRAP_ADMIN_RESET set to exactly true (any case)', () => {
  assert.equal(isPasswordResetRequested({ BOOTSTRAP_ADMIN_RESET: 'true' }), true);
  assert.equal(isPasswordResetRequested({ BOOTSTRAP_ADMIN_RESET: ' TRUE ' }), true);
  assert.equal(isPasswordResetRequested({ BOOTSTRAP_ADMIN_RESET: 'yes' }), false);
  assert.equal(isPasswordResetRequested({ BOOTSTRAP_ADMIN_RESET: '1' }), false);
  assert.equal(isPasswordResetRequested({}), false);
});
