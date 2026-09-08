import { describe, expect, it } from 'vitest';
import { actionsForStatus } from './workflow-actions';
import { CasesService } from './cases.service';

describe('CasesService', () => {
  it('seeds a usable first vertical slice', async () => {
    const service = new CasesService();
    const cases = await service.list({});

    expect(cases).toHaveLength(3);
    expect(cases.some((item) => item.status === 'PENDING_ELIGIBILITY')).toBe(true);
  });

  it('rejects a stale submit version', async () => {
    const service = new CasesService();
    const draft = await service.create({
      employeeId: 'emp-test',
      employeeName: 'Test Employee',
      department: 'Testing',
      currentRole: 'Specialist',
      assessmentReason: 'PROMOTION',
      targetRole: 'Lead',
      targetLevel: 'L4',
      justification: 'A deliberately complete test request for concurrency behavior.',
      priority: 'NORMAL',
    });

    await expect(Promise.resolve().then(() => service.submit(draft.id, 999))).rejects.toThrow();
  });

  it('walks the full workflow to closure in demo mode', async () => {
    const service = new CasesService();
    const draft = await service.create({
      employeeId: 'emp-journey',
      employeeName: 'Journey Employee',
      department: 'Testing',
      currentRole: 'Specialist',
      assessmentReason: 'PROMOTION',
      targetRole: 'Lead',
      targetLevel: 'L4',
      justification: 'A deliberately complete test request for the full workflow.',
      priority: 'NORMAL',
    });

    let current = await service.submit(draft.id, 1);
    expect(current.status).toBe('PENDING_ELIGIBILITY');
    current = await service.decideEligibility(current.id, {
      decision: 'ELIGIBLE',
      expectedVersion: current.version,
    });
    expect(current.status).toBe('READY_FOR_PLANNING');
    current = await service.finalizePlan(current.id, {
      methods: [{ methodCode: 'CBI', required: true }],
      expectedVersion: current.version,
    });
    expect(current.status).toBe('PLANNING');
    const scheduled = await service.scheduleEvent(current.id, {
      startsAt: new Date(Date.now() + 86_400_000).toISOString(),
      expectedVersion: current.version,
    });
    expect(scheduled.status).toBe('SCHEDULED');
    const evidence = await service.saveEvidence(
      scheduled.eventId,
      { id: 'assessor-1', name: 'Assessor One' },
      { summary: 'A sufficiently detailed evidence summary for testing.' },
      true,
    );
    expect(evidence.status).toBe('IN_PROGRESS');
    current = await service.finalizeResult(evidence.id, {
      resultCode: 'READY_NOW',
      expectedVersion: evidence.version,
    });
    expect(current.status).toBe('RESULT_FINALIZED');
    current = await service.submitRecommendation(current.id, {
      code: 'PROMOTE',
      rationale: 'A sufficiently detailed recommendation rationale for testing.',
      requiresDevelopment: false,
      requiresReassessment: false,
      expectedVersion: current.version,
    });
    expect(current.status).toBe('PENDING_APPROVAL');
    const steps = (await service.listApprovalSteps(current.id)) as Array<{ id: string }>;
    expect(steps).toHaveLength(2);
    const firstStep = steps[0];
    const secondStep = steps[1];
    if (!firstStep || !secondStep) throw new Error('Expected two approval steps.');
    let decided = await service.decideApproval(firstStep.id, { decision: 'APPROVED' });
    expect(decided.status).toBe('PENDING_APPROVAL');
    decided = await service.decideApproval(secondStep.id, { decision: 'APPROVED' });
    expect(decided.status).toBe('APPROVED');
    current = await service.updateDevelopment(decided.id, { expectedVersion: decided.version });
    expect(current.status).toBe('DEVELOPMENT_IN_PROGRESS');
    current = await service.closeCase(current.id, { expectedVersion: current.version });
    expect(current.status).toBe('CLOSED');
  });

  it('rejects closing a non-approved case', async () => {
    const service = new CasesService();
    const draft = await service.create({
      employeeId: 'emp-close',
      employeeName: 'Close Employee',
      department: 'Testing',
      currentRole: 'Specialist',
      assessmentReason: 'PROMOTION',
      targetRole: 'Lead',
      targetLevel: 'L4',
      justification: 'A deliberately complete test request for invalid closure.',
      priority: 'NORMAL',
    });

    await expect(
      Promise.resolve().then(() => service.closeCase(draft.id, { expectedVersion: draft.version })),
    ).rejects.toThrow();
  });
});

describe('actionsForStatus', () => {
  it('exposes a primary command for every active workflow status', () => {
    for (const status of [
      'DRAFT',
      'PENDING_ELIGIBILITY',
      'READY_FOR_PLANNING',
      'PLANNING',
      'SCHEDULED',
      'IN_PROGRESS',
      'RESULT_FINALIZED',
      'PENDING_APPROVAL',
      'APPROVED',
      'DEVELOPMENT_IN_PROGRESS',
    ] as const) {
      const actions = actionsForStatus(status);
      expect(actions.some((action) => action.kind === 'primary')).toBe(true);
    }
    // NOT_ELIGIBLE intentionally offers only a confirmation-gated secondary override.
    expect(
      actionsForStatus('NOT_ELIGIBLE').some((action) => action.code === 'REQUEST_OVERRIDE'),
    ).toBe(true);
  });
});
