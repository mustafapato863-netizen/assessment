import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@assessflow/database';
import { createHash } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { currentCorrelationId } from './correlation.context';

const TTL_MS = 24 * 60 * 60 * 1000;
const IN_PROGRESS_STATUS = 102;

function serializeSafe(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === null || value === undefined) return Prisma.JsonNull;
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)),
  ) as Prisma.InputJsonValue;
}

export function hashRequestPayload(command: string, payload?: unknown): string {
  return createHash('sha256')
    .update(command)
    .update(':')
    .update(JSON.stringify(payload ?? null))
    .digest('hex');
}

/**
 * PostgreSQL-backed atomic idempotency records.
 * Reserves the key before running the mutation so concurrent duplicate requests
 * wait or replay cleanly instead of executing twice.
 */
@Injectable()
export class PrismaIdempotencyService {
  private lastPruneAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  async execute<T>(
    key: string,
    actorId: string,
    command: string,
    operation: () => Promise<T> | T,
    payload?: unknown,
  ): Promise<T> {
    const now = new Date();
    const requestHash = hashRequestPayload(command, payload);

    if (now.getTime() - this.lastPruneAt > 60 * 60 * 1000) {
      this.lastPruneAt = now.getTime();
      void this.prisma.idempotencyKey
        .deleteMany({ where: { expiresAt: { lt: now } } })
        .catch(() => {});
    }

    const where = { key_actorId_command: { key, actorId, command } };

    // Remove expired lock/record first if any, then attempt atomic claim.
    await this.prisma.idempotencyKey
      .deleteMany({ where: { key, actorId, command, expiresAt: { lte: now } } })
      .catch(() => {});

    try {
      await this.prisma.idempotencyKey.create({
        data: {
          key,
          actorId,
          command,
          requestHash,
          responseStatus: IN_PROGRESS_STATUS,
          responseBody: Prisma.JsonNull,
          expiresAt: new Date(now.getTime() + TTL_MS),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.idempotencyKey.findUnique({ where });
        if (existing) {
          if (existing.requestHash !== requestHash) {
            throw new ConflictException({
              error: {
                code: 'IDEMPOTENCY_CONFLICT',
                message: 'This Idempotency-Key was already used with a different request payload.',
                correlationId: currentCorrelationId(),
              },
            });
          }
          if (existing.responseStatus === IN_PROGRESS_STATUS) {
            // Brief backoff once for in-flight sibling request before rejecting.
            await new Promise((resolve) => setTimeout(resolve, 150));
            const settled = await this.prisma.idempotencyKey.findUnique({ where });
            if (settled && settled.responseStatus !== IN_PROGRESS_STATUS) {
              return settled.responseBody as unknown as T;
            }
            throw new ConflictException({
              error: {
                code: 'REQUEST_IN_PROGRESS',
                message: 'A matching request with this Idempotency-Key is currently in progress.',
                correlationId: currentCorrelationId(),
              },
            });
          }
          return existing.responseBody as unknown as T;
        }
      }
      throw error;
    }

    try {
      const value = await operation();
      await this.prisma.idempotencyKey.update({
        where,
        data: {
          responseStatus: 200,
          responseBody: serializeSafe(value),
          expiresAt: new Date(Date.now() + TTL_MS),
        },
      });
      return value;
    } catch (error) {
      // Release lock if mutation failed so retry is possible.
      await this.prisma.idempotencyKey
        .deleteMany({ where: { key, actorId, command } })
        .catch(() => {});
      throw error;
    }
  }
}
