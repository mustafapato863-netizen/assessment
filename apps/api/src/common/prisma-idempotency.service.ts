import { Injectable } from '@nestjs/common';
import { Prisma } from '@assessflow/database';
import { PrismaService } from '../database/prisma.service';

const TTL_MS = 24 * 60 * 60 * 1000;

/**
 * PostgreSQL-backed idempotency records. Survives restarts and works
 * across replicas, unlike the process-local fallback.
 */
@Injectable()
export class PrismaIdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async execute<T>(
    key: string,
    actorId: string,
    command: string,
    operation: () => Promise<T> | T,
  ): Promise<T> {
    const now = new Date();
    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { key_actorId_command: { key, actorId, command } },
    });
    if (existing && existing.expiresAt.getTime() > now.getTime()) {
      return existing.responseBody as unknown as T;
    }
    const value = await operation();
    const record = {
      key,
      actorId,
      command,
      requestHash: command,
      responseStatus: 200,
      responseBody:
        (JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      expiresAt: new Date(now.getTime() + TTL_MS),
    };
    try {
      await this.prisma.idempotencyKey.create({ data: record });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const raced = await this.prisma.idempotencyKey.findUnique({
          where: { key_actorId_command: { key, actorId, command } },
        });
        if (raced && raced.expiresAt.getTime() > now.getTime()) {
          return raced.responseBody as unknown as T;
        }
        await this.prisma.idempotencyKey.update({
          where: { key_actorId_command: { key, actorId, command } },
          data: record,
        });
        return value;
      }
      throw error;
    }
    return value;
  }
}
