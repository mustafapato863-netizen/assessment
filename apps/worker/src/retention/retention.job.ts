import type {
  RetentionBatchResult,
  RetentionEvaluationSummary,
  RetentionRepository,
} from './retention.interface';
import { evaluateCategoryPolicy } from './retention-math';

export class RetentionJobProcessor {
  constructor(private readonly repository: RetentionRepository) {}

  async processRetentionEnforcement(options?: {
    now?: Date;
    limitPerCategory?: number;
  }): Promise<RetentionBatchResult> {
    const now = options?.now ?? new Date();
    const limit = options?.limitPerCategory ?? 100;
    const policies = await this.repository.getPolicies();

    const summaries: RetentionEvaluationSummary[] = [];
    let totalRowsChecked = 0;
    let totalFlaggedForReview = 0;

    for (const policy of policies) {
      let rows: any[] = [];
      // Hold-first check: if legal hold is enabled or inactive, avoid unnecessary DB queries
      if (!policy.legalHoldEnabled && policy.active && policy.retentionDays && policy.retentionDays > 0) {
        rows = await this.repository.findCandidates(policy.category, limit);
      }

      const summary = evaluateCategoryPolicy(policy, rows, now);
      summaries.push(summary);
      totalRowsChecked += summary.totalChecked;
      totalFlaggedForReview += summary.flaggedCount;

      // Soft-flag each identified row (no hard deletes)
      for (const flag of summary.flaggedItems) {
        await this.repository.softFlagForReview(flag);
      }
    }

    const batchResult: RetentionBatchResult = {
      processedCategories: policies.length,
      totalRowsChecked,
      totalFlaggedForReview,
      totalDeleted: 0, // Strict invariant: 0 deletes in pilot
      policies: summaries,
      evaluatedAt: now,
    };

    console.info(
      JSON.stringify({
        service: 'assessflow-worker',
        event: 'retention-enforcement-batch',
        categoriesProcessed: batchResult.processedCategories,
        totalChecked: batchResult.totalRowsChecked,
        flaggedForReview: batchResult.totalFlaggedForReview,
        hardDeletes: 0,
        holdFirstEnforced: true,
        evaluatedAt: now.toISOString(),
      }),
    );

    return batchResult;
  }
}
