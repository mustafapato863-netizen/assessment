import { NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { assertUuid, isUuid } from '../common/uuid.util';
import { AccessAccountsService, caseScopeWhere } from '../access/access-accounts.service';
import { AdministrationService } from '../administration/administration.service';
import { CasesService } from './cases.service';

describe('Phase 2 Hardening & Contracts', () => {
  it('validates strict UUIDs and throws NotFoundException instead of leaking Prisma P2023', () => {
    expect(isUuid('11111111-1111-4111-8111-111111111111')).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid('')).toBe(false);
    expect(() => assertUuid('not-a-uuid', 'Case')).toThrow(NotFoundException);
  });

  it('returns empty-set filter for NONE scope instead of invalid UUID literal', () => {
    const where = caseScopeWhere({
      id: 'user-1',
      name: 'Restricted',
      email: 'restricted@saudigerman.com',
      roles: ['Requester'],
      scopeType: 'NONE',
      scopeValues: [],
    });
    expect(where).toEqual({ id: { in: [] } });
  });

  it('lists development plans and clean attachment streams from CasesService memory mode', async () => {
    const service = new CasesService();
    const overview = (await service.getOverview()) as { navCounts?: { activeCases: number } };
    expect(overview.navCounts).toBeDefined();
    expect(typeof overview.navCounts?.activeCases).toBe('number');

    const devPlans = await service.listDevelopmentPlans();
    expect(Array.isArray(devPlans)).toBe(true);

    const listed = (await service.list({})) as Array<{ id: string }>;
    const firstCaseId = listed[0]?.id as string;
    expect(firstCaseId).toBeTruthy();

    const payload = Buffer.from('%PDF-1.4\nhello-clinical-evidence').toString('base64');
    const created = await service.createAttachment({
      caseId: firstCaseId,
      fileName: 'evidence-note.pdf',
      contentType: 'application/pdf',
      sizeBytes: 33,
      classification: 'EVIDENCE',
      contentBase64: payload,
    });
    expect(created.id).toBeTruthy();

    const attachments = await service.listAttachments(firstCaseId);
    expect(Array.isArray(attachments)).toBe(true);
    expect(attachments.some((att) => att.id === created.id)).toBe(true);
  });

  it('builds complete RBAC roles-matrix entries from AdministrationService', () => {
    const fakePrisma = { enabled: false } as never;
    const accountsService = new AccessAccountsService(fakePrisma);
    const adminService = new AdministrationService(fakePrisma, accountsService);
    const matrix = adminService.rolesMatrix();
    expect(matrix.length).toBeGreaterThanOrEqual(8);
    expect(matrix.some((entry) => entry.role === 'Admin')).toBe(true);
    expect(matrix.every((entry) => Array.isArray(entry.capabilities))).toBe(true);
  });
});
