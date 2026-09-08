# AssessFlow Operational Runbook: BullMQ Queue, Retry & Dead-Letter Handling

**Version:** 1.0.0  
**Scope:** Production & Staging Worker Operations  
**Governing Standard:** Gate 7 §7, Gate 8 §5, BIZ-008, BIZ-014  
**Target Codebase Wiring:** `apps/worker/src/main.ts`, `apps/worker/src/scanner`, `apps/worker/src/retention`

---

## 1. Architectural Topology & Queue Overview

AssessFlow leverages **BullMQ** on Redis 7+ for asynchronous task scheduling, event outbox publishing, HRIS data synchronization, asynchronous exports, attachment anti-malware scanning, and retention policy enforcement.

```
                                  +-----------------------+
                                  |   AssessFlow API      |
                                  +-----------+-----------+
                                              |
                   +--------------------------+--------------------------+
                   |                          |                          |
                   v                          v                          v
             [outbox queue]          [attachment-scan]            [exports queue]
                   |                          |                          |
                   +--------------------------+--------------------------+
                                              |
                                              v
                               +-----------------------------+
                               |   AssessFlow Worker Process |
                               |   (apps/worker/src/main.ts) |
                               +--------------+--------------+
                                              |
             +--------------------------------+-------------------------------+
             |                                |                               |
             v                                v                               v
     [Worker Processing]            [Scheduled Heartbeat]             [DLQ / Failure]
     • outbox: 5 retries            • Attachment scan batch           • Job retained in failed set
     • reminders: 3 retries         • Retention policy check          • Structured error logged
     • hris-sync: 3 retries         • Health verification             • Alert triggered to Ops
     • exports: 2 retries
     • attachment-scan: 3 retries
```

---

## 2. Queue Configuration & Retry Matrix

All queue retry settings and dead-letter boundaries are explicitly defined in `QUEUE_CONFIGS` (`apps/worker/src/main.ts`):

| Queue Name | Purpose | Max Attempts | Backoff Strategy | Initial Delay | DLQ Preservation (`removeOnFail`) | Trigger Source |
|---|---|---|---|---|---|---|
| **`outbox`** | Asynchronous delivery of notification events (emails, in-app notices) generated from state machine transitions. | **5** | Exponential | 2,000 ms | `false` (Preserved for review) | Database Outbox poller / API events |
| **`reminders`** | SLA expiration alerts, overdue notifications, and periodic BIZ-008 retention enforcement jobs. | **3** | Exponential | 5,000 ms | `false` (Preserved for review) | Cron / Schedule timer / API |
| **`hris-sync`** | Delta sync and nightly reconciliation with enterprise HRIS provider (workforce master data). | **3** | Exponential | 10,000 ms | `false` (Preserved for review) | Scheduled cron / Manual trigger |
| **`exports`** | Compilation of large assessment dossiers, audit logs, and PDF/Excel bundles. | **2** | Fixed | 5,000 ms | `false` (Preserved for review) | User export requests |
| **`attachment-scan`** | Pluggable anti-malware and file policy verification before promoting blobs from quarantine to clean. | **3** | Exponential | 3,000 ms | `false` (Preserved for review) | Upload gate / Periodic batch |

---

## 3. Dead-Letter Queue (DLQ) Architecture & Semantics

### 3.1 Preservation Policy (`removeOnFail: false`)
BullMQ does not delete failed jobs when `removeOnFail: false` is configured. When a job exhausts all permitted attempts:
1. The job transitions to the **`failed`** state in Redis under the key namespace:  
   `bull:<queue_name>:failed`
2. The complete job payload, execution history, stack trace, and timestamp are preserved in Redis.
3. The worker fires the `worker.on('failed')` event and emits a structured telemetry log entry:
   ```json
   {
     "service": "assessflow-worker",
     "event": "job-dead-letter",
     "queue": "outbox",
     "jobId": "job-10492",
     "attemptsMade": 5,
     "maxAttempts": 5,
     "isDeadLetter": true,
     "errorMessage": "SMTP 535: Authentication credentials rejected"
   }
   ```

### 3.2 Dead-Letter Detection & Alerting Thresholds
- **Severity P1 Alert:** Any job entering `isDeadLetter: true` on `outbox` or `attachment-scan`.
- **Severity P2 Alert:** Any job entering `isDeadLetter: true` on `hris-sync` or `exports`.
- **Warning Threshold:** Queue length > 100 pending jobs for > 5 minutes.

---

## 4. Operational Procedures & Runbook Walkthrough

### 4.1 Inspecting Failed / Dead-Letter Jobs

To inspect failed jobs in the local Docker environment or Azure Container App:

#### Option A: Using Redis CLI directly
```bash
# Connect to Redis
docker exec -it assessmentworkflowapp-redis-1 redis-cli

# 1. Check count of dead-letter jobs in each queue
ZCARD bull:outbox:failed
ZCARD bull:reminders:failed
ZCARD bull:hris-sync:failed
ZCARD bull:exports:failed
ZCARD bull:attachment-scan:failed

# 2. View failed job IDs for outbox
ZRANGE bull:outbox:failed 0 -1

# 3. Inspect details and failed reason of specific job (e.g. job ID "12")
HGETALL bull:outbox:12
```

#### Option B: Programmatic BullMQ Inspection Script
```typescript
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL!);
const outboxQueue = new Queue('outbox', { connection });

async function inspectDeadLetters() {
  const failedJobs = await outboxQueue.getFailed(0, 50);
  for (const job of failedJobs) {
    console.log(`Job ID: ${job.id}`);
    console.log(`Attempts Made: ${job.attemptsMade}`);
    console.log(`Failed Reason: ${job.failedReason}`);
    console.log(`Data:`, job.data);
    console.log(`Stacktrace:`, job.stacktrace);
  }
}
```

---

### 4.2 Replaying Dead-Letter Jobs (Post-Incident Resolution)

Once the upstream root cause (e.g., SMTP outage, network glitch, database lock) is resolved, operators can re-queue failed jobs:

#### Option A: Replay All Failed Jobs in a Queue
```typescript
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL!);
const targetQueue = new Queue('outbox', { connection });

async function retryAllFailed() {
  const failedJobs = await targetQueue.getFailed(0, 100);
  console.log(`Found ${failedJobs.length} dead-letter jobs to retry.`);
  for (const job of failedJobs) {
    await job.retry();
    console.log(`Retried job ${job.id}`);
  }
}
```

#### Option B: Replay via Redis CLI (BullMQ Lua Script)
```bash
# BullMQ provides built-in retry-job patterns.
# Operators can also use bull-board UI or invoke job.retry() via worker CLI.
```

---

### 4.3 Discarding / Purging Poison-Pill Jobs

If a dead-letter job is irrecoverably corrupt (e.g. invalid recipient email format that will never succeed):

```typescript
async function discardPoisonJob(queueName: string, jobId: string, auditReason: string) {
  const queue = new Queue(queueName, { connection });
  const job = await queue.getJob(jobId);
  if (job) {
    console.warn(`Discarding job ${jobId} from ${queueName}: ${auditReason}`);
    await job.remove();
  }
}
```

---

## 5. Queue-by-Queue Incident Playbooks

### 5.1 Queue: `outbox`
- **Symptoms:** Failed notifications, users report missing emails, alert `event: job-dead-letter` on `outbox`.
- **Common Root Causes:**
  1. Azure Communication Services (ACS) or SMTP endpoint rate limit (HTTP 429).
  2. Expired API secret or connection string for email provider.
  3. Malformed recipient address in notification payload.
- **Remediation Procedure:**
  1. Inspect `failedReason` using Section 4.1.
  2. If credentials/network: resolve ACS/SMTP issue, verify egress connectivity.
  3. Execute Section 4.2 to retry all failed notification jobs.
  4. Verify in `NotificationDelivery` table that `sentAt` is recorded.

---

### 5.2 Queue: `reminders` & Retention Enforcement
- **Symptoms:** Pending review tasks not generated; reminder emails delayed.
- **Common Root Causes:**
  1. Database transaction lock on `Task` or `AuditEvent` tables.
  2. Retention policy misconfiguration (e.g., non-numeric `retentionDays`).
- **Remediation Procedure:**
  1. Inspect worker logs for `event: retention-enforcement-batch` or `event: job-dead-letter`.
  2. Confirm `RetentionPolicy` table entries:
     ```sql
     SELECT category, "retentionDays", "legalHoldEnabled", active FROM "RetentionPolicy";
     ```
  3. Recall that **legalHoldEnabled=true supersedes all retention policies** (hold-first rule).
  4. Once DB locks clear, re-run retention enforcement either by replaying the job or waiting for next worker heartbeat.

---

### 5.3 Queue: `hris-sync`
- **Symptoms:** Employee directory out of sync, transfer/leavers not reflected in case assignment.
- **Common Root Causes:**
  1. HRIS upstream API unreachable (timeout / 503).
  2. Unrecognized schema change in HRIS payload (validation error).
- **Remediation Procedure:**
  1. Query `HrSyncBatch` table for error details:
     ```sql
     SELECT id, status, "recordsRead", "recordsApplied", "recordsFailed", "errorSummary"
     FROM "HrSyncBatch" ORDER BY "startedAt" DESC LIMIT 5;
     ```
  2. If upstream timeout: re-run delta sync once HRIS service recovers.
  3. If schema mismatch: escalate to Identity/HRIS Owner (`admin`) to update HRIS mapping.

---

### 5.4 Queue: `exports`
- **Symptoms:** User clicks "Export Case Dossier", spinner runs, report never downloads.
- **Common Root Causes:**
  1. Excessive data size causing memory pressure or timeout (> 60 seconds).
  2. Storage Account SAS URL generation failure or container permission denial.
- **Remediation Procedure:**
  1. Check worker logs for `queue: exports` failure traces.
  2. If memory exhausted: split export date range or increase Container App memory allocation.
  3. If storage error: verify Azure Blob Storage container write permissions and SAS policy.

---

### 5.5 Queue: `attachment-scan`
- **Symptoms:** Attachments stuck in `scanStatus: PENDING` or `SCANNING`; download blocked by API gate (`422 SCAN_NOT_CLEAN`).
- **Common Root Causes:**
  1. Pluggable scanner (e.g. Defender for Storage or ClamAV) daemon unavailable.
  2. Blob storage inaccessible for temporary byte inspection.
- **Remediation Procedure:**
  1. Check scanner heartbeat in worker logs (`scanner: local-allowlist-stub` in dev; `defender` in prod).
  2. If attachment was infected (e.g. EICAR test string):
     - The job successfully marks `scanStatus: REJECTED` with `scanReason: "Malware test signature identified"`.
     - This is **expected security behavior**, not a queue failure. Do NOT retry infected attachments.
  3. If transient scanner outage: retry failed jobs via Section 4.2.

---

## 6. Worker Lifecycle & Graceful Shutdown

The worker handles graceful shutdown via `SIGTERM` and `SIGINT`:
1. Clears periodic heartbeat timer (`clearInterval(timer)`).
2. Closes all active BullMQ `Worker` instances (`Promise.all(workers.map(w => w.close()))`), allowing in-flight jobs up to 30 seconds to conclude before disconnecting.
3. Closes all BullMQ `Queue` instances.
4. Disconnects Prisma client (`prisma.$disconnect()`).

This guarantees zero database connection leaks and prevents jobs from being marked as stalled or abandoned during deployment rollouts.
