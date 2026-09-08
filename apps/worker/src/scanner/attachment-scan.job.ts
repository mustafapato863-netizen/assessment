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
 * Picks PENDING rows, marks SCANNING, runs pluggable scanner, marks outcome with scannedAt.
 */
export class AttachmentScanJobProcessor {
  constructor(
    private readonly repository: AttachmentScanRepository,
    private readonly scanner: AttachmentScanner = new LocalAllowListStubScanner(),
  ) {}

  async processAttachment(attachmentId: string): Promise<ScanResult | null> {
    const item = await this.repository.findById(attachmentId);
    if (!item) return null;

    // Only scan if in PENDING state
    if (item.scanStatus !== 'PENDING') {
      return null;
    }

    // Step 1: Mark SCANNING
    await this.repository.markScanning(item.id);

    try {
      // Step 2: Run pluggable scanner
      const result = await this.scanner.scan(item);

      // Step 3: Mark CLEAN or REJECTED+reason with scannedAt (or FAILED)
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
      const failedResult: ScanResult = {
        outcome: 'FAILED',
        reason: message,
        scannedAt,
        scannerName: this.scanner.name,
      };

      await this.repository.markScanResult(item.id, 'FAILED', message, scannedAt);
      return failedResult;
    }
  }

  async processPendingBatch(limit = 50): Promise<ProcessBatchResult> {
    const pending = await this.repository.findPending(limit);
    const results: Array<{ id: string; result: ScanResult }> = [];
    let clean = 0;
    let rejected = 0;
    let failed = 0;

    for (const item of pending) {
      const result = await this.processAttachment(item.id);
      if (result) {
        results.push({ id: item.id, result });
        if (result.outcome === 'CLEAN') clean++;
        else if (result.outcome === 'REJECTED') rejected++;
        else if (result.outcome === 'FAILED') failed++;
      }
    }

    return {
      processed: pending.length,
      clean,
      rejected,
      failed,
      results,
    };
  }
}
