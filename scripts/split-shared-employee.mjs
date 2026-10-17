#!/usr/bin/env node
/**
 * Repairs requests that were all linked to ONE shared employee record.
 *
 * Before the fix, a new request without a staff number used the placeholder
 * employee ID "emp-new", so every such case pointed at the same employee
 * record and its name was overwritten by the latest request.
 *
 * This script gives each of those cases its own employee record:
 *  - the newest case keeps the existing record (its name is the current one);
 *  - every older case gets a new record. Its name is recovered from the
 *    notification payloads or audit data when found, otherwise it is set to
 *    "Name needed (<case code>)" so you can correct it.
 * Each move writes an EMPLOYEE_RECORD_SPLIT audit event.
 *
 * Dry run (writes nothing):  node scripts/split-shared-employee.mjs
 * Apply:                     node scripts/split-shared-employee.mjs --apply
 * Set a name afterwards:     node scripts/split-shared-employee.mjs --set=AF-2026-886CDC4C="Ahmed Ali"
 */
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {}
}
const { PrismaClient } = await import(
  pathToFileURL(resolve(process.cwd(), 'packages/database/generated/client/index.js')).href
);
const apply = process.argv.includes('--apply');
const prisma = new PrismaClient();
const NAME_KEYS = ['employeeName', 'candidateName', 'displayName'];

function findName(value, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 4) return null;
  for (const key of NAME_KEYS) {
    if (typeof value[key] === 'string' && value[key].trim().length >= 2) return value[key].trim();
  }
  for (const child of Object.values(value)) {
    const found = findName(child, depth + 1);
    if (found) return found;
  }
  return null;
}

async function recoverName(caseId) {
  const outbox = await prisma.notificationOutbox.findMany({
    where: { aggregateId: caseId },
    orderBy: { occurredAt: 'asc' },
    take: 20,
  });
  for (const item of outbox) {
    const name = findName(item.payload);
    if (name) return { name, from: 'notification' };
  }
  const audits = await prisma.auditEvent.findMany({
    where: { caseId },
    orderBy: { createdAt: 'asc' },
    take: 50,
  });
  for (const item of audits) {
    const name = findName(item.previousData) ?? findName(item.newData);
    if (name) return { name, from: 'audit' };
  }
  return null;
}

const renames = process.argv
  .filter((arg) => arg.startsWith('--set='))
  .map((arg) => arg.slice(6))
  .map((pair) => [pair.slice(0, pair.indexOf('=')), pair.slice(pair.indexOf('=') + 1).trim()])
  .filter(([code, name]) => code && name.length >= 2);

try {
  if (renames.length) {
    for (const [caseCode, name] of renames) {
      const c = await prisma.assessmentCase.findUnique({
        where: { caseCode },
        include: { employee: true },
      });
      if (!c) {
        console.log(`${caseCode}: case not found`);
        continue;
      }
      const others = await prisma.assessmentCase.count({ where: { employeeId: c.employeeId } });
      if (others > 1 && c.employee.externalId === 'emp-new') {
        console.log(`${caseCode}: still on the shared record. Run --apply first.`);
        continue;
      }
      await prisma.$transaction([
        prisma.employeeReference.update({
          where: { id: c.employeeId },
          data: { displayName: name },
        }),
        prisma.auditEvent.create({
          data: {
            caseId: c.id,
            actorId: 'system-repair',
            actorName: 'System (employee split script)',
            action: 'EMPLOYEE_NAME_CORRECTED',
            entityType: 'EmployeeReference',
            entityId: c.employeeId,
            reason: 'Employee name corrected after splitting the shared record.',
            previousData: { displayName: c.employee.displayName },
            newData: { displayName: name },
            correlationId: randomUUID(),
          },
        }),
      ]);
      console.log(`${caseCode}: ${c.employee.displayName} -> ${name}`);
    }
    process.exitCode = 0;
  }
  if (renames.length) {
    await prisma.$disconnect();
    process.exit(0);
  }
  const shared = await prisma.employeeReference.findMany({
    where: { externalId: 'emp-new' },
    include: { cases: { orderBy: { createdAt: 'asc' } } },
  });
  const rows = [];
  for (const employee of shared) {
    if (employee.cases.length === 0) continue;
    const newest = employee.cases[employee.cases.length - 1];
    rows.push({
      caseCode: newest.caseCode,
      department: newest.departmentSnapshot,
      created: newest.createdAt.toISOString().slice(0, 16).replace('T', ' '),
      name: employee.displayName,
      action: 'keeps the current record',
    });
    for (const c of employee.cases.slice(0, -1)) {
      const recovered = await recoverName(c.id);
      const name = recovered?.name ?? `Name needed (${c.caseCode})`;
      rows.push({
        caseCode: c.caseCode,
        department: c.departmentSnapshot,
        created: c.createdAt.toISOString().slice(0, 16).replace('T', ' '),
        name,
        action: recovered ? `new record (name from ${recovered.from})` : 'new record (name needed)',
      });
      if (!apply) continue;
      await prisma.$transaction(async (tx) => {
        const record = await tx.employeeReference.create({
          data: {
            organizationId: employee.organizationId,
            externalId: `emp-${randomUUID()}`,
            displayName: name,
            department: c.departmentSnapshot,
            currentRole: c.currentRoleSnapshot,
            employmentState: 'ACTIVE',
          },
        });
        await tx.assessmentCase.update({ where: { id: c.id }, data: { employeeId: record.id } });
        await tx.auditEvent.create({
          data: {
            caseId: c.id,
            actorId: 'system-repair',
            actorName: 'System (employee split script)',
            action: 'EMPLOYEE_RECORD_SPLIT',
            entityType: 'AssessmentCase',
            entityId: c.id,
            reason: 'Case moved off the shared "emp-new" employee record to its own record.',
            previousData: { employeeId: employee.id, displayName: employee.displayName },
            newData: { employeeId: record.id, displayName: name },
            correlationId: randomUUID(),
          },
        });
      });
    }
    if (apply) {
      // Free the placeholder ID so it can never be shared again.
      await prisma.employeeReference.update({
        where: { id: employee.id },
        data: { externalId: `emp-${randomUUID()}` },
      });
    }
  }
  if (!rows.length) console.log('No cases share the "emp-new" employee record. Nothing to repair.');
  else {
    console.table(rows);
    console.log(
      apply
        ? '\nDone. Correct any "Name needed" employee in the case request (Admin edit) or the Employees page.'
        : '\nDry run: nothing was written. Run with --apply to split the records.',
    );
  }
} finally {
  await prisma.$disconnect();
}
