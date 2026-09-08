import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  assessmentReasons,
  type AssessmentCaseDetail,
  type AssessmentCaseSummary,
  type AssessmentReason,
  type AttachmentScanStatus,
  type AttachmentSummary,
  type CloseCaseInput,
  createCaseSchema,
  type CreateAttachmentInput,
  type CreateCaseInput,
  type DecideApprovalInput,
  eligibilityDecisionSchema,
  type EligibilityDecisionInput,
  type FinalizePlanInput,
  type FinalizeResultInput,
  isAllowedAttachmentType,
  MAX_ATTACHMENT_SIZE_BYTES,
  type OverviewResponse,
  type ReopenResultInput,
  type SaveEvidenceInput,
  type ScheduleEventInput,
  type ScheduleReassessmentInput,
  type SubmitRecommendationInput,
  type UpdateDevelopmentInput,
} from '@assessflow/contracts';
import { PrismaService } from '../database/prisma.service';
import { PrismaCasesRepository } from './prisma-cases.repository';
import { actionsForStatus } from './workflow-actions';
import { randomUUID } from 'crypto';
import { getActorContext } from '../auth';

type CaseRecord = AssessmentCaseDetail;

export interface AttachmentItem {
  id: string;
  caseId: string;
  evidenceId?: string | null;
  classification: string;
  fileName: string;
  contentType: string;
  sizeBytes: bigint;
  storageKey: string;
  scanStatus: AttachmentScanStatus;
  scanReason?: string | null;
  createdBy: string;
  createdAt: string;
  scannedAt?: string | null;
}

const reasonLabels: Record<AssessmentReason, string> = {
  PROMOTION: 'Promotion',
  INTERNAL_MOBILITY: 'Internal Mobility',
  ROLE_REALIGNMENT: 'Role Realignment',
};

@Injectable()
export class CasesService {
  private readonly cases = new Map<string, CaseRecord>();
  private readonly attachments = new Map<string, AttachmentItem>();
  private nextCaseNumber = 125;
  private readonly repository?: PrismaCasesRepository;

  constructor(@Optional() prisma?: PrismaService) {
    if (prisma?.enabled) this.repository = new PrismaCasesRepository(prisma);
    else this.seed();
  }

  getOverview(): OverviewResponse | Promise<OverviewResponse> {
    if (this.repository) return this.repository.getOverview();
    const values = [...this.cases.values()];
    return {
      metrics: [
        {
          label: 'Active assessments',
          value: values.filter((item) => item.status !== 'CLOSED').length,
          context: 'Across your scope',
          trend:
            values.filter((item) => item.status !== 'CLOSED').length > 0
              ? '+X% vs last cycle'
              : 'No active assessments',
          tone:
            values.filter((item) => item.status !== 'CLOSED').length > 0 ? 'positive' : 'neutral',
        },
        {
          label: 'Pending eligibility',
          value: values.filter((item) => item.status === 'PENDING_ELIGIBILITY').length,
          context: 'Needs HR review',
          trend:
            values.filter((item) => item.status === 'PENDING_ELIGIBILITY').length > 0
              ? 'X due today'
              : 'None due today',
          tone:
            values.filter((item) => item.status === 'PENDING_ELIGIBILITY').length > 0
              ? 'warning'
              : 'positive',
        },
        {
          label: 'Pending approvals',
          value: values.filter((item) => item.status === 'PENDING_APPROVAL').length,
          context: 'Decision queue',
          trend:
            values.filter((item) => item.status === 'PENDING_APPROVAL').length > 0
              ? 'X pending'
              : 'None pending',
          tone:
            values.filter((item) => item.status === 'PENDING_APPROVAL').length > 0
              ? 'warning'
              : 'positive',
        },
        {
          label: 'Overdue follow-up',
          value: values.filter((item) => item.status === 'DEVELOPMENT_IN_PROGRESS').length,
          context: 'Development actions',
          trend:
            values.filter((item) => item.status === 'DEVELOPMENT_IN_PROGRESS').length > 0
              ? '-X% vs last cycle'
              : 'No overdue follow-up',
          tone:
            values.filter((item) => item.status === 'DEVELOPMENT_IN_PROGRESS').length > 0
              ? 'danger'
              : 'positive',
        },
      ],
      tasks: [
        {
          id: 'task-eligibility-1',
          title: 'Review eligibility for Mona Hassan',
          caseCode: 'AF-2026-00124',
          dueLabel: 'Due today',
          priority: 'HIGH',
        },
        {
          id: 'task-approval-1',
          title: 'Approve development recommendation',
          caseCode: 'AF-2026-00123',
          dueLabel: 'Due tomorrow',
          priority: 'NORMAL',
        },
        {
          id: 'task-result-1',
          title: 'Finalize panel result',
          caseCode: 'AF-2026-00121',
          dueLabel: 'Due in 2 days',
          priority: 'NORMAL',
        },
      ],
      pipeline: [
        {
          label: 'Request',
          value: values.filter((item) => item.stage === 'REQUEST').length,
          tone: 'indigo',
        },
        {
          label: 'Eligibility',
          value: values.filter((item) => item.stage === 'ELIGIBILITY').length,
          tone: 'warning',
        },
        {
          label: 'Assessment',
          value: values.filter((item) => item.stage === 'ASSESSMENT').length,
          tone: 'teal',
        },
        {
          label: 'Decision',
          value: values.filter((item) => ['RECOMMENDATION', 'APPROVAL'].includes(item.stage))
            .length,
          tone: 'violet',
        },
      ],
    };
  }

  getTasks() {
    if (this.repository) return this.repository.getTasks();
    const overview = this.getOverview();
    return overview instanceof Promise ? overview.then((value) => value.tasks) : overview.tasks;
  }

  list(filters: {
    status?: string;
    search?: string;
  }): AssessmentCaseSummary[] | Promise<AssessmentCaseSummary[]> {
    if (this.repository) return this.repository.list(filters);
    const search = filters.search?.trim().toLowerCase();
    return [...this.cases.values()]
      .filter((item) => !filters.status || item.status === filters.status)
      .filter(
        (item) =>
          !search ||
          [item.caseCode, item.employeeName, item.department, item.targetRole].some((value) =>
            value.toLowerCase().includes(search),
          ),
      )
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
      .map((item) => this.withActions(item));
  }

  get(caseId: string): AssessmentCaseDetail | Promise<AssessmentCaseDetail> {
    if (this.repository) return this.repository.get(caseId);
    const record = this.cases.get(caseId);
    if (!record)
      throw new NotFoundException(
        this.error('CASE_NOT_FOUND', 'This assessment case could not be found.'),
      );
    return this.withActions(record);
  }

  create(
    input: CreateCaseInput,
    actor?: { id: string; name: string },
  ): AssessmentCaseDetail | Promise<AssessmentCaseDetail> {
    if (this.repository) return this.repository.create(input, actor);
    const parsed = createCaseSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(
        this.error(
          'VALIDATION_ERROR',
          'Review the highlighted request fields.',
          parsed.error.flatten().fieldErrors,
        ),
      );
    }

    const currentActor = actor ?? getActorContext();
    const data = parsed.data;
    const caseCode = `AF-2026-${String(this.nextCaseNumber++).padStart(5, '0')}`;
    const id = `case-${caseCode.toLowerCase()}`;
    const now = new Date().toISOString();
    const record: CaseRecord = {
      id,
      caseCode,
      employeeId: data.employeeId,
      employeeName: data.employeeName,
      department: data.department,
      currentRole: data.currentRole,
      assessmentReason: data.assessmentReason,
      targetRole: data.targetRole,
      targetLevel: data.targetLevel,
      stage: 'REQUEST',
      status: 'DRAFT',
      owner: 'Requester',
      priority: data.priority,
      requestedAt: now,
      ageLabel: 'Just now',
      version: 1,
      scoringEnabled: false,
      availableActions: [],
      justification: data.justification,
      activity: [
        {
          id: `event-${id}`,
          actor: currentActor.name,
          action: 'Created assessment draft',
          timestamp: now,
          tone: 'info',
        },
      ],
    };
    this.cases.set(id, record);
    return this.withActions(record);
  }

  submit(
    caseId: string,
    expectedVersion: number,
  ): AssessmentCaseDetail | Promise<AssessmentCaseDetail> {
    if (this.repository) return this.repository.submit(caseId, expectedVersion);
    const record = this.require(caseId);
    this.assertVersion(record, expectedVersion);
    if (record.status !== 'DRAFT')
      throw new BadRequestException(
        this.error('INVALID_TRANSITION', 'Only draft requests can be submitted.'),
      );
    record.status = 'PENDING_ELIGIBILITY';
    record.stage = 'ELIGIBILITY';
    record.owner = 'HR / Talent';
    record.version += 1;
    record.eligibility = this.defaultEligibility();
    this.addActivity(record, 'Submitted request for eligibility review', 'success');
    return this.withActions(record);
  }

  decideEligibility(
    caseId: string,
    input: EligibilityDecisionInput,
    actor?: { id: string; name: string },
  ): AssessmentCaseDetail | Promise<AssessmentCaseDetail> {
    if (this.repository) return this.repository.decideEligibility(caseId, input, actor);
    const record = this.require(caseId);
    const parsed = eligibilityDecisionSchema.safeParse(input);
    if (!parsed.success)
      throw new BadRequestException(
        this.error(
          'VALIDATION_ERROR',
          'A valid eligibility decision and version are required.',
          parsed.error.flatten().fieldErrors,
        ),
      );
    this.assertVersion(record, parsed.data.expectedVersion);
    if (!record.eligibility || !['PENDING_ELIGIBILITY', 'NOT_ELIGIBLE'].includes(record.status))
      throw new BadRequestException(
        this.error('INVALID_TRANSITION', 'This case is not ready for an eligibility decision.'),
      );
    if (parsed.data.decision === 'NOT_ELIGIBLE' && !parsed.data.reason?.trim())
      throw new BadRequestException(
        this.error('REASON_REQUIRED', 'A reason is required when the employee is not eligible.'),
      );

    record.eligibility.decision = parsed.data.decision;
    record.eligibility.reason = parsed.data.reason;
    record.version += 1;
    if (parsed.data.decision === 'ELIGIBLE') {
      record.status = 'READY_FOR_PLANNING';
      record.stage = 'PLANNING';
      record.owner = 'Assessment Coordinator';
      this.addActivity(
        record,
        'Eligibility approved; planning task created',
        'success',
        actor?.name,
      );
    } else {
      record.status = 'NOT_ELIGIBLE';
      record.stage = 'ELIGIBILITY';
      record.owner = 'HR / Talent';
      this.addActivity(record, 'Eligibility marked not eligible', 'danger', actor?.name);
    }
    return this.withActions(record);
  }

  requestOverride(
    caseId: string,
    reason: string,
    actor?: { id: string; name: string },
  ): AssessmentCaseDetail | Promise<AssessmentCaseDetail> {
    if (this.repository) return this.repository.requestOverride(caseId, reason, actor);
    const record = this.require(caseId);
    if (record.status !== 'NOT_ELIGIBLE')
      throw new BadRequestException(
        this.error(
          'INVALID_TRANSITION',
          'An override can only be requested after an ineligible decision.',
        ),
      );
    if (!reason?.trim())
      throw new BadRequestException(
        this.error('REASON_REQUIRED', 'An override reason is required.'),
      );
    record.status = 'PENDING_ELIGIBILITY';
    record.owner = 'HR Governance';
    record.version += 1;
    if (record.eligibility) record.eligibility.reason = `Override requested: ${reason}`;
    this.addActivity(
      record,
      'Eligibility override requested for governance review',
      'warning',
      actor?.name,
    );
    return this.withActions(record);
  }

  // ---------------------------------------------------------------------------
  // Workflow expansion (demo-memory path): same status flow as the PostgreSQL
  // repository, without persisted sub-entities. Reads below return the
  // demo-held plan/events/result state; database mode is authoritative.
  // ---------------------------------------------------------------------------

  private readonly expansion = new Map<
    string,
    {
      plan?: { methods: unknown[]; leadAssessor?: string };
      events: Array<{ id: string; status: string; startsAt?: string }>;
      result?: { resultCode: string };
      recommendation?: { code: string };
      steps: Array<{ id: string; sequence: number; role: string; decision: string }>;
      development?: { actions: unknown[] };
    }
  >();

  private exp(caseId: string) {
    let state = this.expansion.get(caseId);
    if (!state) {
      state = { events: [], steps: [] };
      this.expansion.set(caseId, state);
    }
    return state;
  }

  private moveTo(
    record: CaseRecord,
    status: CaseRecord['status'],
    stage: CaseRecord['stage'],
    owner: string,
    activity: string,
    tone: 'info' | 'success' | 'warning' | 'danger',
  ): CaseRecord {
    record.status = status;
    record.stage = stage;
    record.owner = owner;
    record.version += 1;
    this.addActivity(record, activity, tone);
    return this.withActions(record);
  }

  private requireTransition(
    record: CaseRecord,
    from: string[],
    expectedVersion: number,
    message: string,
  ) {
    this.assertVersion(record, expectedVersion);
    if (!from.includes(record.status))
      throw new BadRequestException(this.error('INVALID_TRANSITION', message));
  }

  finalizePlan(
    caseId: string,
    input: FinalizePlanInput,
  ): AssessmentCaseDetail | Promise<AssessmentCaseDetail> {
    if (this.repository) return this.repository.finalizePlan(caseId, input);
    const record = this.require(caseId);
    this.requireTransition(
      record,
      ['READY_FOR_PLANNING'],
      input.expectedVersion,
      'A plan can only be finalized from readiness for planning.',
    );
    this.exp(caseId).plan = { methods: input.methods, leadAssessor: input.leadAssessor };
    return this.moveTo(
      record,
      'PLANNING',
      'PLANNING',
      'Assessment Coordinator',
      'Assessment plan finalized',
      'success',
    );
  }

  scheduleEvent(
    caseId: string,
    input: ScheduleEventInput,
  ):
    | (AssessmentCaseDetail & { eventId: string })
    | Promise<AssessmentCaseDetail & { eventId: string }> {
    if (this.repository) return this.repository.scheduleEvent(caseId, input);
    const record = this.require(caseId);
    this.requireTransition(
      record,
      ['PLANNING', 'SCHEDULED'],
      input.expectedVersion,
      'Events can only be scheduled during planning.',
    );
    const eventId = `event-${record.id}-${record.version}`;
    this.exp(caseId).events.push({ id: eventId, status: 'SCHEDULED', startsAt: input.startsAt });
    const detail = this.moveTo(
      record,
      'SCHEDULED',
      'ASSESSMENT',
      'Assessment Coordinator',
      'Assessment event scheduled',
      'success',
    );
    return { ...detail, eventId };
  }

  saveEvidence(
    eventId: string,
    assessor: { id: string; name: string },
    input: SaveEvidenceInput,
    submit: boolean,
  ):
    | (AssessmentCaseDetail & { evidenceId: string; submitted: boolean })
    | Promise<AssessmentCaseDetail & { evidenceId: string; submitted: boolean }> {
    void assessor;
    void input;
    if (this.repository) return this.repository.saveEvidence(eventId, assessor, input, submit);
    const record = [...this.cases.values()].find((item) =>
      this.exp(item.id).events.some((event) => event.id === eventId),
    );
    if (!record)
      throw new NotFoundException(
        this.error('EVENT_NOT_FOUND', 'This assessment event could not be found.'),
      );
    if (!['SCHEDULED', 'IN_PROGRESS'].includes(record.status))
      throw new BadRequestException(
        this.error(
          'INVALID_TRANSITION',
          'Evidence can only be recorded for scheduled or in-progress assessments.',
        ),
      );
    const evidenceId = `evidence-${eventId}`;
    const detail =
      submit && record.status === 'SCHEDULED'
        ? this.moveTo(
            record,
            'IN_PROGRESS',
            'ASSESSMENT',
            'Assessor Panel',
            'Assessor evidence submitted',
            'success',
          )
        : this.withActions(record);
    if (!submit) this.addActivity(record, 'Assessor evidence draft saved', 'info');
    return { ...detail, evidenceId, submitted: submit };
  }

  finalizeResult(
    caseId: string,
    input: FinalizeResultInput,
    actor?: { id: string; name: string },
  ): AssessmentCaseDetail | Promise<AssessmentCaseDetail> {
    void actor;
    if (this.repository) return this.repository.finalizeResult(caseId, input);
    const record = this.require(caseId);
    this.requireTransition(
      record,
      ['IN_PROGRESS'],
      input.expectedVersion,
      'A result can only be finalized while assessment is in progress.',
    );
    this.exp(caseId).result = { resultCode: input.resultCode };
    return this.moveTo(
      record,
      'RESULT_FINALIZED',
      'RESULT',
      'Panel Lead',
      `Result finalized: ${input.resultCode}`,
      'success',
    );
  }

  reopenResult(
    caseId: string,
    input: ReopenResultInput,
    actor?: { id: string; name: string },
  ): AssessmentCaseDetail | Promise<AssessmentCaseDetail> {
    if (this.repository) return this.repository.reopenResult(caseId, input, actor);
    const record = this.require(caseId);
    this.requireTransition(
      record,
      ['RESULT_FINALIZED'],
      input.expectedVersion,
      'Only a finalized result can be reopened.',
    );
    if (!input.reason?.trim() || input.reason.trim().length < 10)
      throw new BadRequestException(
        this.error('REASON_REQUIRED', 'A reopen reason of at least 10 characters is required.'),
      );
    delete this.exp(caseId).result;
    return this.moveTo(
      record,
      'IN_PROGRESS',
      'ASSESSMENT',
      'Panel Lead',
      'Result reopened',
      'warning',
    );
  }

  submitRecommendation(
    caseId: string,
    input: SubmitRecommendationInput,
    actor?: { id: string; name: string },
  ): AssessmentCaseDetail | Promise<AssessmentCaseDetail> {
    void actor;
    if (this.repository) return this.repository.submitRecommendation(caseId, input);
    const record = this.require(caseId);
    this.requireTransition(
      record,
      ['RESULT_FINALIZED', 'PENDING_RECOMMENDATION'],
      input.expectedVersion,
      'A recommendation requires a finalized result.',
    );
    const state = this.exp(caseId);
    state.recommendation = { code: input.code };
    state.steps = [
      { id: `step-${record.id}-1`, sequence: 1, role: 'HR', decision: 'PENDING' },
      { id: `step-${record.id}-2`, sequence: 2, role: 'BUSINESS', decision: 'PENDING' },
    ];
    return this.moveTo(
      record,
      'PENDING_APPROVAL',
      'APPROVAL',
      'Business Approver',
      'Recommendation submitted for approval',
      'warning',
    );
  }

  decideApproval(
    stepId: string,
    input: DecideApprovalInput,
    actor?: { id: string; name: string },
  ):
    | (AssessmentCaseDetail & { stepId: string })
    | Promise<AssessmentCaseDetail & { stepId: string }> {
    void actor;
    if (this.repository) return this.repository.decideApproval(stepId, input);
    const record = [...this.cases.values()].find((item) =>
      this.exp(item.id).steps.some((step) => step.id === stepId),
    );
    if (!record)
      throw new NotFoundException(
        this.error('STEP_NOT_FOUND', 'This approval step could not be found.'),
      );
    const step = this.exp(record.id).steps.find((item) => item.id === stepId);
    if (!step || step.decision !== 'PENDING' || record.status !== 'PENDING_APPROVAL')
      throw new BadRequestException(
        this.error('INVALID_TRANSITION', 'This approval step cannot be decided now.'),
      );
    step.decision = input.decision;
    let detail: CaseRecord;
    if (input.decision === 'REJECTED' || input.decision === 'CHANGES_REQUESTED') {
      detail = this.moveTo(
        record,
        'PENDING_RECOMMENDATION',
        'RECOMMENDATION',
        'Business Owner',
        `Approval step ${input.decision}`,
        'danger',
      );
    } else if (this.exp(record.id).steps.every((item) => item.decision === 'APPROVED')) {
      detail = this.moveTo(
        record,
        'APPROVED',
        'APPROVAL',
        'HR / Talent',
        'All approval steps granted',
        'success',
      );
    } else {
      detail = this.withActions(record);
      this.addActivity(record, `Approval step ${input.decision} (step ${step.sequence})`, 'info');
    }
    return { ...detail, stepId };
  }

  updateDevelopment(
    caseId: string,
    input: UpdateDevelopmentInput,
  ): AssessmentCaseDetail | Promise<AssessmentCaseDetail> {
    if (this.repository) return this.repository.updateDevelopment(caseId, input);
    const record = this.require(caseId);
    this.requireTransition(
      record,
      ['APPROVED', 'DEVELOPMENT_IN_PROGRESS'],
      input.expectedVersion,
      'A development plan requires an approved case.',
    );
    this.exp(caseId).development = { actions: input.actions ?? [] };
    return this.moveTo(
      record,
      'DEVELOPMENT_IN_PROGRESS',
      'FOLLOW_UP',
      'Manager',
      'Development plan updated',
      'success',
    );
  }

  scheduleReassessment(
    sourceCaseId: string,
    input: ScheduleReassessmentInput,
  ):
    | (AssessmentCaseDetail & { linkId: string; sourceCaseId: string })
    | Promise<AssessmentCaseDetail & { linkId: string; sourceCaseId: string }> {
    if (this.repository) return this.repository.scheduleReassessment(sourceCaseId, input);
    const source = this.require(sourceCaseId);
    this.requireTransition(
      source,
      ['APPROVED', 'DEVELOPMENT_IN_PROGRESS', 'CLOSED'],
      input.expectedVersion,
      'Reassessment requires an approved, in-development, or closed case.',
    );
    if (!input.reason?.trim() || input.reason.trim().length < 10)
      throw new BadRequestException(
        this.error(
          'REASON_REQUIRED',
          'A reassessment reason of at least 10 characters is required.',
        ),
      );
    const created = this.create({
      employeeId: source.employeeId,
      employeeName: source.employeeName,
      department: source.department,
      currentRole: source.currentRole,
      assessmentReason: source.assessmentReason,
      targetRole: source.targetRole,
      targetLevel: source.targetLevel,
      justification: `Reassessment of ${source.caseCode}: ${input.reason}`.slice(0, 4000),
      priority: source.priority,
    });
    if (created instanceof Promise)
      throw new Error('Memory reassessment cannot run in database mode.');
    this.addActivity(source, 'Reassessment scheduled', 'warning');
    return { ...created, linkId: `link-${source.id}-${created.id}`, sourceCaseId };
  }

  closeCase(
    caseId: string,
    input: CloseCaseInput,
  ): AssessmentCaseDetail | Promise<AssessmentCaseDetail> {
    if (this.repository) return this.repository.closeCase(caseId, input);
    const record = this.require(caseId);
    this.requireTransition(
      record,
      ['APPROVED', 'DEVELOPMENT_IN_PROGRESS'],
      input.expectedVersion,
      'Only approved or in-development cases can be closed.',
    );
    return this.moveTo(
      record,
      'CLOSED',
      'CLOSED',
      'HR / Talent',
      'Case closed after approval and follow-up ownership',
      'success',
    );
  }

  getPlan(caseId: string): unknown | Promise<unknown> {
    if (this.repository) return this.repository.getPlan(caseId);
    const plan = this.exp(this.require(caseId).id).plan;
    if (!plan)
      throw new NotFoundException(
        this.error('PLAN_NOT_FOUND', 'No assessment plan exists for this case yet.'),
      );
    return plan;
  }

  listEvents(caseId: string): unknown[] | Promise<unknown[]> {
    if (this.repository) return this.repository.listEvents(caseId);
    this.require(caseId);
    return this.exp(caseId).events;
  }

  getResult(caseId: string): unknown | Promise<unknown> {
    if (this.repository) return this.repository.getResult(caseId);
    const result = this.exp(this.require(caseId).id).result;
    if (!result)
      throw new NotFoundException(
        this.error('RESULT_NOT_FOUND', 'No result has been finalized for this case yet.'),
      );
    return result;
  }

  getRecommendation(caseId: string): unknown | Promise<unknown> {
    if (this.repository) return this.repository.getRecommendation(caseId);
    const recommendation = this.exp(this.require(caseId).id).recommendation;
    if (!recommendation)
      throw new NotFoundException(
        this.error('RECOMMENDATION_NOT_FOUND', 'No recommendation exists for this case yet.'),
      );
    return recommendation;
  }

  listApprovalSteps(caseId: string): unknown[] | Promise<unknown[]> {
    if (this.repository) return this.repository.listApprovalSteps(caseId);
    this.require(caseId);
    return this.exp(caseId).steps;
  }

  getDevelopment(caseId: string): unknown | Promise<unknown> {
    if (this.repository) return this.repository.getDevelopment(caseId);
    const development = this.exp(this.require(caseId).id).development;
    if (!development)
      throw new NotFoundException(
        this.error('DEVELOPMENT_NOT_FOUND', 'No development plan exists for this case yet.'),
      );
    return development;
  }

  private require(caseId: string): CaseRecord {
    const record = this.cases.get(caseId);
    if (!record)
      throw new NotFoundException(
        this.error('CASE_NOT_FOUND', 'This assessment case could not be found.'),
      );
    return record;
  }
  private assertVersion(record: CaseRecord, expectedVersion: number) {
    if (!Number.isInteger(expectedVersion) || expectedVersion !== record.version) {
      throw new ConflictException(
        this.error(
          'CONCURRENCY_CONFLICT',
          'This case changed in another session. Refresh before trying again.',
        ),
      );
    }
  }

  private withActions(record: CaseRecord): CaseRecord {
    return { ...record, availableActions: actionsForStatus(record.status) };
  }

  private defaultEligibility() {
    // TODO: Replace with actual policy engine when BIZ-002 is approved
    // Currently returns placeholder values for demo purposes only
    return {
      policyVersion: '2026.1',
      criteria: [
        {
          code: 'TENURE',
          label: 'Minimum time in current role',
          blocking: true,
          result: 'NOT_CHECKED' as const, // Placeholder - should be determined by policy
        },
        {
          code: 'PIP',
          label: 'Active PIP or disciplinary action',
          blocking: true,
          result: 'NOT_CHECKED' as const, // Placeholder - should be determined by policy
        },
        {
          code: 'TRAINING',
          label: 'Mandatory training',
          blocking: false,
          result: 'NOT_CHECKED' as const,
        },
        {
          code: 'POSITION',
          label: 'Target position approved',
          blocking: true,
          result: 'NOT_CHECKED' as const, // Placeholder - should be determined by policy
        },
      ],
    };
  }

  private addActivity(
    record: CaseRecord,
    action: string,
    tone: 'info' | 'success' | 'warning' | 'danger',
    actorName?: string,
  ) {
    const actor = actorName ?? getActorContext().name ?? 'You';
    record.activity.unshift({
      id: `event-${record.id}-${record.version}`,
      actor,
      action,
      timestamp: new Date().toISOString(),
      tone,
    });
  }

  private error(code: string, message: string, fieldErrors?: Record<string, string[]>) {
    return { error: { code, message, fieldErrors, correlationId: randomUUID() } };
  }

  private seed() {
    const seedCases: CreateCaseInput[] = [
      {
        employeeId: 'emp-001',
        employeeName: 'Mona Hassan',
        department: 'Product',
        currentRole: 'Senior Specialist',
        assessmentReason: 'PROMOTION',
        targetRole: 'Team Lead',
        targetLevel: 'L5',
        justification: 'Expand leadership scope across the product operations team.',
        priority: 'HIGH',
      },
      {
        employeeId: 'emp-002',
        employeeName: 'Omar Khalil',
        department: 'Engineering',
        currentRole: 'Software Engineer',
        assessmentReason: 'INTERNAL_MOBILITY',
        targetRole: 'Platform Engineer',
        targetLevel: 'L4',
        justification: 'Support the platform team with an approved internal move.',
        priority: 'NORMAL',
      },
      {
        employeeId: 'emp-003',
        employeeName: 'Sara Adel',
        department: 'People',
        currentRole: 'HR Specialist',
        assessmentReason: 'ROLE_REALIGNMENT',
        targetRole: 'Talent Partner',
        targetLevel: 'L5',
        justification: 'Align responsibilities with the emerging talent-partner operating model.',
        priority: 'NORMAL',
      },
    ];

    seedCases.forEach((input, index) => {
      const created = this.create(input);
      if (created instanceof Promise) throw new Error('Memory seed cannot run in database mode.');
      if (index === 0) {
        const record = this.require(created.id);
        record.status = 'PENDING_ELIGIBILITY';
        record.stage = 'ELIGIBILITY';
        record.owner = 'HR / Talent';
        record.eligibility = this.defaultEligibility();
        record.version = 2;
        this.addActivity(record, 'Submitted request for eligibility review', 'success');

        // Seed demo attachments
        const cleanId = 'att-demo-clean';
        this.attachments.set(cleanId, {
          id: cleanId,
          caseId: created.id,
          evidenceId: null,
          classification: 'EVIDENCE',
          fileName: 'prior-performance-review.pdf',
          contentType: 'application/pdf',
          sizeBytes: 1_048_576n,
          storageKey: `clean/${created.id}/${cleanId}-prior-performance-review.pdf`,
          scanStatus: 'CLEAN',
          scanReason: null,
          createdBy: 'demo-user',
          createdAt: new Date().toISOString(),
          scannedAt: new Date().toISOString(),
        });
        const pendingId = 'att-demo-pending';
        this.attachments.set(pendingId, {
          id: pendingId,
          caseId: created.id,
          evidenceId: null,
          classification: 'PORTFOLIO',
          fileName: 'project-portfolio.docx',
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          sizeBytes: 2_097_152n,
          storageKey: `quarantine/${created.id}/${pendingId}-project-portfolio.docx`,
          scanStatus: 'PENDING',
          scanReason: null,
          createdBy: 'demo-user',
          createdAt: new Date().toISOString(),
          scannedAt: null,
        });
      }
      if (index === 1) {
        const record = this.require(created.id);
        record.status = 'READY_FOR_PLANNING';
        record.stage = 'PLANNING';
        record.owner = 'Assessment Coordinator';
        record.eligibility = { ...this.defaultEligibility(), decision: 'ELIGIBLE' };
        record.version = 2;
        this.addActivity(record, 'Eligibility approved; planning task created', 'success');
      }
      if (index === 2) {
        const record = this.require(created.id);
        record.status = 'PENDING_APPROVAL';
        record.stage = 'APPROVAL';
        record.owner = 'Business Approver';
        record.version = 2;
        this.addActivity(record, 'Recommendation submitted for approval', 'warning');
      }
    });
  }

  createAttachment(
    input: CreateAttachmentInput,
    actor: { id: string; name: string } = { id: 'demo-user', name: 'Demo user' },
  ): Promise<AttachmentSummary> | AttachmentSummary {
    if (!input.classification || input.classification.trim().length === 0) {
      throw new BadRequestException({
        error: {
          code: 'CLASSIFICATION_REQUIRED',
          message: 'Attachment classification is required',
          fieldErrors: { classification: ['Classification is required'] },
        },
      });
    }

    if (!isAllowedAttachmentType(input.fileName, input.contentType)) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_FILE_TYPE',
          message: `File type '${input.contentType}' or file extension is not allowed. Permitted types: PDF, DOC, DOCX, JPG, PNG.`,
          fieldErrors: { contentType: ['Must be an allowed type: PDF, DOC, DOCX, JPG, PNG'] },
        },
      });
    }

    if (input.sizeBytes <= 0 || input.sizeBytes > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new BadRequestException({
        error: {
          code: 'FILE_TOO_LARGE',
          message: `File size exceeds 10MB maximum limit (${MAX_ATTACHMENT_SIZE_BYTES} bytes).`,
          fieldErrors: { sizeBytes: ['File size exceeds 10MB limit'] },
        },
      });
    }

    if (this.repository) {
      return this.repository.createAttachment(input, actor);
    }

    const caseRecord = this.cases.get(input.caseId);
    if (!caseRecord) {
      throw new NotFoundException({
        error: {
          code: 'CASE_NOT_FOUND',
          message: `Case '${input.caseId}' not found.`,
        },
      });
    }

    const id = randomUUID();
    const storageKey = input.storageKey ?? `quarantine/${input.caseId}/${id}-${input.fileName}`;
    const record: AttachmentItem = {
      id,
      caseId: input.caseId,
      evidenceId: input.evidenceId ?? null,
      classification: input.classification.trim(),
      fileName: input.fileName.trim(),
      contentType: input.contentType.toLowerCase().trim(),
      sizeBytes: BigInt(input.sizeBytes),
      storageKey,
      scanStatus: 'PENDING',
      scanReason: null,
      createdBy: actor.id,
      createdAt: new Date().toISOString(),
      scannedAt: null,
    };

    this.attachments.set(id, record);
    this.addActivity(
      caseRecord,
      `Attachment uploaded: ${record.fileName} (${record.classification})`,
      'info',
    );
    return this.serializeAttachment(record);
  }

  getAttachment(attachmentId: string): Promise<AttachmentSummary> | AttachmentSummary {
    if (this.repository) {
      return this.repository.getAttachment(attachmentId);
    }
    const attachment = this.attachments.get(attachmentId);
    if (!attachment) {
      throw new NotFoundException({
        error: {
          code: 'ATTACHMENT_NOT_FOUND',
          message: `Attachment '${attachmentId}' not found.`,
        },
      });
    }
    return this.serializeAttachment(attachment);
  }

  listAttachments(caseId: string): Promise<AttachmentSummary[]> | AttachmentSummary[] {
    if (this.repository) {
      return this.repository.listAttachments(caseId);
    }
    return [...this.attachments.values()]
      .filter((item) => item.caseId === caseId)
      .map((item) => this.serializeAttachment(item));
  }

  assertScanClean(attachment: {
    id: string;
    scanStatus: AttachmentScanStatus;
    scanReason?: string | null;
  }) {
    if (attachment.scanStatus !== 'CLEAN') {
      throw new UnprocessableEntityException({
        error: {
          code: 'SCAN_NOT_CLEAN',
          message: `Attachment '${attachment.id}' cannot be accessed because scanStatus is '${attachment.scanStatus}' (must be CLEAN).`,
          scanStatus: attachment.scanStatus,
          scanReason: attachment.scanReason ?? null,
        },
      });
    }
  }

  async previewAttachment(attachmentId: string) {
    const attachment = await this.getAttachment(attachmentId);
    this.assertScanClean(attachment);
    return {
      id: attachment.id,
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      scanStatus: attachment.scanStatus,
      previewUrl: `https://storage.local/clean/${attachment.storageKey}?action=preview`,
    };
  }

  async downloadAttachment(attachmentId: string) {
    const attachment = await this.getAttachment(attachmentId);
    this.assertScanClean(attachment);
    return {
      id: attachment.id,
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      scanStatus: attachment.scanStatus,
      downloadUrl: `https://storage.local/clean/${attachment.storageKey}?action=download`,
    };
  }

  async updateAttachmentScanStatus(
    attachmentId: string,
    scanStatus: AttachmentScanStatus,
    reason?: string | null,
    scannedAt: Date = new Date(),
  ): Promise<AttachmentSummary> {
    if (this.repository) {
      return this.repository.updateAttachmentScan(attachmentId, scanStatus, reason, scannedAt);
    }
    const attachment = this.attachments.get(attachmentId);
    if (!attachment) {
      throw new NotFoundException({
        error: {
          code: 'ATTACHMENT_NOT_FOUND',
          message: `Attachment '${attachmentId}' not found.`,
        },
      });
    }
    attachment.scanStatus = scanStatus;
    attachment.scanReason = reason ?? null;
    attachment.scannedAt = scannedAt.toISOString();
    return this.serializeAttachment(attachment);
  }

  getPendingAttachments(limit = 50): Promise<AttachmentSummary[]> | AttachmentSummary[] {
    if (this.repository) {
      return this.repository.getPendingAttachments(limit);
    }
    return [...this.attachments.values()]
      .filter((item) => item.scanStatus === 'PENDING')
      .slice(0, limit)
      .map((item) => this.serializeAttachment(item));
  }

  private serializeAttachment(item: AttachmentItem): AttachmentSummary {
    return {
      id: item.id,
      caseId: item.caseId,
      evidenceId: item.evidenceId ?? null,
      classification: item.classification,
      fileName: item.fileName,
      contentType: item.contentType,
      sizeBytes: Number(item.sizeBytes),
      storageKey: item.storageKey,
      scanStatus: item.scanStatus,
      scanReason: item.scanReason ?? null,
      createdBy: item.createdBy,
      createdAt: item.createdAt,
      scannedAt: item.scannedAt ?? null,
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
