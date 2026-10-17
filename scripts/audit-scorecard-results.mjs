#!/usr/bin/env node
/**
 * Read-only audit: re-scores every finalized assessment result with the
 * corrected scorecard formula and lists the cases whose result code changes.
 *
 * Background: SCORECARD_QUESTION_TARGET was 1 on a 0-5 rating scale, so any
 * average rating >= 1 scored 5/5 and almost every complete scorecard was
 * finalized as READY_NOW. Nothing is written to the database.
 *
 * Usage (repo root):  node scripts/audit-scorecard-results.mjs
 */
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {}
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set (expected in .env).');
  process.exit(1);
}

const { PrismaClient } = await import(
  pathToFileURL(resolve(process.cwd(), 'packages/database/generated/client/index.js')).href
);
const contracts = createRequire(resolve(process.cwd(), 'packages/contracts/package.json'))(
  './dist/index.js',
);
const {
  calculateScorecard,
  defaultScorecardConfig,
  scorecardConfigSchema,
  scorecardRatingsSchema,
} = contracts;

const prisma = new PrismaClient();
const fmt = (value) => (typeof value === 'number' ? value.toFixed(2) : '—');

try {
  const cases = await prisma.assessmentCase.findMany({
    where: { resultRevisions: { some: { finalizedAt: { not: null } } } },
    include: {
      employee: { select: { displayName: true } },
      plan: { select: { scorecardConfig: true } },
      scorecards: { where: { submittedAt: { not: null } } },
      resultRevisions: { orderBy: { revision: 'desc' }, take: 1 },
    },
    orderBy: { requestedAt: 'asc' },
  });

  const rows = [];
  for (const record of cases) {
    const latest = record.resultRevisions[0];
    if (!latest?.finalizedAt || latest.reopenedAt) continue;
    const config = record.plan?.scorecardConfig
      ? scorecardConfigSchema.parse(record.plan.scorecardConfig)
      : defaultScorecardConfig;
    const corrected = calculateScorecard(
      config,
      record.scorecards.map((s) => ({
        ratings: scorecardRatingsSchema.parse(s.ratings),
        submitted: true,
      })),
    );
    const stored = latest.scorecardSummary ?? {};
    rows.push({
      caseCode: record.caseCode,
      employee: record.employee?.displayName ?? '—',
      status: record.status,
      storedResult: latest.resultCode ?? '—',
      storedOverall: fmt(stored.overall),
      correctedResult: corrected.resultCode,
      correctedOverall: fmt(corrected.overall),
      knockout: corrected.knockout ? 'yes' : '',
      changed: !record.scorecards.length
        ? 'NO SCORECARD'
        : latest.resultCode !== corrected.resultCode
          ? 'CHANGED'
          : '',
    });
  }

  if (!rows.length) {
    console.log('No finalized results found. Nothing to review.');
  } else {
    console.table(rows);
    const changed = rows.filter((row) => row.changed === 'CHANGED');
    const unscored = rows.filter((row) => row.changed === 'NO SCORECARD');
    console.log(
      `\n${rows.length} finalized result(s) checked; ${changed.length} would change under the corrected formula; ${unscored.length} have no submitted scorecard (result entered or imported directly).`,
    );
    if (changed.length) {
      console.log(
        'Review each CHANGED case with the panel. To correct one, reopen the result (Admin) and finalize it again.',
      );
    }
  }
} finally {
  await prisma.$disconnect();
}
