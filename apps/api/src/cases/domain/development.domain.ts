import { BadRequestException } from '@nestjs/common';
import {
  closeCaseSchema,
  scheduleReassessmentSchema,
  updateDevelopmentSchema,
  type CloseCaseInput,
  type ScheduleReassessmentInput,
  type UpdateDevelopmentInput,
} from '@assessflow/contracts';

export class DevelopmentDomain {
  static validateUpdate(input: UpdateDevelopmentInput) {
    const parsed = updateDevelopmentSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Action title and owner are required.',
          fieldErrors: parsed.error.flatten().fieldErrors,
          correlationId: `corr-${Date.now()}`,
        },
      });
    }
    return parsed.data;
  }

  static validateReassessment(input: ScheduleReassessmentInput) {
    const parsed = scheduleReassessmentSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'A reassessment reason of at least 10 characters is required.',
          fieldErrors: parsed.error.flatten().fieldErrors,
          correlationId: `corr-${Date.now()}`,
        },
      });
    }
    return parsed.data;
  }

  static validateClose(input: CloseCaseInput) {
    const parsed = closeCaseSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'A closure reason and expected version are required.',
          fieldErrors: parsed.error.flatten().fieldErrors,
          correlationId: `corr-${Date.now()}`,
        },
      });
    }
    return parsed.data;
  }
}
