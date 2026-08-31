import { Injectable } from '@nestjs/common';

type StoredResponse = { storedAt: number; value: unknown };

@Injectable()
export class IdempotencyService {
  private readonly responses = new Map<string, StoredResponse>();
  private readonly ttlMs = 24 * 60 * 60 * 1000;

  execute<T>(key: string | undefined, actorId: string, command: string, operation: () => T): T {
    if (!key?.trim()) return operation();

    const cacheKey = `${actorId}:${command}:${key.trim()}`;
    const existing = this.responses.get(cacheKey);
    if (existing && Date.now() - existing.storedAt < this.ttlMs) return existing.value as T;
    if (existing) this.responses.delete(cacheKey);

    const value = operation();
    this.responses.set(cacheKey, { storedAt: Date.now(), value });
    return value;
  }
}
