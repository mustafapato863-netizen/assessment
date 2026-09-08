import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  finalizeResultSchema,
  reopenResultSchema,
  saveEvidenceSchema,
  type FinalizeResultInput,
  type ReopenResultInput,
  type SaveEvidenceInput,
} from '@assessflow/contracts';

export class EvaluationDomain {
  static validateEvidence(input: SaveEvidenceInput) {
    const parsed = saveEvidenceSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Evidence summary must be at least 20 characters.',
          fieldErrors: parsed.error.flatten().fieldErrors,
          correlationId: `corr-${Date.now()}`,
        },
      });
    }
    return parsed.data;
  }

  static validateFinalizeResult(input: FinalizeResultInput) {
    const parsed = finalizeResultSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'A valid result code and version are required.',
          fieldErrors: parsed.error.flatten().fieldErrors,
          correlationId: `corr-${Date.now()}`,
        },
      });
    }
    return parsed.data;
  }

  static validateReopenResult(input: ReopenResultInput) {
    const parsed = reopenResultSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'A reopen reason of at least 10 characters is required.',
          fieldErrors: parsed.error.flatten().fieldErrors,
          correlationId: `corr-${Date.now()}`,
        },
      });
    }
    return parsed.data;
  }
}
