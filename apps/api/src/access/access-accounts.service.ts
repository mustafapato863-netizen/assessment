import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { Prisma } from '@assessflow/database';
import { PrismaService } from '../database/prisma.service';
import { AppRole, normalizeRole } from '../auth/auth.types';
import type { AuthActor } from '../auth/auth.types';
import { hashPassword, verifyPassword } from '../auth/password.util';

export type AccessScope =
  'NONE' | 'ORGANIZATION' | 'DEPARTMENTS' | 'DIRECT_REPORTS' | 'ASSIGNED' | 'SELF';

export interface AccessAccountInput {
  password?: string;
  email: string;
  displayName: string;
  roles: string[];
  scopeType: AccessScope;
  scopeValues?: string[];
  active?: boolean;
}

export interface AdminAccessAccountInput extends Omit<AccessAccountInput, 'password' | 'active'> {}

interface StoredAccessAccount extends AccessAccountInput {
  id: string;
  scopeValues: string[];
  active: boolean;
  passwordHash?: string | null;
  mustChangePassword?: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

function allowedEmailDomain(): string {
  return (process.env.ACCESS_ALLOWED_EMAIL_DOMAIN || 'saudigerman.com').trim().toLowerCase();
}
const SCOPES: AccessScope[] = [
  'NONE',
  'ORGANIZATION',
  'DEPARTMENTS',
  'DIRECT_REPORTS',
  'ASSIGNED',
  'SELF',
];

/**
 * Workflow tasks are created for role queues (e.g. 'hr-approver') rather than
 * named people. A user works a queue when they hold the matching role; the
 * case scope still limits which of those cases they can see.
 */
export const ROLE_TASK_QUEUES: Partial<Record<AppRole, readonly string[]>> = {
  HR: ['hr-talent', 'hr-approver'],
  Coordinator: ['assessment-coordinator'],
  PanelLead: ['panel-lead'],
  BusinessApprover: ['business-approver'],
  Requester: ['business-owner'],
  Manager: ['manager'],
};

/** Task assignee ids an actor works: their own id plus their role queues. */
export function taskAssigneeIdsFor(actor: AuthActor): string[] {
  return [actor.id, ...actor.roles.flatMap((role) => ROLE_TASK_QUEUES[role] ?? [])];
}

/** Approval step roles an actor can decide (see APPROVAL_STEP_ROLES). */
function approvalStepRolesFor(actor: AuthActor): string[] {
  const roles: string[] = [];
  if (actor.roles.includes('HR')) roles.push('HR');
  if (actor.roles.includes('BusinessApprover')) roles.push('BUSINESS');
  return roles;
}

export function caseScopeWhere(actor: AuthActor): Record<string, unknown> {
  const values = actor.scopeValues ?? [];
  // System admins always have organization-wide access. Local development's
  // default actor also carries the Employee role, so checking that narrow role
  // first incorrectly rejected the admin's organization scope.
  if (actor.roles.includes('Admin') || actor.roles.includes('Assessor')) return {};
  if (
    (actor.roles.includes('EmployeeManager') && actor.scopeType !== 'DEPARTMENTS') ||
    (actor.roles.includes('Employee') && actor.scopeType !== 'SELF') ||
    (actor.roles.includes('Manager') && actor.scopeType !== 'ORGANIZATION')
  ) {
    return { id: '__invalid_role_scope__' };
  }
  switch (actor.scopeType) {
    case 'ORGANIZATION':
      return {};
    case 'DEPARTMENTS':
      return {
        departmentSnapshot: { in: values },
        ...(actor.roles.includes('EmployeeManager') ? { feedbackReleasedAt: { not: null } } : {}),
      };
    case 'DIRECT_REPORTS':
      return { employee: { externalId: { in: values } } };
    case 'ASSIGNED': {
      const stepRoles = approvalStepRolesFor(actor);
      return {
        OR: [
          { tasks: { some: { assigneeId: actor.id } } },
          { events: { some: { assessors: { some: { userId: actor.id } } } } },
          { approvalSteps: { some: { approverId: actor.id } } },
          // Approvers see cases waiting on a step their role can decide.
          ...(stepRoles.length
            ? [{ approvalSteps: { some: { decision: 'PENDING', role: { in: stepRoles } } } }]
            : []),
        ],
      };
    }
    case 'SELF':
      return {
        employee: {
          OR: [
            ...(actor.email ? [{ email: actor.email }] : []),
            ...(values.length ? [{ externalId: { in: values } }] : []),
          ],
        },
      };
    default:
      return { id: '__no_access__' };
  }
}

function normalizeAccountInput(input: AccessAccountInput) {
  const email = input.email.trim().toLowerCase();
  const domain = allowedEmailDomain();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestException('Enter a valid company email address.');
  }
  if (!email.endsWith(`@${domain}`)) {
    throw new BadRequestException(`Only @${domain} email addresses can be added.`);
  }
  if (!input.displayName.trim()) {
    throw new BadRequestException('Display name is required.');
  }
  if (!SCOPES.includes(input.scopeType)) throw new BadRequestException('Unknown data scope.');
  const roles = [
    ...new Set(input.roles.map((role) => normalizeRole(role)).filter(Boolean)),
  ] as AppRole[];
  if (roles.includes('Employee') && input.scopeType !== 'SELF') {
    throw new BadRequestException('Employee access must be limited to their own record.');
  }
  if (roles.includes('EmployeeManager') && input.scopeType !== 'DEPARTMENTS') {
    throw new BadRequestException(
      'Employee Manager access must be limited to selected departments.',
    );
  }
  if (roles.includes('Manager') && input.scopeType !== 'ORGANIZATION') {
    throw new BadRequestException('Manager access must cover the full assessment cycle.');
  }
  if (
    roles.includes('Requester') &&
    !['DIRECT_REPORTS', 'DEPARTMENTS', 'NONE'].includes(input.scopeType)
  ) {
    throw new BadRequestException(
      'Requester access must be limited to direct reports or departments.',
    );
  }
  if (
    roles.some((role) => ['PanelLead', 'BusinessApprover'].includes(role)) &&
    input.scopeType !== 'ASSIGNED'
  ) {
    throw new BadRequestException(
      'Assessment and approval roles must be limited to assigned cases.',
    );
  }
  if (
    input.scopeType === 'ORGANIZATION' &&
    !roles.some((role) => ['Admin', 'HR', 'Manager', 'Assessor'].includes(role))
  ) {
    throw new BadRequestException(
      'Organization-wide access is reserved for Admin, HR, and Manager.',
    );
  }
  const scopeValues = [
    ...new Set((input.scopeValues ?? []).map((value) => value.trim()).filter(Boolean)),
  ];
  if (input.scopeType === 'DIRECT_REPORTS' && scopeValues.length === 0) {
    throw new BadRequestException(
      'Enter at least one department or employee ID for this data scope.',
    );
  }
  return {
    email,
    displayName: input.displayName.trim(),
    roles,
    scopeType: input.scopeType,
    scopeValues,
    active: input.active ?? true,
  };
}

@Injectable()
export class AccessAccountsService {
  private readonly localAccounts = new Map<string, StoredAccessAccount>();

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  async list(actor?: AuthActor) {
    const canSeeAdminAccounts = !actor || actor.roles.includes('Admin');
    if (this.prisma?.enabled) {
      const accounts = await this.prisma.accessAccount.findMany({ orderBy: { createdAt: 'desc' } });
      return accounts
        .filter((account) => canSeeAdminAccounts || !account.roles.includes('Admin'))
        .map(({ passwordHash: _passwordHash, ...account }) => account);
    }
    return [...this.localAccounts.values()]
      .filter((account) => canSeeAdminAccounts || !account.roles.includes('Admin'))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(({ passwordHash: _passwordHash, password: _password, ...account }) => account);
  }

  async listAssessors() {
    if (this.prisma?.enabled) {
      return this.prisma.accessAccount.findMany({
        where: { active: true, roles: { hasSome: ['Assessor', 'PanelLead'] } },
        select: { id: true, displayName: true, email: true, roles: true },
        orderBy: { displayName: 'asc' },
      });
    }
    return [...this.localAccounts.values()]
      .filter(
        (account) =>
          account.active &&
          (account.roles.includes('Assessor') || account.roles.includes('PanelLead')),
      )
      .map(({ id, displayName, email, roles }) => ({ id, displayName, email, roles }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  async create(input: AccessAccountInput, actor: AuthActor) {
    const password = this.validatePassword(input.password);
    const data = normalizeAccountInput(input);
    this.assertAssessorCannotManageAdmins(actor, data.roles, false);
    const passwordHash = await hashPassword(password);
    if (this.prisma?.enabled) {
      const existing = await this.prisma.accessAccount.findFirst({
        where: { email: data.email },
      });
      if (existing) throw new ConflictException('This company account is already registered.');
      const created = await this.prisma.$transaction(async (tx) => {
        const record = await tx.accessAccount.create({
          data: { ...data, passwordHash, createdBy: actor.id, mustChangePassword: true },
        });
        await this.writeAdminAudit(
          tx,
          actor,
          'ADMIN_ACCOUNT_CREATED',
          record.id,
          null,
          this.safeAccountAuditData(record),
        );
        return record;
      });
      const { passwordHash: _passwordHash, ...safeAccount } = created;
      return safeAccount;
    }
    if ([...this.localAccounts.values()].some((account) => account.email === data.email)) {
      throw new ConflictException('This company account is already registered.');
    }
    const now = new Date().toISOString();
    const account: StoredAccessAccount = {
      ...data,
      id: randomUUID(),
      passwordHash,
      mustChangePassword: true,
      createdAt: now,
      updatedAt: now,
    };
    this.localAccounts.set(account.id, account);
    const { passwordHash: _passwordHash, password: _password, ...safeAccount } = account;
    return safeAccount;
  }

  async update(id: string, input: Partial<AccessAccountInput>, actor?: AuthActor) {
    if (
      (input.password !== undefined || input.active !== undefined || input.roles !== undefined) &&
      !actor?.roles.includes('Admin')
    ) {
      throw new ForbiddenException(
        'Only a System admin can change passwords, roles, or account status.',
      );
    }
    const existing = this.prisma?.enabled
      ? await this.prisma.accessAccount.findUnique({ where: { id } })
      : this.localAccounts.get(id);
    if (!existing) throw new NotFoundException('Access account not found.');
    if (input.password !== undefined) {
      throw new BadRequestException(
        'Use the administrator Reset password action for password changes.',
      );
    }
    if (actor?.roles.includes('Admin') && this.prisma?.enabled) {
      return this.adminUpdate(id, input, actor);
    }
    this.assertAssessorCannotManageAdmins(
      actor,
      input.roles ?? existing.roles,
      existing.roles.includes('Admin'),
    );

    const merged = normalizeAccountInput({
      email: input.email ?? existing.email,
      displayName: input.displayName ?? existing.displayName,
      roles: input.roles ?? existing.roles,
      scopeType: input.scopeType ?? (existing.scopeType as AccessScope),
      scopeValues: input.scopeValues ?? existing.scopeValues,
      active: input.active ?? existing.active,
    });

    const passwordHash =
      input.password !== undefined
        ? await hashPassword(this.validatePassword(input.password))
        : undefined;

    if (this.prisma?.enabled) {
      const duplicate = await this.prisma.accessAccount.findFirst({
        where: {
          id: { not: id },
          email: merged.email,
        },
      });
      if (duplicate) throw new ConflictException('Another access account uses this email.');
      const updated = await this.prisma.accessAccount.update({
        where: { id },
        data: {
          ...merged,
          ...(passwordHash ? { passwordHash, mustChangePassword: true } : {}),
        },
      });
      const { passwordHash: _passwordHash, ...safeAccount } = updated;
      return safeAccount;
    }
    const updated: StoredAccessAccount = {
      ...existing,
      ...merged,
      ...(passwordHash ? { passwordHash } : {}),
      ...(passwordHash ? { mustChangePassword: true } : {}),
      roles: merged.roles,
      scopeType: merged.scopeType,
      scopeValues: merged.scopeValues,
      active: merged.active,
      updatedAt: new Date().toISOString(),
    };
    this.localAccounts.set(id, updated);
    const { passwordHash: _passwordHash, password: _password, ...safeAccount } = updated;
    return safeAccount;
  }

  async authenticate(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.endsWith(`@${allowedEmailDomain()}`)) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    const account = this.prisma?.enabled
      ? await this.prisma.accessAccount.findUnique({ where: { email: normalizedEmail } })
      : [...this.localAccounts.values()].find((item) => item.email === normalizedEmail);
    if (!account || !account.active || !account.passwordHash) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    if (!(await verifyPassword(password, account.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    const roles = account.roles.map(normalizeRole).filter((role): role is AppRole => Boolean(role));
    return {
      id: account.id,
      name: account.displayName,
      email: account.email,
      roles,
      scopeType: account.scopeType,
      scopeValues: account.scopeValues,
      mustChangePassword: Boolean('mustChangePassword' in account && account.mustChangePassword),
    } satisfies AuthActor;
  }

  private validatePassword(password: string | undefined): string {
    if (!password || password.length < 12) {
      throw new BadRequestException('Password must be at least 12 characters.');
    }
    if (password.length > 256) {
      throw new BadRequestException('Password cannot be longer than 256 characters.');
    }
    return password;
  }

  async remove(id: string, actor?: AuthActor) {
    if (!actor?.roles.includes('Admin')) {
      throw new ForbiddenException('Only a System admin can remove or deactivate accounts.');
    }
    await this.adminDeactivate(id, actor);
    return { id, removed: false };
  }

  async adminCreate(input: AdminAccessAccountInput, actor: AuthActor) {
    this.requireDatabase();
    const temporaryPassword = this.generateTemporaryPassword();
    const data = normalizeAccountInput({ ...input, password: temporaryPassword });
    const existing = await this.prisma!.accessAccount.findUnique({ where: { email: data.email } });
    if (existing) throw new ConflictException('This company account is already registered.');
    const passwordHash = await hashPassword(temporaryPassword);
    const safeInput = {
      displayName: data.displayName,
      email: data.email,
      roles: data.roles,
      scopeType: data.scopeType,
      scopeValues: data.scopeValues,
      active: true,
    };
    const account = await this.prisma!.$transaction(async (tx) => {
      const created = await tx.accessAccount.create({
        data: {
          ...data,
          passwordHash,
          mustChangePassword: true,
          createdBy: actor.id,
        },
      });
      const { passwordHash: _passwordHash, ...safeAccount } = created;
      await this.writeAdminAudit(tx, actor, 'ADMIN_ACCOUNT_CREATED', created.id, null, safeInput);
      return safeAccount;
    });
    return { account, temporaryPassword };
  }

  async adminUpdate(
    id: string,
    input: Partial<AccessAccountInput>,
    actor: AuthActor,
    action = 'ADMIN_ACCOUNT_UPDATED',
  ) {
    this.requireDatabase();
    const existing = await this.prisma!.accessAccount.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Access account not found.');
    const merged = normalizeAccountInput({
      email: input.email ?? existing.email,
      displayName: input.displayName ?? existing.displayName,
      roles: input.roles ?? existing.roles,
      scopeType: input.scopeType ?? (existing.scopeType as AccessScope),
      scopeValues: input.scopeValues ?? existing.scopeValues,
      active: input.active ?? existing.active,
    });
    await this.assertAnotherAdminRemains(id, existing, merged);
    const previousData = this.safeAccountAuditData(existing);
    const newData = this.safeAccountAuditData(merged);
    return this.prisma!.$transaction(async (tx) => {
      const updated = await tx.accessAccount.update({ where: { id }, data: merged });
      const { passwordHash: _passwordHash, ...safeAccount } = updated;
      await this.writeAdminAudit(tx, actor, action, id, previousData, newData);
      return safeAccount;
    });
  }

  async adminDeactivate(id: string, actor: AuthActor) {
    return this.adminUpdate(id, { active: false }, actor, 'ADMIN_ACCOUNT_DEACTIVATED');
  }

  async adminResetPassword(id: string, actor: AuthActor) {
    this.requireDatabase();
    const existing = await this.prisma!.accessAccount.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Access account not found.');
    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    await this.prisma!.$transaction(async (tx) => {
      await tx.accessAccount.update({
        where: { id },
        data: { passwordHash, mustChangePassword: true },
      });
      await this.writeAdminAudit(
        tx,
        actor,
        'ADMIN_PASSWORD_RESET',
        id,
        { mustChangePassword: Boolean(existing.mustChangePassword) },
        { mustChangePassword: true },
      );
    });
    return { temporaryPassword };
  }

  async changeTemporaryPassword(actor: AuthActor, newPassword: string, confirmPassword: string) {
    this.requireDatabase();
    if (newPassword !== confirmPassword) throw new BadRequestException('Passwords do not match.');
    const password = this.validatePassword(newPassword);
    const existing = await this.prisma!.accessAccount.findUnique({ where: { id: actor.id } });
    if (!existing || !existing.active) throw new UnauthorizedException('Account is unavailable.');
    const passwordHash = await hashPassword(password);
    await this.prisma!.$transaction(async (tx) => {
      await tx.accessAccount.update({
        where: { id: actor.id },
        data: { passwordHash, mustChangePassword: false },
      });
      await this.writeAdminAudit(
        tx,
        actor,
        'TEMPORARY_PASSWORD_CHANGED',
        actor.id,
        { mustChangePassword: true },
        { mustChangePassword: false },
      );
    });
    return { changed: true as const };
  }

  private requireDatabase() {
    if (!this.prisma?.enabled) {
      throw new BadRequestException('Administration account changes require database mode.');
    }
  }

  private generateTemporaryPassword(): string {
    return `${randomBytes(24).toString('base64url')}aA9!`;
  }

  private async assertAnotherAdminRemains(
    id: string,
    existing: { active: boolean; roles: string[] },
    next: { active: boolean; roles: string[] },
  ) {
    if (
      !existing.active ||
      !existing.roles.includes('Admin') ||
      (next.active && next.roles.includes('Admin'))
    )
      return;
    const activeAdmins = await this.prisma!.accessAccount.count({
      where: { id: { not: id }, active: true, roles: { has: 'Admin' } },
    });
    if (activeAdmins === 0)
      throw new BadRequestException(
        'The last active System admin cannot be deactivated or demoted.',
      );
  }

  private safeAccountAuditData(value: {
    displayName?: string;
    email?: string;
    roles?: string[];
    scopeType?: string;
    scopeValues?: string[];
    active?: boolean;
  }) {
    return {
      displayName: value.displayName,
      email: value.email,
      roles: value.roles,
      scopeType: value.scopeType,
      scopeValues: value.scopeValues,
      active: value.active,
    };
  }

  private async writeAdminAudit(
    tx: Prisma.TransactionClient,
    actor: AuthActor,
    action: string,
    entityId: string,
    previousData: unknown,
    newData: unknown,
  ) {
    const asJson = (value: unknown) =>
      value === null
        ? Prisma.JsonNull
        : (JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue);
    await tx.auditEvent.create({
      data: {
        actorId: actor.id,
        actorName: actor.name,
        action,
        entityType: 'ACCESS_ACCOUNT',
        entityId,
        previousData: asJson(previousData),
        newData: asJson(newData),
        correlationId: `corr-${randomUUID()}`,
      },
    });
  }

  private assertAssessorCannotManageAdmins(
    actor: AuthActor | undefined,
    targetRoles: string[],
    existingTargetIsAdmin: boolean,
  ) {
    if (
      !actor?.roles.includes('Admin') &&
      actor?.roles.some((role) => ['Assessor', 'PanelLead'].includes(role))
    ) {
      if (existingTargetIsAdmin || targetRoles.includes('Admin')) {
        throw new BadRequestException(
          'Assessors cannot add, change, or remove system admin access.',
        );
      }
    }
  }
}
