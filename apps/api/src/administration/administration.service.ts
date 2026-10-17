import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@assessflow/database';
import { randomUUID } from 'node:crypto';
import type { AuthActor } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import {
  AccessAccountsService,
  type AdminAccessAccountInput,
  type AccessAccountInput,
} from '../access/access-accounts.service';

export interface AdministrationPolicy {
  version: string;
  cbiWeight: number;
  caseStudyWeight: number;
  simulationWeight: number;
  passingScore: number;
  blindGrading: boolean;
  autoEscalate: boolean;
  slaWindows: {
    eligibilityHours: number;
    assessorHours: number;
    committeeHours: number;
  };
  updatedAt?: string | null;
}

const DEFAULT_POLICY: AdministrationPolicy = {
  version: 'v2026.1',
  cbiWeight: 40,
  caseStudyWeight: 35,
  simulationWeight: 25,
  passingScore: 75,
  blindGrading: true,
  autoEscalate: true,
  slaWindows: { eligibilityHours: 48, assessorHours: 120, committeeHours: 72 },
  updatedAt: null,
};

@Injectable()
export class AdministrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: AccessAccountsService,
  ) {}

  async listAccounts() {
    return this.accounts.list({ id: 'admin', name: 'Admin', roles: ['Admin'] });
  }

  createAccount(input: AdminAccessAccountInput, actor: AuthActor) {
    return this.accounts.adminCreate(input, actor);
  }

  updateAccount(id: string, input: Partial<AccessAccountInput>, actor: AuthActor) {
    return this.accounts.adminUpdate(id, input, actor);
  }

  deactivateAccount(id: string, actor: AuthActor) {
    return this.accounts.adminDeactivate(id, actor);
  }

  resetAccountPassword(id: string, actor: AuthActor) {
    return this.accounts.adminResetPassword(id, actor);
  }

  async getPolicy(): Promise<AdministrationPolicy> {
    if (!this.prisma.enabled)
      return { ...DEFAULT_POLICY, slaWindows: { ...DEFAULT_POLICY.slaWindows } };
    const stored = await this.prisma.governancePolicy.findUnique({ where: { id: 'default' } });
    if (!stored) return { ...DEFAULT_POLICY, slaWindows: { ...DEFAULT_POLICY.slaWindows } };
    return {
      ...(stored.settings as unknown as Omit<AdministrationPolicy, 'version' | 'updatedAt'>),
      version: stored.version,
      updatedAt: stored.updatedAt.toISOString(),
    };
  }

  async enforcePolicy(
    input: { policy?: AdministrationPolicy; reason?: string },
    actor: AuthActor,
  ): Promise<AdministrationPolicy> {
    if (!this.prisma.enabled)
      throw new ServiceUnavailableException('Policy storage is not available.');
    const next = input?.policy;
    this.validatePolicy(next);
    const reason = input.reason?.trim() || null;
    if (reason && reason.length > 2000)
      throw new BadRequestException('Change note cannot exceed 2,000 characters.');
    const previous = await this.getPolicy();
    const version = this.nextVersion(previous.version);
    const { version: _version, updatedAt: _updatedAt, ...settings } = next;
    const settingsJson = JSON.parse(JSON.stringify(settings)) as Prisma.InputJsonValue;
    const savedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.governancePolicy.upsert({
        where: { id: 'default' },
        create: { id: 'default', version, settings: settingsJson, updatedBy: actor.id },
        update: { version, settings: settingsJson, updatedBy: actor.id },
      });
      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          actorName: actor.name,
          action: 'ADMIN_POLICY_ENFORCED',
          entityType: 'GOVERNANCE_POLICY',
          entityId: 'default',
          reason,
          previousData: JSON.parse(JSON.stringify(previous)) as Prisma.InputJsonValue,
          newData: JSON.parse(JSON.stringify({ ...settings, version })) as Prisma.InputJsonValue,
          correlationId: `corr-${randomUUID()}`,
        },
      });
    });
    return { ...settings, version, updatedAt: savedAt.toISOString() };
  }

  async listAudit(input: {
    search?: string;
    action?: string;
    from?: string;
    to?: string;
    page?: string;
    pageSize?: string;
  }) {
    if (!this.prisma.enabled)
      throw new ServiceUnavailableException('Audit storage is not available.');
    const page = Math.max(1, Number.parseInt(input.page ?? '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(input.pageSize ?? '10', 10) || 10));
    const createdAt: { gte?: Date; lte?: Date } = {};
    if (input.from) {
      const from = new Date(input.from);
      if (Number.isNaN(from.getTime())) throw new BadRequestException('Invalid audit start date.');
      createdAt.gte = from;
    }
    if (input.to) {
      const to = new Date(input.to);
      if (Number.isNaN(to.getTime())) throw new BadRequestException('Invalid audit end date.');
      to.setHours(23, 59, 59, 999);
      createdAt.lte = to;
    }
    const where: Prisma.AuditEventWhereInput = {
      ...(input.action ? { action: input.action } : {}),
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
      ...(input.search?.trim()
        ? {
            OR: [
              { actorName: { contains: input.search.trim(), mode: 'insensitive' } },
              { action: { contains: input.search.trim(), mode: 'insensitive' } },
              { entityType: { contains: input.search.trim(), mode: 'insensitive' } },
              { entityId: { contains: input.search.trim(), mode: 'insensitive' } },
              { reason: { contains: input.search.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, records] = await this.prisma.$transaction([
      this.prisma.auditEvent.count({ where }),
      this.prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          createdAt: true,
          actorName: true,
          action: true,
          entityType: true,
          entityId: true,
          reason: true,
        },
      }),
    ]);
    return {
      items: records.map((event) => ({
        id: event.id,
        timestamp: event.createdAt.toISOString(),
        actor: event.actorName,
        action: event.action,
        target: `${event.entityType} · ${event.entityId}`,
        reason: event.reason,
        hash: null,
        integrity: 'Not verified' as const,
      })),
      total,
      page,
      pageSize,
    };
  }

  private validatePolicy(policy?: AdministrationPolicy): asserts policy is AdministrationPolicy {
    if (!policy || !policy.slaWindows)
      throw new BadRequestException('A complete policy is required.');
    const weights = [policy.cbiWeight, policy.caseStudyWeight, policy.simulationWeight];
    if (
      weights.some((value) => !Number.isFinite(value) || value < 0 || value > 100) ||
      weights.reduce((sum, value) => sum + value, 0) !== 100
    ) {
      throw new BadRequestException(
        'Scoring weights must be between 0% and 100% and total exactly 100%.',
      );
    }
    if (
      !Number.isFinite(policy.passingScore) ||
      policy.passingScore < 0 ||
      policy.passingScore > 100
    ) {
      throw new BadRequestException('Minimum passing score must be between 0% and 100%.');
    }
    const windows = Object.values(policy.slaWindows);
    if (windows.length !== 3 || windows.some((value) => !Number.isFinite(value) || value < 1)) {
      throw new BadRequestException('Every SLA window must be at least 1 hour.');
    }
    if (typeof policy.blindGrading !== 'boolean' || typeof policy.autoEscalate !== 'boolean') {
      throw new BadRequestException('Safeguard values must be true or false.');
    }
  }

  private nextVersion(current: string): string {
    const match = current.match(/^(.*?)(\d+)$/);
    if (!match) return `${current}.1`;
    return `${match[1]}${Number(match[2]) + 1}`;
  }
}
