#!/usr/bin/env node
/**
 * Brings stored scores in line with the current scorecard rules.
 *
 *  1. Legacy scorecards: questions used to be rated 0-5. Today a question takes
 *     0 up to its weight. A scorecard with any score above its question weight is
 *     treated as legacy and every score is converted: points = score / 5 x weight
 *     (4 of 5 on a weight-1 question becomes 0.8).
 *  2. Finalized results: each finalized (not reopened) result is re-scored from
 *     its submitted scorecards. When the result code or scores changed, the
 *     result revision is updated and a RESULT_RESCORED audit event records the
 *     before and after.
 *
 * Dry run by default (prints what would change, writes nothing):
 *   node scripts/rescore-results.mjs
 * Write the changes:
 *   node scripts/rescore-results.mjs --apply
 *
 * Needs the contracts build: pnpm --filter @assessflow/contracts build
 */
import { randomUUID } from 'node:crypto';
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
if (typeof isValidQuestionScore !== 'function') {
  console.error('Contracts build is out of date. Run: pnpm --filter @assessflow/contracts build');
  process.exit(1);
}

const apply = process.argv.includes('--apply');
const prisma = new PrismaClient();
const round2 = (value) => Math.round(value * 100) / 100;
const fmt = (value) => (typeof value === 'number' ? value.toFixed(2) : '—');
const ACTOR = { actorId: 'system-rescore', actorName: 'System (rescore script)' };

function questionsOf(config) {
  return [...config.technical, ...config.behavioral].flatMap((group) =>
    group.criteria.map((criterion) => ({ key: scorecardRatingKey(group, criterion), criterion })),
  );
}

/** Returns converted ratings when the scorecard is on the old 0-5 scale, else null. */
function convertLegacy(ratings, questions) {
  const scored = questions.filter((q) => typeof ratings[q.key]?.score === 'number');
  const legacy =
    scored.some((q) => ratings[q.key].score > q.criterion.weight + 1e-9) &&
    scored.every((q) => ratings[q.key].score <= 5);
  if (!legacy) return null;
  const next = { ...ratings };
  for (const q of scored) {
    next[q.key] = {
      ...ratings[q.key],
      score: round2((ratings[q.key].score / 5) * q.criterion.weight),
    };
  }
  return next;
}

try {
  const cases = await prisma.assessmentCase.findMany({
    include: {
      employee: { select: { displayName: true } },
      plan: { select: { scorecardConfig: true } },
      scorecards: true,
      resultRevisions: { orderBy: { revision: 'desc' }, take: 1 },
    },
    orderBy: { requestedAt: 'asc' },
  });

  const legacyRows = [];
  const resultRows = [];
  let writes = 0;

  for (const record of cases) {
    const config = record.plan?.scorecardConfig
      ? scorecardConfigSchema.parse(record.plan.scorecardConfig)
      : defaultScorecardConfig;
    const questions = questionsOf(config);

    // 1. Legacy scorecards
    const ratingsById = new Map();
    for (const scorecard of record.scorecards) {
      const ratings = scorecardRatingsSchema.parse(scorecard.ratings);
      const converted = convertLegacy(ratings, questions);
      ratingsById.set(scorecard.id, converted ?? ratings);
      if (!converted) continue;
      legacyRows.push({
        caseCode: record.caseCode,
        employee: record.employee?.displayName ?? '—',
        assessor: scorecard.assessorName,
        submitted: scorecard.submittedAt ? 'yes' : 'draft',
        example: (() => {
          const q = questions.find((x) => typeof ratings[x.key]?.score === 'number');
          return q
            ? `${ratings[q.key].score}/5 → ${converted[q.key].score}/${q.criterion.weight}`
            : '';
        })(),
      });
      if (apply) {
        await prisma.$transaction([
          prisma.assessmentScorecard.update({
            where: { id: scorecard.id },
            data: { ratings: converted },
          }),
          prisma.auditEvent.create({
            data: {
              caseId: record.id,
              ...ACTOR,
              action: 'SCORECARD_CONVERTED_TO_POINTS',
              entityType: 'AssessmentScorecard',
              entityId: scorecard.id,
              reason: 'Legacy 0-5 ratings converted to points (score / 5 x question weight).',
              previousData: ratings,
              newData: converted,
              correlationId: randomUUID(),
            },
          }),
        ]);
        writes += 1;
      }
    }

    // 2. Finalized results
    const latest = record.resultRevisions[0];
    if (!latest?.finalizedAt || latest.reopenedAt) continue;
    const submitted = record.scorecards.filter((s) => s.submittedAt);
    if (!submitted.length) {
      resultRows.push({
        caseCode: record.caseCode,
        employee: record.employee?.displayName ?? '—',
        stored: latest.resultCode ?? '—',
        now: '—',
        overall: '—',
        action: 'skip: no submitted scorecard',
      });
      continue;
    }
    const scored = calculateScorecard(
      config,
      submitted.map((s) => ({ ratings: ratingsById.get(s.id), submitted: true })),
    );
    if (!scored.completeCount) {
      resultRows.push({
        caseCode: record.caseCode,
        employee: record.employee?.displayName ?? '—',
        stored: latest.resultCode ?? '—',
        now: 'INCOMPLETE',
        overall: '—',
        action: 'skip: scorecard incomplete',
      });
      continue;
    }
    const stored = latest.scorecardSummary ?? {};
    const sameCode = latest.resultCode === scored.resultCode;
    const sameScores =
      fmt(stored.overall) === fmt(scored.overall) &&
      fmt(stored.technical) === fmt(scored.technical) &&
      fmt(stored.behavioral) === fmt(scored.behavioral);
    if (sameCode && sameScores) continue;
    resultRows.push({
      caseCode: record.caseCode,
      employee: record.employee?.displayName ?? '—',
      stored: `${latest.resultCode ?? '—'} (${fmt(stored.overall)})`,
      now: scored.resultCode + (scored.knockout ? ' · knockout' : ''),
      overall: fmt(scored.overall),
      action: sameCode ? 'update scores' : 'RESULT CHANGES',
    });
    if (apply) {
      const nextSummary = { ...scored, assessorRecommendation: stored.assessorRecommendation };
      await prisma.$transaction([
        prisma.resultRevision.update({
          where: { id: latest.id },
          data: { resultCode: scored.resultCode, scorecardSummary: nextSummary },
        }),
        prisma.auditEvent.create({
          data: {
            caseId: record.id,
            ...ACTOR,
            action: 'RESULT_RESCORED',
            entityType: 'ResultRevision',
            entityId: latest.id,
            reason: 'Finalized result re-scored with the current scorecard rules.',
            previousData: { resultCode: latest.resultCode, scorecardSummary: stored },
            newData: { resultCode: scored.resultCode, scorecardSummary: nextSummary },
            correlationId: randomUUID(),
          },
        }),
      ]);
      writes += 1;
    }
  }

  console.log(`\n1) Legacy 0-5 scorecards: ${legacyRows.length}`);
  if (legacyRows.length) console.table(legacyRows);
  console.log(`\n2) Finalized results that differ from the current scoring: ${resultRows.length}`);
  if (resultRows.length) console.table(resultRows);
  const changes = resultRows.filter((row) => row.action === 'RESULT CHANGES').length;
  console.log(
    apply
      ? `\nApplied ${writes} change(s). Each one has an audit event.`
      : `\nDry run: nothing was written. ${changes} result code(s) would change. Run with --apply to write.`,
  );
  if (changes)
    console.log(
      'Note: a changed result does not change recommendations or approvals already made on it. Review those cases.',
    );
} finally {
  await prisma.$disconnect();
}
