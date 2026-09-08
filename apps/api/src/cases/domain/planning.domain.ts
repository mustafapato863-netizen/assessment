import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  finalizePlanSchema,
  scheduleEventSchema,
  type FinalizePlanInput,
  type ScheduleEventInput,
} from '@assessflow/contracts';

export class PlanningDomain {
  static validateFinalizePlan(input: FinalizePlanInput) {
    const parsed = finalizePlanSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'At least one valid assessment method is required.',
          fieldErrors: parsed.error.flatten().fieldErrors,
          correlationId: `corr-${Date.now()}`,
        },
      });
    }
    return parsed.data;
  }

  static validateScheduleEvent(input: ScheduleEventInput) {
    const parsed = scheduleEventSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'A valid start time and expected version are required.',
          fieldErrors: parsed.error.flatten().fieldErrors,
          correlationId: `corr-${Date.now()}`,
        },
      });
    }
    return parsed.data;
  }

  static assertCanPlan(status: string, currentVersion: number, expectedVersion: number) {
    if (currentVersion !== expectedVersion) {
      throw new ConflictException({
        error: {
          code: 'CONCURRENCY_CONFLICT',
          message: 'This case changed in another session. Refresh before trying again.',
          correlationId: `corr-${Date.now()}`,
        },
      });
    }
    if (status !== 'READY_FOR_PLANNING') {
      throw new BadRequestException({
        error: {
          code: 'INVALID_TRANSITION',
          message: 'Only cases marked ready for planning can have their plan finalized.',
          correlationId: `corr-${Date.now()}`,
        },
      });
    }
  }
}
