import type { PrismaClient } from '@assessflow/database';
import type {
  AttachmentScanInput,
  AttachmentScanner,
  ScanOutcome,
  ScanResult,
} from './scanner.interface';
import { LocalAllowListStubScanner } from './local-allowlist-scanner';

export interface AttachmentScanRepository {
  findPending(limit?: number): Promise<AttachmentScanInput[]>;
  findById(id: string): Promise<AttachmentScanInput | null>;
  claimPending?(id: string): Promise<boolean>;
  recoverStaleScanning?(staleBefore: Date): Promise<number>;
  markScanning(id: string): Promise<void>;
  markScanResult(
    id: string,
    status: ScanOutcome,
    reason?: string | null,
    scannedAt?: Date,
  ): Promise<void>;
}

/**
 * In-memory repository adapter for worker testing and memory mode.
 */
export class InMemoryAttachmentScanRepository implements AttachmentScanRepository {
  private readonly items = new Map<string, AttachmentScanInput>();

  constructor(initialItems: AttachmentScanInput[] = []) {
    for (const item of initialItems) {
      this.items.set(item.id, { ...item, scanStatus: item.scanStatus ?? 'PENDING' });
    }
  }

  add(item: AttachmentScanInput) {
    this.items.set(item.id, { ...item, scanStatus: item.scanStatus ?? 'PENDING' });
  }

  async findPending(limit = 50): Promise<AttachmentScanInput[]> {
    return [...this.items.values()].filter((i) => i.scanStatus === 'PENDING').slice(0, limit);
  }

  async findById(id: string): Promise<AttachmentScanInput | null> {
    return this.items.get(id) ?? null;
  }

  async claimPending(id: string): Promise<boolean> {
    const item = this.items.get(id);
    if (!item || item.scanStatus !== 'PENDING') return false;
    item.scanStatus = 'SCANNING';
    return true;
  }

  async markScanning(id: string): Promise<void> {
    const item = this.items.get(id);
    if (item) {
      item.scanStatus = 'SCANNING';
    }
  }

  async markScanResult(
    id: string,
    status: ScanOutcome,
    reason?: string | null,
    _scannedAt?: Date,
  ): Promise<void> {
    const item = this.items.get(id);
    if (item) {
      item.scanStatus = status;
      (item as { scanReason?: string | null }).scanReason = reason ?? null;
    }
  }
}

/**
 * Prisma database repository adapter for PostgreSQL Flexible Server mode.
 */
export class PrismaAttachmentScanRepository implements AttachmentScanRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findPending(limit = 50): Promise<AttachmentScanInput[]> {
    const rows = await this.prisma.attachment.findMany({
      where: { scanStatus: 'PENDING' },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      caseId: r.caseId,
      evidenceId: r.evidenceId,
      classification: r.classification,
      fileName: r.fileName,
      contentType: r.contentType,
      sizeBytes: Number(r.sizeBytes),
      storageKey: r.storageKey,
      scanStatus: r.scanStatus,
    }));
  }

  async findById(id: string): Promise<AttachmentScanInput | null> {
    const r = await this.prisma.attachment.findUnique({ where: { id } });
    if (!r) return null;
    return {
      id: r.id,
      caseId: r.caseId,
      evidenceId: r.evidenceId,
      classification: r.classification,
      fileName: r.fileName,
      contentType: r.contentType,
      sizeBytes: Number(r.sizeBytes),
      storageKey: r.storageKey,
      scanStatus: r.scanStatus,
    };
  }

  async claimPending(id: string): Promise<boolean> {
    const claimed = await this.prisma.attachment.updateMany({
      where: { id, scanStatus: 'PENDING' },
      data: { scanStatus: 'SCANNING' },
    });
    return claimed.count === 1;
  }

  async recoverStaleScanning(staleBefore: Date): Promise<number> {
    const recovered = await this.prisma.attachment.updateMany({
      where: {
        scanStatus: 'SCANNING',
        createdAt: { lt: staleBefore },
      },
      data: { scanStatus: 'PENDING' },
    });
    return recovered.count;
  }

  async markScanning(id: string): Promise<void> {
    await this.prisma.attachment.update({
      where: { id },
      data: { scanStatus: 'SCANNING' },
    });
  }

  async markScanResult(
    id: string,
    status: ScanOutcome,
    reason?: string | null,
    scannedAt: Date = new Date(),
  ): Promise<void> {
    await this.prisma.attachment.update({
      where: { id },
      data: {
        scanStatus: status,
        scanReason: reason ?? null,
        scannedAt,
      },
    });
  }
}

export interface ProcessBatchResult {
  processed: number;
  clean: number;
  rejected: number;
  failed: number;
  results: Array<{ id: string; result: ScanResult }>;
}

/**
 * Worker job handler for 'attachment-scan'.
 * Uses atomic PENDING -> SCANNING claiming and stale SCANNING recovery.
 */
export class AttachmentScanJobProcessor {
  constructor(
    private readonly repository: AttachmentScanRepository,
    private readonly scanner: AttachmentScanner = new LocalAllowListStubScanner(),
  ) {}

  private async scanClaimedItem(
    item: AttachmentScanInput,
    options?: { rethrowOnError?: boolean },
  ): Promise<ScanResult | null> {
    if (this.repository.claimPending) {
      const claimed = await this.repository.claimPending(item.id);
      if (!claimed) return null;
    } else {
      await this.repository.markScanning(item.id);
    }

    try {
      const result = await this.scanner.scan(item);
      await this.repository.markScanResult(
        item.id,
        result.outcome,
        result.reason,
        result.scannedAt,
      );
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unexpected scanner exception';
      const scannedAt = new Date();
      await this.repository.markScanResult(item.id, 'FAILED', message, scannedAt);
      if (options?.rethrowOnError) {
        throw err;
      }
      return {
        outcome: 'FAILED',
        reason: message,
        scannedAt,
        scannerName: this.scanner.name,
      };
    }
  }

  async processAttachment(
    attachmentId: string,
    options?: { rethrowOnError?: boolean },
  ): Promise<ScanResult | null> {
    const item = await this.repository.findById(attachmentId);
    if (!item || item.scanStatus !== 'PENDING') {
      return null;
    }
    return this.scanClaimedItem(item, options);
  }

  async processPendingBatch(limit = 50): Promise<ProcessBatchResult> {
    if (this.repository.recoverStaleScanning) {
      const staleBefore = new Date(Date.now() - 5 * 60_000);
      await this.repository.recoverStaleScanning(staleBefore);
    }

    const pending = await this.repository.findPending(limit);
    const results: Array<{ id: string; result: ScanResult }> = [];
    let clean = 0;
    let rejected = 0;
    let failed = 0;

    for (const item of pending) {
      const result = await this.scanClaimedItem(item, { rethrowOnError: false });
      if (result) {
        results.push({ id: item.id, result });
        if (result.outcome === 'CLEAN') clean++;
        else if (result.outcome === 'REJECTED') rejected++;
        else if (result.outcome === 'FAILED') failed++;
      }
    }

    return {
      processed: results.length,
      clean,
      rejected,
      failed,
      results,
    };
  }
}
