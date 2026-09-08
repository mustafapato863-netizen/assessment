import { describe, expect, it } from 'vitest';
import { LocalAllowListStubScanner } from './local-allowlist-scanner';
import {
  AttachmentScanJobProcessor,
  InMemoryAttachmentScanRepository,
} from './attachment-scan.job';
import type { AttachmentScanInput } from './scanner.interface';

describe('Attachment Scanner & Worker Job', () => {
  describe('LocalAllowListStubScanner', () => {
    const scanner = new LocalAllowListStubScanner();

    it('identifies clean files matching the allow-list (PDF, DOC, DOCX, JPG, PNG)', async () => {
      const cleanFiles: AttachmentScanInput[] = [
        {
          id: '1',
          caseId: 'case-1',
          fileName: 'annual-review.pdf',
          contentType: 'application/pdf',
          sizeBytes: 1024 * 100,
          storageKey: 'quarantine/case-1/1-annual-review.pdf',
          classification: 'EVIDENCE',
        },
        {
          id: '2',
          caseId: 'case-1',
          fileName: 'project-notes.doc',
          contentType: 'application/msword',
          sizeBytes: 1024 * 200,
          storageKey: 'quarantine/case-1/2-project-notes.doc',
          classification: 'ASSESSMENT_NOTES',
        },
        {
          id: '3',
          caseId: 'case-1',
          fileName: 'deliverables.docx',
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          sizeBytes: 1024 * 300,
          storageKey: 'quarantine/case-1/3-deliverables.docx',
          classification: 'PORTFOLIO',
        },
        {
          id: '4',
          caseId: 'case-1',
          fileName: 'avatar.jpg',
          contentType: 'image/jpeg',
          sizeBytes: 1024 * 50,
          storageKey: 'quarantine/case-1/4-avatar.jpg',
          classification: 'IDENTITY',
        },
        {
          id: '5',
          caseId: 'case-1',
          fileName: 'system-diagram.png',
          contentType: 'image/png',
          sizeBytes: 1024 * 500,
          storageKey: 'quarantine/case-1/5-system-diagram.png',
          classification: 'EVIDENCE',
        },
      ];

      for (const file of cleanFiles) {
        const result = await scanner.scan(file);
        expect(result.outcome).toBe('CLEAN');
        expect(result.reason).toBeNull();
        expect(result.scannedAt).toBeInstanceOf(Date);
        expect(result.scannerName).toBe('local-allow-list-stub');
      }
    });

    it('flags malware and suspicious signatures as REJECTED', async () => {
      const infectedFiles: AttachmentScanInput[] = [
        {
          id: 'inf-1',
          caseId: 'case-1',
          fileName: 'eicar-standard-antivirus-testfile.pdf',
          contentType: 'application/pdf',
          sizeBytes: 68,
          storageKey: 'quarantine/case-1/eicar.pdf',
          classification: 'EVIDENCE',
        },
        {
          id: 'inf-2',
          caseId: 'case-1',
          fileName: 'trojan-payload.doc',
          contentType: 'application/msword',
          sizeBytes: 1024,
          storageKey: 'quarantine/case-1/trojan.doc',
          classification: 'EVIDENCE',
        },
        {
          id: 'inf-3',
          caseId: 'case-1',
          fileName: 'ransomware_notice.docx',
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          sizeBytes: 2048,
          storageKey: 'quarantine/case-1/ransom.docx',
          classification: 'EVIDENCE',
        },
      ];

      for (const file of infectedFiles) {
        const result = await scanner.scan(file);
        expect(result.outcome).toBe('REJECTED');
        expect(result.reason).toContain('Malware signature detected');
        expect(result.scannedAt).toBeInstanceOf(Date);
      }
    });

    it('rejects disallowed file types that bypassed upload filter', async () => {
      const disallowed: AttachmentScanInput = {
        id: 'disallowed-1',
        caseId: 'case-1',
        fileName: 'binary.exe',
        contentType: 'application/x-msdownload',
        sizeBytes: 2048,
        storageKey: 'quarantine/case-1/binary.exe',
        classification: 'EVIDENCE',
      };

      const result = await scanner.scan(disallowed);
      expect(result.outcome).toBe('REJECTED');
      expect(result.reason).toContain('Disallowed file type or extension');
    });

    it('rejects files exceeding the 10MB limit', async () => {
      const oversized: AttachmentScanInput = {
        id: 'oversized-1',
        caseId: 'case-1',
        fileName: 'huge.pdf',
        contentType: 'application/pdf',
        sizeBytes: 10 * 1024 * 1024 + 500,
        storageKey: 'quarantine/case-1/huge.pdf',
        classification: 'EVIDENCE',
      };

      const result = await scanner.scan(oversized);
      expect(result.outcome).toBe('REJECTED');
      expect(result.reason).toContain('exceeds maximum allowed limit of 10MB');
    });

    it('marks corrupted files as FAILED with scannedAt', async () => {
      const corrupt: AttachmentScanInput = {
        id: 'corrupt-1',
        caseId: 'case-1',
        fileName: 'corrupt-stream.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
        storageKey: 'quarantine/case-1/corrupt.pdf',
        classification: 'EVIDENCE',
      };

      const result = await scanner.scan(corrupt);
      expect(result.outcome).toBe('FAILED');
      expect(result.reason).toContain('Scanner internal I/O failure');
      expect(result.scannedAt).toBeInstanceOf(Date);
    });
  });

  describe('AttachmentScanJobProcessor', () => {
    it('picks PENDING row, marks SCANNING, runs scanner, marks CLEAN with scannedAt', async () => {
      const repo = new InMemoryAttachmentScanRepository();
      const scanner = new LocalAllowListStubScanner();
      const processor = new AttachmentScanJobProcessor(repo, scanner);

      repo.add({
        id: 'att-pending-1',
        caseId: 'case-100',
        fileName: 'evaluation.pdf',
        contentType: 'application/pdf',
        sizeBytes: 4096,
        storageKey: 'quarantine/case-100/att-pending-1.pdf',
        classification: 'EVIDENCE',
        scanStatus: 'PENDING',
      });

      const scanResult = await processor.processAttachment('att-pending-1');
      expect(scanResult).not.toBeNull();
      expect(scanResult?.outcome).toBe('CLEAN');

      const saved = await repo.findById('att-pending-1');
      expect(saved?.scanStatus).toBe('CLEAN');
    });

    it('picks PENDING row with malware signature and marks REJECTED+reason with scannedAt', async () => {
      const repo = new InMemoryAttachmentScanRepository();
      const scanner = new LocalAllowListStubScanner();
      const processor = new AttachmentScanJobProcessor(repo, scanner);

      repo.add({
        id: 'att-infected-1',
        caseId: 'case-100',
        fileName: 'eicar-test.pdf',
        contentType: 'application/pdf',
        sizeBytes: 2048,
        storageKey: 'quarantine/case-100/eicar.pdf',
        classification: 'EVIDENCE',
        scanStatus: 'PENDING',
      });

      const scanResult = await processor.processAttachment('att-infected-1');
      expect(scanResult?.outcome).toBe('REJECTED');
      expect(scanResult?.reason).toContain('Malware signature detected');

      const saved = await repo.findById('att-infected-1');
      expect(saved?.scanStatus).toBe('REJECTED');
    });

    it('ignores non-PENDING rows', async () => {
      const repo = new InMemoryAttachmentScanRepository();
      const scanner = new LocalAllowListStubScanner();
      const processor = new AttachmentScanJobProcessor(repo, scanner);

      repo.add({
        id: 'att-already-clean',
        caseId: 'case-100',
        fileName: 'doc.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
        storageKey: 'clean/doc.pdf',
        classification: 'EVIDENCE',
        scanStatus: 'CLEAN',
      });

      const result = await processor.processAttachment('att-already-clean');
      expect(result).toBeNull();
    });

    it('processes batch of pending attachments across CLEAN, REJECTED, and FAILED outcomes', async () => {
      const repo = new InMemoryAttachmentScanRepository();
      const scanner = new LocalAllowListStubScanner();
      const processor = new AttachmentScanJobProcessor(repo, scanner);

      repo.add({
        id: 'batch-clean-1',
        caseId: 'c1',
        fileName: 'file1.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
        storageKey: 'k1',
        classification: 'EVIDENCE',
        scanStatus: 'PENDING',
      });
      repo.add({
        id: 'batch-clean-2',
        caseId: 'c1',
        fileName: 'file2.png',
        contentType: 'image/png',
        sizeBytes: 2048,
        storageKey: 'k2',
        classification: 'EVIDENCE',
        scanStatus: 'PENDING',
      });
      repo.add({
        id: 'batch-malware',
        caseId: 'c1',
        fileName: 'virus-sample.docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        sizeBytes: 512,
        storageKey: 'k3',
        classification: 'EVIDENCE',
        scanStatus: 'PENDING',
      });
      repo.add({
        id: 'batch-corrupt',
        caseId: 'c1',
        fileName: 'corrupt-data.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
        storageKey: 'k4',
        classification: 'EVIDENCE',
        scanStatus: 'PENDING',
      });

      const batchResult = await processor.processPendingBatch();
      expect(batchResult.processed).toBe(4);
      expect(batchResult.clean).toBe(2);
      expect(batchResult.rejected).toBe(1);
      expect(batchResult.failed).toBe(1);

      // Verify no pending rows remain
      const remainingPending = await repo.findPending();
      expect(remainingPending).toHaveLength(0);

      // Verify individual statuses
      expect((await repo.findById('batch-clean-1'))?.scanStatus).toBe('CLEAN');
      expect((await repo.findById('batch-clean-2'))?.scanStatus).toBe('CLEAN');
      expect((await repo.findById('batch-malware'))?.scanStatus).toBe('REJECTED');
      expect((await repo.findById('batch-corrupt'))?.scanStatus).toBe('FAILED');
    });
  });
});
