import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  decideApprovalSchema,
  submitRecommendationSchema,
  type DecideApprovalInput,
  type SubmitRecommendationInput,
} from '@assessflow/contracts';

export class ApprovalsDomain {
  static validateRecommendation(input: SubmitRecommendationInput) {
    const parsed = submitRecommendationSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'A recommendation code and rationale of at least 20 characters are required.',
          fieldErrors: parsed.error.flatten().fieldErrors,
          correlationId: `corr-${Date.now()}`,
        },
      });
    }
    return parsed.data;
  }

  static validateDecision(input: DecideApprovalInput) {
    const parsed = decideApprovalSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'A valid decision and expected version are required.',
          fieldErrors: parsed.error.flatten().fieldErrors,
          correlationId: `corr-${Date.now()}`,
        },
      });
    }
    return parsed.data;
  }
}
