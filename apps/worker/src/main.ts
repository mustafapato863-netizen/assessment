import 'reflect-metadata';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
if (typeof process.loadEnvFile === 'function') {
  for (const envPath of ['.env', '../.env', '../../.env']) {
    const fullPath = resolve(process.cwd(), envPath);
    if (existsSync(fullPath)) {
      try {
        process.loadEnvFile(fullPath);
        break;
      } catch {}
    }
  }
}
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '@assessflow/database';
import {
  AttachmentScanJobProcessor,
  InMemoryAttachmentScanRepository,
  PrismaAttachmentScanRepository,
  LocalAllowListStubScanner,
} from './scanner';
import {
  RetentionJobProcessor,
  InMemoryRetentionRepository,
  PrismaRetentionRepository,
} from './retention';

const intervalMs = Number(process.env.WORKER_HEARTBEAT_MS ?? 30_000);
export const queueNames = [
  'outbox',
  'reminders',
  'hris-sync',
  'exports',
  'attachment-scan',
] as const;
export type QueueName = (typeof queueNames)[number];

export interface QueueConfig {
  attempts: number;
  backoff: {
    type: 'exponential' | 'fixed';
    delay: number;
  };
  removeOnFail: boolean | number;
}

export const QUEUE_CONFIGS: Record<QueueName, QueueConfig> = {
  outbox: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnFail: false, // BullMQ dead-letter preservation
  },
  reminders: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnFail: false,
  },
  'hris-sync': {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnFail: false,
  },
  exports: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 5000 },
    removeOnFail: false,
  },
  'attachment-scan': {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnFail: false,
  },
};

const redisUrl = process.env.REDIS_URL;
const queues: Queue[] = [];
const workers: Worker[] = [];

const isDatabaseMode = process.env.DATA_MODE === 'database';
const prisma = isDatabaseMode ? new PrismaClient() : undefined;

// Scanner wiring
const scanRepository = prisma
  ? new PrismaAttachmentScanRepository(prisma)
  : new InMemoryAttachmentScanRepository();
const scanner = new LocalAllowListStubScanner();
export const scanProcessor = new AttachmentScanJobProcessor(scanRepository, scanner);

// Retention enforcement wiring (BIZ-008 hold-first)
const retentionRepository = prisma
  ? new PrismaRetentionRepository(prisma)
  : new InMemoryRetentionRepository();
export const retentionProcessor = new RetentionJobProcessor(retentionRepository);

console.info(
  JSON.stringify({
    service: 'assessflow-worker',
    status: 'started',
    intervalMs,
    mode: redisUrl ? 'redis' : 'stub',
    queues: queueNames,
    scanner: scanner.name,
    retention: 'hold-first-enforced',
  }),
);

if (redisUrl) {
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  for (const name of queueNames) {
    const config = QUEUE_CONFIGS[name];
    queues.push(
      new Queue(name, {
        connection,
        defaultJobOptions: {
          attempts: config.attempts,
          backoff: config.backoff,
          removeOnFail: config.removeOnFail,
        },
      }),
    );

    const worker = new Worker(
      name,
      async (job) => {
        console.info(
          JSON.stringify({
            service: 'assessflow-worker',
            event: 'job-started',
            queue: name,
            jobId: job.id,
            attemptNumber: (job.attemptsMade ?? 0) + 1,
          }),
        );

        if (name === 'attachment-scan') {
          const attachmentId = job.data?.attachmentId as string | undefined;
          if (attachmentId) {
            const scanResult = await scanProcessor.processAttachment(attachmentId);
            return { acknowledged: true, queue: name, jobId: job.id, scanResult };
          }
          const batchResult = await scanProcessor.processPendingBatch();
          return { acknowledged: true, queue: name, jobId: job.id, ...batchResult };
        }

        if (name === 'reminders') {
          const isRetention =
            job.name === 'retention-enforcement' ||
            job.data?.type === 'retention' ||
            job.data?.action === 'retention-review';
          if (isRetention) {
            const retentionResult = await retentionProcessor.processRetentionEnforcement();
            return { acknowledged: true, queue: name, jobId: job.id, retentionResult };
          }
        }

        // Job handlers become adapter-backed modules in the operations phase.
        return { acknowledged: true, queue: name, jobId: job.id };
      },
      { connection },
    );

    worker.on('failed', (job, err) => {
      const maxAttempts = config.attempts;
      const attemptsMade = job?.attemptsMade ?? 0;
      const isDeadLetter = attemptsMade >= maxAttempts;

      console.error(
        JSON.stringify({
          service: 'assessflow-worker',
          event: isDeadLetter ? 'job-dead-letter' : 'job-attempt-failed',
          queue: name,
          jobId: job?.id,
          attemptsMade,
          maxAttempts,
          isDeadLetter,
          errorMessage: err?.message,
        }),
      );
    });

    workers.push(worker);
  }
}

const heartbeat = async () => {
  try {
    const scanBatch = await scanProcessor.processPendingBatch();
    if (scanBatch.processed > 0) {
      console.info(
        JSON.stringify({
          service: 'assessflow-worker',
          event: 'attachment-scan-batch',
          processed: scanBatch.processed,
          clean: scanBatch.clean,
          rejected: scanBatch.rejected,
          failed: scanBatch.failed,
        }),
      );
    }
  } catch (err: unknown) {
    console.error('Error during periodic scan batch:', err);
  }

  try {
    const retentionBatch = await retentionProcessor.processRetentionEnforcement();
    if (retentionBatch.totalFlaggedForReview > 0) {
      console.info(
        JSON.stringify({
          service: 'assessflow-worker',
          event: 'retention-periodic-batch',
          categoriesEvaluated: retentionBatch.processedCategories,
          totalChecked: retentionBatch.totalRowsChecked,
          flaggedForReview: retentionBatch.totalFlaggedForReview,
          hardDeletes: 0,
          holdFirstEnforced: true,
        }),
      );
    }
  } catch (err: unknown) {
    console.error('Error during periodic retention enforcement:', err);
  }

  console.info(
    JSON.stringify({
      service: 'assessflow-worker',
      event: 'heartbeat',
      timestamp: new Date().toISOString(),
      jobs: queueNames,
    }),
  );
};

const timer = setInterval(() => void heartbeat(), intervalMs);
const shutdown = async () => {
  clearInterval(timer);
  await Promise.all(workers.map((worker) => worker.close()));
  await Promise.all(queues.map((queue) => queue.close()));
  if (prisma) await prisma.$disconnect();
};
process.once('SIGTERM', () => void shutdown());
process.once('SIGINT', () => void shutdown());

