import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  decideApprovalSchema,
  submitRecommendationSchema,
  type DecideApprovalInput,
  type SubmitRecommendationInput,
} from '@assessflow/contracts';
import type { AppRole } from '../../auth/auth.types';

/** Roles allowed to decide each sequential approval step. */
export const APPROVAL_STEP_ROLES: Record<string, readonly AppRole[]> = {
  HR: ['HR', 'Admin'],
  BUSINESS: ['BusinessApprover', 'Admin'],
};

/** Someone who already acted on the case in a role that conflicts with approving it. */
export interface ApprovalConflict {
  actorId: string;
  reason: string;
}

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

  /**
   * Segregation of duties for approval decisions (Gate 1: self-approval is
   * prohibited). The approver must hold the step's role, and must not be anyone
   * who scored the candidate, finalized the result, submitted the
   * recommendation, or decided another approval step on the same case.
   */
  static assertSegregationOfDuties(params: {
    actor: { id: string; roles: readonly AppRole[] };
    stepRole: string;
    conflicts: ApprovalConflict[];
    correlationId: string;
  }) {
    const { actor, stepRole, conflicts, correlationId } = params;
    const allowedRoles = APPROVAL_STEP_ROLES[stepRole.toUpperCase()];
    if (!allowedRoles || !allowedRoles.some((role) => actor.roles.includes(role))) {
      throw new ForbiddenException({
        error: {
          code: 'APPROVER_ROLE_REQUIRED',
          message: `Only ${allowedRoles?.join(' or ') ?? 'an authorized approver'} can decide the ${stepRole} approval step.`,
          correlationId,
        },
      });
    }
    const conflict = conflicts.find((item) => item.actorId === actor.id);
    if (conflict) {
      throw new ForbiddenException({
        error: {
          code: 'SEGREGATION_OF_DUTIES',
          message: `You cannot approve this case because you ${conflict.reason}. Another approver must decide this step.`,
          correlationId,
        },
      });
    }
  }
}
