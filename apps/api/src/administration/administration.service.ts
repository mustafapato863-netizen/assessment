import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@assessflow/database';
import { adminPolicyEnforceSchema } from '@assessflow/contracts';
import type { AuthActor } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { currentCorrelationId } from '../common/correlation.context';
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

const AUDIT_ACTIONS_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class AdministrationService {
  private auditActionsCache?: { at: number; actions: string[] };

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: AccessAccountsService,
  ) {}

  async listAccounts() {
    return this.accounts.list({ id: 'admin', name: 'Admin', roles: ['Admin'] });
  }

  rolesMatrix() {
    return this.accounts.getRolesMatrix();
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

  reactivateAccount(id: string, actor: AuthActor) {
    return this.accounts.adminReactivate(id, actor);
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

  async enforcePolicy(input: unknown, actor: AuthActor): Promise<AdministrationPolicy> {
    if (!this.prisma.enabled) {
      throw new ServiceUnavailableException('Policy storage is not available.');
    }
    const parsed = adminPolicyEnforceSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'A valid governance policy is required.',
      );
    }

    const { policy, reason: rawReason } = parsed.data;
    const reason = rawReason?.trim() || null;
    const settings = {
      cbiWeight: policy.cbiWeight,
      caseStudyWeight: policy.caseStudyWeight,
      simulationWeight: policy.simulationWeight,
      passingScore: policy.passingScore,
      blindGrading: policy.blindGrading,
      autoEscalate: policy.autoEscalate,
      slaWindows: {
        eligibilityHours: policy.slaWindows.eligibilityHours,
        assessorHours: policy.slaWindows.assessorHours,
        committeeHours: policy.slaWindows.committeeHours,
      },
    };
    const settingsJson = JSON.parse(JSON.stringify(settings)) as Prisma.InputJsonValue;
    const savedAt = new Date();

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.governancePolicy.findUnique({ where: { id: 'default' } });
      const previous: AdministrationPolicy = existing
        ? {
            ...(existing.settings as unknown as Omit<
              AdministrationPolicy,
              'version' | 'updatedAt'
            >),
            version: existing.version,
            updatedAt: existing.updatedAt.toISOString(),
          }
        : { ...DEFAULT_POLICY, slaWindows: { ...DEFAULT_POLICY.slaWindows } };

      const version = this.nextVersion(previous.version);
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
          correlationId: currentCorrelationId(),
        },
      });
      return { ...settings, version, updatedAt: savedAt.toISOString() };
    });
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
      from.setUTCHours(0, 0, 0, 0);
      createdAt.gte = from;
    }
    if (input.to) {
      const to = new Date(input.to);
      if (Number.isNaN(to.getTime())) throw new BadRequestException('Invalid audit end date.');
      to.setUTCHours(23, 59, 59, 999);
      createdAt.lte = to;
    }
    const trimmedSearch = input.search?.trim().slice(0, 120);
    const where: Prisma.AuditEventWhereInput = {
      ...(input.action ? { action: input.action } : {}),
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
      ...(trimmedSearch
        ? {
            OR: [
              { actorName: { contains: trimmedSearch, mode: 'insensitive' } },
              { action: { contains: trimmedSearch, mode: 'insensitive' } },
              { entityType: { contains: trimmedSearch, mode: 'insensitive' } },
              { entityId: { contains: trimmedSearch, mode: 'insensitive' } },
              { reason: { contains: trimmedSearch, mode: 'insensitive' } },
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
          correlationId: true,
        },
      }),
    ]);
    const availableActions = await this.distinctAuditActions();
    return {
      items: records.map((event) => ({
        id: event.id,
        timestamp: event.createdAt.toISOString(),
        actor: event.actorName,
        action: event.action,
        target: `${event.entityType} · ${event.entityId}`,
        reason: event.reason,
        hash: event.correlationId,
        integrity: 'Tracked' as const,
      })),
      availableActions,
      total,
      page,
      pageSize,
    };
  }

  /** The filter list changes rarely, so avoid scanning the audit table on every page load. */
  private async distinctAuditActions(): Promise<string[]> {
    const cached = this.auditActionsCache;
    if (cached && Date.now() - cached.at < AUDIT_ACTIONS_TTL_MS) return cached.actions;
    const rows = await this.prisma.auditEvent.findMany({
      distinct: ['action'],
      select: { action: true },
      orderBy: { action: 'asc' },
      take: 100,
    });
    const actions = rows.map((row) => row.action);
    this.auditActionsCache = { at: Date.now(), actions };
    return actions;
  }

  private nextVersion(current: string): string {
    const match = current.match(/^(.*?)(\d+)$/);
    if (!match) return `${current}.1`;
    return `${match[1]}${Number(match[2]) + 1}`;
  }
}
