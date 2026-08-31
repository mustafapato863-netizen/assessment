import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  caseStatuses,
  createCaseSchema,
  eligibilityDecisionSchema,
  type AssessmentCaseDetail,
  type AssessmentCaseSummary,
  type AssessmentReason,
  type CaseStage,
  type CaseStatus,
  type CreateCaseInput,
  type EligibilityDecisionInput,
  type OverviewResponse,
} from '@assessflow/contracts';
import { Prisma, CaseStatus as PrismaCaseStatus } from '@assessflow/database';
import { PrismaService } from '../database/prisma.service';
import { actionsForStatus } from './workflow-actions';

const caseInclude = {
  employee: true,
  eligibility: { include: { criteria: true } },
  auditEvents: { orderBy: { createdAt: 'desc' }, take: 20 },
} as const;

type CaseWithRelations = Prisma.AssessmentCaseGetPayload<{ include: typeof caseInclude }>;

const defaultCriteria = [
  {
    criterionCode: 'TENURE',
    label: 'Minimum time in current role',
    blocking: true,
    result: 'MET' as const,
  },
  {
    criterionCode: 'PIP',
    label: 'Active PIP or disciplinary action',
    blocking: true,
    result: 'MET' as const,
  },
  {
    criterionCode: 'TRAINING',
    label: 'Mandatory training',
    blocking: false,
    result: 'NOT_CHECKED' as const,
  },
  {
    criterionCode: 'POSITION',
    label: 'Target position approved',
    blocking: true,
    result: 'MET' as const,
  },
];

export class PrismaCasesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(): Promise<OverviewResponse> {
    const cases = await this.list({});
    const tasks = await this.getTasks();
    return {
      metrics: [
        {
          label: 'Active assessments',
          value: cases.filter((item) => item.status !== 'CLOSED').length,
          context: 'Across your scope',
          trend: '+12% vs last cycle',
          tone: 'positive',
        },
        {
          label: 'Pending eligibility',
          value: cases.filter((item) => item.status === 'PENDING_ELIGIBILITY').length,
          context: 'Needs HR review',
          trend: '2 due today',
          tone: 'warning',
        },
        {
          label: 'Pending approvals',
          value: cases.filter((item) => item.status === 'PENDING_APPROVAL').length,
          context: 'Decision queue',
          trend: '1 high priority',
          tone: 'warning',
        },
        {
          label: 'Overdue follow-up',
          value: cases.filter((item) => item.status === 'REASSESSMENT_DUE').length,
          context: 'Development actions',
          trend: '-4% vs last cycle',
          tone: 'danger',
        },
      ],
      tasks,
      pipeline: [
        {
          label: 'Request',
          value: cases.filter((item) => item.stage === 'REQUEST').length,
          tone: 'indigo',
        },
        {
          label: 'Eligibility',
          value: cases.filter((item) => item.stage === 'ELIGIBILITY').length,
          tone: 'warning',
        },
        {
          label: 'Assessment',
          value: cases.filter((item) => item.stage === 'ASSESSMENT').length,
          tone: 'teal',
        },
        {
          label: 'Decision',
          value: cases.filter((item) => ['RECOMMENDATION', 'APPROVAL'].includes(item.stage)).length,
          tone: 'violet',
        },
      ],
    };
  }

  async getTasks(): Promise<OverviewResponse['tasks']> {
    const organization = await this.organization();
    const tasks = await this.prisma.task.findMany({
      where: { status: 'OPEN', case: { organizationId: organization.id } },
      include: { case: { include: { employee: true } } },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
      take: 20,
    });
    return tasks.map((task) => ({
      id: task.id,
      title: this.taskTitle(task.taskType, task.case?.employee.displayName),
      caseCode: task.case?.caseCode ?? '—',
      dueLabel: task.dueAt
        ? `Due ${task.dueAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`
        : 'No due date',
      priority: task.taskType.includes('ELIGIBILITY') ? 'HIGH' : 'NORMAL',
    }));
  }

  async list(filters: { status?: string; search?: string }): Promise<AssessmentCaseSummary[]> {
    const organization = await this.organization();
    const where: Prisma.AssessmentCaseWhereInput = { organizationId: organization.id };
    if (filters.status && caseStatuses.includes(filters.status as CaseStatus)) {
      where.status = filters.status as PrismaCaseStatus;
    }
    const search = filters.search?.trim();
    if (search) {
      where.OR = [
        { caseCode: { contains: search, mode: 'insensitive' } },
        { ownerName: { contains: search, mode: 'insensitive' } },
        { departmentSnapshot: { contains: search, mode: 'insensitive' } },
        { targetRoleSnapshot: { contains: search, mode: 'insensitive' } },
        { employee: { displayName: { contains: search, mode: 'insensitive' } } },
      ];
    }
    const records = await this.prisma.assessmentCase.findMany({
      where,
      include: caseInclude,
      orderBy: { requestedAt: 'desc' },
    });
    return records.map((record) => this.toSummary(this.toDetail(record)));
  }

  async get(caseId: string): Promise<AssessmentCaseDetail> {
    const record = await this.prisma.assessmentCase.findUnique({
      where: { id: caseId },
      include: caseInclude,
    });
    if (!record)
      throw new NotFoundException(
        this.error('CASE_NOT_FOUND', 'This assessment case could not be found.'),
      );
    return this.toDetail(record);
  }

  async create(input: CreateCaseInput): Promise<AssessmentCaseDetail> {
    const parsed = createCaseSchema.safeParse(input);
    if (!parsed.success)
      throw new BadRequestException(
        this.error(
          'VALIDATION_ERROR',
          'Review the highlighted request fields.',
          parsed.error.flatten().fieldErrors,
        ),
      );
    const data = parsed.data;
    const organization = await this.organization();
    const employee = await this.prisma.employeeReference.upsert({
      where: {
        organizationId_externalId: { organizationId: organization.id, externalId: data.employeeId },
      },
      update: {
        displayName: data.employeeName,
        department: data.department,
        currentRole: data.currentRole,
      },
      create: {
        organizationId: organization.id,
        externalId: data.employeeId,
        displayName: data.employeeName,
        department: data.department,
        currentRole: data.currentRole,
        currentLevel: data.targetLevel,
      },
    });
    const created = await this.prisma.assessmentCase.create({
      data: {
        caseCode: `AF-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
        organizationId: organization.id,
        employeeId: employee.id,
        assessmentReason: data.assessmentReason,
        stage: 'REQUEST',
        status: 'DRAFT',
        ownerName: 'Requester',
        priority: data.priority,
        currentRoleSnapshot: data.currentRole,
        targetRoleSnapshot: data.targetRole,
        targetLevelSnapshot: data.targetLevel,
        departmentSnapshot: data.department,
        justification: data.justification,
      },
    });
    await this.audit(
      created.id,
      'CASE_CREATED',
      'AssessmentCase',
      created.id,
      'Created assessment draft',
    );
    return this.get(created.id);
  }

  async submit(caseId: string, expectedVersion: number): Promise<AssessmentCaseDetail> {
    await this.prisma.$transaction(async (tx) => {
      const record = await tx.assessmentCase.findUnique({ where: { id: caseId } });
      if (!record)
        throw new NotFoundException(
          this.error('CASE_NOT_FOUND', 'This assessment case could not be found.'),
        );
      this.assertVersion(record.version, expectedVersion);
      if (record.status !== 'DRAFT')
        throw new BadRequestException(
          this.error('INVALID_TRANSITION', 'Only draft requests can be submitted.'),
        );
      const changed = await tx.assessmentCase.updateMany({
        where: { id: caseId, version: expectedVersion, status: 'DRAFT' },
        data: {
          status: 'PENDING_ELIGIBILITY',
          stage: 'ELIGIBILITY',
          ownerName: 'HR / Talent',
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1)
        throw new ConflictException(
          this.error(
            'CONCURRENCY_CONFLICT',
            'This case changed in another session. Refresh before trying again.',
          ),
        );
      const review = await tx.eligibilityReview.create({
        data: { caseId, policyVersion: '2026.1', criteria: { create: defaultCriteria } },
      });
      await tx.task.create({
        data: {
          caseId,
          assigneeId: 'hr-talent',
          assigneeName: 'HR / Talent',
          taskType: 'ELIGIBILITY_REVIEW',
          status: 'OPEN',
        },
      });
      await tx.auditEvent.create({
        data: this.auditData(
          caseId,
          'CASE_SUBMITTED',
          'AssessmentCase',
          caseId,
          'Submitted request for eligibility review',
        ),
      });
      await tx.notificationOutbox.create({
        data: {
          eventType: 'CASE_SUBMITTED',
          aggregateType: 'AssessmentCase',
          aggregateId: caseId,
          payload: { caseId, reviewId: review.id },
        },
      });
    });
    return this.get(caseId);
  }

  async decideEligibility(
    caseId: string,
    input: EligibilityDecisionInput,
  ): Promise<AssessmentCaseDetail> {
    const parsed = eligibilityDecisionSchema.safeParse(input);
    if (!parsed.success)
      throw new BadRequestException(
        this.error(
          'VALIDATION_ERROR',
          'A valid eligibility decision and version are required.',
          parsed.error.flatten().fieldErrors,
        ),
      );
    if (parsed.data.decision === 'NOT_ELIGIBLE' && !parsed.data.reason?.trim())
      throw new BadRequestException(
        this.error('REASON_REQUIRED', 'A reason is required when the employee is not eligible.'),
      );
    await this.prisma.$transaction(async (tx) => {
      const record = await tx.assessmentCase.findUnique({
        where: { id: caseId },
        include: { eligibility: true },
      });
      if (!record)
        throw new NotFoundException(
          this.error('CASE_NOT_FOUND', 'This assessment case could not be found.'),
        );
      this.assertVersion(record.version, parsed.data.expectedVersion);
      if (!record.eligibility || !['PENDING_ELIGIBILITY', 'NOT_ELIGIBLE'].includes(record.status))
        throw new BadRequestException(
          this.error('INVALID_TRANSITION', 'This case is not ready for an eligibility decision.'),
        );
      const eligible = parsed.data.decision === 'ELIGIBLE';
      const changed = await tx.assessmentCase.updateMany({
        where: {
          id: caseId,
          version: parsed.data.expectedVersion,
          status: { in: ['PENDING_ELIGIBILITY', 'NOT_ELIGIBLE'] },
        },
        data: {
          status: eligible ? 'READY_FOR_PLANNING' : 'NOT_ELIGIBLE',
          stage: eligible ? 'PLANNING' : 'ELIGIBILITY',
          ownerName: eligible ? 'Assessment Coordinator' : 'HR / Talent',
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1)
        throw new ConflictException(
          this.error(
            'CONCURRENCY_CONFLICT',
            'This case changed in another session. Refresh before trying again.',
          ),
        );
      await tx.eligibilityReview.update({
        where: { caseId },
        data: {
          decision: parsed.data.decision,
          decisionReason: parsed.data.reason,
          decidedBy: 'demo-user',
          decidedAt: new Date(),
        },
      });
      if (eligible)
        await tx.task.create({
          data: {
            caseId,
            assigneeId: 'assessment-coordinator',
            assigneeName: 'Assessment Coordinator',
            taskType: 'PLANNING_OPEN',
            status: 'OPEN',
          },
        });
      await tx.auditEvent.create({
        data: this.auditData(
          caseId,
          eligible ? 'ELIGIBILITY_APPROVED' : 'ELIGIBILITY_REJECTED',
          'EligibilityReview',
          record.eligibility.id,
          eligible
            ? 'Eligibility approved; planning task created'
            : 'Eligibility marked not eligible',
        ),
      });
      await tx.notificationOutbox.create({
        data: {
          eventType: eligible ? 'ELIGIBILITY_APPROVED' : 'ELIGIBILITY_REJECTED',
          aggregateType: 'AssessmentCase',
          aggregateId: caseId,
          payload: { caseId, decision: parsed.data.decision },
        },
      });
    });
    return this.get(caseId);
  }

  async requestOverride(caseId: string, reason: string): Promise<AssessmentCaseDetail> {
    if (!reason?.trim())
      throw new BadRequestException(
        this.error('REASON_REQUIRED', 'An override reason is required.'),
      );
    await this.prisma.$transaction(async (tx) => {
      const record = await tx.assessmentCase.findUnique({
        where: { id: caseId },
        include: { eligibility: true },
      });
      if (!record)
        throw new NotFoundException(
          this.error('CASE_NOT_FOUND', 'This assessment case could not be found.'),
        );
      if (record.status !== 'NOT_ELIGIBLE' || !record.eligibility)
        throw new BadRequestException(
          this.error(
            'INVALID_TRANSITION',
            'An override can only be requested after an ineligible decision.',
          ),
        );
      const changed = await tx.assessmentCase.updateMany({
        where: { id: caseId, status: 'NOT_ELIGIBLE' },
        data: {
          status: 'PENDING_ELIGIBILITY',
          ownerName: 'HR Governance',
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1)
        throw new ConflictException(
          this.error(
            'CONCURRENCY_CONFLICT',
            'This case changed in another session. Refresh before trying again.',
          ),
        );
      await tx.eligibilityReview.update({
        where: { caseId },
        data: {
          decision: 'OVERRIDE_REQUESTED',
          decisionReason: reason,
          decidedBy: 'demo-user',
          decidedAt: new Date(),
        },
      });
      await tx.auditEvent.create({
        data: this.auditData(
          caseId,
          'ELIGIBILITY_OVERRIDE_REQUESTED',
          'EligibilityReview',
          record.eligibility.id,
          'Eligibility override requested for governance review',
          reason,
        ),
      });
      await tx.notificationOutbox.create({
        data: {
          eventType: 'ELIGIBILITY_OVERRIDE_REQUESTED',
          aggregateType: 'AssessmentCase',
          aggregateId: caseId,
          payload: { caseId, reason },
        },
      });
    });
    return this.get(caseId);
  }

  private async organization() {
    const organization = await this.prisma.organization.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    if (!organization)
      throw new BadRequestException(
        this.error('DATA_NOT_INITIALIZED', 'Seed the organization before using database mode.'),
      );
    return organization;
  }

  private toDetail(record: CaseWithRelations): AssessmentCaseDetail {
    const eligibility = record.eligibility
      ? {
          policyVersion: record.eligibility.policyVersion,
          criteria: record.eligibility.criteria.map((criterion) => ({
            code: criterion.criterionCode,
            label: criterion.label,
            blocking: criterion.blocking,
            result: criterion.result as 'MET' | 'NOT_MET' | 'NOT_CHECKED',
          })),
          decision:
            record.eligibility.decision === 'ELIGIBLE' ||
            record.eligibility.decision === 'NOT_ELIGIBLE'
              ? record.eligibility.decision
              : undefined,
          reason: record.eligibility.decisionReason ?? undefined,
        }
      : undefined;
    return {
      id: record.id,
      caseCode: record.caseCode,
      employeeId: record.employee.externalId,
      employeeName: record.employee.displayName,
      department: record.departmentSnapshot,
      currentRole: record.currentRoleSnapshot,
      assessmentReason: record.assessmentReason as AssessmentReason,
      targetRole: record.targetRoleSnapshot,
      targetLevel: record.targetLevelSnapshot ?? '',
      stage: record.stage as CaseStage,
      status: record.status as CaseStatus,
      owner: record.ownerName,
      priority: record.priority as 'LOW' | 'NORMAL' | 'HIGH',
      requestedAt: record.requestedAt.toISOString(),
      ageLabel: this.ageLabel(record.requestedAt),
      version: record.version,
      scoringEnabled: false,
      availableActions: actionsForStatus(record.status as CaseStatus),
      justification: record.justification,
      eligibility,
      activity: record.auditEvents.map((event) => ({
        id: event.id,
        actor: event.actorName,
        action: event.reason ?? event.action,
        timestamp: event.createdAt.toISOString(),
        tone: this.activityTone(event.action),
      })),
    };
  }

  private toSummary(detail: AssessmentCaseDetail): AssessmentCaseSummary {
    const {
      justification: _justification,
      eligibility: _eligibility,
      activity: _activity,
      ...summary
    } = detail;
    return summary;
  }

  private taskTitle(taskType: string, employeeName?: string) {
    const subject = employeeName ? ` for ${employeeName}` : '';
    return `${taskType.replaceAll('_', ' ').toLowerCase()}${subject}`;
  }

  private ageLabel(date: Date) {
    const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
    return days === 0 ? 'Today' : `${days}d ago`;
  }

  private activityTone(action: string): 'info' | 'success' | 'warning' | 'danger' {
    if (action.includes('REJECTED')) return 'danger';
    if (action.includes('OVERRIDE')) return 'warning';
    if (action.includes('APPROVED') || action.includes('SUBMITTED')) return 'success';
    return 'info';
  }

  private assertVersion(actual: number, expected: number) {
    if (!Number.isInteger(expected) || expected !== actual)
      throw new ConflictException(
        this.error(
          'CONCURRENCY_CONFLICT',
          'This case changed in another session. Refresh before trying again.',
        ),
      );
  }

  private async audit(
    caseId: string,
    action: string,
    entityType: string,
    entityId: string,
    reason: string,
    detail?: string,
  ) {
    await this.prisma.auditEvent.create({
      data: this.auditData(caseId, action, entityType, entityId, reason, detail),
    });
  }

  private auditData(
    caseId: string,
    action: string,
    entityType: string,
    entityId: string,
    reason: string,
    detail?: string,
  ) {
    return {
      caseId,
      actorId: 'demo-user',
      actorName: 'Demo user',
      action,
      entityType,
      entityId,
      reason: detail ?? reason,
      correlationId: `corr-${randomUUID()}`,
    };
  }

  private error(code: string, message: string, fieldErrors?: Record<string, string[]>) {
    return { error: { code, message, fieldErrors, correlationId: `corr-${randomUUID()}` } };
  }
}
