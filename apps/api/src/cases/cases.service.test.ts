import { describe, expect, it } from 'vitest';
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
});
