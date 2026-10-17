#!/usr/bin/env node
/**
 * Read-only: explains, case by case, why a case is or is not placed on the
 * 9-box (Calibration). Nothing is written to the database.
 *
 * Usage (repo root):  node scripts/diagnose-calibration.mjs            (closed cases)
 *                     node scripts/diagnose-calibration.mjs --all      (every case)
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
  scorecardRatingKey,
  isValidQuestionScore,
} = contracts;

const all = process.argv.includes('--all');
const prisma = new PrismaClient();

try {
  const cases = await prisma.assessmentCase.findMany({
    where: all ? {} : { status: 'CLOSED' },
    include: {
      employee: { select: { displayName: true } },
      plan: { select: { scorecardConfig: true } },
      scorecards: true,
      resultRevisions: { orderBy: { revision: 'desc' }, take: 1 },
    },
    orderBy: { requestedAt: 'asc' },
  });

  const rows = cases.map((record) => {
    const latest = record.resultRevisions[0];
    const submitted = record.scorecards.filter((s) => s.submittedAt);
    const config = record.plan?.scorecardConfig
      ? scorecardConfigSchema.parse(record.plan.scorecardConfig)
      : defaultScorecardConfig;
    const questions = [...config.technical, ...config.behavioral].flatMap((group) =>
      group.criteria.map((criterion) => ({ key: scorecardRatingKey(group, criterion), criterion })),
    );
    let invalidScores = 0;
    let missingScores = 0;
    for (const s of submitted) {
      const ratings = scorecardRatingsSchema.parse(s.ratings);
      for (const q of questions) {
        const score = ratings[q.key]?.score;
        if (score === undefined) missingScores += 1;
        else if (!isValidQuestionScore(score, q.criterion.weight)) invalidScores += 1;
      }
    }
    const scored = calculateScorecard(
      config,
      submitted.map((s) => ({ ratings: scorecardRatingsSchema.parse(s.ratings), submitted: true })),
    );

    let reason = 'PLACED';
    if (['DRAFT', 'CANCELLED'].includes(record.status))
      reason = `Excluded: status ${record.status}`;
    else if (record.candidateType === 'NEW_CANDIDATE') reason = 'Excluded: external new candidate';
    else if (!latest?.finalizedAt) reason = 'Unplaced: result never finalized';
    else if (latest.reopenedAt) reason = 'Unplaced: result reopened';
    else if (!record.scorecards.length) reason = 'Unplaced: no scorecard at all';
    else if (!submitted.length) reason = 'Unplaced: scorecard only saved as draft';
    else if (!scored.completeCount)
      reason = invalidScores
        ? `Unplaced: ${invalidScores} score(s) above the question weight (old 0-5 scale?)`
        : `Unplaced: ${missingScores} question(s) without a score`;

    return {
      caseCode: record.caseCode,
      employee: record.employee?.displayName ?? '—',
      status: record.status,
      type: record.candidateType,
      technical: scored.completeCount ? scored.technical.toFixed(2) : '—',
      behavioral: scored.completeCount ? scored.behavioral.toFixed(2) : '—',
      reason,
    };
  });

  if (!rows.length) console.log(all ? 'No cases found.' : 'No CLOSED cases found.');
  else {
    console.table(rows);
    const counts = {};
    for (const row of rows)
      counts[row.reason.split(':')[0]] = (counts[row.reason.split(':')[0]] ?? 0) + 1;
    console.log(counts);
  }
} finally {
  await prisma.$disconnect();
}
