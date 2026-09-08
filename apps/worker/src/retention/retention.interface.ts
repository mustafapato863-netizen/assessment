/**
 * BIZ-008 Retention Policies & Hold-First Interface Definitions.
 *
 * Requirements:
 * - Cases: 7 years (2555 days)
 * - Evidence: 3 years (1095 days)
 * - Logs: 1 year (365 days)
 * - Audit: Indefinite (anonymize after 7 years / 2555 days)
 * - Exports: 90 days
 * - Hold-first: any category with legalHoldEnabled MUST be skipped completely.
 * - Pilot constraint: NO hard deletes; soft-flag expired rows for review.
 */

export type RetentionCategory =
  | 'CASE_RECORD'
  | 'ASSESSOR_EVIDENCE'
  | 'ACCESS_LOG'
  | 'AUDIT_EVENT'
  | 'EXPORT'
  | string;

export interface RetentionPolicyItem {
  id?: string;
  category: RetentionCategory;
  retentionDays: number | null;
  legalHoldEnabled: boolean;
  active: boolean;
  version?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface RetentionCandidateRow {
  id: string;
  category: RetentionCategory;
  caseId?: string | null;
  createdAt: Date;
  referenceDate?: Date; // e.g. closedAt or submittedAt
  metadata?: Record<string, unknown>;
}

export interface RetentionReviewFlag {
  id: string;
  rowId: string;
  category: RetentionCategory;
  caseId?: string | null;
  ageDays: number;
  retentionDays: number;
  cutoffDate: Date;
  flaggedAt: Date;
  reason: string;
  reviewStatus: 'PENDING_REVIEW' | 'REVIEWED' | 'DISMISSED';
}

export type RetentionPolicyEvaluationStatus =
  | 'SKIPPED_LEGAL_HOLD'
  | 'SKIPPED_INACTIVE'
  | 'SKIPPED_INDEFINITE'
  | 'EVALUATED';

export interface RetentionEvaluationSummary {
  category: RetentionCategory;
  legalHold: boolean;
  active: boolean;
  retentionDays: number | null;
  status: RetentionPolicyEvaluationStatus;
  totalChecked: number;
  flaggedCount: number;
  deletedCount: 0; // Strict pilot constraint: always 0 (no hard deletes)
  flaggedItems: RetentionReviewFlag[];
}

export interface RetentionBatchResult {
  processedCategories: number;
  totalRowsChecked: number;
  totalFlaggedForReview: number;
  totalDeleted: 0;
  policies: RetentionEvaluationSummary[];
  evaluatedAt: Date;
}

export interface RetentionRepository {
  getPolicies(): Promise<RetentionPolicyItem[]>;
  getPolicyByCategory(category: RetentionCategory): Promise<RetentionPolicyItem | null>;
  findCandidates(category: RetentionCategory, limit?: number): Promise<RetentionCandidateRow[]>;
  softFlagForReview(flag: RetentionReviewFlag): Promise<void>;
  getFlaggedReviews(): Promise<RetentionReviewFlag[]>;
}

/**
 * Standard BIZ-008 Baseline Policy Configurations.
 */
export const BIZ_008_RETENTION_STANDARDS: Record<string, { days: number | null; defaultHold: boolean }> = {
  CASE_RECORD: { days: 7 * 365, defaultHold: true }, // 2555 days (7 years)
  ASSESSOR_EVIDENCE: { days: 3 * 365, defaultHold: true }, // 1095 days (3 years)
  ACCESS_LOG: { days: 365, defaultHold: true }, // 365 days (1 year)
  AUDIT_EVENT: { days: 7 * 365, defaultHold: true }, // 2555 days (indefinite, review for anonymization after 7yr)
  EXPORT: { days: 90, defaultHold: true }, // 90 days
};
