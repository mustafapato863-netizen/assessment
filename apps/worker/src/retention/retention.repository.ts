import type { PrismaClient } from '@assessflow/database';
import type {
  RetentionCandidateRow,
  RetentionCategory,
  RetentionPolicyItem,
  RetentionRepository,
  RetentionReviewFlag,
} from './retention.interface';

export class InMemoryRetentionRepository implements RetentionRepository {
  private policies: Map<string, RetentionPolicyItem> = new Map();
  private candidateRows: Map<string, RetentionCandidateRow[]> = new Map();
  private flaggedReviews: RetentionReviewFlag[] = [];

  constructor(
    initialPolicies: RetentionPolicyItem[] = [],
    initialCandidates: Record<string, RetentionCandidateRow[]> = {},
  ) {
    for (const p of initialPolicies) {
      this.policies.set(p.category, p);
    }
    for (const [cat, rows] of Object.entries(initialCandidates)) {
      this.candidateRows.set(cat, [...rows]);
    }
  }

  setPolicy(policy: RetentionPolicyItem): void {
    this.policies.set(policy.category, policy);
  }

  addCandidate(row: RetentionCandidateRow): void {
    const list = this.candidateRows.get(row.category) ?? [];
    list.push(row);
    this.candidateRows.set(row.category, list);
  }

  async getPolicies(): Promise<RetentionPolicyItem[]> {
    return [...this.policies.values()];
  }

  async getPolicyByCategory(category: RetentionCategory): Promise<RetentionPolicyItem | null> {
    return this.policies.get(category) ?? null;
  }

  async findCandidates(category: RetentionCategory, limit = 100): Promise<RetentionCandidateRow[]> {
    const rows = this.candidateRows.get(category) ?? [];
    return rows.slice(0, limit);
  }

  async softFlagForReview(flag: RetentionReviewFlag): Promise<void> {
    this.flaggedReviews.push(flag);
  }

  async getFlaggedReviews(): Promise<RetentionReviewFlag[]> {
    return [...this.flaggedReviews];
  }
}

export class PrismaRetentionRepository implements RetentionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getPolicies(): Promise<RetentionPolicyItem[]> {
    const dbPolicies = await this.prisma.retentionPolicy.findMany({
      orderBy: { category: 'asc' },
    });
    return dbPolicies.map((p) => ({
      id: p.id,
      category: p.category,
      retentionDays: p.retentionDays,
      legalHoldEnabled: p.legalHoldEnabled,
      active: p.active,
      version: p.version,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  }

  async getPolicyByCategory(category: RetentionCategory): Promise<RetentionPolicyItem | null> {
    const p = await this.prisma.retentionPolicy.findUnique({ where: { category } });
    if (!p) return null;
    return {
      id: p.id,
      category: p.category,
      retentionDays: p.retentionDays,
      legalHoldEnabled: p.legalHoldEnabled,
      active: p.active,
      version: p.version,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  async findCandidates(category: RetentionCategory, limit = 100): Promise<RetentionCandidateRow[]> {
    if (category === 'CASE_RECORD') {
      const cases = await this.prisma.assessmentCase.findMany({
        take: limit,
        orderBy: { createdAt: 'asc' },
        select: { id: true, createdAt: true, closedAt: true },
      });
      return cases.map((c) => ({
        id: c.id,
        category: 'CASE_RECORD',
        caseId: c.id,
        createdAt: c.createdAt,
        referenceDate: c.closedAt ?? c.createdAt,
      }));
    }

    if (category === 'ASSESSOR_EVIDENCE') {
      const evidence = await this.prisma.evidenceSubmission.findMany({
        take: limit,
        orderBy: { createdAt: 'asc' },
        select: { id: true, caseId: true, createdAt: true, submittedAt: true },
      });
      return evidence.map((e) => ({
        id: e.id,
        category: 'ASSESSOR_EVIDENCE',
        caseId: e.caseId,
        createdAt: e.createdAt,
        referenceDate: e.submittedAt ?? e.createdAt,
      }));
    }

    if (category === 'ACCESS_LOG') {
      const logs = await this.prisma.accessLog.findMany({
        take: limit,
        orderBy: { createdAt: 'asc' },
        select: { id: true, caseId: true, createdAt: true },
      });
      return logs.map((l) => ({
        id: l.id,
        category: 'ACCESS_LOG',
        caseId: l.caseId,
        createdAt: l.createdAt,
      }));
    }

    if (category === 'AUDIT_EVENT') {
      const audits = await this.prisma.auditEvent.findMany({
        take: limit,
        orderBy: { createdAt: 'asc' },
        select: { id: true, caseId: true, createdAt: true },
      });
      return audits.map((a) => ({
        id: a.id,
        category: 'AUDIT_EVENT',
        caseId: a.caseId,
        createdAt: a.createdAt,
      }));
    }

    return [];
  }

  async softFlagForReview(flag: RetentionReviewFlag): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        actorId: 'system-retention-worker',
        actorName: 'Retention Enforcement Worker',
        action: 'RETENTION_FLAGGED_FOR_REVIEW',
        entityType: flag.category,
        entityId: flag.rowId,
        caseId: flag.caseId ?? undefined,
        reason: flag.reason,
        correlationId: `corr-retention-${flag.rowId}`,
        newData: {
          flagId: flag.id,
          ageDays: flag.ageDays,
          retentionDays: flag.retentionDays,
          cutoffDate: flag.cutoffDate.toISOString(),
          flaggedAt: flag.flaggedAt.toISOString(),
          pilotRule: 'NO_HARD_DELETES_HOLD_FIRST',
        },
      },
    });

    if (flag.caseId) {
      await this.prisma.task.create({
        data: {
          caseId: flag.caseId,
          assigneeId: 'hr-legal-governance',
          assigneeName: 'HR Governance Reviewer',
          taskType: 'RETENTION_REVIEW',
          dueAt: new Date(Date.now() + 14 * 86_400_000),
        },
      });
    }
  }

  async getFlaggedReviews(): Promise<RetentionReviewFlag[]> {
    const events = await this.prisma.auditEvent.findMany({
      where: { action: 'RETENTION_FLAGGED_FOR_REVIEW' },
      take: 100,
      orderBy: { createdAt: 'desc' },
    });
    return events.map((ev) => {
      const data = (ev.newData ?? {}) as Record<string, unknown>;
      return {
        id: (data.flagId as string) ?? ev.id,
        rowId: ev.entityId,
        category: ev.entityType,
        caseId: ev.caseId,
        ageDays: Number(data.ageDays ?? 0),
        retentionDays: Number(data.retentionDays ?? 0),
        cutoffDate: new Date((data.cutoffDate as string) ?? ev.createdAt),
        flaggedAt: ev.createdAt,
        reason: ev.reason ?? 'Retention review required',
        reviewStatus: 'PENDING_REVIEW',
      };
    });
  }
}
