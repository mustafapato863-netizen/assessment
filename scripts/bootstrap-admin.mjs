#!/usr/bin/env node
/**
 * Creates the first System Admin account, so the company can sign in without any
 * client-side fallback. It never changes an existing account.
 *
 * Usage (repo root, PowerShell), with the database running and migrated:
 *   $env:BOOTSTRAP_ADMIN_EMAIL = 'you@saudigerman.com'
 *   $env:BOOTSTRAP_ADMIN_PASSWORD = '<at least 12 characters>'
 *   node scripts/bootstrap-admin.mjs
 *
 * Optional: BOOTSTRAP_ADMIN_NAME (default "System Administrator").
 * The email must end with ACCESS_ALLOWED_EMAIL_DOMAIN (default saudigerman.com).
 */
import { randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  buildAdminAccount,
  hashBootstrapPassword,
  isPasswordResetRequested,
  readBootstrapInput,
} from './bootstrap-admin-core.mjs';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {}
}

let input;
try {
  input = readBootstrapInput(process.env);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const { PrismaClient } = await import(
  pathToFileURL(
    fileURLToPath(new URL('../packages/database/generated/client/index.js', import.meta.url)),
  ).href
);
const prisma = new PrismaClient();

try {
  const existing = await prisma.accessAccount.findUnique({ where: { email: input.email } });
  if (existing && isPasswordResetRequested(process.env)) {
    if (!existing.roles.includes('Admin')) {
      throw new Error('Only an existing Admin account can have its password reset.');
    }
    const passwordHash = await hashBootstrapPassword(input.password);
    await prisma.$transaction(async (tx) => {
      await tx.accessAccount.update({
        where: { id: existing.id },
        data: { passwordHash, mustChangePassword: false },
      });
      await tx.auditEvent.create({
        data: {
          actorId: 'bootstrap-admin',
          actorName: 'Bootstrap script',
          action: 'ADMIN_BOOTSTRAP_PASSWORD_RESET',
          entityType: 'ACCESS_ACCOUNT',
          entityId: existing.id,
          newData: { email: existing.email },
          correlationId: `corr-${randomUUID()}`,
        },
      });
    });
    console.log(`Reset the password for ${existing.email}. Sign in with the new password.`);
  } else if (existing) {
    console.log(
      `An account for ${input.email} already exists. Nothing was changed. ` +
        'To reset its password, also set BOOTSTRAP_ADMIN_RESET=true.',
    );
  } else {
    const passwordHash = await hashBootstrapPassword(input.password);
    const created = await prisma.$transaction(async (tx) => {
      const account = await tx.accessAccount.create({
        data: buildAdminAccount(input, passwordHash),
      });
      await tx.auditEvent.create({
        data: {
          actorId: 'bootstrap-admin',
          actorName: 'Bootstrap script',
          action: 'ADMIN_BOOTSTRAP_CREATED',
          entityType: 'ACCESS_ACCOUNT',
          entityId: account.id,
          newData: { email: account.email, roles: account.roles, scopeType: account.scopeType },
          correlationId: `corr-${randomUUID()}`,
        },
      });
      return account;
    });
    console.log(`Created the System Admin account ${created.email}. Sign in with the password you set.`);
  }
} catch (error) {
  console.error(`Bootstrap failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
