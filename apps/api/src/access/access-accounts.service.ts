import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Prisma } from '@assessflow/database';
import {
  adminCreateAccountSchema,
  adminUpdateAccountSchema,
  type AccessScopeType,
  type RolePermissionMatrixEntry,
} from '@assessflow/contracts';
import { PrismaService } from '../database/prisma.service';
import { AppRole, normalizeRole } from '../auth/auth.types';
import type { AuthActor } from '../auth/auth.types';
import { hashPassword, verifyPassword } from '../auth/password.util';
import { assertUuid, isUuid } from '../common/uuid.util';
import { currentCorrelationId } from '../common/correlation.context';

export type AccessScope = AccessScopeType;

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

const ACCOUNT_PUBLIC_SELECT = {
  id: true,
  entraObjectId: true,
  email: true,
  displayName: true,
  mustChangePassword: true,
  roles: true,
  scopeType: true,
  scopeValues: true,
  active: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
} as const;

const DUMMY_SCRYPT_HASH = `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`;

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

export const RESULT_RELEASE_STATUSES = [
  'APPROVED',
  'DEVELOPMENT_IN_PROGRESS',
  'REASSESSMENT_DUE',
  'CLOSED',
] as const;

export const ROLE_TASK_QUEUES: Partial<Record<AppRole, readonly string[]>> = {
  HR: ['hr-talent', 'hr-approver'],
  Coordinator: ['assessment-coordinator'],
  PanelLead: ['panel-lead'],
  BusinessApprover: ['business-approver'],
  Requester: ['business-owner'],
  Manager: ['manager'],
};

export function taskAssigneeIdsFor(actor: AuthActor): string[] {
  return [actor.id, ...actor.roles.flatMap((role) => ROLE_TASK_QUEUES[role] ?? [])];
}

function approvalStepRolesFor(actor: AuthActor): string[] {
  const roles: string[] = [];
  if (actor.roles.includes('HR')) roles.push('HR');
  if (actor.roles.includes('BusinessApprover')) roles.push('BUSINESS');
  return roles;
}

export const ROLE_PERMISSION_MATRIX: RolePermissionMatrixEntry[] = [
  {
    role: 'Admin',
    label: 'System Administrator',
    description:
      'Full platform governance, account administration, policy enforcement, stage reopen, and workflow orchestration.',
    allowedScopes: ['ORGANIZATION'],
    defaultHome: '/overview',
    pages: [
      'Overview',
      'My work',
      'Assessments',
      'Employees',
      'Development',
      'Calibration',
      'Insights',
      'Administration',
    ],
    capabilities: [
      'Manage accounts & scopes',
      'Enforce governance policy',
      'Reopen completed stages',
      'Run full assessment lifecycle',
    ],
    restrictions: ['Cannot approve a step on a case they scored, finalized, or recommended (SoD).'],
  },
  {
    role: 'Assessor',
    label: 'Principal / Lead Assessor',
    description:
      'Leads assessments, reviews eligibility, builds plans & events, scores rubrics, uses AI Copilot, finalizes results, and writes recommendations.',
    allowedScopes: ['ORGANIZATION', 'DEPARTMENTS', 'ASSIGNED'],
    defaultHome: '/assessor',
    pages: [
      'Overview',
      'Assessor workspace',
      'My work',
      'Assessments',
      'Employees',
      'Development',
      'Calibration',
      'Insights',
    ],
    capabilities: [
      'Create & submit cases',
      'Eligibility & planning',
      'Schedule events & manage scorecards',
      'AI Copilot & result finalization',
      'Update development & close',
    ],
    restrictions: ['Cannot manage accounts or policies', 'Cannot decide approval steps (SoD).'],
  },
  {
    role: 'PanelLead',
    label: 'Panel Lead',
    description:
      'Assigned assessment panelist responsible for recording session evidence, bias-checking notes, and completing candidate scorecards.',
    allowedScopes: ['ASSIGNED'],
    defaultHome: '/assessor',
    pages: ['Assessor workspace', 'My work', 'Assessments', 'Calibration'],
    capabilities: [
      'Save & submit session evidence',
      'Upload evidence attachments',
      'Complete & revise assigned scorecards',
      'Run Copilot Bias Radar',
    ],
    restrictions: [
      'Restricted to assigned cases/sessions',
      'Cannot finalize results, recommend, approve, or schedule events.',
    ],
  },
  {
    role: 'HR',
    label: 'HR Talent Partner / Approver',
    description:
      'Owns the Step 1 HR approval gate and monitors talent pipelines, calibration, and development readiness.',
    allowedScopes: ['ORGANIZATION', 'DEPARTMENTS', 'ASSIGNED'],
    defaultHome: '/overview',
    pages: [
      'Overview',
      'My work',
      'Assessments',
      'Employees',
      'Development',
      'Calibration',
      'Insights',
    ],
    capabilities: [
      'Decide HR approval step (Step 1)',
      'Read scorecards, results, calibration & insights within scope',
    ],
    restrictions: [
      'Cannot alter scorecards, results, or administration policies',
      'Cannot approve both HR & Business steps.',
    ],
  },
  {
    role: 'BusinessApprover',
    label: 'Business Executive Approver',
    description: 'Owns the Step 2 Business executive approval gate after HR sign-off.',
    allowedScopes: ['ASSIGNED'],
    defaultHome: '/tasks',
    pages: ['My work', 'Case dossiers (assigned)'],
    capabilities: [
      'Decide Business approval step (Step 2)',
      'View finalized results & recommendations on pending approvals',
    ],
    restrictions: [
      'Assigned/pending approval cases only',
      'No workflow mutations outside approval decision.',
    ],
  },
  {
    role: 'Coordinator',
    label: 'Assessment Coordinator',
    description:
      'Read-only operational visibility across overview, schedules, employees, and development progress.',
    allowedScopes: ['ORGANIZATION', 'DEPARTMENTS'],
    defaultHome: '/overview',
    pages: ['Overview', 'My work', 'Assessments', 'Employees', 'Development', 'Insights'],
    capabilities: ['Track case progress, events, and development status'],
    restrictions: ['Read-only across assessment and approval decisions.'],
  },
  {
    role: 'Requester',
    label: 'Line Manager / Case Initiator',
    description:
      'Raises new assessment drafts for direct reports or approved departments and submits them for eligibility review.',
    allowedScopes: ['DIRECT_REPORTS', 'DEPARTMENTS', 'NONE'],
    defaultHome: '/overview',
    pages: ['Overview', 'My work', 'Assessments', 'Development'],
    capabilities: [
      'Create draft requests for scoped team/departments',
      'Submit drafts',
      'Upload intake attachments',
    ],
    restrictions: [
      'Read-only after submission',
      'Results & recommendations hidden until released post-approval.',
    ],
  },
  {
    role: 'Manager',
    label: 'Department / Cycle Manager',
    description:
      'Cycle-wide read-only talent viewer across Overview, Assessments, Employees, Development, Calibration, and Insights.',
    allowedScopes: ['ORGANIZATION'],
    defaultHome: '/overview',
    pages: [
      'Overview',
      'My work',
      'Assessments',
      'Employees',
      'Development',
      'Calibration',
      'Insights',
    ],
    capabilities: ['Monitor department talent pipelines, calibration matrix, and analytics'],
    restrictions: ['Read-only role; cannot mutate workflow or accounts.'],
  },
  {
    role: 'EmployeeManager',
    label: 'Employee Manager (Department)',
    description:
      'Follows released assessment outcomes and post-approval growth plans for their assigned departments.',
    allowedScopes: ['DEPARTMENTS'],
    defaultHome: '/employees',
    pages: ['Assessments (released)', 'Employees', 'Development'],
    capabilities: ['View released results and development follow-ups in assigned departments'],
    restrictions: ['Sees cases only after final approval and feedback release.'],
  },
  {
    role: 'Auditor',
    label: 'Read-Only Compliance Auditor',
    description:
      'Reviews cases, plans, results, approvals, and calibration read-only for governance compliance.',
    allowedScopes: ['DEPARTMENTS', 'ASSIGNED'],
    defaultHome: '/overview',
    pages: [
      'Overview',
      'My work',
      'Assessments',
      'Employees',
      'Development',
      'Calibration',
      'Insights',
    ],
    capabilities: ['Full read-only compliance visibility within assigned scope'],
    restrictions: ['Strictly read-only; zero workflow or admin mutations.'],
  },
  {
    role: 'Employee',
    label: 'Assessed Employee (Self)',
    description: 'Self-service access strictly limited to their own released assessment feedback.',
    allowedScopes: ['SELF'],
    defaultHome: '/my-result',
    pages: ['My Results'],
    capabilities: ['View personal assessment result once released by HR/Assessor'],
    restrictions: ['Cannot view in-flight assessments, calibration, or other employees.'],
  },
];

const NO_CASE_ACCESS_WHERE = { id: { in: [] as string[] } };

export function caseScopeWhere(actor: AuthActor): Record<string, unknown> {
  const values = actor.scopeValues ?? [];
  if (actor.roles.includes('Admin') || actor.roles.includes('Assessor')) return {};
  if (
    (actor.roles.includes('EmployeeManager') && actor.scopeType !== 'DEPARTMENTS') ||
    (actor.roles.includes('Employee') && actor.scopeType !== 'SELF') ||
    (actor.roles.includes('Manager') && actor.scopeType !== 'ORGANIZATION')
  ) {
    return NO_CASE_ACCESS_WHERE;
  }
  switch (actor.scopeType) {
    case 'ORGANIZATION':
      return {};
    case 'DEPARTMENTS':
      if (!values.length) return NO_CASE_ACCESS_WHERE;
      return {
        departmentSnapshot: { in: values },
        ...(actor.roles.includes('EmployeeManager')
          ? { feedbackReleasedAt: { not: null }, status: { in: [...RESULT_RELEASE_STATUSES] } }
          : {}),
      };
    case 'DIRECT_REPORTS':
      if (!values.length) return NO_CASE_ACCESS_WHERE;
      return { employee: { externalId: { in: values } } };
    case 'ASSIGNED': {
      const stepRoles = approvalStepRolesFor(actor);
      return {
        OR: [
          { tasks: { some: { assigneeId: actor.id } } },
          { events: { some: { assessors: { some: { userId: actor.id } } } } },
          { approvalSteps: { some: { approverId: actor.id } } },
          ...(stepRoles.length
            ? [{ approvalSteps: { some: { decision: 'PENDING', role: { in: stepRoles } } } }]
            : []),
        ],
      };
    }
    case 'SELF':
      if (!actor.email && !values.length) return NO_CASE_ACCESS_WHERE;
      return {
        employee: {
          OR: [
            ...(actor.email ? [{ email: actor.email }] : []),
            ...(values.length ? [{ externalId: { in: values } }] : []),
          ],
        },
      };
    default:
      return NO_CASE_ACCESS_WHERE;
  }
}

function normalizeAccountInput(input: AccessAccountInput) {
  if (typeof input?.email !== 'string') {
    throw new BadRequestException('Enter a valid company email address.');
  }
  if (typeof input?.displayName !== 'string' || !input.displayName.trim()) {
    throw new BadRequestException('Display name is required.');
  }
  if (!Array.isArray(input?.roles)) {
    throw new BadRequestException('Select at least one role.');
  }

  const email = input.email.trim().toLowerCase();
  const domain = allowedEmailDomain();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestException('Enter a valid company email address.');
  }
  if (!email.endsWith(`@${domain}`)) {
    throw new BadRequestException(`Only @${domain} email addresses can be added.`);
  }
  if (!SCOPES.includes(input.scopeType)) throw new BadRequestException('Unknown data scope.');

  const roles = [
    ...new Set(input.roles.map((role) => normalizeRole(role)).filter(Boolean)),
  ] as AppRole[];
  if (!roles.length) throw new BadRequestException('Select at least one valid role.');

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
      'Organization-wide access is reserved for Admin, HR, Manager, and Assessor.',
    );
  }
  const scopeValues = [
    ...new Set(
      (Array.isArray(input.scopeValues) ? input.scopeValues : [])
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean),
    ),
  ];
  if (
    (input.scopeType === 'DIRECT_REPORTS' || input.scopeType === 'DEPARTMENTS') &&
    scopeValues.length === 0
  ) {
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

  getRolesMatrix(): RolePermissionMatrixEntry[] {
    return ROLE_PERMISSION_MATRIX;
  }

  async list(actor?: AuthActor) {
    const canSeeAdminAccounts = !actor || actor.roles.includes('Admin');
    if (this.prisma?.enabled) {
      const accounts = await this.prisma.accessAccount.findMany({
        select: ACCOUNT_PUBLIC_SELECT,
        orderBy: { createdAt: 'desc' },
      });
      return accounts.filter((account) => canSeeAdminAccounts || !account.roles.includes('Admin'));
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

  async create(input: unknown, actor: AuthActor) {
    const parsed = adminCreateAccountSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Invalid account input.');
    }
    const password = this.validatePassword(parsed.data.password);
    const data = normalizeAccountInput(parsed.data);
    this.assertAssessorCannotManageAdmins(actor, data.roles, false);
    const passwordHash = await hashPassword(password);
    if (this.prisma?.enabled) {
      const created = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.accessAccount.findFirst({ where: { email: data.email } });
        if (existing) throw new ConflictException('This company account is already registered.');
        const record = await tx.accessAccount.create({
          data: { ...data, passwordHash, createdBy: actor.id, mustChangePassword: true },
          select: ACCOUNT_PUBLIC_SELECT,
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
      return created;
    }
    if ([...this.localAccounts.values()].some((account) => account.email === data.email)) {
      throw new ConflictException('This company account is already registered.');
    }
    const now = new Date().toISOString();
    const account: StoredAccessAccount = {
      ...data,
      id: cryptoRandomUuid(),
      passwordHash,
      mustChangePassword: true,
      createdAt: now,
      updatedAt: now,
    };
    this.localAccounts.set(account.id, account);
    const { passwordHash: _passwordHash, password: _password, ...safeAccount } = account;
    return safeAccount;
  }

  async update(id: string, input: unknown, actor?: AuthActor) {
    if (this.prisma?.enabled) {
      assertUuid(id, 'ACCOUNT_NOT_FOUND', 'Access account not found.');
    }
    const parsed = adminUpdateAccountSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Invalid account update.');
    }
    const validInput = parsed.data;
    if (
      (validInput.password !== undefined ||
        validInput.active !== undefined ||
        validInput.roles !== undefined) &&
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
    if (validInput.password !== undefined) {
      throw new BadRequestException(
        'Use the administrator Reset password action for password changes.',
      );
    }
    if (actor?.roles.includes('Admin') && this.prisma?.enabled) {
      return this.adminUpdate(id, validInput, actor);
    }
    this.assertAssessorCannotManageAdmins(
      actor,
      validInput.roles ?? existing.roles,
      existing.roles.includes('Admin'),
    );

    const merged = normalizeAccountInput({
      email: validInput.email ?? existing.email,
      displayName: validInput.displayName ?? existing.displayName,
      roles: validInput.roles ?? existing.roles,
      scopeType: validInput.scopeType ?? (existing.scopeType as AccessScope),
      scopeValues: validInput.scopeValues ?? existing.scopeValues,
      active: validInput.active ?? existing.active,
    });

    if (this.prisma?.enabled) {
      const duplicate = await this.prisma.accessAccount.findFirst({
        where: { id: { not: id }, email: merged.email },
      });
      if (duplicate) throw new ConflictException('Another access account uses this email.');
      return this.prisma.accessAccount.update({
        where: { id },
        data: merged,
        select: ACCOUNT_PUBLIC_SELECT,
      });
    }
    const updated: StoredAccessAccount = {
      ...existing,
      ...merged,
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
    if (typeof email !== 'string' || typeof password !== 'string') {
      throw new UnauthorizedException('Invalid email or password.');
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.endsWith(`@${allowedEmailDomain()}`)) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    const account = this.prisma?.enabled
      ? await this.prisma.accessAccount.findUnique({ where: { email: normalizedEmail } })
      : [...this.localAccounts.values()].find((item) => item.email === normalizedEmail);
    if (!account || !account.active || !account.passwordHash) {
      await verifyPassword(password, DUMMY_SCRYPT_HASH);
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

  async adminCreate(input: unknown, actor: AuthActor) {
    this.requireDatabase();
    const parsed = adminCreateAccountSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Invalid account input.');
    }
    const temporaryPassword = this.generateTemporaryPassword();
    const data = normalizeAccountInput({ ...parsed.data, password: temporaryPassword });
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
      const existing = await tx.accessAccount.findUnique({ where: { email: data.email } });
      if (existing) throw new ConflictException('This company account is already registered.');
      const created = await tx.accessAccount.create({
        data: {
          ...data,
          passwordHash,
          mustChangePassword: true,
          createdBy: actor.id,
        },
        select: ACCOUNT_PUBLIC_SELECT,
      });
      await this.writeAdminAudit(tx, actor, 'ADMIN_ACCOUNT_CREATED', created.id, null, safeInput);
      return created;
    });
    return { account, temporaryPassword };
  }

  async adminUpdate(
    id: string,
    input: unknown,
    actor: AuthActor,
    action = 'ADMIN_ACCOUNT_UPDATED',
  ) {
    this.requireDatabase();
    assertUuid(id, 'ACCOUNT_NOT_FOUND', 'Access account not found.');
    const parsed = adminUpdateAccountSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Invalid account update.');
    }
    const validInput = parsed.data;
    if (validInput.password !== undefined) {
      throw new BadRequestException(
        'Use the administrator Reset password action for password changes.',
      );
    }

    return this.prisma!.$transaction(async (tx) => {
      const existing = await tx.accessAccount.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Access account not found.');
      const merged = normalizeAccountInput({
        email: validInput.email ?? existing.email,
        displayName: validInput.displayName ?? existing.displayName,
        roles: validInput.roles ?? existing.roles,
        scopeType: validInput.scopeType ?? (existing.scopeType as AccessScope),
        scopeValues: validInput.scopeValues ?? existing.scopeValues,
        active: validInput.active ?? existing.active,
      });
      if (merged.email !== existing.email) {
        const duplicate = await tx.accessAccount.findFirst({
          where: { id: { not: id }, email: merged.email },
        });
        if (duplicate) throw new ConflictException('Another access account uses this email.');
      }
      await this.assertAnotherAdminRemains(tx, id, existing, merged);
      const previousData = this.safeAccountAuditData(existing);
      const newData = this.safeAccountAuditData(merged);
      const updated = await tx.accessAccount.update({
        where: { id },
        data: merged,
        select: ACCOUNT_PUBLIC_SELECT,
      });
      await this.writeAdminAudit(tx, actor, action, id, previousData, newData);
      return updated;
    });
  }

  async adminDeactivate(id: string, actor: AuthActor) {
    return this.adminUpdate(id, { active: false }, actor, 'ADMIN_ACCOUNT_DEACTIVATED');
  }

  async adminReactivate(id: string, actor: AuthActor) {
    return this.adminUpdate(id, { active: true }, actor, 'ADMIN_ACCOUNT_REACTIVATED');
  }

  async adminResetPassword(id: string, actor: AuthActor) {
    this.requireDatabase();
    assertUuid(id, 'ACCOUNT_NOT_FOUND', 'Access account not found.');
    const existing = await this.prisma!.accessAccount.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Access account not found.');
    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    await this.prisma!.$transaction(async (tx) => {
      await tx.accessAccount.update({
        where: { id },
        data: { passwordHash, mustChangePassword: true, passwordChangedAt: new Date() },
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
    assertUuid(actor.id, 'ACCOUNT_NOT_FOUND', 'Account is unavailable.');
    if (newPassword !== confirmPassword) throw new BadRequestException('Passwords do not match.');
    const password = this.validatePassword(newPassword);
    const existing = await this.prisma!.accessAccount.findUnique({ where: { id: actor.id } });
    if (!existing || !existing.active) throw new UnauthorizedException('Account is unavailable.');
    const passwordHash = await hashPassword(password);
    const previousMustChange = Boolean(existing.mustChangePassword);
    await this.prisma!.$transaction(async (tx) => {
      await tx.accessAccount.update({
        where: { id: actor.id },
        data: { passwordHash, mustChangePassword: false, passwordChangedAt: new Date() },
      });
      await this.writeAdminAudit(
        tx,
        actor,
        previousMustChange ? 'TEMPORARY_PASSWORD_CHANGED' : 'PASSWORD_CHANGED',
        actor.id,
        { mustChangePassword: previousMustChange },
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
    tx: Prisma.TransactionClient,
    id: string,
    existing: { active: boolean; roles: string[] },
    next: { active: boolean; roles: string[] },
  ) {
    if (
      !existing.active ||
      !existing.roles.includes('Admin') ||
      (next.active && next.roles.includes('Admin'))
    ) {
      return;
    }
    const activeAdmins = await tx.accessAccount.count({
      where: { id: { not: id }, active: true, roles: { has: 'Admin' } },
    });
    if (activeAdmins === 0) {
      throw new BadRequestException(
        'The last active System admin cannot be deactivated or demoted.',
      );
    }
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
        correlationId: currentCorrelationId(),
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

function cryptoRandomUuid(): string {
  return randomBytes(16)
    .toString('hex')
    .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-4$3-a$4-$5');
}
