#!/usr/bin/env node

/**
 * AssessFlow UAT Seed Refresh Script
 *
 * Resets asses_db to the clean demo seed:
 * - Demo Company (ASSESSFLOW-DEMO)
 * - Exactly 3 demo employees (Product: Mona Hassan, Engineering: Omar Khalil, People: Sara Adel)
 * - Standard retention policies (CASE_RECORD, ASSESSOR_EVIDENCE, EXPORT)
 * - Purges all smoke, proof, and load cases and associated child records
 * - Verifies and outputs post-refresh counts across all tables
 */

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {}
}

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://postgres:123456@localhost:5432/asses_db';

const clientModulePath = resolve(
  process.cwd(),
  'packages/database/generated/client/index.js',
);
const { PrismaClient } = await import(pathToFileURL(clientModulePath).href);

const prisma = new PrismaClient({
  datasources: {
    db: { url: databaseUrl },
  },
});

export async function refreshUatSeed({ checkOnly = false } = {}) {
  console.log('[UAT Refresh] Connecting to database...');
  await prisma.$connect();

  if (!checkOnly) {
    console.log('[UAT Refresh] Purging smoke and proof cases and related child records...');

    // Delete in dependency order
    await prisma.notificationDelivery.deleteMany({});
    await prisma.notificationOutbox.deleteMany({});
    await prisma.auditEvent.deleteMany({});
    await prisma.accessLog.deleteMany({});
    await prisma.idempotencyKey.deleteMany({});
    await prisma.task.deleteMany({});
    await prisma.developmentAction.deleteMany({});
    await prisma.developmentPlan.deleteMany({});
    await prisma.approvalStep.deleteMany({});
    await prisma.recommendationRevision.deleteMany({});
    await prisma.resultRevision.deleteMany({});
    await prisma.attachment.deleteMany({});
    await prisma.evidenceSubmission.deleteMany({});
    await prisma.eventAssessor.deleteMany({});
    await prisma.assessmentEvent.deleteMany({});
    await prisma.assessmentPlanMethod.deleteMany({});
    await prisma.assessmentPlan.deleteMany({});
    await prisma.eligibilityCriterionResult.deleteMany({});
    await prisma.eligibilityReview.deleteMany({});
    await prisma.reassessmentLink.deleteMany({});
    await prisma.assessmentCase.deleteMany({});

    // Purge non-seed employees (e.g. emp-att or any temporary test employees)
    await prisma.employeeReference.deleteMany({
      where: {
        externalId: {
          notIn: ['emp-001', 'emp-002', 'emp-003'],
        },
      },
    });

    console.log('[UAT Refresh] Upserting demo organization...');
    const organization = await prisma.organization.upsert({
      where: { code: 'ASSESSFLOW-DEMO' },
      update: { name: 'AssessFlow Demo Company' },
      create: { code: 'ASSESSFLOW-DEMO', name: 'AssessFlow Demo Company' },
    });

    console.log('[UAT Refresh] Upserting 3 demo employees (Product, Engineering, People)...');
    const demoEmployees = [
      {
        externalId: 'emp-001',
        displayName: 'Mona Hassan',
        email: 'mona.hassan@example.test',
        department: 'Product',
        managerName: 'Sarah Johnson',
        currentRole: 'Senior Specialist',
        currentLevel: 'L4',
      },
      {
        externalId: 'emp-002',
        displayName: 'Omar Khalil',
        email: 'omar.khalil@example.test',
        department: 'Engineering',
        managerName: 'Sarah Johnson',
        currentRole: 'Software Engineer',
        currentLevel: 'L3',
      },
      {
        externalId: 'emp-003',
        displayName: 'Sara Adel',
        email: 'sara.adel@example.test',
        department: 'People',
        managerName: 'Sarah Johnson',
        currentRole: 'HR Specialist',
        currentLevel: 'L4',
      },
    ];

    for (const emp of demoEmployees) {
      await prisma.employeeReference.upsert({
        where: {
          organizationId_externalId: {
            organizationId: organization.id,
            externalId: emp.externalId,
          },
        },
        update: { ...emp, organizationId: organization.id },
        create: { ...emp, organizationId: organization.id },
      });
    }

    console.log('[UAT Refresh] Upserting baseline retention policies...');
    const retentionPolicies = [
      { category: 'CASE_RECORD', retentionDays: null, legalHoldEnabled: true, active: true },
      { category: 'ASSESSOR_EVIDENCE', retentionDays: null, legalHoldEnabled: true, active: true },
      { category: 'EXPORT', retentionDays: 90, legalHoldEnabled: true, active: true },
    ];

    for (const policy of retentionPolicies) {
      await prisma.retentionPolicy.upsert({
        where: { category: policy.category },
        update: policy,
        create: policy,
      });
    }
  }

  // Count verification
  const orgCount = await prisma.organization.count();
  const empCount = await prisma.employeeReference.count();
  const caseCount = await prisma.assessmentCase.count();
  const attachmentCount = await prisma.attachment.count();
  const auditEventCount = await prisma.auditEvent.count();
  const idempotencyCount = await prisma.idempotencyKey.count();
  const retentionCount = await prisma.retentionPolicy.count();

  const employees = await prisma.employeeReference.findMany({
    select: { externalId: true, displayName: true, department: true, currentLevel: true },
    orderBy: { externalId: 'asc' },
  });

  console.log('\n========================================');
  console.log('       UAT SEED VERIFICATION REPORT     ');
  console.log('========================================');
  console.log(` Organizations:     ${orgCount} (expected: 1)`);
  console.log(` Employees:         ${empCount} (expected: 3)`);
  console.log(` Assessment Cases:  ${caseCount} (expected: 0, clean for UAT)`);
  console.log(` Attachments:       ${attachmentCount} (expected: 0)`);
  console.log(` Audit Events:      ${auditEventCount} (expected: 0)`);
  console.log(` Idempotency Keys:  ${idempotencyCount} (expected: 0)`);
  console.log(` Retention Policies:${retentionCount} (expected: 3)`);
  console.log('----------------------------------------');
  console.log(' Seeded Employees:');
  for (const emp of employees) {
    console.log(
      `   • [${emp.externalId}] ${emp.displayName} (${emp.department}, ${emp.currentLevel})`,
    );
  }
  console.log('========================================\n');

  const isValid =
    orgCount === 1 &&
    empCount === 3 &&
    caseCount === 0 &&
    attachmentCount === 0 &&
    idempotencyCount === 0 &&
    retentionCount === 3;

  if (!isValid) {
    throw new Error(
      `[UAT Refresh] Verification failed: unexpected table count(s).`,
    );
  }

  console.log('✓ UAT seed verified clean and ready for pilot.');
  return {
    orgCount,
    empCount,
    caseCount,
    attachmentCount,
    auditEventCount,
    idempotencyCount,
    retentionCount,
    employees,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const checkOnly = process.argv.includes('--check');
  refreshUatSeed({ checkOnly })
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
