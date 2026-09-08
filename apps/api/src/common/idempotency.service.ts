import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PrismaIdempotencyService } from './prisma-idempotency.service';

type StoredResponse = { storedAt: number; value: unknown };

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
  ): Promise<T> {
    if (!key?.trim()) return operation();
    if (this.persistent) return this.persistent.execute(key.trim(), actorId, command, operation);

    const cacheKey = `${actorId}:${command}:${key.trim()}`;
    const existing = this.responses.get(cacheKey);
    if (existing && Date.now() - existing.storedAt < this.ttlMs) return existing.value as T;
    if (existing) this.responses.delete(cacheKey);

    const value = await operation();
    this.responses.set(cacheKey, { storedAt: Date.now(), value });
    return value;
  }
}
