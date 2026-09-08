import { describe, expect, it } from 'vitest';
import {
  calculateAgeInDays,
  calculateCutoffDate,
  evaluateCategoryPolicy,
  isRowExpired,
  MS_PER_DAY,
} from './retention-math';
import { InMemoryRetentionRepository } from './retention.repository';
import { RetentionJobProcessor } from './retention.job';
import type {
  RetentionCandidateRow,
  RetentionPolicyItem,
} from './retention.interface';

describe('Retention Policy Math & Hold-First Enforcement', () => {
  // Fixed evaluation timestamp for deterministic mathematical assertions
  const FIXED_NOW = new Date('2026-09-05T00:00:00.000Z');

  describe('Core Math & Cutoff Calculations', () => {
    it('calculates correct cutoff date for 7 years (2555 days)', () => {
      const days = 7 * 365; // 2555 days
      const cutoff = calculateCutoffDate(FIXED_NOW, days);
      const expectedCutoff = new Date(FIXED_NOW.getTime() - 2555 * MS_PER_DAY);

      expect(cutoff.toISOString()).toBe(expectedCutoff.toISOString());
      expect(calculateAgeInDays(cutoff, FIXED_NOW)).toBe(2555);
    });

    it('calculates correct cutoff date for 3 years (1095 days)', () => {
      const days = 3 * 365; // 1095 days
      const cutoff = calculateCutoffDate(FIXED_NOW, days);
      const expectedCutoff = new Date(FIXED_NOW.getTime() - 1095 * MS_PER_DAY);

      expect(cutoff.toISOString()).toBe(expectedCutoff.toISOString());
      expect(calculateAgeInDays(cutoff, FIXED_NOW)).toBe(1095);
    });

    it('calculates correct cutoff date for 1 year (365 days)', () => {
      const cutoff = calculateCutoffDate(FIXED_NOW, 365);
      const expectedCutoff = new Date(FIXED_NOW.getTime() - 365 * MS_PER_DAY);

      expect(cutoff.toISOString()).toBe(expectedCutoff.toISOString());
      expect(calculateAgeInDays(cutoff, FIXED_NOW)).toBe(365);
    });

    it('calculates correct cutoff date for 90 days (exports)', () => {
      const cutoff = calculateCutoffDate(FIXED_NOW, 90);
      const expectedCutoff = new Date(FIXED_NOW.getTime() - 90 * MS_PER_DAY);

      expect(cutoff.toISOString()).toBe(expectedCutoff.toISOString());
      expect(calculateAgeInDays(cutoff, FIXED_NOW)).toBe(90);
    });

    it('accurately identifies row expiration boundaries', () => {
      const retentionDays = 365;
      const cutoff = calculateCutoffDate(FIXED_NOW, retentionDays);

      // 1 ms before cutoff -> expired
      const expiredDate = new Date(cutoff.getTime() - 1);
      expect(isRowExpired(expiredDate, retentionDays, FIXED_NOW)).toBe(true);

      // exactly at cutoff -> not expired (strictly less than cutoff)
      const exactCutoffDate = new Date(cutoff.getTime());
      expect(isRowExpired(exactCutoffDate, retentionDays, FIXED_NOW)).toBe(false);

      // 1 ms after cutoff (younger) -> not expired
      const freshDate = new Date(cutoff.getTime() + 1);
      expect(isRowExpired(freshDate, retentionDays, FIXED_NOW)).toBe(false);
    });
  });

  describe('BIZ-008 Category Verification with Fixed Dates', () => {
    it('Cases: 7-year retention (2555 days)', () => {
      const policy: RetentionPolicyItem = {
        category: 'CASE_RECORD',
        retentionDays: 2555,
        legalHoldEnabled: false,
        active: true,
      };

      const case6YearsOld: RetentionCandidateRow = {
        id: 'case-6yr',
        category: 'CASE_RECORD',
        createdAt: new Date(FIXED_NOW.getTime() - 6 * 365 * MS_PER_DAY),
      };

      const case7Years1DayOld: RetentionCandidateRow = {
        id: 'case-7yr-plus',
        category: 'CASE_RECORD',
        createdAt: new Date(FIXED_NOW.getTime() - (7 * 365 + 1) * MS_PER_DAY),
      };

      const result = evaluateCategoryPolicy(policy, [case6YearsOld, case7Years1DayOld], FIXED_NOW);

      expect(result.status).toBe('EVALUATED');
      expect(result.totalChecked).toBe(2);
      expect(result.flaggedCount).toBe(1);
      expect(result.deletedCount).toBe(0); // Zero hard deletes
      expect(result.flaggedItems[0]!.rowId).toBe('case-7yr-plus');
      expect(result.flaggedItems[0]!.ageDays).toBe(2556);
      expect(result.flaggedItems[0]!.reviewStatus).toBe('PENDING_REVIEW');
    });

    it('Evidence: 3-year retention (1095 days)', () => {
      const policy: RetentionPolicyItem = {
        category: 'ASSESSOR_EVIDENCE',
        retentionDays: 1095,
        legalHoldEnabled: false,
        active: true,
      };

      const evidence2YearsOld: RetentionCandidateRow = {
        id: 'ev-2yr',
        category: 'ASSESSOR_EVIDENCE',
        createdAt: new Date(FIXED_NOW.getTime() - 2 * 365 * MS_PER_DAY),
      };

      const evidence3Years1DayOld: RetentionCandidateRow = {
        id: 'ev-3yr-plus',
        category: 'ASSESSOR_EVIDENCE',
        createdAt: new Date(FIXED_NOW.getTime() - (3 * 365 + 1) * MS_PER_DAY),
      };

      const result = evaluateCategoryPolicy(
        policy,
        [evidence2YearsOld, evidence3Years1DayOld],
        FIXED_NOW,
      );

      expect(result.status).toBe('EVALUATED');
      expect(result.totalChecked).toBe(2);
      expect(result.flaggedCount).toBe(1);
      expect(result.deletedCount).toBe(0);
      expect(result.flaggedItems[0]!.rowId).toBe('ev-3yr-plus');
      expect(result.flaggedItems[0]!.ageDays).toBe(1096);
    });

    it('Logs: 1-year retention (365 days)', () => {
      const policy: RetentionPolicyItem = {
        category: 'ACCESS_LOG',
        retentionDays: 365,
        legalHoldEnabled: false,
        active: true,
      };

      const log300DaysOld: RetentionCandidateRow = {
        id: 'log-300d',
        category: 'ACCESS_LOG',
        createdAt: new Date(FIXED_NOW.getTime() - 300 * MS_PER_DAY),
      };

      const log366DaysOld: RetentionCandidateRow = {
        id: 'log-366d',
        category: 'ACCESS_LOG',
        createdAt: new Date(FIXED_NOW.getTime() - 366 * MS_PER_DAY),
      };

      const result = evaluateCategoryPolicy(policy, [log300DaysOld, log366DaysOld], FIXED_NOW);

      expect(result.status).toBe('EVALUATED');
      expect(result.totalChecked).toBe(2);
      expect(result.flaggedCount).toBe(1);
      expect(result.deletedCount).toBe(0);
      expect(result.flaggedItems[0]!.rowId).toBe('log-366d');
      expect(result.flaggedItems[0]!.ageDays).toBe(366);
    });

    it('Audit: Indefinite retention (retentionDays = null) skips expiration checks', () => {
      const policy: RetentionPolicyItem = {
        category: 'AUDIT_EVENT',
        retentionDays: null, // Indefinite
        legalHoldEnabled: false,
        active: true,
      };

      const oldAuditRow: RetentionCandidateRow = {
        id: 'audit-old',
        category: 'AUDIT_EVENT',
        createdAt: new Date(FIXED_NOW.getTime() - 3000 * MS_PER_DAY),
      };

      const result = evaluateCategoryPolicy(policy, [oldAuditRow], FIXED_NOW);

      expect(result.status).toBe('SKIPPED_INDEFINITE');
      expect(result.flaggedCount).toBe(0);
      expect(result.deletedCount).toBe(0);
    });

    it('Exports: 90-day retention', () => {
      const policy: RetentionPolicyItem = {
        category: 'EXPORT',
        retentionDays: 90,
        legalHoldEnabled: false,
        active: true,
      };

      const export89DaysOld: RetentionCandidateRow = {
        id: 'exp-89d',
        category: 'EXPORT',
        createdAt: new Date(FIXED_NOW.getTime() - 89 * MS_PER_DAY),
      };

      const export95DaysOld: RetentionCandidateRow = {
        id: 'exp-95d',
        category: 'EXPORT',
        createdAt: new Date(FIXED_NOW.getTime() - 95 * MS_PER_DAY),
      };

      const result = evaluateCategoryPolicy(policy, [export89DaysOld, export95DaysOld], FIXED_NOW);

      expect(result.status).toBe('EVALUATED');
      expect(result.totalChecked).toBe(2);
      expect(result.flaggedCount).toBe(1);
      expect(result.deletedCount).toBe(0);
      expect(result.flaggedItems[0]!.rowId).toBe('exp-95d');
    });
  });

  describe('Hold-First Enforcement (Rule: Hold supersedes all retention policies)', () => {
    it('SKIPS entire category under legal hold even if rows are 10 years old', () => {
      const policyWithHold: RetentionPolicyItem = {
        category: 'CASE_RECORD',
        retentionDays: 2555,
        legalHoldEnabled: true, // LEGAL HOLD ACTIVE
        active: true,
      };

      const ancientRow: RetentionCandidateRow = {
        id: 'case-ancient',
        category: 'CASE_RECORD',
        createdAt: new Date(FIXED_NOW.getTime() - 10 * 365 * MS_PER_DAY), // 10 years old
      };

      const result = evaluateCategoryPolicy(policyWithHold, [ancientRow], FIXED_NOW);

      expect(result.status).toBe('SKIPPED_LEGAL_HOLD');
      expect(result.legalHold).toBe(true);
      expect(result.totalChecked).toBe(0);
      expect(result.flaggedCount).toBe(0);
      expect(result.deletedCount).toBe(0);
      expect(result.flaggedItems).toHaveLength(0);
    });

    it('enforces hold-first across all standard categories when legalHoldEnabled=true', () => {
      const categories = ['CASE_RECORD', 'ASSESSOR_EVIDENCE', 'ACCESS_LOG', 'EXPORT'];

      for (const cat of categories) {
        const policy: RetentionPolicyItem = {
          category: cat,
          retentionDays: 30,
          legalHoldEnabled: true,
          active: true,
        };

        const row: RetentionCandidateRow = {
          id: `${cat}-old`,
          category: cat,
          createdAt: new Date(FIXED_NOW.getTime() - 1000 * MS_PER_DAY),
        };

        const result = evaluateCategoryPolicy(policy, [row], FIXED_NOW);
        expect(result.status).toBe('SKIPPED_LEGAL_HOLD');
        expect(result.flaggedCount).toBe(0);
        expect(result.deletedCount).toBe(0);
      }
    });
  });

  describe('Inactive Policies & Edge Cases', () => {
    it('skips inactive policies', () => {
      const inactivePolicy: RetentionPolicyItem = {
        category: 'CUSTOM_LOG',
        retentionDays: 30,
        legalHoldEnabled: false,
        active: false,
      };

      const oldRow: RetentionCandidateRow = {
        id: 'custom-old',
        category: 'CUSTOM_LOG',
        createdAt: new Date(FIXED_NOW.getTime() - 100 * MS_PER_DAY),
      };

      const result = evaluateCategoryPolicy(inactivePolicy, [oldRow], FIXED_NOW);
      expect(result.status).toBe('SKIPPED_INACTIVE');
      expect(result.flaggedCount).toBe(0);
      expect(result.deletedCount).toBe(0);
    });
  });

  describe('Full RetentionJobProcessor Workflow with In-Memory Repository', () => {
    it('runs batch enforcement, honors legal hold, soft-flags expired rows, and preserves 0 deletes', async () => {
      const policies: RetentionPolicyItem[] = [
        {
          category: 'CASE_RECORD',
          retentionDays: 2555,
          legalHoldEnabled: true, // Held: should be skipped
          active: true,
        },
        {
          category: 'ASSESSOR_EVIDENCE',
          retentionDays: 1095,
          legalHoldEnabled: false, // Not held: should be evaluated
          active: true,
        },
        {
          category: 'ACCESS_LOG',
          retentionDays: 365,
          legalHoldEnabled: false, // Not held: should be evaluated
          active: true,
        },
      ];

      const candidates: Record<string, RetentionCandidateRow[]> = {
        CASE_RECORD: [
          {
            id: 'case-10yr',
            category: 'CASE_RECORD',
            createdAt: new Date(FIXED_NOW.getTime() - 3650 * MS_PER_DAY),
          },
        ],
        ASSESSOR_EVIDENCE: [
          {
            id: 'ev-fresh',
            category: 'ASSESSOR_EVIDENCE',
            createdAt: new Date(FIXED_NOW.getTime() - 500 * MS_PER_DAY),
          },
          {
            id: 'ev-expired',
            category: 'ASSESSOR_EVIDENCE',
            createdAt: new Date(FIXED_NOW.getTime() - 1200 * MS_PER_DAY),
          },
        ],
        ACCESS_LOG: [
          {
            id: 'log-expired',
            category: 'ACCESS_LOG',
            createdAt: new Date(FIXED_NOW.getTime() - 400 * MS_PER_DAY),
          },
        ],
      };

      const repo = new InMemoryRetentionRepository(policies, candidates);
      const processor = new RetentionJobProcessor(repo);

      const batchResult = await processor.processRetentionEnforcement({ now: FIXED_NOW });

      expect(batchResult.processedCategories).toBe(3);
      expect(batchResult.totalDeleted).toBe(0); // Zero hard deletes invariant!

      // CASE_RECORD was held -> 0 flagged
      const caseSummary = batchResult.policies.find((p) => p.category === 'CASE_RECORD')!;
      expect(caseSummary.status).toBe('SKIPPED_LEGAL_HOLD');
      expect(caseSummary.flaggedCount).toBe(0);

      // ASSESSOR_EVIDENCE: 1 fresh, 1 expired -> 1 flagged
      const evSummary = batchResult.policies.find((p) => p.category === 'ASSESSOR_EVIDENCE')!;
      expect(evSummary.status).toBe('EVALUATED');
      expect(evSummary.totalChecked).toBe(2);
      expect(evSummary.flaggedCount).toBe(1);
      expect(evSummary.flaggedItems[0]!.rowId).toBe('ev-expired');

      // ACCESS_LOG: 1 expired -> 1 flagged
      const logSummary = batchResult.policies.find((p) => p.category === 'ACCESS_LOG')!;
      expect(logSummary.status).toBe('EVALUATED');
      expect(logSummary.totalChecked).toBe(1);
      expect(logSummary.flaggedCount).toBe(1);
      expect(logSummary.flaggedItems[0]!.rowId).toBe('log-expired');

      // Total flagged in batch
      expect(batchResult.totalFlaggedForReview).toBe(2);

      // Verify repository recorded review flags
      const storedFlags = await repo.getFlaggedReviews();
      expect(storedFlags).toHaveLength(2);
      expect(storedFlags.map((f) => f.rowId)).toEqual(['ev-expired', 'log-expired']);
      expect(storedFlags.every((f) => f.reviewStatus === 'PENDING_REVIEW')).toBe(true);
    });
  });
});
