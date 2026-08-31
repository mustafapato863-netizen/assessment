import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  assessmentReasons,
  type AssessmentCaseDetail,
  type AssessmentCaseSummary,
  type AssessmentReason,
  createCaseSchema,
  type CreateCaseInput,
  eligibilityDecisionSchema,
  type EligibilityDecisionInput,
  type OverviewResponse,
} from '@assessflow/contracts';
import { PrismaService } from '../database/prisma.service';
import { PrismaCasesRepository } from './prisma-cases.repository';
import { actionsForStatus } from './workflow-actions';

type CaseRecord = AssessmentCaseDetail;

const reasonLabels: Record<AssessmentReason, string> = {
  PROMOTION: 'Promotion',
  INTERNAL_MOBILITY: 'Internal Mobility',
  ROLE_REALIGNMENT: 'Role Realignment',
};

@Injectable()
export class CasesService {
  private readonly cases = new Map<string, CaseRecord>();
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
          trend: '+12% vs last cycle',
          tone: 'positive',
        },
        {
          label: 'Pending eligibility',
          value: values.filter((item) => item.status === 'PENDING_ELIGIBILITY').length,
          context: 'Needs HR review',
          trend: '2 due today',
          tone: 'warning',
        },
        {
          label: 'Pending approvals',
          value: values.filter((item) => item.status === 'PENDING_APPROVAL').length,
          context: 'Decision queue',
          trend: '1 high priority',
          tone: 'warning',
        },
        {
          label: 'Overdue follow-up',
          value: 2,
          context: 'Development actions',
          trend: '-4% vs last cycle',
          tone: 'danger',
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

  create(input: CreateCaseInput): AssessmentCaseDetail | Promise<AssessmentCaseDetail> {
    if (this.repository) return this.repository.create(input);
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
          actor: 'You',
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
  ): AssessmentCaseDetail | Promise<AssessmentCaseDetail> {
    if (this.repository) return this.repository.decideEligibility(caseId, input);
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
      this.addActivity(record, 'Eligibility approved; planning task created', 'success');
    } else {
      record.status = 'NOT_ELIGIBLE';
      record.stage = 'ELIGIBILITY';
      record.owner = 'HR / Talent';
      this.addActivity(record, 'Eligibility marked not eligible', 'danger');
    }
    return this.withActions(record);
  }

  requestOverride(
    caseId: string,
    reason: string,
  ): AssessmentCaseDetail | Promise<AssessmentCaseDetail> {
    if (this.repository) return this.repository.requestOverride(caseId, reason);
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
    this.addActivity(record, 'Eligibility override requested for governance review', 'warning');
    return this.withActions(record);
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
    return {
      policyVersion: '2026.1',
      criteria: [
        {
          code: 'TENURE',
          label: 'Minimum time in current role',
          blocking: true,
          result: 'MET' as const,
        },
        {
          code: 'PIP',
          label: 'Active PIP or disciplinary action',
          blocking: true,
          result: 'MET' as const,
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
          result: 'MET' as const,
        },
      ],
    };
  }

  private addActivity(
    record: CaseRecord,
    action: string,
    tone: 'info' | 'success' | 'warning' | 'danger',
  ) {
    record.activity.unshift({
      id: `event-${record.id}-${record.version}`,
      actor: 'You',
      action,
      timestamp: new Date().toISOString(),
      tone,
    });
  }

  private error(code: string, message: string, fieldErrors?: Record<string, string[]>) {
    return { error: { code, message, fieldErrors, correlationId: `corr-${Date.now()}` } };
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
}
