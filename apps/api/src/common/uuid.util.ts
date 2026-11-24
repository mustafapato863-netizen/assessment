import { NotFoundException } from '@nestjs/common';
import { currentCorrelationId } from './correlation.context';

/**
 * Prisma primary/foreign keys are PostgreSQL UUIDs. Passing a non-UUID string
 * throws Prisma P2023 unless validated upfront.
 */
const UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value.trim());
}

export function assertUuid(
  value: unknown,
  code = 'RESOURCE_NOT_FOUND',
  message = 'The requested record could not be found.',
): asserts value is string {
  if (!isUuid(value)) {
    throw new NotFoundException({
      error: {
        code,
        message,
        correlationId: currentCorrelationId(),
      },
    });
  }
}
