import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  caseStatuses,
  adminEditRequestSchema,
  closeCaseSchema,
  adminReopenStageSchema,
  createAttachmentSchema,
  createCaseSchema,
  DEFAULT_SLA_WINDOWS,
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
  updateAssessorRecommendationSchema,
  calculateScorecard,
  isValidQuestionScore,
  scorecardWeightProblems,
  defaultScorecardConfig,
  scorecardRatingKey,
  scorecardConfigSchema,
  scorecardRatingsSchema,
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
  type ScorecardConfig,
  type ScorecardRatings,
  type SubmitRecommendationInput,
  type UpdateDevelopmentInput,
  type UpdateAssessorRecommendationInput,
  type AttachmentSummary,
  type AttachmentScanStatus,
  type AdminReopenStageInput,
  type AdminEditRequestInput,
  type z as ZodNamespace,
} from '@assessflow/contracts';
import {
  Prisma,
  CaseStatus as PrismaCaseStatus,
  ScanStatus as PrismaScanStatus,
} from '@assessflow/database';
import { PrismaService } from '../database/prisma.service';
import { actionsForActor } from './workflow-actions';
import { getActorContext, type AuthActor } from '../auth';
import {
  caseScopeWhere,
  RESULT_RELEASE_STATUSES,
  taskAssigneeIdsFor,
} from '../access/access-accounts.service';
import { ApprovalsDomain } from './domain/approvals.domain';

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
    result: 'NOT_CHECKED' as const,
  },
  {
    criterionCode: 'PIP',
    label: 'No active PIP or disciplinary action',
    blocking: true,
    result: 'NOT_CHECKED' as const,
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
    result: 'NOT_CHECKED' as const,
  },
];
const candidateEligibilityCriteria = [
  {
    criterionCode: 'APPLICATION',
    label: 'Candidate application complete',
    blocking: true,
    result: 'NOT_CHECKED' as const,
  },
  {
    criterionCode: 'POSITION',
    label: 'Target position approved',
    blocking: true,
    result: 'NOT_CHECKED' as const,
  },
  {
    criterionCode: 'DOCUMENTS',
    label: 'Required candidate documents',
    blocking: false,
    result: 'NOT_CHECKED' as const,
  },
];

export class PrismaCasesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async reopenCompletedStage(
    caseId: string,
    input: AdminReopenStageInput,
    actor: AuthActor,
  ): Promise<AssessmentCaseDetail> {
    const parsed = this.parsed(
      adminReopenStageSchema,
      input,
      'Choose a completed stage and enter a reason of at least 10 characters.',
    );
    if (!actor.roles.includes('Admin'))
      throw new ForbiddenException(
        this.error('ADMIN_REQUIRED', 'Only an Admin can reopen a stage.'),
      );

    const target = {
      REQUEST: { status: 'DRAFT' as const, stage: 'REQUEST' as const, ownerName: 'Requester' },
      ELIGIBILITY: {
        status: 'PENDING_ELIGIBILITY' as const,
        stage: 'ELIGIBILITY' as const,
        ownerName: 'HR / Talent',
      },
      PLANNING: {
        status: 'READY_FOR_PLANNING' as const,
        stage: 'PLANNING' as const,
        ownerName: 'Assessment Coordinator',
      },
      ASSESSMENT: {
        status: 'IN_PROGRESS' as const,
        stage: 'ASSESSMENT' as const,
        ownerName: 'Panel Lead',
      },
      RESULT: {
        status: 'PENDING_RESULT' as const,
        stage: 'RESULT' as const,
        ownerName: 'Panel Lead',
      },
      RECOMMENDATION: {
        status: 'PENDING_RECOMMENDATION' as const,
        stage: 'RECOMMENDATION' as const,
        ownerName: 'HR / Talent',
      },
      FOLLOW_UP: {
        status: 'DEVELOPMENT_IN_PROGRESS' as const,
        stage: 'FOLLOW_UP' as const,
        ownerName: 'Manager',
      },
    }[parsed.stage];

    await this.prisma.$transaction(async (tx) => {
      const record = await tx.assessmentCase.findUnique({
        where: { id: caseId },
        include: {
          eligibility: { include: { criteria: true } },
          plan: { include: { methods: true } },
          events: { include: { assessors: true, evidence: true } },
          scorecards: true,
          attachments: true,
          tasks: true,
          resultRevisions: true,
          recommendationRevisions: true,
          approvalSteps: true,
          developmentPlan: { include: { actions: true } },
        },
      });
      if (!record)
        throw new NotFoundException(
          this.error('CASE_NOT_FOUND', 'This assessment case could not be found.'),
        );
      this.assertVersion(record.version, parsed.expectedVersion);
      if (record.adminEditStage)
        throw new BadRequestException(
          this.error(
            'STAGE_ALREADY_REOPENED',
            'Finish the current Admin edit before reopening another stage.',
          ),
        );

      const stageOrder: Record<string, number> = {
        REQUEST: 0,
        ELIGIBILITY: 1,
        PLANNING: 2,
        ASSESSMENT: 3,
        RESULT: 4,
        RECOMMENDATION: 5,
        APPROVAL: 5,
        FOLLOW_UP: 6,
        CLOSED: 7,
      };
      const currentOrder = stageOrder[record.stage] ?? 0;
      const targetOrder = stageOrder[parsed.stage] ?? 0;
      const currentStageCompleted =
        (parsed.stage === 'REQUEST' && record.status !== 'DRAFT') ||
        (parsed.stage === 'ELIGIBILITY' &&
          !['SUBMITTED', 'PENDING_ELIGIBILITY'].includes(record.status)) ||
        (parsed.stage === 'PLANNING' && record.status !== 'READY_FOR_PLANNING') ||
        (parsed.stage === 'ASSESSMENT' &&
          [
            'PENDING_RESULT',
            'RESULT_FINALIZED',
            'PENDING_RECOMMENDATION',
            'PENDING_APPROVAL',
            'APPROVED',
            'DEVELOPMENT_IN_PROGRESS',
            'REASSESSMENT_DUE',
            'CLOSED',
          ].includes(record.status)) ||
        (parsed.stage === 'RESULT' &&
          [
            'RESULT_FINALIZED',
            'PENDING_RECOMMENDATION',
            'PENDING_APPROVAL',
            'APPROVED',
            'DEVELOPMENT_IN_PROGRESS',
            'REASSESSMENT_DUE',
            'CLOSED',
          ].includes(record.status)) ||
        (parsed.stage === 'RECOMMENDATION' &&
          [
            'PENDING_APPROVAL',
            'APPROVED',
            'DEVELOPMENT_IN_PROGRESS',
            'REASSESSMENT_DUE',
            'CLOSED',
          ].includes(record.status)) ||
        (parsed.stage === 'FOLLOW_UP' && ['REASSESSMENT_DUE', 'CLOSED'].includes(record.status));
      if (targetOrder > currentOrder || (targetOrder === currentOrder && !currentStageCompleted))
        throw new BadRequestException(
          this.error('STAGE_NOT_COMPLETED', 'Only a completed stage can be reopened.'),
        );

      // Keep the pre-reopen records in the audit snapshot, but make later
      // stages pending again so stale decisions and scores cannot complete the
      // restarted workflow without being reviewed again.
      if (targetOrder <= 1 && record.eligibility) {
        await tx.eligibilityReview.update({
          where: { caseId },
          data: { decision: null, decisionReason: null, decidedBy: null, decidedAt: null },
        });
      }
      if (targetOrder < 3) {
        await tx.assessmentEvent.updateMany({
          where: { caseId, status: { not: 'CANCELLED' } },
          data: {
            status: 'CANCELLED',
            cancellationReason: `Superseded after Admin reopened ${parsed.stage.replace('_', ' ')}.`,
          },
        });
      }
      if (targetOrder <= 3) {
        await tx.assessmentScorecard.updateMany({
          where: { caseId, submittedAt: { not: null } },
          data: { submittedAt: null },
        });
      }
      if (targetOrder <= 4) {
        const latestResult = await tx.resultRevision.findFirst({
          where: { caseId, finalizedAt: { not: null } },
          orderBy: { revision: 'desc' },
        });
        if (latestResult && !latestResult.reopenedAt) {
          await tx.resultRevision.update({
            where: { id: latestResult.id },
            data: { reopenedAt: new Date(), reopenReason: parsed.reason },
          });
        }
      }
      if (targetOrder <= 5) {
        await tx.recommendationRevision.updateMany({
          where: {
            caseId,
            status: { in: ['DRAFT', 'PENDING_APPROVAL', 'CHANGES_REQUESTED', 'APPROVED'] },
          },
          data: { status: 'CANCELLED' },
        });
        await tx.approvalStep.updateMany({
          where: { caseId },
          data: {
            decision: 'PENDING',
            comment: null,
            decidedAt: null,
            approverId: null,
            approverName: null,
          },
        });
      }
      if (targetOrder <= 6) {
        const developmentPlan = await tx.developmentPlan.findUnique({
          where: { caseId },
          select: { id: true },
        });
        if (developmentPlan) {
          await tx.developmentPlan.update({
            where: { id: developmentPlan.id },
            data: { status: 'PLANNED' },
          });
          await tx.developmentAction.updateMany({
            where: { planId: developmentPlan.id },
            data: { status: 'NOT_STARTED', completedAt: null },
          });
        }
      }

      const changed = await tx.assessmentCase.updateMany({
        where: { id: caseId, version: parsed.expectedVersion, adminEditStage: null },
        data: {
          status: target.status,
          stage: target.stage,
          ownerName: target.ownerName,
          adminEditStage: parsed.stage === 'RECOMMENDATION' ? 'RECOMMENDATION' : parsed.stage,
          adminEditReason: parsed.reason,
          closedAt: null,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw this.concurrencyError();

      await tx.task.updateMany({
        where: { caseId, status: 'OPEN' },
        data: { status: 'CANCELLED', completedAt: new Date() },
      });
      const reopenedTask = {
        REQUEST: undefined,
        ELIGIBILITY: {
          assigneeId: 'hr-talent',
          assigneeName: 'HR / Talent',
          taskType: 'ELIGIBILITY_REVIEW',
        },
        PLANNING: {
          assigneeId: 'assessment-coordinator',
          assigneeName: 'Assessment Coordinator',
          taskType: 'PLANNING_OPEN',
        },
        ASSESSMENT: {
          assigneeId: 'panel-lead',
          assigneeName: 'Panel Lead',
          taskType: 'ASSESSMENT_REVIEW',
        },
        RESULT: {
          assigneeId: 'panel-lead',
          assigneeName: 'Panel Lead',
          taskType: 'RESULT_FINALIZATION',
        },
        RECOMMENDATION: {
          assigneeId: 'hr-approver',
          assigneeName: 'HR Approver',
          taskType: 'RECOMMENDATION_DRAFT',
        },
        FOLLOW_UP: {
          assigneeId: 'manager',
          assigneeName: 'Manager',
          taskType: 'DEVELOPMENT_UPDATE',
        },
      }[parsed.stage];
      if (reopenedTask) await tx.task.create({ data: { caseId, ...reopenedTask, status: 'OPEN' } });

      const previousData = JSON.parse(
        JSON.stringify({
          status: record.status,
          stage: record.stage,
          eligibility: record.eligibility,
          plan: record.plan,
          events: record.events,
          scorecards: record.scorecards,
          attachments: record.attachments,
          tasks: record.tasks,
          resultRevisions: record.resultRevisions,
          recommendationRevisions: record.recommendationRevisions,
          approvalSteps: record.approvalSteps,
          developmentPlan: record.developmentPlan,
        }),
      ) as Prisma.InputJsonValue;
      await tx.auditEvent.create({
        data: {
          caseId,
          actorId: actor.id,
          actorName: actor.name,
          action: 'ADMIN_STAGE_REOPENED',
          entityType: 'AssessmentCase',
          entityId: caseId,
          reason: parsed.reason,
          previousData,
          newData: { stage: parsed.stage, status: target.status },
          correlationId: `corr-${randomUUID()}`,
        },
      });
    });
    return this.get(caseId);
  }

  async updateReopenedRequest(
    caseId: string,
    input: AdminEditRequestInput,
    actor: AuthActor,
  ): Promise<AssessmentCaseDetail> {
    if (!actor.roles.includes('Admin'))
      throw new ForbiddenException(
        this.error('ADMIN_REQUIRED', 'Only an Admin can edit a reopened request.'),
      );
    const parsed = this.parsed(
      adminEditRequestSchema,
      input,
      'Enter valid request details and an edit reason of at least 10 characters.',
    );
    await this.prisma.$transaction(async (tx) => {
      const record = await tx.assessmentCase.findUnique({ where: { id: caseId } });
      if (!record)
        throw new NotFoundException(
          this.error('CASE_NOT_FOUND', 'This assessment case could not be found.'),
        );
      this.assertVersion(record.version, parsed.expectedVersion);
      if (record.adminEditStage !== 'REQUEST' || record.status !== 'DRAFT')
        throw new BadRequestException(
          this.error(
            'REQUEST_NOT_REOPENED',
            'Reopen the Request stage before editing its details.',
          ),
        );
      const changed = await tx.assessmentCase.updateMany({
        where: { id: caseId, version: parsed.expectedVersion, adminEditStage: 'REQUEST' },
        data: {
          targetRoleSnapshot: parsed.targetRole,
          targetLevelSnapshot: parsed.targetLevel,
          justification: parsed.justification,
          adminEditReason: parsed.reason,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw this.concurrencyError();
      await tx.auditEvent.create({
        data: {
          caseId,
          actorId: actor.id,
          actorName: actor.name,
          action: 'ADMIN_REQUEST_EDITED',
          entityType: 'AssessmentCase',
          entityId: caseId,
          reason: parsed.reason,
          previousData: {
            targetRole: record.targetRoleSnapshot,
            targetLevel: record.targetLevelSnapshot,
            justification: record.justification,
          },
          newData: {
            targetRole: parsed.targetRole,
            targetLevel: parsed.targetLevel,
            justification: parsed.justification,
          },
          correlationId: `corr-${randomUUID()}`,
        },
      });
    });
    return this.get(caseId);
  }

  async getOverview(): Promise<OverviewResponse> {
    const cases = await this.list({});
    const tasks = await this.getTasks();
    const storedPolicy = await this.prisma.governancePolicy.findUnique({
      where: { id: 'default' },
    });
    const storedSettings = storedPolicy?.settings as
      { slaWindows?: Partial<OverviewResponse['slaWindows']> } | undefined;
    const configuredSla = storedSettings?.slaWindows;
    const slaWindows = {
      eligibilityHours: this.validSlaHours(
        configuredSla?.eligibilityHours,
        DEFAULT_SLA_WINDOWS.eligibilityHours,
      ),
      assessorHours: this.validSlaHours(
        configuredSla?.assessorHours,
        DEFAULT_SLA_WINDOWS.assessorHours,
      ),
      committeeHours: this.validSlaHours(
        configuredSla?.committeeHours,
        DEFAULT_SLA_WINDOWS.committeeHours,
      ),
    };
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
          label: 'Planning',
          value: cases.filter((item) => item.stage === 'PLANNING').length,
          tone: 'warning',
        },
        {
          label: 'Assessment',
          value: cases.filter((item) => item.stage === 'ASSESSMENT').length,
          tone: 'teal',
        },
        {
          label: 'Result',
          value: cases.filter((item) => item.stage === 'RESULT').length,
          tone: 'teal',
        },
        {
          label: 'Decision',
          value: cases.filter((item) => ['RECOMMENDATION', 'APPROVAL'].includes(item.stage)).length,
          tone: 'violet',
        },
        {
          label: 'Follow-up',
          value: cases.filter((item) => item.stage === 'FOLLOW_UP').length,
          tone: 'warning',
        },
        {
          label: 'Closed',
          value: cases.filter((item) => item.stage === 'CLOSED').length,
          tone: 'indigo',
        },
      ],
      slaWindows,
    };
  }

  private validSlaHours(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 1 ? value : fallback;
  }

  async getTasks(): Promise<OverviewResponse['tasks']> {
    const organization = await this.organization();
    const actor = getActorContext();
    if (actor.roles.includes('Employee')) return [];
    const tasks = await this.prisma.task.findMany({
      where: {
        status: 'OPEN',
        ...(actor.scopeType !== 'ORGANIZATION' && !actor.roles.includes('Assessor')
          ? { assigneeId: { in: taskAssigneeIdsFor(actor) } }
          : {}),
        case: { organizationId: organization.id, ...caseScopeWhere(actor) },
      },
      include: { case: { include: { employee: true } } },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
      take: 20,
    });
    return tasks.map((task) => ({
      id: task.id,
      title: this.taskTitle(task.taskType, task.case?.employee.displayName),
      caseCode: task.case?.caseCode ?? '—',
      dueAt: task.dueAt?.toISOString() ?? null,
      taskType: task.taskType,
      dueLabel: task.dueAt
        ? `Due ${task.dueAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`
        : 'No due date',
      priority: task.taskType.includes('ELIGIBILITY') ? 'HIGH' : 'NORMAL',
    }));
  }

  async list(filters: { status?: string; search?: string }): Promise<AssessmentCaseSummary[]> {
    const organization = await this.organization();
    const actor = getActorContext();
    const andFilters: Prisma.AssessmentCaseWhereInput[] = [
      caseScopeWhere(actor) as Prisma.AssessmentCaseWhereInput,
    ];
    const where: Prisma.AssessmentCaseWhereInput = {
      organizationId: organization.id,
      AND: andFilters,
    };
    if (filters.status && caseStatuses.includes(filters.status as CaseStatus)) {
      where.status = filters.status as PrismaCaseStatus;
    }
    const search = filters.search?.trim();
    if (search) {
      andFilters.push({
        OR: [
          { caseCode: { contains: search, mode: 'insensitive' } },
          { ownerName: { contains: search, mode: 'insensitive' } },
          { departmentSnapshot: { contains: search, mode: 'insensitive' } },
          { targetRoleSnapshot: { contains: search, mode: 'insensitive' } },
          { employee: { displayName: { contains: search, mode: 'insensitive' } } },
        ],
      });
    }
    const records = await this.prisma.assessmentCase.findMany({
      where,
      include: caseInclude,
      orderBy: { requestedAt: 'desc' },
    });
    return records.map((record) => this.toSummary(this.toDetail(record)));
  }

  async get(caseId: string): Promise<AssessmentCaseDetail> {
    const actor = getActorContext();
    const record = await this.prisma.assessmentCase.findFirst({
      where: { id: caseId, ...caseScopeWhere(actor) },
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
    const employeeExternalId =
      data.candidateType === 'NEW_CANDIDATE' ? `candidate-${randomUUID()}` : data.employeeId;
    const currentRole = data.currentRole?.trim() || 'External candidate';
    const employee = await this.prisma.employeeReference.upsert({
      where: {
        organizationId_externalId: {
          organizationId: organization.id,
          externalId: employeeExternalId,
        },
      },
      update: {
        displayName: data.employeeName,
        department: data.department,
        currentRole,
        currentLevel: data.currentLevel,
        email: data.candidateEmail || undefined,
        employmentState: data.candidateType === 'NEW_CANDIDATE' ? 'CANDIDATE' : 'ACTIVE',
      },
      create: {
        organizationId: organization.id,
        externalId: employeeExternalId,
        displayName: data.employeeName,
        email: data.candidateEmail || undefined,
        department: data.department,
        currentRole,
        currentLevel: data.currentLevel,
        employmentState: data.candidateType === 'NEW_CANDIDATE' ? 'CANDIDATE' : 'ACTIVE',
      },
    });
    const created = await this.prisma.assessmentCase.create({
      data: {
        caseCode: `AF-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
        organizationId: organization.id,
        employeeId: employee.id,
        candidateType: data.candidateType,
        candidateEmail: data.candidateEmail || null,
        assessmentReason: data.assessmentReason,
        stage: 'REQUEST',
        status: 'DRAFT',
        ownerName: 'Requester',
        priority: data.priority,
        currentRoleSnapshot: currentRole,
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
      const record = await tx.assessmentCase.findUnique({
        where: { id: caseId },
        include: {
          eligibility: { include: { criteria: true } },
          plan: true,
          scorecards: { where: { submittedAt: { not: null } } },
        },
      });
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
          adminEditStage: null,
          adminEditReason: null,
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
      const review = record.eligibility
        ? await tx.eligibilityReview.update({
            where: { caseId },
            data: {
              policyVersion: '2026.1',
              decision: null,
              decisionReason: null,
              decidedBy: null,
              decidedAt: null,
              criteria: {
                updateMany: {
                  where: {},
                  data: { result: 'NOT_CHECKED', sourceValue: null, evidenceNote: null },
                },
              },
            },
          })
        : await tx.eligibilityReview.create({
            data: {
              caseId,
              policyVersion: '2026.1',
              criteria: {
                create:
                  record.candidateType === 'NEW_CANDIDATE'
                    ? candidateEligibilityCriteria
                    : defaultCriteria,
              },
            },
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
          record.adminEditReason ? `Admin edit reason: ${record.adminEditReason}` : undefined,
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
        include: { eligibility: { include: { criteria: true } } },
      });
      if (!record)
        throw new NotFoundException(
          this.error('CASE_NOT_FOUND', 'This assessment case could not be found.'),
        );
      this.assertVersion(record.version, parsed.data.expectedVersion);
      if (
        !record.eligibility ||
        !['SUBMITTED', 'PENDING_ELIGIBILITY', 'NOT_ELIGIBLE'].includes(record.status)
      )
        throw new BadRequestException(
          this.error('INVALID_TRANSITION', 'This case is not ready for an eligibility decision.'),
        );
      const knownCriteria = new Set(
        record.eligibility.criteria.map((criterion) => criterion.criterionCode),
      );
      const unknownCriterion = parsed.data.criteria?.find(
        (criterion) => !knownCriteria.has(criterion.code),
      );
      if (unknownCriterion)
        throw new BadRequestException(
          this.error(
            'INVALID_CRITERION',
            `Unknown eligibility criterion: ${unknownCriterion.code}.`,
          ),
        );
      const eligible = parsed.data.decision === 'ELIGIBLE';
      const changed = await tx.assessmentCase.updateMany({
        where: {
          id: caseId,
          version: parsed.data.expectedVersion,
          status: { in: ['SUBMITTED', 'PENDING_ELIGIBILITY', 'NOT_ELIGIBLE'] },
        },
        data: {
          status: eligible ? 'READY_FOR_PLANNING' : 'NOT_ELIGIBLE',
          stage: eligible ? 'PLANNING' : 'ELIGIBILITY',
          ownerName: eligible ? 'Assessment Coordinator' : 'HR / Talent',
          adminEditStage: null,
          adminEditReason: null,
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
      for (const criterion of parsed.data.criteria ?? []) {
        await tx.eligibilityCriterionResult.updateMany({
          where: {
            reviewId: record.eligibility.id,
            criterionCode: criterion.code,
          },
          data: { result: criterion.result },
        });
      }
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
          record.adminEditReason ? `Admin edit reason: ${record.adminEditReason}` : undefined,
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
    let organization = await this.prisma.organization.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    if (!organization) {
      organization = await this.prisma.organization.upsert({
        where: { code: 'ASSESSFLOW-DEMO' },
        update: {},
        create: {
          code: 'ASSESSFLOW-DEMO',
          name: 'AssessFlow Demo Company',
        },
      });
    }
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
    ASSESSMENT_CENTER: 'Assessment Center',
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
          adminEditStage: null,
          adminEditReason: null,
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
          record.adminEditReason ? `Admin edit reason: ${record.adminEditReason}` : undefined,
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
          record.adminEditReason ? `Admin edit reason: ${record.adminEditReason}` : undefined,
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
    assessor: { id: string; name: string; email?: string; roles?: string[] },
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
        include: { case: true, evidence: true, assessors: true },
      });
      if (!event)
        throw new NotFoundException(
          this.error('EVENT_NOT_FOUND', 'This assessment event could not be found.'),
        );
      if (
        assessor.roles?.some((role) => ['Assessor', 'PanelLead'].includes(role)) &&
        !event.assessors.some(
          (assignment) =>
            assignment.userId === assessor.id ||
            (assessor.email && assignment.userId.toLowerCase() === assessor.email.toLowerCase()),
        )
      ) {
        throw new ForbiddenException(
          this.error('ASSESSOR_NOT_ASSIGNED', 'You are not assigned to this assessment session.'),
        );
      }
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
          event.case.adminEditReason
            ? `Admin edit reason: ${event.case.adminEditReason}`
            : undefined,
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
      const record = await tx.assessmentCase.findUnique({
        where: { id: caseId },
        include: { plan: true, scorecards: { where: { submittedAt: { not: null } } } },
      });
      if (!record)
        throw new NotFoundException(
          this.error('CASE_NOT_FOUND', 'This assessment case could not be found.'),
        );
      this.assertVersion(record.version, parsed.expectedVersion);
      if (!['IN_PROGRESS', 'PENDING_RESULT'].includes(record.status))
        throw new BadRequestException(
          this.error(
            'INVALID_TRANSITION',
            'A result can only be finalized after assessment has started.',
          ),
        );
      const scorecardConfig = record.plan?.scorecardConfig
        ? scorecardConfigSchema.parse(record.plan.scorecardConfig)
        : defaultScorecardConfig;
      const scorecardResult = calculateScorecard(
        scorecardConfig,
        record.scorecards.map((submission) => ({
          ratings: scorecardRatingsSchema.parse(submission.ratings),
          submitted: true,
        })),
      );
      if (!scorecardResult.completeCount)
        throw new BadRequestException(
          'At least one assessor must submit a complete scorecard before finalizing the result.',
        );
      const effectiveResultCode = scorecardResult.resultCode;
      const changed = await tx.assessmentCase.updateMany({
        where: {
          id: caseId,
          version: parsed.expectedVersion,
          status: { in: ['IN_PROGRESS', 'PENDING_RESULT'] },
        },
        data: {
          status: 'RESULT_FINALIZED',
          stage: 'RESULT',
          ownerName: 'Panel Lead',
          adminEditStage: null,
          adminEditReason: null,
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
          resultCode: effectiveResultCode,
          scorecardSummary: {
            ...scorecardResult,
            assessorRecommendation: parsed.assessorRecommendation,
          } as never,
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
          `Result finalized automatically from scorecard: ${effectiveResultCode}`,
          record.adminEditReason ? `Admin edit reason: ${record.adminEditReason}` : undefined,
          currentActor,
        ),
      });
      await tx.notificationOutbox.create({
        data: {
          eventType: 'RESULT_FINALIZED',
          aggregateType: 'AssessmentCase',
          aggregateId: caseId,
          payload: { caseId, resultCode: effectiveResultCode },
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
          feedbackReleasedAt: null,
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

  async updateAssessorRecommendation(
    caseId: string,
    input: UpdateAssessorRecommendationInput,
    actor: AuthActor,
  ) {
    const parsed = this.parsed(
      updateAssessorRecommendationSchema,
      input,
      'Choose a recommendation and enter a reason for the change.',
    );
    return this.prisma.$transaction(async (tx) => {
      const record = await tx.assessmentCase.findUnique({ where: { id: caseId } });
      if (!record)
        throw new NotFoundException(
          this.error('CASE_NOT_FOUND', 'This assessment case could not be found.'),
        );
      this.assertVersion(record.version, parsed.expectedVersion);
      if (!['RESULT_FINALIZED', 'PENDING_RECOMMENDATION'].includes(record.status))
        throw new BadRequestException(
          'The assessor recommendation can only be changed before the business recommendation is submitted.',
        );
      const latest = await tx.resultRevision.findFirst({
        where: { caseId },
        orderBy: { revision: 'desc' },
      });
      if (!latest?.finalizedAt)
        throw new NotFoundException(
          this.error('RESULT_NOT_FOUND', 'No finalized result exists for this case.'),
        );
      const previousSummary =
        latest.scorecardSummary && typeof latest.scorecardSummary === 'object'
          ? (latest.scorecardSummary as Record<string, unknown>)
          : {};
      const previousRecommendation = previousSummary.assessorRecommendation ?? null;
      const changed = await tx.assessmentCase.updateMany({
        where: {
          id: caseId,
          version: parsed.expectedVersion,
          status: { in: ['RESULT_FINALIZED', 'PENDING_RECOMMENDATION'] },
        },
        data: { version: { increment: 1 } },
      });
      if (changed.count !== 1) throw this.concurrencyError();
      await tx.resultRevision.update({
        where: { id: latest.id },
        data: {
          scorecardSummary: {
            ...previousSummary,
            assessorRecommendation: parsed.code,
          } as never,
        },
      });
      await tx.auditEvent.create({
        data: {
          ...this.auditData(
            caseId,
            'ASSESSOR_RECOMMENDATION_UPDATED',
            'ResultRevision',
            latest.id,
            parsed.reason,
            undefined,
            actor,
          ),
          previousData: { assessorRecommendation: previousRecommendation } as never,
          newData: { assessorRecommendation: parsed.code } as never,
        },
      });
      return { code: parsed.code };
    });
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
          adminEditStage: null,
          adminEditReason: null,
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
          requiresManagerActionPlan: parsed.requiresManagerActionPlan,
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
          record.adminEditReason ? `Admin edit reason: ${record.adminEditReason}` : undefined,
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
      const previousSteps = await tx.approvalStep.findMany({
        where: { caseId: step.caseId, sequence: { lt: step.sequence } },
      });
      if (previousSteps.some((previous) => previous.decision !== 'APPROVED'))
        throw new BadRequestException(
          this.error(
            'APPROVAL_STEP_BLOCKED',
            'Earlier approval steps must be approved before this step can be decided.',
          ),
        );
      const [submittedScorecards, conflictingActions, otherDecisions] = await Promise.all([
        tx.assessmentScorecard.findMany({
          where: { caseId: step.caseId, submittedAt: { not: null } },
          select: { assessorId: true },
        }),
        tx.auditEvent.findMany({
          where: {
            caseId: step.caseId,
            action: { in: ['RESULT_FINALIZED', 'RECOMMENDATION_SUBMITTED'] },
          },
          select: { actorId: true, action: true },
        }),
        tx.approvalStep.findMany({
          where: { caseId: step.caseId, id: { not: stepId }, decision: { not: 'PENDING' } },
          select: { approverId: true },
        }),
      ]);
      const { adminSelfApproval } = ApprovalsDomain.assertSegregationOfDuties({
        actor: getActorContext(),
        stepRole: step.role,
        correlationId: `corr-${randomUUID()}`,
        allowAdminSelfApproval:
          process.env.ALLOW_ADMIN_SELF_APPROVAL?.trim().toLowerCase() === 'true',
        conflicts: [
          ...submittedScorecards.map((item) => ({
            actorId: item.assessorId,
            reason: 'scored the candidate',
          })),
          ...conflictingActions.map((item) => ({
            actorId: item.actorId,
            reason:
              item.action === 'RESULT_FINALIZED'
                ? 'finalized the assessment result'
                : 'submitted the recommendation',
          })),
          ...otherDecisions.flatMap((item) =>
            item.approverId
              ? [{ actorId: item.approverId, reason: 'decided the other approval step' }]
              : [],
          ),
        ],
      });
      if (adminSelfApproval.length) {
        // Flag every bypass so self-approved cases stay distinguishable later.
        await tx.auditEvent.create({
          data: this.auditData(
            step.caseId,
            'ADMIN_SELF_APPROVAL',
            'ApprovalStep',
            stepId,
            'Admin self-approval (segregation of duties bypassed)',
            `Admin self-approval: ${step.role} step decided by an admin who ${[
              ...new Set(adminSelfApproval.map((item) => item.reason)),
            ].join(', ')}. Enabled by ALLOW_ADMIN_SELF_APPROVAL.`,
          ),
        });
      }
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
            [
              parsed.comment,
              step.case.adminEditReason
                ? `Admin edit reason: ${step.case.adminEditReason}`
                : undefined,
            ]
              .filter(Boolean)
              .join('\n') || undefined,
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
            step.case.adminEditReason
              ? `Admin edit reason: ${step.case.adminEditReason}`
              : undefined,
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
            [
              parsed.comment,
              step.case.adminEditReason
                ? `Admin edit reason: ${step.case.adminEditReason}`
                : undefined,
            ]
              .filter(Boolean)
              .join('\n') || undefined,
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
      const isHiringOutcomeOnly =
        record.candidateType === 'NEW_CANDIDATE' &&
        parsed.hiringOutcome !== undefined &&
        parsed.actionPlan === undefined &&
        parsed.learningManagementSystem === undefined &&
        parsed.actions === undefined &&
        parsed.targetDate === undefined;
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
          ...(isHiringOutcomeOnly
            ? {}
            : { status: 'DEVELOPMENT_IN_PROGRESS', stage: 'FOLLOW_UP', ownerName: 'Manager' }),
          hiringOutcome: parsed.hiringOutcome,
          hiringOutcomeReason: parsed.hiringOutcomeReason,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw this.concurrencyError();
      if (parsed.hiringOutcome) {
        await tx.employeeReference.update({
          where: { id: record.employeeId },
          data: {
            employmentState:
              parsed.hiringOutcome === 'JOINED'
                ? 'ACTIVE'
                : parsed.hiringOutcome === 'NOT_JOINED'
                  ? 'NOT_HIRED'
                  : 'CANDIDATE',
          },
        });
      }
      let planId = record.developmentPlan?.id;
      if (isHiringOutcomeOnly) {
        await tx.auditEvent.create({
          data: this.auditData(
            caseId,
            'CANDIDATE_HIRING_OUTCOME_RECORDED',
            'AssessmentCase',
            caseId,
            `Hiring outcome: ${parsed.hiringOutcome}${parsed.hiringOutcomeReason ? ` (${parsed.hiringOutcomeReason})` : ''}`,
            record.adminEditReason ? `Admin edit reason: ${record.adminEditReason}` : undefined,
          ),
        });
      } else {
        if (planId) {
          await tx.developmentPlan.update({
            where: { id: planId },
            data: {
              actionPlan: parsed.actionPlan,
              learningManagementSystem: parsed.learningManagementSystem,
              targetDate: parsed.targetDate ? new Date(parsed.targetDate) : undefined,
              status: 'IN_PROGRESS',
            },
          });
        } else {
          const plan = await tx.developmentPlan.create({
            data: {
              caseId,
              ownerName: 'Manager',
              actionPlan: parsed.actionPlan,
              learningManagementSystem: parsed.learningManagementSystem,
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
      }
      if (!isHiringOutcomeOnly)
        await tx.auditEvent.create({
          data: this.auditData(
            caseId,
            'DEVELOPMENT_UPDATED',
            'DevelopmentPlan',
            planId ?? caseId,
            'Development plan updated',
            record.adminEditReason ? `Admin edit reason: ${record.adminEditReason}` : undefined,
          ),
        });
      if (!isHiringOutcomeOnly)
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
      if (
        !['APPROVED', 'DEVELOPMENT_IN_PROGRESS', 'REASSESSMENT_DUE', 'CLOSED'].includes(
          source.status,
        )
      )
        throw new BadRequestException(
          this.error(
            'INVALID_TRANSITION',
            'Reassessment requires an approved, in-development, reassessment-due, or closed case. Prior cases stay immutable.',
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
          adminEditStage: null,
          adminEditReason: null,
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
          record.adminEditReason ? `Admin edit reason: ${record.adminEditReason}` : undefined,
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

  async getScorecard(caseId: string, actor: AuthActor) {
    const record = await this.prisma.assessmentCase.findUnique({
      where: { id: caseId },
      include: { plan: true, events: { include: { assessors: true } }, scorecards: true },
    });
    if (!record)
      throw new NotFoundException(
        this.error('CASE_NOT_FOUND', 'This assessment case could not be found.'),
      );
    if (!record.plan)
      throw new NotFoundException(
        this.error('PLAN_NOT_FOUND', 'Finalize the assessment plan first.'),
      );
    const config = record.plan.scorecardConfig
      ? scorecardConfigSchema.parse(record.plan.scorecardConfig)
      : defaultScorecardConfig;
    const aggregate = calculateScorecard(
      config,
      record.scorecards.map((submission) => ({
        ratings: scorecardRatingsSchema.parse(submission.ratings),
        submitted: Boolean(submission.submittedAt),
      })),
    );
    const mySubmission = record.scorecards.find((submission) => submission.assessorId === actor.id);
    const priorSubmission = await this.prisma.auditEvent.findFirst({
      where: { caseId, action: 'SCORECARD_SUBMITTED' },
      select: { id: true },
    });
    const assignedAssessorCount = new Set(
      record.events.flatMap((event) => event.assessors.map((assessor) => assessor.userId)),
    ).size;
    return {
      config,
      mySubmission: mySubmission
        ? {
            ratings: mySubmission.ratings,
            submittedAt: mySubmission.submittedAt?.toISOString() ?? null,
            assessorName: mySubmission.assessorName,
          }
        : null,
      aggregate,
      assignedAssessorCount,
      submissions: record.scorecards.map((submission) => ({
        assessorName: submission.assessorName,
        submitted: Boolean(submission.submittedAt),
        submittedAt: submission.submittedAt?.toISOString() ?? null,
      })),
      canEditWeights:
        actor.roles.some((role) => ['Assessor', 'Admin'].includes(role)) &&
        !priorSubmission &&
        ['PLANNING', 'SCHEDULED', 'IN_PROGRESS'].includes(record.status),
      canReviseSubmission:
        Boolean(mySubmission?.submittedAt) &&
        ['SCHEDULED', 'IN_PROGRESS', 'PENDING_RESULT'].includes(record.status),
    };
  }

  async updateScorecardConfig(caseId: string, configInput: ScorecardConfig, actor: AuthActor) {
    const config = scorecardConfigSchema.parse(configInput);
    const weightProblems = scorecardWeightProblems(config);
    if (weightProblems.length)
      throw new BadRequestException(
        this.error('SCORECARD_WEIGHTS_INVALID', weightProblems.join(' ')),
      );
    const record = await this.prisma.assessmentCase.findUnique({
      where: { id: caseId },
      include: { plan: true, scorecards: { where: { submittedAt: { not: null } }, take: 1 } },
    });
    if (!record?.plan)
      throw new NotFoundException(
        this.error('PLAN_NOT_FOUND', 'Finalize the assessment plan first.'),
      );
    if (!['PLANNING', 'SCHEDULED', 'IN_PROGRESS'].includes(record.status))
      throw new BadRequestException('Scorecard settings can only be changed during assessment.');
    const priorSubmission = await this.prisma.auditEvent.findFirst({
      where: { caseId, action: 'SCORECARD_SUBMITTED' },
      select: { id: true },
    });
    if (priorSubmission)
      throw new ConflictException('Scorecard weights are locked after the first assessor submits.');
    const updated = await this.prisma.assessmentPlan.update({
      where: { id: record.plan.id },
      data: { scorecardConfig: config as never, version: { increment: 1 } },
    });
    await this.prisma.auditEvent.create({
      data: this.auditData(
        caseId,
        'SCORECARD_CONFIG_UPDATED',
        'AssessmentPlan',
        updated.id,
        'Scorecard settings updated',
        record.adminEditReason ? `Admin edit reason: ${record.adminEditReason}` : undefined,
        actor,
      ),
    });
    return { config, canEditWeights: true };
  }

  async saveScorecard(
    caseId: string,
    ratingsInput: ScorecardRatings,
    submit: boolean,
    actor: AuthActor,
  ) {
    const ratings = scorecardRatingsSchema.parse(ratingsInput);
    return this.prisma.$transaction(async (tx) => {
      const record = await tx.assessmentCase.findUnique({
        where: { id: caseId },
        include: { plan: true, scorecards: true, events: { include: { assessors: true } } },
      });
      if (!record?.plan)
        throw new NotFoundException(
          this.error('PLAN_NOT_FOUND', 'Finalize the assessment plan first.'),
        );
      // Panel leads (and any non-assessor scorer) may only score sessions they are assigned to.
      if (
        !actor.roles.some((role) => ['Assessor', 'Admin'].includes(role)) &&
        !record.events.some((event) =>
          event.assessors.some(
            (assignment) =>
              assignment.userId === actor.id ||
              Boolean(actor.email && assignment.userId.toLowerCase() === actor.email.toLowerCase()),
          ),
        )
      )
        throw new ForbiddenException(
          this.error(
            'ASSESSOR_NOT_ASSIGNED',
            'You are not assigned to an assessment session on this case.',
          ),
        );
      if (!['SCHEDULED', 'IN_PROGRESS', 'PENDING_RESULT'].includes(record.status))
        throw new BadRequestException('Scorecards can only be entered during assessment.');
      const config = record.plan.scorecardConfig
        ? scorecardConfigSchema.parse(record.plan.scorecardConfig)
        : defaultScorecardConfig;
      const criteria = [...config.technical, ...config.behavioral].flatMap((group) =>
        group.criteria.map((criterion) => ({
          criterion,
          ratingKey: scorecardRatingKey(group, criterion),
        })),
      );
      const criterionKeys = new Set(criteria.map((entry) => entry.ratingKey));
      if (Object.keys(ratings).some((key) => !criterionKeys.has(key)))
        throw new BadRequestException('The scorecard contains an unknown criterion.');
      const outOfRange = criteria.find((entry) => {
        const score = ratings[entry.ratingKey]?.score;
        return score !== undefined && !isValidQuestionScore(score, entry.criterion.weight);
      });
      if (outOfRange)
        throw new BadRequestException(
          `"${outOfRange.criterion.name}" takes 0 to ${outOfRange.criterion.weight} points (up to two decimals).`,
        );
      if (submit && criteria.some((entry) => ratings[entry.ratingKey]?.score === undefined))
        throw new BadRequestException('Score every question before submitting.');
      const existing = record.scorecards.find((submission) => submission.assessorId === actor.id);
      if (existing?.submittedAt)
        throw new ConflictException('This scorecard was submitted and is locked.');
      const saved = await tx.assessmentScorecard.upsert({
        where: { caseId_assessorId: { caseId, assessorId: actor.id } },
        create: {
          caseId,
          assessorId: actor.id,
          assessorName: actor.name,
          ratings: ratings as never,
          submittedAt: submit ? new Date() : null,
        },
        update: {
          assessorName: actor.name,
          ratings: ratings as never,
          ...(submit ? { submittedAt: new Date() } : {}),
        },
      });
      if (submit && record.status === 'SCHEDULED') {
        const started = await tx.assessmentCase.updateMany({
          where: { id: caseId, status: 'SCHEDULED', version: record.version },
          data: {
            status: 'IN_PROGRESS',
            stage: 'ASSESSMENT',
            ownerName: 'Panel Lead',
            version: { increment: 1 },
          },
        });
        if (started.count === 1) {
          await tx.auditEvent.create({
            data: this.auditData(
              caseId,
              'ASSESSMENT_STARTED',
              'AssessmentCase',
              caseId,
              'Assessment started when the first assessor submitted a scorecard',
              undefined,
              actor,
            ),
          });
          await tx.notificationOutbox.create({
            data: {
              eventType: 'ASSESSMENT_STARTED',
              aggregateType: 'AssessmentCase',
              aggregateId: caseId,
              payload: { caseId, assessorId: actor.id },
            },
          });
        } else {
          const latest = await tx.assessmentCase.findUnique({
            where: { id: caseId },
            select: { status: true },
          });
          if (latest?.status !== 'IN_PROGRESS') throw this.concurrencyError();
        }
      }
      await tx.auditEvent.create({
        data: this.auditData(
          caseId,
          submit ? 'SCORECARD_SUBMITTED' : 'SCORECARD_SAVED',
          'AssessmentScorecard',
          saved.id,
          submit ? 'Assessor scorecard submitted' : 'Assessor scorecard draft saved',
          record.adminEditReason ? `Admin edit reason: ${record.adminEditReason}` : undefined,
          actor,
        ),
      });
      return { saved: true, submitted: Boolean(saved.submittedAt) };
    });
  }

  async reviseScorecard(caseId: string, reason: string, actor: AuthActor) {
    return this.prisma.$transaction(async (tx) => {
      const record = await tx.assessmentCase.findUnique({
        where: { id: caseId },
        include: { scorecards: true },
      });
      if (!record)
        throw new NotFoundException(
          this.error('CASE_NOT_FOUND', 'This assessment case could not be found.'),
        );
      if (!['SCHEDULED', 'IN_PROGRESS', 'PENDING_RESULT'].includes(record.status))
        throw new BadRequestException(
          'Submitted scores can only be reopened before the result is finalized.',
        );
      const existing = record.scorecards.find((submission) => submission.assessorId === actor.id);
      if (!existing?.submittedAt)
        throw new ConflictException('You do not have a submitted scorecard to edit for this case.');

      await tx.assessmentScorecard.update({
        where: { id: existing.id },
        data: { submittedAt: null },
      });
      await tx.auditEvent.create({
        data: {
          ...this.auditData(
            caseId,
            'SCORECARD_REOPENED_FOR_EDIT',
            'AssessmentScorecard',
            existing.id,
            reason,
            undefined,
            actor,
          ),
          previousData: existing.ratings as never,
          newData: { ratings: existing.ratings, status: 'DRAFT' } as never,
        },
      });
      return { reopened: true };
    });
  }

  async listEvents(caseId: string) {
    await this.requireCase(caseId);
    return this.prisma.assessmentEvent.findMany({
      where: { caseId },
      include: { assessors: true, planMethod: true, _count: { select: { evidence: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async listAssessorAssignments(assessorId: string, email?: string) {
    const assessorIds = [assessorId, email?.trim().toLowerCase()].filter((value): value is string =>
      Boolean(value),
    );
    const events = await this.prisma.assessmentEvent.findMany({
      where: { assessors: { some: { userId: { in: assessorIds } } } },
      include: {
        case: {
          select: {
            id: true,
            caseCode: true,
            status: true,
            currentRoleSnapshot: true,
            targetRoleSnapshot: true,
            targetLevelSnapshot: true,
            feedbackReleasedAt: true,
            departmentSnapshot: true,
            employee: { select: { displayName: true } },
          },
        },
        planMethod: { select: { methodLabel: true } },
        evidence: {
          where: { assessorId },
          select: { id: true, summary: true, strengths: true, gaps: true, submittedAt: true },
          take: 1,
        },
      },
      orderBy: [{ startsAt: 'asc' }, { createdAt: 'desc' }],
    });

    return events.map((event) => {
      const evidence = event.evidence[0];
      return {
        eventId: event.id,
        caseId: event.case.id,
        caseCode: event.case.caseCode,
        employeeName: event.case.employee.displayName,
        department: event.case.departmentSnapshot,
        currentRole: event.case.currentRoleSnapshot,
        targetRole: event.case.targetRoleSnapshot,
        targetLevel: event.case.targetLevelSnapshot,
        feedbackReleasedAt: event.case.feedbackReleasedAt?.toISOString() ?? null,
        caseStatus: event.case.status,
        eventStatus: event.status,
        startsAt: event.startsAt?.toISOString() ?? null,
        endsAt: event.endsAt?.toISOString() ?? null,
        timezone: event.timezone,
        location: event.location,
        method: event.planMethod?.methodLabel ?? 'Assessment session',
        evidenceStatus: evidence?.submittedAt ? 'SUBMITTED' : evidence ? 'DRAFT' : 'NOT_STARTED',
        evidence: evidence
          ? {
              summary: evidence.summary,
              strengths: evidence.strengths,
              gaps: evidence.gaps,
            }
          : null,
      };
    });
  }

  async setFeedbackVisibility(caseId: string, visible: boolean, actor: AuthActor) {
    const record = await this.prisma.assessmentCase.findFirst({
      where: { id: caseId, ...caseScopeWhere(actor) },
      include: {
        events: { include: { assessors: true } },
        resultRevisions: { orderBy: { revision: 'desc' }, take: 1 },
      },
    });
    if (!record)
      throw new NotFoundException(
        this.error('CASE_NOT_FOUND', 'This assessment case could not be found.'),
      );
    const latestResult = record.resultRevisions[0];
    if (visible && (!latestResult?.finalizedAt || latestResult.reopenedAt)) {
      throw new BadRequestException('Finalize the assessment result before sharing feedback.');
    }
    // Feedback is shared only after final approval, so it cannot change afterwards.
    if (visible && !(RESULT_RELEASE_STATUSES as readonly string[]).includes(record.status)) {
      throw new BadRequestException(
        this.error(
          'RESULT_NOT_APPROVED',
          'Feedback can be shared after the recommendation is approved.',
        ),
      );
    }
    if (Boolean(record.feedbackReleasedAt) === visible) {
      return {
        caseId,
        visible,
        feedbackReleasedAt: record.feedbackReleasedAt?.toISOString() ?? null,
      };
    }
    const releasedAt = visible ? new Date() : null;
    const updated = await this.prisma.assessmentCase.update({
      where: { id: caseId },
      data: { feedbackReleasedAt: releasedAt, version: { increment: 1 } },
    });
    await this.audit(
      caseId,
      visible ? 'FEEDBACK_RELEASED' : 'FEEDBACK_HIDDEN',
      'AssessmentCase',
      caseId,
      visible
        ? 'Feedback released to employee and department manager'
        : 'Feedback visibility removed',
      undefined,
      actor,
    );
    return {
      caseId,
      visible,
      feedbackReleasedAt: updated.feedbackReleasedAt?.toISOString() ?? null,
    };
  }

  async listMyResults(actor: AuthActor) {
    const organization = await this.organization();
    const records = await this.prisma.assessmentCase.findMany({
      where: {
        organizationId: organization.id,
        feedbackReleasedAt: { not: null },
        status: { in: [...RESULT_RELEASE_STATUSES] },
        ...caseScopeWhere(actor),
      },
      include: {
        resultRevisions: {
          orderBy: { revision: 'desc' },
          take: 1,
          select: {
            revision: true,
            resultCode: true,
            developmentFocus: true,
            finalizedAt: true,
            createdAt: true,
          },
        },
      },
      orderBy: { feedbackReleasedAt: 'desc' },
    });
    return records.flatMap((record) => {
      const result = record.resultRevisions[0];
      return result
        ? [
            {
              caseId: record.id,
              caseCode: record.caseCode,
              assessmentReason: record.assessmentReason,
              targetRole: record.targetRoleSnapshot,
              targetLevel: record.targetLevelSnapshot,
              resultCode: result.resultCode ?? 'INCOMPLETE',
              rationale: result.developmentFocus,
              finalizedAt: (result.finalizedAt ?? result.createdAt).toISOString(),
            },
          ]
        : [];
    });
  }

  async getResult(caseId: string, actor: AuthActor = getActorContext()) {
    const scopedCase = await this.prisma.assessmentCase.findFirst({
      where: {
        id: caseId,
        ...caseScopeWhere(actor),
        // Employees and their managers see a result only once it is approved and shared.
        ...(actor.roles.some((role) =>
          ['Employee', 'EmployeeManager', 'Requester'].includes(role),
        ) &&
        !actor.roles.some((role) => ['Assessor', 'Admin', 'HR', 'BusinessApprover'].includes(role))
          ? { feedbackReleasedAt: { not: null }, status: { in: [...RESULT_RELEASE_STATUSES] } }
          : {}),
      },
      select: { id: true },
    });
    if (!scopedCase)
      throw new NotFoundException(
        this.error('CASE_NOT_FOUND', 'This assessment case could not be found.'),
      );
    const result = await this.prisma.resultRevision.findFirst({
      where: { caseId },
      orderBy: { revision: 'desc' },
      select: {
        id: true,
        caseId: true,
        revision: true,
        resultCode: true,
        scorecardSummary: true,
        developmentFocus: true,
        finalizedAt: true,
        finalizedBy: true,
        createdAt: true,
      },
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
      candidateType: (record.candidateType ?? 'INTERNAL_EMPLOYEE') as
        'INTERNAL_EMPLOYEE' | 'NEW_CANDIDATE',
      candidateEmail: record.candidateEmail,
      hiringOutcome: (record.hiringOutcome ?? 'PENDING') as 'PENDING' | 'JOINED' | 'NOT_JOINED',
      hiringOutcomeReason: record.hiringOutcomeReason as
        'ASSESSMENT' | 'OFFER_DECLINED' | 'ROLE_CANCELLED' | 'OTHER' | null,
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
      stageEnteredAt: record.stageEnteredAt.toISOString(),
      ageLabel: this.ageLabel(record.requestedAt),
      version: record.version,
      adminEditStage: record.adminEditStage as CaseStage | null,
      scoringEnabled: false,
      availableActions: actionsForActor(record.status as CaseStatus, getActorContext().roles),
      justification: record.justification,
      feedbackReleasedAt: record.feedbackReleasedAt?.toISOString() ?? null,
      eligibility,
      activity: record.auditEvents.map((event) => ({
        id: event.id,
        actor: event.actorName,
        action:
          event.action === 'ADMIN_STAGE_REOPENED'
            ? `Admin reopened a completed stage: ${event.reason}`
            : event.action === 'ADMIN_REQUEST_EDITED'
              ? `Admin edited request details: ${event.reason}`
              : (event.reason ?? event.action),
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
    const data = this.parsed(
      createAttachmentSchema,
      input,
      'A valid attachment payload is required.',
    );
    const id = randomUUID();
    const storageKey = data.storageKey ?? `quarantine/${data.caseId}/${id}-${data.fileName}`;

    await this.requireCase(data.caseId);
    if (data.evidenceId) {
      const evidence = await this.prisma.evidenceSubmission.findUnique({
        where: { id: data.evidenceId },
      });
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
