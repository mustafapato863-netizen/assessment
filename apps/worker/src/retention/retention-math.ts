import type {
  RetentionCandidateRow,
  RetentionEvaluationSummary,
  RetentionPolicyItem,
  RetentionReviewFlag,
} from './retention.interface';
import { randomUUID } from 'node:crypto';

export const MS_PER_DAY = 86_400_000;

/**
 * Calculates cutoff date for expiration.
 * Cutoff = referenceDate - (retentionDays * 86,400,000 ms).
 * A record created before cutoff date is considered expired.
 */
export function calculateCutoffDate(referenceDate: Date, retentionDays: number): Date {
  return new Date(referenceDate.getTime() - retentionDays * MS_PER_DAY);
}

/**
 * Calculates age of record in full days relative to reference date.
 */
export function calculateAgeInDays(rowDate: Date, referenceDate: Date): number {
  const diffMs = referenceDate.getTime() - rowDate.getTime();
  return Math.floor(diffMs / MS_PER_DAY);
}

/**
 * Determines whether a candidate row is expired based on retention days and reference date.
 */
export function isRowExpired(rowDate: Date, retentionDays: number, referenceDate: Date): boolean {
  if (retentionDays <= 0) return false;
  const cutoff = calculateCutoffDate(referenceDate, retentionDays);
  return rowDate.getTime() < cutoff.getTime();
}

/**
 * Evaluates retention policy for a set of rows according to BIZ-008 hold-first rules.
 */
export function evaluateCategoryPolicy(
  policy: RetentionPolicyItem,
  rows: RetentionCandidateRow[],
  now: Date = new Date(),
): RetentionEvaluationSummary {
  // Step 1: Hold-first enforcement.
  // If legal hold is enabled, the entire category is exempt from review/flagging/deletion.
  if (policy.legalHoldEnabled) {
    return {
      category: policy.category,
      legalHold: true,
      active: policy.active,
      retentionDays: policy.retentionDays,
      status: 'SKIPPED_LEGAL_HOLD',
      totalChecked: 0,
      flaggedCount: 0,
      deletedCount: 0,
      flaggedItems: [],
    };
  }

  // Step 2: Skip inactive policies
  if (!policy.active) {
    return {
      category: policy.category,
      legalHold: false,
      active: false,
      retentionDays: policy.retentionDays,
      status: 'SKIPPED_INACTIVE',
      totalChecked: 0,
      flaggedCount: 0,
      deletedCount: 0,
      flaggedItems: [],
    };
  }

  // Step 3: Skip policies with indefinite retention (null or <= 0 retentionDays)
  if (policy.retentionDays === null || policy.retentionDays === undefined || policy.retentionDays <= 0) {
    return {
      category: policy.category,
      legalHold: false,
      active: true,
      retentionDays: null,
      status: 'SKIPPED_INDEFINITE',
      totalChecked: rows.length,
      flaggedCount: 0,
      deletedCount: 0,
      flaggedItems: [],
    };
  }

  // Step 4: Evaluate rows against cutoff
  const cutoffDate = calculateCutoffDate(now, policy.retentionDays);
  const flaggedItems: RetentionReviewFlag[] = [];

  for (const row of rows) {
    const effectiveDate = row.referenceDate ?? row.createdAt;
    if (isRowExpired(effectiveDate, policy.retentionDays, now)) {
      const ageDays = calculateAgeInDays(effectiveDate, now);
      flaggedItems.push({
        id: `flag-${randomUUID()}`,
        rowId: row.id,
        category: policy.category,
        caseId: row.caseId,
        ageDays,
        retentionDays: policy.retentionDays,
        cutoffDate,
        flaggedAt: now,
        reason: `Row age (${ageDays} days) exceeds ${policy.category} policy limit of ${policy.retentionDays} days. Soft-flagged for review; no pilot deletion.`,
        reviewStatus: 'PENDING_REVIEW',
      });
    }
  }

  return {
    category: policy.category,
    legalHold: false,
    active: true,
    retentionDays: policy.retentionDays,
    status: 'EVALUATED',
    totalChecked: rows.length,
    flaggedCount: flaggedItems.length,
    deletedCount: 0, // Strict invariant: never hard delete in pilot
    flaggedItems,
  };
}
