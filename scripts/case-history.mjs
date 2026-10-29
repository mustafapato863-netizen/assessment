#!/usr/bin/env node
/**
 * Read-only: shows every case for an employee name and how each one was created
 * (new request, reassessment of an earlier case, seed/import) with its first audit events.
 *
 * Usage (repo root):  node scripts/case-history.mjs --name=elrawy
 *                     node scripts/case-history.mjs --code=AF-2026-886CDC4C
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {}
}
const name = process.argv.find((arg) => arg.startsWith('--name='))?.slice(7);
const code = process.argv.find((arg) => arg.startsWith('--code='))?.slice(7);
if (!name && !code) {
  console.error('Usage: node scripts/case-history.mjs --name=<part of the employee name>');
  process.exit(1);
}
const { PrismaClient } = await import(
  pathToFileURL(resolve(process.cwd(), 'packages/database/generated/client/index.js')).href
);
const prisma = new PrismaClient();
const when = (d) => (d ? new Date(d).toISOString().replace('T', ' ').slice(0, 16) : '—');

try {
  const cases = await prisma.assessmentCase.findMany({
    where: code
      ? { caseCode: code }
      : { employee: { displayName: { contains: name, mode: 'insensitive' } } },
    include: {
      employee: { select: { displayName: true, externalId: true } },
      sourceReassessmentLinks: true,
      targetReassessmentLink: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  if (!cases.length) {
    console.log('No cases found for that name.');
    process.exit(0);
  }
  const codeById = new Map(cases.map((c) => [c.id, c.caseCode]));
  const rows = [];
  for (const c of cases) {
    const first = await prisma.auditEvent.findFirst({
      where: { caseId: c.id },
      orderBy: { createdAt: 'asc' },
    });
    const source = c.targetReassessmentLink;
    rows.push({
      caseCode: c.caseCode,
      employeeId: c.employee?.externalId ?? '—',
      department: c.departmentSnapshot,
      currentRole: c.currentRoleSnapshot,
      targetRole: c.targetRoleSnapshot,
      justification: (c.justification ?? '').replace(/\s+/g, ' ').slice(0, 160),
      status: c.status,
      created: when(c.createdAt),
      origin: source
        ? `REASSESSMENT of ${codeById.get(source.sourceCaseId) ?? source.sourceCaseId}`
        : first
          ? `${first.action} by ${first.actorName}`
          : 'no audit (seed/import)',
      firstEvent: first ? when(first.createdAt) : '—',
    });
  }
  console.table(rows);
} finally {
  await prisma.$disconnect();
}
