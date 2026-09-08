import { describe, expect, it } from 'vitest';
import { actorStorage, getActorContext, runWithActor } from './actor.context';
import { AuthActor, DEFAULT_STUB_ACTOR } from './auth.types';
import { CasesService } from '../cases/cases.service';
import { PrismaCasesRepository } from '../cases/prisma-cases.repository';

describe('Actor Propagation & Context Threading', () => {
  const verifiedActor: AuthActor = {
    id: 'entra-usr-99',
    name: 'Elena Rostova',
    roles: ['HR', 'Requester'],
  };

  it('provides verified actor inside runWithActor scope', () => {
    runWithActor(verifiedActor, () => {
      const active = getActorContext();
      expect(active.id).toBe('entra-usr-99');
      expect(active.name).toBe('Elena Rostova');
      expect(active.roles).toEqual(['HR', 'Requester']);
    });
  });

  it('falls back to demo-user outside of active context', () => {
    const fallback = getActorContext();
    expect(fallback).toEqual(DEFAULT_STUB_ACTOR);
    expect(fallback.id).toBe('demo-user');
    expect(fallback.name).toBe('Demo user');
  });

  it('propagates actor into CasesService memory activity log', async () => {
    const service = new CasesService();

    let createdCaseId = '';
    await runWithActor(verifiedActor, async () => {
      const created = await service.create({
        employeeId: 'emp-prop-1',
        employeeName: 'Candidate One',
        department: 'Operations',
        currentRole: 'Analyst',
        assessmentReason: 'PROMOTION',
        targetRole: 'Senior Analyst',
        targetLevel: 'L4',
        justification: 'Testing actor propagation in memory activity log.',
        priority: 'NORMAL',
      });

      createdCaseId = created.id;
      const initialActivity = created.activity[0];
      expect(initialActivity?.actor).toBe('Elena Rostova');
    });

    // Submitting under a different actor updates activity log accordingly
    const assessorActor: AuthActor = {
      id: 'assessor-42',
      name: 'Dr. Marcus Vance',
      roles: ['Assessor'],
    };

    await runWithActor(assessorActor, async () => {
      const submitted = await service.submit(createdCaseId, 1);
      const latestActivity = submitted.activity[0];
      expect(latestActivity?.actor).toBe('Dr. Marcus Vance');
    });
  });

  it('propagates actor into PrismaCasesRepository audit data with fallback', () => {
    // Mock minimal PrismaService
    const mockPrisma = {
      enabled: false,
    } as any;

    const repo = new PrismaCasesRepository(mockPrisma);

    // Call private auditData via reflection to verify data assembly
    const auditDataMethod = (repo as any).auditData.bind(repo);

    // Inside actor context
    runWithActor(verifiedActor, () => {
      const audit = auditDataMethod(
        'case-123',
        'TEST_ACTION',
        'AssessmentCase',
        'case-123',
        'Test reason',
      );

      expect(audit.actorId).toBe('entra-usr-99');
      expect(audit.actorName).toBe('Elena Rostova');
    });

    // Outside actor context (fallback to demo-user)
    const fallbackAudit = auditDataMethod(
      'case-123',
      'TEST_ACTION',
      'AssessmentCase',
      'case-123',
      'Test reason',
    );

    expect(fallbackAudit.actorId).toBe('demo-user');
    expect(fallbackAudit.actorName).toBe('Demo user');
  });
});
