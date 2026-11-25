import { describe, expect, it, vi } from 'vitest';
import { PrismaCasesRepository } from './prisma-cases.repository';

function fakePrisma() {
  const groupBy = vi.fn(async () => []);
  const prisma = {
    organization: { findFirst: async () => ({ id: 'org-1', code: 'X', name: 'X' }) },
    assessmentCase: { groupBy },
    task: { findMany: async () => [] },
    developmentPlan: { findMany: async () => [] },
    governancePolicy: { findUnique: async () => null },
    auditEvent: { create: async () => ({}) },
  };
  return { prisma, groupBy };
}

describe('PrismaCasesRepository overview cache', () => {
  it('serves repeated overview requests from cache', async () => {
    const { prisma, groupBy } = fakePrisma();
    const repository = new PrismaCasesRepository(prisma as never);
    await repository.getOverview();
    const callsAfterFirst = groupBy.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);
    await repository.getOverview();
    expect(groupBy.mock.calls.length).toBe(callsAfterFirst);
  });

  it('recomputes after a write through the repository', async () => {
    const { prisma, groupBy } = fakePrisma();
    const repository = new PrismaCasesRepository(prisma as never);
    await repository.getOverview();
    const callsAfterFirst = groupBy.mock.calls.length;
    // Any audited write bumps the version.
    (repository as unknown as { auditData: (...args: string[]) => unknown }).auditData(
      'case-1',
      'TEST',
      'AssessmentCase',
      'case-1',
      'reason',
    );
    await repository.getOverview();
    expect(groupBy.mock.calls.length).toBeGreaterThan(callsAfterFirst);
  });
});
