import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  caseStatuses,
  closeCaseSchema,
  createAttachmentSchema,
  createCaseSchema,
  decideApprovalSchema,
  eligibilityDecisionSchema,
  finalizePlanSchema,
  finalizeResultSchema,
  reopenResultSchema,
  saveEvidenceSchema,
  scheduleEventSchema,
  scheduleReassessmentSchema,
  submitRecommendationSchema,
  updateDevelopmentSchema,
  type AssessmentCaseDetail,
  type AssessmentCaseSummary,
  type AssessmentReason,
  type CaseStage,
  type CaseStatus,
  type CloseCaseInput,
  type CreateAttachmentInput,
  type CreateCaseInput,
  type DecideApprovalInput,
  type EligibilityDecisionInput,
  type FinalizePlanInput,
  type FinalizeResultInput,
  type OverviewResponse,
  type ReopenResultInput,
  type SaveEvidenceInput,
  type ScheduleEventInput,
  type ScheduleReassessmentInput,
  type SubmitRecommendationInput,
  type UpdateDevelopmentInput,
  type AttachmentSummary,
  type AttachmentScanStatus,
  type z as ZodNamespace,
} from '@assessflow/contracts';
import {
  Prisma,
  CaseStatus as PrismaCaseStatus,
  ScanStatus as PrismaScanStatus,
} from '@assessflow/database';
import { PrismaService } from '../database/prisma.service';
import { actionsForStatus } from './workflow-actions';
import { getActorContext } from '../auth';

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

  async create(
    input: CreateCaseInput,
    actor?: { id: string; name: string },
  ): Promise<AssessmentCaseDetail> {
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
      undefined,
      actor,
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
    actor?: { id: string; name: string },
  ): Promise<AssessmentCaseDetail> {
    const currentActor = actor ?? getActorContext();
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
          decidedBy: currentActor.name ?? 'demo-user',
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
          undefined,
          currentActor,
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

  async requestOverride(
    caseId: string,
    reason: string,
    actor?: { id: string; name: string },
  ): Promise<AssessmentCaseDetail> {
    const currentActor = actor ?? getActorContext();
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
          decidedBy: currentActor.name ?? 'demo-user',
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
          currentActor,
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

  // ---------------------------------------------------------------------------
  // Workflow expansion: planning → events → evidence → result → recommendation
  // → approval → development → reassessment → closure.
  // Every command runs in one transaction, checks optimistic version, writes
  // audit + outbox, and maintains tasks. See docs/workflow-state-machine.md.
  // ---------------------------------------------------------------------------

  private readonly methodLabels: Record<string, string> = {
    CBI: 'Competency-Based Interview',
    CASE_STUDY: 'Case Study / Work Sample',
    ROLEPLAY: 'Roleplay',
  };

  async finalizePlan(caseId: string, input: FinalizePlanInput): Promise<AssessmentCaseDetail> {
    const parsed = this.parsed(
      finalizePlanSchema,
      input,
      'A valid plan with at least one method and version is required.',
    );
    await this.prisma.$transaction(async (tx) => {
      const record = await tx.assessmentCase.findUnique({
        where: { id: caseId },
        include: { plan: true },
      });
      if (!record)
        throw new NotFoundException(
          this.error('CASE_NOT_FOUND', 'This assessment case could not be found.'),
        );
      this.assertVersion(record.version, parsed.expectedVersion);
      if (record.status !== 'READY_FOR_PLANNING')
        throw new BadRequestException(
          this.error(
            'INVALID_TRANSITION',
            'A plan can only be finalized from readiness for planning.',
          ),
        );
      const changed = await tx.assessmentCase.updateMany({
        where: { id: caseId, version: parsed.expectedVersion, status: 'READY_FOR_PLANNING' },
        data: {
          status: 'PLANNING',
          stage: 'PLANNING',
          ownerName: 'Assessment Coordinator',
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw this.concurrencyError();
      if (record.plan) {
        await tx.assessmentPlanMethod.deleteMany({ where: { planId: record.plan.id } });
        await tx.assessmentPlan.update({
          where: { id: record.plan.id },
          data: {
            complexityBand: parsed.complexityBand,
            leadAssessor: parsed.leadAssessor,
            deviationReason: parsed.deviationReason,
            version: { increment: 1 },
          },
        });
      } else {
        const plan = await tx.assessmentPlan.create({
          data: {
            caseId,
            complexityBand: parsed.complexityBand,
            leadAssessor: parsed.leadAssessor,
            deviationReason: parsed.deviationReason,
          },
        });
        record.plan = plan;
      }
      await tx.assessmentPlanMethod.createMany({
        data: parsed.methods.map((method) => ({
          planId: (record.plan as { id: string }).id,
          methodCode: method.methodCode,
          methodLabel:
            method.methodLabel ?? this.methodLabels[method.methodCode] ?? method.methodCode,
          required: method.required,
          durationMin: method.durationMin,
        })),
      });
      await tx.task.updateMany({
        where: { caseId, taskType: 'PLANNING_OPEN', status: 'OPEN' },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      await tx.task.create({
        data: {
          caseId,
          assigneeId: 'assessment-coordinator',
          assigneeName: 'Assessment Coordinator',
          taskType: 'EVENT_SCHEDULING',
          status: 'OPEN',
        },
      });
      await tx.auditEvent.create({
        data: this.auditData(
          caseId,
          'PLAN_FINALIZED',
          'AssessmentPlan',
          (record.plan as { id: string }).id,
          'Assessment plan finalized',
        ),
      });
      await tx.notificationOutbox.create({
        data: {
          eventType: 'PLAN_FINALIZED',
          aggregateType: 'AssessmentCase',
          aggregateId: caseId,
          payload: { caseId, planId: (record.plan as { id: string }).id },
        },
      });
    });
    return this.get(caseId);
  }

  async scheduleEvent(
    caseId: string,
    input: ScheduleEventInput,
  ): Promise<AssessmentCaseDetail & { eventId: string }> {
    const parsed = this.parsed(
      scheduleEventSchema,
      input,
      'A valid event schedule with start time and version is required.',
    );
    let eventId = '';
    await this.prisma.$transaction(async (tx) => {
      const record = await tx.assessmentCase.findUnique({
        where: { id: caseId },
        include: { plan: { include: { methods: true } } },
      });
      if (!record)
        throw new NotFoundException(
          this.error('CASE_NOT_FOUND', 'This assessment case could not be found.'),
        );
      this.assertVersion(record.version, parsed.expectedVersion);
      if (!['PLANNING', 'SCHEDULED'].includes(record.status))
        throw new BadRequestException(
          this.error('INVALID_TRANSITION', 'Events can only be scheduled during planning.'),
        );
      if (parsed.planMethodId && !record.plan?.methods.some((m) => m.id === parsed.planMethodId))
        throw new BadRequestException(
          this.error('UNKNOWN_METHOD', 'The selected plan method does not belong to this case.'),
        );
      const changed = await tx.assessmentCase.updateMany({
        where: {
          id: caseId,
          version: parsed.expectedVersion,
          status: { in: ['PLANNING', 'SCHEDULED'] },
        },
        data: {
          status: 'SCHEDULED',
          stage: 'ASSESSMENT',
          ownerName: 'Assessment Coordinator',
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw this.concurrencyError();
      const event = await tx.assessmentEvent.create({
        data: {
          caseId,
          planMethodId: parsed.planMethodId,
          status: parsed.startsAt ? 'SCHEDULED' : 'PLANNED',
          startsAt: parsed.startsAt ? new Date(parsed.startsAt) : undefined,
          endsAt: parsed.endsAt ? new Date(parsed.endsAt) : undefined,
          timezone: parsed.timezone,
          location: parsed.location,
          meetingLink: parsed.meetingLink,
        },
      });
      eventId = event.id;
      if (parsed.assessors?.length) {
        await tx.eventAssessor.createMany({
          data: parsed.assessors.map((a) => ({
            eventId: event.id,
            userId: a.userId,
            displayName: a.displayName,
            role: 'ASSESSOR',
          })),
          skipDuplicates: true,
        });
      }
      await tx.auditEvent.create({
        data: this.auditData(
          caseId,
          'EVENT_SCHEDULED',
          'AssessmentEvent',
          event.id,
          'Assessment event scheduled',
        ),
      });
      await tx.notificationOutbox.create({
        data: {
          eventType: 'EVENT_SCHEDULED',
          aggregateType: 'AssessmentCase',
          aggregateId: caseId,
          payload: { caseId, eventId: event.id },
        },
      });
    });
    return { ...(await this.get(caseId)), eventId };
  }

  async saveEvidence(
    eventId: string,
    assessor: { id: string; name: string },
    input: SaveEvidenceInput,
    submit: boolean,
  ): Promise<AssessmentCaseDetail & { evidenceId: string; submitted: boolean }> {
    const parsed = this.parsed(
      saveEvidenceSchema,
      input,
      'Evidence needs a summary of at least 20 characters.',
    );
    let evidenceId = '';
    let submitted = false;
    await this.prisma.$transaction(async (tx) => {
      const event = await tx.assessmentEvent.findUnique({
        where: { id: eventId },
        include: { case: true, evidence: true },
      });
      if (!event)
        throw new NotFoundException(
          this.error('EVENT_NOT_FOUND', 'This assessment event could not be found.'),
        );
      if (!['SCHEDULED', 'IN_PROGRESS'].includes(event.case.status))
        throw new BadRequestException(
          this.error(
            'INVALID_TRANSITION',
            'Evidence can only be recorded for scheduled or in-progress assessments.',
          ),
        );
      const existing = event.evidence.find((e) => e.assessorId === assessor.id);
      if (existing) {
        if (existing.submittedAt)
          throw new BadRequestException(
            this.error(
              'ALREADY_SUBMITTED',
              'Submitted evidence cannot be edited. Submit a supplement instead.',
            ),
          );
        await tx.evidenceSubmission.update({
          where: { id: existing.id },
          data: {
            summary: parsed.summary,
            strengths: parsed.strengths,
            gaps: parsed.gaps,
            submittedAt: submit ? new Date() : undefined,
          },
        });
        evidenceId = existing.id;
        submitted = submit || existing.submittedAt !== null;
      } else {
        const created = await tx.evidenceSubmission.create({
          data: {
            caseId: event.caseId,
            eventId: event.id,
            assessorId: assessor.id,
            assessorName: assessor.name,
            summary: parsed.summary,
            strengths: parsed.strengths,
            gaps: parsed.gaps,
            submittedAt: submit ? new Date() : undefined,
          },
        });
        evidenceId = created.id;
        submitted = submit;
      }
      if (submit && event.case.status === 'SCHEDULED') {
        await tx.assessmentCase.updateMany({
          where: { id: event.caseId, status: 'SCHEDULED' },
          data: {
            status: 'IN_PROGRESS',
            stage: 'ASSESSMENT',
            ownerName: 'Assessor Panel',
            version: { increment: 1 },
          },
        });
      }
      await tx.auditEvent.create({
        data: this.auditData(
          event.caseId,
          submit ? 'EVIDENCE_SUBMITTED' : 'EVIDENCE_SAVED',
          'EvidenceSubmission',
          evidenceId,
          submit ? 'Assessor evidence submitted' : 'Assessor evidence draft saved',
        ),
      });
      if (submit) {
        await tx.notificationOutbox.create({
          data: {
            eventType: 'EVIDENCE_SUBMITTED',
            aggregateType: 'AssessmentCase',
            aggregateId: event.caseId,
            payload: { caseId: event.caseId, eventId, evidenceId },
          },
        });
      }
    });
    const detail = await this.get(
      (await this.prisma.assessmentEvent.findUniqueOrThrow({ where: { id: eventId } })).caseId,
    );
    return { ...detail, evidenceId, submitted };
  }

  async finalizeResult(
    caseId: string,
    input: FinalizeResultInput,
    actor?: { id: string; name: string },
  ): Promise<AssessmentCaseDetail> {
    const currentActor = actor ?? getActorContext();
    const parsed = this.parsed(
      finalizeResultSchema,
      input,
      'A valid result code and version are required.',
    );
    await this.prisma.$transaction(async (tx) => {
      const record = await tx.assessmentCase.findUnique({ where: { id: caseId } });
      if (!record)
        throw new NotFoundException(
          this.error('CASE_NOT_FOUND', 'This assessment case could not be found.'),
        );
      this.assertVersion(record.version, parsed.expectedVersion);
      if (record.status !== 'IN_PROGRESS')
        throw new BadRequestException(
          this.error(
            'INVALID_TRANSITION',
            'A result can only be finalized while assessment is in progress.',
          ),
        );
      const changed = await tx.assessmentCase.updateMany({
        where: { id: caseId, version: parsed.expectedVersion, status: 'IN_PROGRESS' },
        data: {
          status: 'RESULT_FINALIZED',
          stage: 'RESULT',
          ownerName: 'Panel Lead',
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw this.concurrencyError();
      const aggregate = await tx.resultRevision.aggregate({
        where: { caseId },
        _max: { revision: true },
      });
      await tx.resultRevision.create({
        data: {
          caseId,
          revision: (aggregate._max.revision ?? 0) + 1,
          resultCode: parsed.resultCode,
          evidenceSummary: parsed.evidenceSummary,
          strengths: parsed.strengths,
          gaps: parsed.gaps,
          developmentFocus: parsed.developmentFocus,
          finalizedAt: new Date(),
          finalizedBy: currentActor.name ?? 'demo-user',
        },
      });
      await tx.task.create({
        data: {
          caseId,
          assigneeId: 'business-owner',
          assigneeName: 'Business Owner',
          taskType: 'RECOMMENDATION_DRAFT',
          status: 'OPEN',
        },
      });
      await tx.auditEvent.create({
        data: this.auditData(
          caseId,
          'RESULT_FINALIZED',
          'ResultRevision',
          caseId,
          `Result finalized: ${parsed.resultCode}`,
          undefined,
          currentActor,
        ),
      });
      await tx.notificationOutbox.create({
        data: {
          eventType: 'RESULT_FINALIZED',
          aggregateType: 'AssessmentCase',
          aggregateId: caseId,
          payload: { caseId, resultCode: parsed.resultCode },
        },
      });
    });
    return this.get(caseId);
  }

  async reopenResult(
    caseId: string,
    input: ReopenResultInput,
    actor?: { id: string; name: string },
  ): Promise<AssessmentCaseDetail> {
    const currentActor = actor ?? getActorContext();
    const parsed = this.parsed(
      reopenResultSchema,
      input,
      'A reopen reason and version are required.',
    );
    await this.prisma.$transaction(async (tx) => {
      const record = await tx.assessmentCase.findUnique({ where: { id: caseId } });
      if (!record)
        throw new NotFoundException(
          this.error('CASE_NOT_FOUND', 'This assessment case could not be found.'),
        );
      this.assertVersion(record.version, parsed.expectedVersion);
      if (record.status !== 'RESULT_FINALIZED')
        throw new BadRequestException(
          this.error('INVALID_TRANSITION', 'Only a finalized result can be reopened.'),
        );
      const changed = await tx.assessmentCase.updateMany({
        where: { id: caseId, version: parsed.expectedVersion, status: 'RESULT_FINALIZED' },
        data: {
          status: 'IN_PROGRESS',
          stage: 'ASSESSMENT',
          ownerName: 'Panel Lead',
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw this.concurrencyError();
      const latest = await tx.resultRevision.findFirst({
        where: { caseId },
        orderBy: { revision: 'desc' },
      });
      if (latest) {
        await tx.resultRevision.update({
          where: { id: latest.id },
          data: { reopenedAt: new Date(), reopenReason: parsed.reason },
        });
      }
      await tx.auditEvent.create({
        data: this.auditData(
          caseId,
          'RESULT_REOPENED',
          'ResultRevision',
          latest?.id ?? caseId,
          'Result reopened',
          parsed.reason,
          currentActor,
        ),
      });
      await tx.notificationOutbox.create({
        data: {
          eventType: 'RESULT_REOPENED',
          aggregateType: 'AssessmentCase',
          aggregateId: caseId,
          payload: { caseId, reason: parsed.reason },
        },
      });
    });
    return this.get(caseId);
  }

  async submitRecommendation(
    caseId: string,
    input: SubmitRecommendationInput,
    actor?: { id: string; name: string },
  ): Promise<AssessmentCaseDetail> {
    const currentActor = actor ?? getActorContext();
    const parsed = this.parsed(
      submitRecommendationSchema,
      input,
      'A valid recommendation with rationale and version is required.',
    );
    await this.prisma.$transaction(async (tx) => {
      const record = await tx.assessmentCase.findUnique({ where: { id: caseId } });
      if (!record)
        throw new NotFoundException(
          this.error('CASE_NOT_FOUND', 'This assessment case could not be found.'),
        );
      this.assertVersion(record.version, parsed.expectedVersion);
      if (!['RESULT_FINALIZED', 'PENDING_RECOMMENDATION'].includes(record.status))
        throw new BadRequestException(
          this.error('INVALID_TRANSITION', 'A recommendation requires a finalized result.'),
        );
      const changed = await tx.assessmentCase.updateMany({
        where: {
          id: caseId,
          version: parsed.expectedVersion,
          status: { in: ['RESULT_FINALIZED', 'PENDING_RECOMMENDATION'] },
        },
        data: {
          status: 'PENDING_APPROVAL',
          stage: 'APPROVAL',
          ownerName: 'Business Approver',
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw this.concurrencyError();
      const aggregate = await tx.recommendationRevision.aggregate({
        where: { caseId },
        _max: { revision: true },
      });
      const revision = await tx.recommendationRevision.create({
        data: {
          caseId,
          revision: (aggregate._max.revision ?? 0) + 1,
          code: parsed.code,
          status: 'PENDING_APPROVAL',
          rationale: parsed.rationale,
          requiresDevelopment: parsed.requiresDevelopment,
          requiresReassessment: parsed.requiresReassessment,
          targetDate: parsed.targetDate ? new Date(parsed.targetDate) : undefined,
          submittedAt: new Date(),
          createdBy: currentActor.name ?? 'demo-user',
        },
      });
      await tx.approvalStep.deleteMany({ where: { caseId } });
      await tx.approvalStep.createMany({
        data: [
          { caseId, sequence: 1, role: 'HR' },
          { caseId, sequence: 2, role: 'BUSINESS' },
        ],
      });
      await tx.task.updateMany({
        where: { caseId, taskType: 'RECOMMENDATION_DRAFT', status: 'OPEN' },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      await tx.task.create({
        data: {
          caseId,
          assigneeId: 'hr-approver',
          assigneeName: 'HR Approver',
          taskType: 'APPROVAL_STEP_1',
          status: 'OPEN',
        },
      });
      await tx.auditEvent.create({
        data: this.auditData(
          caseId,
          'RECOMMENDATION_SUBMITTED',
          'RecommendationRevision',
          revision.id,
          'Recommendation submitted for approval',
          undefined,
          currentActor,
        ),
      });
      await tx.notificationOutbox.create({
        data: {
          eventType: 'RECOMMENDATION_SUBMITTED',
          aggregateType: 'AssessmentCase',
          aggregateId: caseId,
          payload: { caseId, revisionId: revision.id },
        },
      });
    });
    return this.get(caseId);
  }

  async decideApproval(
    stepId: string,
    input: DecideApprovalInput,
    actor?: { id: string; name: string },
  ): Promise<AssessmentCaseDetail & { stepId: string }> {
    const currentActor = actor ?? getActorContext();
    const parsed = this.parsed(
      decideApprovalSchema,
      input,
      'A valid approval decision is required.',
    );
    let caseId = '';
    await this.prisma.$transaction(async (tx) => {
      const step = await tx.approvalStep.findUnique({
        where: { id: stepId },
        include: { case: true },
      });
      if (!step)
        throw new NotFoundException(
          this.error('STEP_NOT_FOUND', 'This approval step could not be found.'),
        );
      caseId = step.caseId;
      if (step.decision !== 'PENDING')
        throw new BadRequestException(
          this.error('INVALID_TRANSITION', 'This approval step has already been decided.'),
        );
      if (step.case.status !== 'PENDING_APPROVAL')
        throw new BadRequestException(
          this.error('INVALID_TRANSITION', 'This case is not waiting for approval.'),
        );
      await tx.approvalStep.update({
        where: { id: stepId },
        data: {
          decision: parsed.decision,
          comment: parsed.comment,
          decidedAt: new Date(),
          approverId: currentActor.id ?? 'demo-user',
          approverName: currentActor.name ?? 'Demo user',
        },
      });
      const steps = await tx.approvalStep.findMany({
        where: { caseId: step.caseId },
        orderBy: { sequence: 'asc' },
      });
      if (parsed.decision === 'REJECTED' || parsed.decision === 'CHANGES_REQUESTED') {
        const rejected = parsed.decision === 'REJECTED';
        await tx.assessmentCase.updateMany({
          where: { id: step.caseId, status: 'PENDING_APPROVAL' },
          data: {
            status: 'PENDING_RECOMMENDATION',
            stage: 'RECOMMENDATION',
            ownerName: 'Business Owner',
            version: { increment: 1 },
          },
        });
        await tx.recommendationRevision.updateMany({
          where: { caseId: step.caseId, status: 'PENDING_APPROVAL' },
          data: { status: rejected ? 'REJECTED' : 'CHANGES_REQUESTED' },
        });
        await tx.auditEvent.create({
          data: this.auditData(
            step.caseId,
            rejected ? 'APPROVAL_REJECTED' : 'APPROVAL_CHANGES_REQUESTED',
            'ApprovalStep',
            stepId,
            `Approval step ${parsed.decision}`,
            parsed.comment,
          ),
        });
        await tx.notificationOutbox.create({
          data: {
            eventType: rejected ? 'APPROVAL_REJECTED' : 'APPROVAL_CHANGES_REQUESTED',
            aggregateType: 'AssessmentCase',
            aggregateId: step.caseId,
            payload: { caseId: step.caseId, stepId },
          },
        });
        return;
      }
      if (
        steps.every((s) =>
          s.id === stepId ? parsed.decision === 'APPROVED' : s.decision === 'APPROVED',
        )
      ) {
        await tx.assessmentCase.updateMany({
          where: { id: step.caseId, status: 'PENDING_APPROVAL' },
          data: {
            status: 'APPROVED',
            stage: 'APPROVAL',
            ownerName: 'HR / Talent',
            version: { increment: 1 },
          },
        });
        await tx.recommendationRevision.updateMany({
          where: { caseId: step.caseId, status: 'PENDING_APPROVAL' },
          data: { status: 'APPROVED' },
        });
        await tx.task.updateMany({
          where: { caseId: step.caseId, taskType: { startsWith: 'APPROVAL_STEP' }, status: 'OPEN' },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });
        await tx.auditEvent.create({
          data: this.auditData(
            step.caseId,
            'APPROVAL_GRANTED',
            'ApprovalStep',
            stepId,
            'All approval steps granted',
          ),
        });
        await tx.notificationOutbox.create({
          data: {
            eventType: 'CASE_APPROVED',
            aggregateType: 'AssessmentCase',
            aggregateId: step.caseId,
            payload: { caseId: step.caseId },
          },
        });
      } else {
        const next = steps.find((s) => s.decision === 'PENDING' && s.id !== stepId);
        if (next) {
          await tx.task.create({
            data: {
              caseId: step.caseId,
              assigneeId: `${next.role.toLowerCase()}-approver`,
              assigneeName: `${next.role} Approver`,
              taskType: `APPROVAL_STEP_${next.sequence}`,
              status: 'OPEN',
            },
          });
        }
        await tx.auditEvent.create({
          data: this.auditData(
            step.caseId,
            'APPROVAL_STEP_DECIDED',
            'ApprovalStep',
            stepId,
            `Approval step ${parsed.decision} (${step.sequence})`,
            parsed.comment,
          ),
        });
      }
    });
    return { ...(await this.get(caseId)), stepId };
  }

  async updateDevelopment(
    caseId: string,
    input: UpdateDevelopmentInput,
  ): Promise<AssessmentCaseDetail> {
    const parsed = this.parsed(
      updateDevelopmentSchema,
      input,
      'A valid development update and version are required.',
    );
    await this.prisma.$transaction(async (tx) => {
      const record = await tx.assessmentCase.findUnique({
        where: { id: caseId },
        include: { developmentPlan: true },
      });
      if (!record)
        throw new NotFoundException(
          this.error('CASE_NOT_FOUND', 'This assessment case could not be found.'),
        );
      this.assertVersion(record.version, parsed.expectedVersion);
      if (!['APPROVED', 'DEVELOPMENT_IN_PROGRESS'].includes(record.status))
        throw new BadRequestException(
          this.error('INVALID_TRANSITION', 'A development plan requires an approved case.'),
        );
      const changed = await tx.assessmentCase.updateMany({
        where: {
          id: caseId,
          version: parsed.expectedVersion,
          status: { in: ['APPROVED', 'DEVELOPMENT_IN_PROGRESS'] },
        },
        data: {
          status: 'DEVELOPMENT_IN_PROGRESS',
          stage: 'FOLLOW_UP',
          ownerName: 'Manager',
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw this.concurrencyError();
      let planId = record.developmentPlan?.id;
      if (planId) {
        await tx.developmentPlan.update({
          where: { id: planId },
          data: {
            targetDate: parsed.targetDate ? new Date(parsed.targetDate) : undefined,
            status: 'IN_PROGRESS',
          },
        });
      } else {
        const plan = await tx.developmentPlan.create({
          data: {
            caseId,
            ownerName: 'Manager',
            targetDate: parsed.targetDate ? new Date(parsed.targetDate) : undefined,
            status: 'IN_PROGRESS',
          },
        });
        planId = plan.id;
      }
      if (parsed.actions) {
        await tx.developmentAction.deleteMany({ where: { planId } });
        if (parsed.actions.length) {
          await tx.developmentAction.createMany({
            data: parsed.actions.map((action) => ({
              planId: planId as string,
              title: action.title,
              ownerName: action.ownerName,
              dueDate: action.dueDate ? new Date(action.dueDate) : undefined,
              status: action.status,
              evidenceNote: action.evidenceNote,
            })),
          });
        }
      }
      await tx.auditEvent.create({
        data: this.auditData(
          caseId,
          'DEVELOPMENT_UPDATED',
          'DevelopmentPlan',
          planId,
          'Development plan updated',
        ),
      });
      await tx.notificationOutbox.create({
        data: {
          eventType: 'DEVELOPMENT_UPDATED',
          aggregateType: 'AssessmentCase',
          aggregateId: caseId,
          payload: { caseId, planId },
        },
      });
    });
    return this.get(caseId);
  }

  async scheduleReassessment(
    sourceCaseId: string,
    input: ScheduleReassessmentInput,
  ): Promise<AssessmentCaseDetail & { linkId: string; sourceCaseId: string }> {
    const parsed = this.parsed(
      scheduleReassessmentSchema,
      input,
      'A reassessment reason and version are required.',
    );
    let linkId = '';
    let newCaseId = '';
    await this.prisma.$transaction(async (tx) => {
      const source = await tx.assessmentCase.findUnique({ where: { id: sourceCaseId } });
      if (!source)
        throw new NotFoundException(
          this.error('CASE_NOT_FOUND', 'This assessment case could not be found.'),
        );
      this.assertVersion(source.version, parsed.expectedVersion);
      if (!['APPROVED', 'DEVELOPMENT_IN_PROGRESS', 'CLOSED'].includes(source.status))
        throw new BadRequestException(
          this.error(
            'INVALID_TRANSITION',
            'Reassessment requires an approved, in-development, or closed case. Prior cases stay immutable.',
          ),
        );
      const created = await tx.assessmentCase.create({
        data: {
          caseCode: `AF-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
          organizationId: source.organizationId,
          employeeId: source.employeeId,
          assessmentReason: source.assessmentReason,
          stage: 'REQUEST',
          status: 'DRAFT',
          ownerName: 'Requester',
          priority: source.priority,
          currentRoleSnapshot: source.currentRoleSnapshot,
          targetRoleSnapshot: source.targetRoleSnapshot,
          targetLevelSnapshot: source.targetLevelSnapshot,
          managerSnapshot: source.managerSnapshot,
          departmentSnapshot: source.departmentSnapshot,
          justification: `Reassessment of ${source.caseCode}: ${parsed.reason}`,
        },
      });
      newCaseId = created.id;
      const link = await tx.reassessmentLink.create({
        data: {
          sourceCaseId,
          reassessmentCaseId: created.id,
          reason: parsed.reason,
          targetDate: parsed.targetDate ? new Date(parsed.targetDate) : undefined,
        },
      });
      linkId = link.id;
      await tx.auditEvent.create({
        data: this.auditData(
          sourceCaseId,
          'REASSESSMENT_SCHEDULED',
          'ReassessmentLink',
          link.id,
          'Reassessment scheduled',
          parsed.reason,
        ),
      });
      await tx.auditEvent.create({
        data: this.auditData(
          created.id,
          'CASE_CREATED',
          'AssessmentCase',
          created.id,
          `Reassessment draft for ${source.caseCode}`,
        ),
      });
      await tx.notificationOutbox.create({
        data: {
          eventType: 'REASSESSMENT_SCHEDULED',
          aggregateType: 'AssessmentCase',
          aggregateId: sourceCaseId,
          payload: { sourceCaseId, reassessmentCaseId: created.id },
        },
      });
    });
    return { ...(await this.get(newCaseId)), linkId, sourceCaseId };
  }

  async closeCase(caseId: string, input: CloseCaseInput): Promise<AssessmentCaseDetail> {
    const parsed = this.parsed(closeCaseSchema, input, 'A version is required to close the case.');
    await this.prisma.$transaction(async (tx) => {
      const record = await tx.assessmentCase.findUnique({ where: { id: caseId } });
      if (!record)
        throw new NotFoundException(
          this.error('CASE_NOT_FOUND', 'This assessment case could not be found.'),
        );
      this.assertVersion(record.version, parsed.expectedVersion);
      if (!['APPROVED', 'DEVELOPMENT_IN_PROGRESS'].includes(record.status))
        throw new BadRequestException(
          this.error('INVALID_TRANSITION', 'Only approved or in-development cases can be closed.'),
        );
      const changed = await tx.assessmentCase.updateMany({
        where: {
          id: caseId,
          version: parsed.expectedVersion,
          status: { in: ['APPROVED', 'DEVELOPMENT_IN_PROGRESS'] },
        },
        data: {
          status: 'CLOSED',
          stage: 'CLOSED',
          ownerName: 'HR / Talent',
          closedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw this.concurrencyError();
      await tx.task.updateMany({
        where: { caseId, status: 'OPEN' },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: this.auditData(
          caseId,
          'CASE_CLOSED',
          'AssessmentCase',
          caseId,
          'Case closed after approval and follow-up ownership',
        ),
      });
      await tx.notificationOutbox.create({
        data: {
          eventType: 'CASE_CLOSED',
          aggregateType: 'AssessmentCase',
          aggregateId: caseId,
          payload: { caseId },
        },
      });
    });
    return this.get(caseId);
  }

  async getPlan(caseId: string) {
    const plan = await this.prisma.assessmentPlan.findUnique({
      where: { caseId },
      include: {
        methods: {
          include: {
            events: { include: { assessors: true, _count: { select: { evidence: true } } } },
          },
        },
      },
    });
    if (!plan)
      throw new NotFoundException(
        this.error('PLAN_NOT_FOUND', 'No assessment plan exists for this case yet.'),
      );
    return plan;
  }

  async listEvents(caseId: string) {
    await this.requireCase(caseId);
    return this.prisma.assessmentEvent.findMany({
      where: { caseId },
      include: { assessors: true, planMethod: true, _count: { select: { evidence: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getResult(caseId: string) {
    const result = await this.prisma.resultRevision.findFirst({
      where: { caseId },
      orderBy: { revision: 'desc' },
    });
    if (!result)
      throw new NotFoundException(
        this.error('RESULT_NOT_FOUND', 'No result has been finalized for this case yet.'),
      );
    return result;
  }

  async getRecommendation(caseId: string) {
    const recommendation = await this.prisma.recommendationRevision.findFirst({
      where: { caseId },
      orderBy: { revision: 'desc' },
    });
    if (!recommendation)
      throw new NotFoundException(
        this.error('RECOMMENDATION_NOT_FOUND', 'No recommendation exists for this case yet.'),
      );
    return recommendation;
  }

  async listApprovalSteps(caseId: string) {
    await this.requireCase(caseId);
    return this.prisma.approvalStep.findMany({ where: { caseId }, orderBy: { sequence: 'asc' } });
  }

  async getDevelopment(caseId: string) {
    const plan = await this.prisma.developmentPlan.findUnique({
      where: { caseId },
      include: { actions: true },
    });
    if (!plan)
      throw new NotFoundException(
        this.error('DEVELOPMENT_NOT_FOUND', 'No development plan exists for this case yet.'),
      );
    return plan;
  }

  private async requireCase(caseId: string) {
    const record = await this.prisma.assessmentCase.findUnique({ where: { id: caseId } });
    if (!record)
      throw new NotFoundException(
        this.error('CASE_NOT_FOUND', 'This assessment case could not be found.'),
      );
    return record;
  }

  private concurrencyError() {
    return new ConflictException(
      this.error(
        'CONCURRENCY_CONFLICT',
        'This case changed in another session. Refresh before trying again.',
      ),
    );
  }

  private parsed<T>(schema: ZodNamespace.ZodType<T>, input: unknown, message: string): T {
    const result = schema.safeParse(input);
    if (!result.success) {
      throw new BadRequestException(
        this.error(
          'VALIDATION_ERROR',
          message,
          result.error.flatten().fieldErrors as Record<string, string[]>,
        ),
      );
    }
    return result.data;
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
    actor?: { id: string; name: string },
  ) {
    await this.prisma.auditEvent.create({
      data: this.auditData(caseId, action, entityType, entityId, reason, detail, actor),
    });
  }

  private auditData(
    caseId: string,
    action: string,
    entityType: string,
    entityId: string,
    reason: string,
    detail?: string,
    actor?: { id: string; name: string },
  ) {
    const currentActor = actor ?? getActorContext();
    return {
      caseId,
      actorId: currentActor.id ?? 'demo-user',
      actorName: currentActor.name ?? 'Demo user',
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

  async createAttachment(
    input: CreateAttachmentInput,
    actor: { id: string; name: string },
  ): Promise<AttachmentSummary> {
    const data = this.parsed(createAttachmentSchema, input, 'A valid attachment payload is required.');
    const id = randomUUID();
    const storageKey = data.storageKey ?? `quarantine/${data.caseId}/${id}-${data.fileName}`;

    await this.requireCase(data.caseId);
    if (data.evidenceId) {
      const evidence = await this.prisma.evidenceSubmission.findUnique({ where: { id: data.evidenceId } });
      if (!evidence || evidence.caseId !== data.caseId)
        throw new NotFoundException(
          this.error('EVIDENCE_NOT_FOUND', 'The linked evidence does not belong to this case.'),
        );
    }
    const created = await this.prisma.attachment.create({
      data: {
        id,
        caseId: data.caseId,
        evidenceId: data.evidenceId ?? null,
        classification: data.classification,
        fileName: data.fileName,
        contentType: data.contentType,
        sizeBytes: BigInt(data.sizeBytes),
        storageKey,
        scanStatus: PrismaScanStatus.PENDING,
        createdBy: actor.id,
      },
    });

    await this.audit(
      data.caseId,
      'ATTACHMENT_UPLOADED',
      'Attachment',
      created.id,
      `Attachment uploaded: ${data.fileName} (${data.classification})`,
      undefined,
      actor,
    );

    return this.serializeAttachment(created);
  }

  async getAttachment(attachmentId: string): Promise<AttachmentSummary> {
    const found = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
    });
    if (!found) {
      throw new NotFoundException(
        this.error('ATTACHMENT_NOT_FOUND', `Attachment '${attachmentId}' not found.`),
      );
    }
    return this.serializeAttachment(found);
  }

  async listAttachments(caseId: string): Promise<AttachmentSummary[]> {
    const list = await this.prisma.attachment.findMany({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
    });
    return list.map((item) => this.serializeAttachment(item));
  }

  async updateAttachmentScan(
    attachmentId: string,
    scanStatus: AttachmentScanStatus,
    scanReason?: string | null,
    scannedAt: Date = new Date(),
  ): Promise<AttachmentSummary> {
    const updated = await this.prisma.attachment.update({
      where: { id: attachmentId },
      data: {
        scanStatus: scanStatus as PrismaScanStatus,
        scanReason: scanReason ?? null,
        scannedAt,
      },
    });
    return this.serializeAttachment(updated);
  }

  async getPendingAttachments(limit = 50): Promise<AttachmentSummary[]> {
    const items = await this.prisma.attachment.findMany({
      where: { scanStatus: PrismaScanStatus.PENDING },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });
    return items.map((item) => this.serializeAttachment(item));
  }

  private serializeAttachment(item: {
    id: string;
    caseId: string;
    evidenceId?: string | null;
    classification: string;
    fileName: string;
    contentType: string;
    sizeBytes: bigint | number;
    storageKey: string;
    scanStatus: string;
    scanReason?: string | null;
    createdBy: string;
    createdAt: Date | string;
    scannedAt?: Date | string | null;
  }): AttachmentSummary {
    return {
      id: item.id,
      caseId: item.caseId,
      evidenceId: item.evidenceId ?? null,
      classification: item.classification,
      fileName: item.fileName,
      contentType: item.contentType,
      sizeBytes: Number(item.sizeBytes),
      storageKey: item.storageKey,
      scanStatus: item.scanStatus as AttachmentScanStatus,
      scanReason: item.scanReason ?? null,
      createdBy: item.createdBy,
      createdAt:
        item.createdAt instanceof Date ? item.createdAt.toISOString() : String(item.createdAt),
      scannedAt: item.scannedAt
        ? item.scannedAt instanceof Date
          ? item.scannedAt.toISOString()
          : String(item.scannedAt)
        : null,
      downloadUrl:
        item.scanStatus === 'CLEAN'
          ? `https://storage.local/clean/${item.storageKey}?action=download`
          : null,
      previewUrl:
        item.scanStatus === 'CLEAN'
          ? `https://storage.local/clean/${item.storageKey}?action=preview`
          : null,
    };
  }
}
