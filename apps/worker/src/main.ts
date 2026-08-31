import 'reflect-metadata';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

const intervalMs = Number(process.env.WORKER_HEARTBEAT_MS ?? 30_000);
const queueNames = ['outbox', 'reminders', 'hris-sync', 'exports'] as const;
const redisUrl = process.env.REDIS_URL;
const queues: Queue[] = [];
const workers: Worker[] = [];

console.info(
  JSON.stringify({
    service: 'assessflow-worker',
    status: 'started',
    intervalMs,
    mode: redisUrl ? 'redis' : 'stub',
    queues: queueNames,
  }),
);

if (redisUrl) {
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  for (const name of queueNames) {
    queues.push(new Queue(name, { connection }));
    workers.push(
      new Worker(
        name,
        async (job) => {
          console.info(
            JSON.stringify({
              service: 'assessflow-worker',
              event: 'job-started',
              queue: name,
              jobId: job.id,
            }),
          );
          // Job handlers become adapter-backed modules in the operations phase.
          return { acknowledged: true, queue: name, jobId: job.id };
        },
        { connection },
      ),
    );
  }
}

const heartbeat = () => {
  console.info(
    JSON.stringify({
      service: 'assessflow-worker',
      event: 'heartbeat',
      timestamp: new Date().toISOString(),
      jobs: queueNames,
    }),
  );
};

const timer = setInterval(heartbeat, intervalMs);
const shutdown = async () => {
  clearInterval(timer);
  await Promise.all(workers.map((worker) => worker.close()));
  await Promise.all(queues.map((queue) => queue.close()));
};
process.once('SIGTERM', () => void shutdown());
process.once('SIGINT', () => void shutdown());
