import type { AttachmentScanStatus } from '@assessflow/contracts';

export interface AttachmentScanInput {
  id: string;
  caseId: string;
  evidenceId?: string | null;
  classification: string;
  fileName: string;
  contentType: string;
  sizeBytes: number | bigint;
  storageKey: string;
  scanStatus?: AttachmentScanStatus;
}

export type ScanOutcome = 'CLEAN' | 'REJECTED' | 'FAILED';

export interface ScanResult {
  outcome: ScanOutcome;
  reason?: string | null;
  scannedAt: Date;
  scannerName: string;
  metadata?: Record<string, unknown>;
}

/**
 * Pluggable scanner interface.
 * Production implementations can plug into Azure Defender for Storage, ClamAV, or ICAP engines.
 */
export interface AttachmentScanner {
  readonly name: string;
  scan(attachment: AttachmentScanInput): Promise<ScanResult>;
}
