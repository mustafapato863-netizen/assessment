import { ConflictException, Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PrismaIdempotencyService, hashRequestPayload } from './prisma-idempotency.service';
import { currentCorrelationId } from './correlation.context';

type StoredResponse = { storedAt: number; requestHash: string; value: unknown };

@Injectable()
export class IdempotencyService {
  private readonly responses = new Map<string, StoredResponse>();
  private readonly ttlMs = 24 * 60 * 60 * 1000;
  private readonly persistent?: PrismaIdempotencyService;

  constructor(@Optional() prisma?: PrismaService) {
    if (prisma?.enabled) this.persistent = new PrismaIdempotencyService(prisma);
  }

  async execute<T>(
    key: string | undefined,
    actorId: string,
    command: string,
    operation: () => Promise<T> | T,
    payload?: unknown,
  ): Promise<T> {
    if (!key?.trim()) return operation();
    if (this.persistent) {
      return this.persistent.execute(key.trim(), actorId, command, operation, payload);
    }

    const requestHash = hashRequestPayload(command, payload);
    const cacheKey = `${actorId}:${command}:${key.trim()}`;
    const existing = this.responses.get(cacheKey);
    if (existing && Date.now() - existing.storedAt < this.ttlMs) {
      if (existing.requestHash !== requestHash) {
        throw new ConflictException({
          error: {
            code: 'IDEMPOTENCY_CONFLICT',
            message: 'This Idempotency-Key was already used with a different request payload.',
            correlationId: currentCorrelationId(),
          },
        });
      }
      return existing.value as T;
    }
    if (existing) this.responses.delete(cacheKey);

    const value = await operation();
    if (this.responses.size > 5000) {
      const now = Date.now();
      for (const [k, v] of this.responses.entries()) {
        if (now - v.storedAt >= this.ttlMs) this.responses.delete(k);
      }
    }
    this.responses.set(cacheKey, { storedAt: Date.now(), requestHash, value });
    return value;
  }
}
