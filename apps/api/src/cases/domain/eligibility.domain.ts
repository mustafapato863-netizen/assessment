import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  eligibilityDecisionSchema,
  type AssessmentCaseDetail,
  type EligibilityDecisionInput,
} from '@assessflow/contracts';
import { Prisma } from '@assessflow/database';

export const defaultEligibilityCriteria = [
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

export class EligibilityDomain {
  static validateDecision(input: EligibilityDecisionInput) {
    const parsed = eligibilityDecisionSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'A valid eligibility decision and version are required.',
          fieldErrors: parsed.error.flatten().fieldErrors,
          correlationId: `corr-${Date.now()}`,
        },
      });
    }
    if (parsed.data.decision === 'NOT_ELIGIBLE' && !parsed.data.reason?.trim()) {
      throw new BadRequestException({
        error: {
          code: 'REASON_REQUIRED',
          message: 'A reason is required when the employee is not eligible.',
          correlationId: `corr-${Date.now()}`,
        },
      });
    }
    return parsed.data;
  }

  static assertCanDecide(record: {
    status: string;
    version: number;
    eligibility?: unknown | null;
  }, expectedVersion: number) {
    if (record.version !== expectedVersion) {
      throw new ConflictException({
        error: {
          code: 'CONCURRENCY_CONFLICT',
          message: 'This case changed in another session. Refresh before trying again.',
          correlationId: `corr-${Date.now()}`,
        },
      });
    }
    if (!record.eligibility || !['PENDING_ELIGIBILITY', 'NOT_ELIGIBLE'].includes(record.status)) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_TRANSITION',
          message: 'This case is not ready for an eligibility decision.',
          correlationId: `corr-${Date.now()}`,
        },
      });
    }
  }
}
