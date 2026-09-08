import { MAX_ATTACHMENT_SIZE_BYTES, isAllowedAttachmentType } from '@assessflow/contracts';
import type { AttachmentScanInput, AttachmentScanner, ScanResult } from './scanner.interface';

export class LocalAllowListStubScanner implements AttachmentScanner {
  readonly name = 'local-allow-list-stub';

  private static readonly MALWARE_PATTERNS = [
    'eicar',
    'virus',
    'malware',
    'trojan',
    'ransomware',
    'infected',
  ];

  private static readonly CORRUPT_PATTERNS = ['corrupt', 'scan-fail', 'read-error', 'crash'];

  async scan(attachment: AttachmentScanInput): Promise<ScanResult> {
    const scannedAt = new Date();
    const lowerName = attachment.fileName.toLowerCase();
    const lowerKey = attachment.storageKey.toLowerCase();
    const size =
      typeof attachment.sizeBytes === 'bigint'
        ? Number(attachment.sizeBytes)
        : attachment.sizeBytes;

    // 1. Check for simulated corruption / unrecoverable scanner engine failures
    if (
      LocalAllowListStubScanner.CORRUPT_PATTERNS.some(
        (p) => lowerName.includes(p) || lowerKey.includes(p),
      )
    ) {
      return {
        outcome: 'FAILED',
        reason: 'Scanner internal I/O failure while analyzing file stream',
        scannedAt,
        scannerName: this.name,
      };
    }

    // 2. Check for simulated malware signatures (e.g. EICAR test string)
    if (
      LocalAllowListStubScanner.MALWARE_PATTERNS.some(
        (p) => lowerName.includes(p) || lowerKey.includes(p),
      )
    ) {
      return {
        outcome: 'REJECTED',
        reason: 'Malware signature detected in upload payload: EICAR-Test-Signature',
        scannedAt,
        scannerName: this.name,
      };
    }

    // 3. File type allow-list verification (PDF, DOC, DOCX, JPG, PNG)
    if (!isAllowedAttachmentType(attachment.fileName, attachment.contentType)) {
      return {
        outcome: 'REJECTED',
        reason: `Disallowed file type or extension: contentType='${attachment.contentType}', fileName='${attachment.fileName}'. Permitted types: PDF, DOC, DOCX, JPG, PNG.`,
        scannedAt,
        scannerName: this.name,
      };
    }

    // 4. File size limit enforcement (10MB max)
    if (size <= 0 || size > MAX_ATTACHMENT_SIZE_BYTES) {
      return {
        outcome: 'REJECTED',
        reason: `File size ${size} bytes exceeds maximum allowed limit of 10MB (${MAX_ATTACHMENT_SIZE_BYTES} bytes).`,
        scannedAt,
        scannerName: this.name,
      };
    }

    // 5. Clean result
    return {
      outcome: 'CLEAN',
      reason: null,
      scannedAt,
      scannerName: this.name,
    };
  }
}
