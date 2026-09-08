import { describe, expect, it } from 'vitest';
import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CasesService } from './cases.service';
import { CasesController } from './cases.controller';
import { CalibrationService } from './calibration.service';
import { CopilotService } from './copilot.service';
import { IdempotencyService } from '../common/idempotency.service';
import { ROUTE_PERMISSIONS } from '../auth';
import { MAX_ATTACHMENT_SIZE_BYTES } from '@assessflow/contracts';

describe('Attachment Scan Gate — API & Service', () => {
  const createServiceWithCase = async () => {
    const service = new CasesService();
    const draft = await service.create({
      employeeId: 'emp-gate',
      employeeName: 'Gate Employee',
      department: 'Security',
      currentRole: 'Engineer',
      assessmentReason: 'PROMOTION',
      targetRole: 'Senior Engineer',
      targetLevel: 'L5',
      justification: 'Justification for testing attachment scan gate and security policy.',
      priority: 'NORMAL',
    });
    return { service, caseId: draft.id };
  };

  describe('1. Upload Validation Matrix', () => {
    it('accepts valid PDF, DOC, DOCX, JPG, PNG attachments with scanStatus=PENDING', async () => {
      const { service, caseId } = await createServiceWithCase();

      const validFiles = [
        { name: 'document.pdf', type: 'application/pdf', size: 1024, classification: 'EVIDENCE' },
        { name: 'resume.doc', type: 'application/msword', size: 2048, classification: 'PORTFOLIO' },
        {
          name: 'notes.docx',
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          size: 4096,
          classification: 'ASSESSMENT_NOTES',
        },
        { name: 'badge.jpg', type: 'image/jpeg', size: 512, classification: 'IDENTITY' },
        { name: 'photo.jpeg', type: 'image/jpeg', size: 512, classification: 'IDENTITY' },
        { name: 'screenshot.png', type: 'image/png', size: 8192, classification: 'EVIDENCE' },
      ];

      for (const file of validFiles) {
        const result = await service.createAttachment(
          {
            caseId,
            fileName: file.name,
            contentType: file.type,
            sizeBytes: file.size,
            classification: file.classification,
          },
          { id: 'assessor-1', name: 'Assessor One' },
        );

        expect(result.id).toBeDefined();
        expect(result.caseId).toBe(caseId);
        expect(result.fileName).toBe(file.name);
        expect(result.contentType).toBe(file.type.toLowerCase());
        expect(result.classification).toBe(file.classification);
        expect(result.sizeBytes).toBe(file.size);
        expect(result.scanStatus).toBe('PENDING');
        expect(result.scanReason).toBeNull();
        expect(result.scannedAt).toBeNull();
        expect(result.createdBy).toBe('assessor-1');
        expect(result.downloadUrl).toBeNull();
        expect(result.previewUrl).toBeNull();
      }
    });

    it('rejects upload with missing or empty classification', async () => {
      const { service, caseId } = await createServiceWithCase();

      await expect(
        Promise.resolve().then(() =>
          service.createAttachment({
            caseId,
            fileName: 'doc.pdf',
            contentType: 'application/pdf',
            sizeBytes: 1024,
            classification: '',
          }),
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        Promise.resolve().then(() =>
          service.createAttachment({
            caseId,
            fileName: 'doc.pdf',
            contentType: 'application/pdf',
            sizeBytes: 1024,
            classification: '   ',
          }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects disallowed file types (.exe, .sh, .bat, .zip, .txt, etc.)', async () => {
      const { service, caseId } = await createServiceWithCase();

      const disallowedFiles = [
        { name: 'malicious.exe', type: 'application/x-msdownload' },
        { name: 'script.sh', type: 'application/x-sh' },
        { name: 'install.bat', type: 'application/x-bat' },
        { name: 'archive.zip', type: 'application/zip' },
        { name: 'readme.txt', type: 'text/plain' },
        { name: 'script.js', type: 'application/javascript' },
        { name: 'trojan.dll', type: 'application/octet-stream' },
        { name: 'mismatch.pdf', type: 'application/zip' },
        { name: 'mismatch.exe', type: 'application/pdf' },
      ];

      for (const file of disallowedFiles) {
        await expect(
          Promise.resolve().then(() =>
            service.createAttachment({
              caseId,
              fileName: file.name,
              contentType: file.type,
              sizeBytes: 2048,
              classification: 'EVIDENCE',
            }),
          ),
        ).rejects.toThrow(BadRequestException);
      }
    });

    it('enforces the 10MB file size cap strictly', async () => {
      const { service, caseId } = await createServiceWithCase();

      // Zero or negative size
      await expect(
        Promise.resolve().then(() =>
          service.createAttachment({
            caseId,
            fileName: 'zero.pdf',
            contentType: 'application/pdf',
            sizeBytes: 0,
            classification: 'EVIDENCE',
          }),
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        Promise.resolve().then(() =>
          service.createAttachment({
            caseId,
            fileName: 'negative.pdf',
            contentType: 'application/pdf',
            sizeBytes: -100,
            classification: 'EVIDENCE',
          }),
        ),
      ).rejects.toThrow(BadRequestException);

      // Exactly 10MB (10 * 1024 * 1024 = 10,485,760 bytes) is accepted
      const accepted = await service.createAttachment({
        caseId,
        fileName: 'exact-10mb.pdf',
        contentType: 'application/pdf',
        sizeBytes: MAX_ATTACHMENT_SIZE_BYTES,
        classification: 'EVIDENCE',
      });
      expect(accepted.sizeBytes).toBe(MAX_ATTACHMENT_SIZE_BYTES);

      // 10MB + 1 byte is rejected
      await expect(
        Promise.resolve().then(() =>
          service.createAttachment({
            caseId,
            fileName: 'too-large.pdf',
            contentType: 'application/pdf',
            sizeBytes: MAX_ATTACHMENT_SIZE_BYTES + 1,
            classification: 'EVIDENCE',
          }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects attachment upload for non-existent case', async () => {
      const service = new CasesService();
      await expect(
        Promise.resolve().then(() =>
          service.createAttachment({
            caseId: '00000000-0000-0000-0000-000000000000',
            fileName: 'valid.pdf',
            contentType: 'application/pdf',
            sizeBytes: 1024,
            classification: 'EVIDENCE',
          }),
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('2. Gate Reads (Preview & Download)', () => {
    it('refuses preview/download with structured 422 SCAN_NOT_CLEAN when scanStatus is PENDING', async () => {
      const { service, caseId } = await createServiceWithCase();
      const attachment = await service.createAttachment({
        caseId,
        fileName: 'evidence.pdf',
        contentType: 'application/pdf',
        sizeBytes: 2048,
        classification: 'EVIDENCE',
      });

      expect(attachment.scanStatus).toBe('PENDING');

      try {
        await service.previewAttachment(attachment.id);
        expect.unreachable('Should have thrown SCAN_NOT_CLEAN');
      } catch (err) {
        expect(err).toBeInstanceOf(UnprocessableEntityException);
        const response = (err as UnprocessableEntityException).getResponse() as {
          error: { code: string; scanStatus: string };
        };
        expect(response.error.code).toBe('SCAN_NOT_CLEAN');
        expect(response.error.scanStatus).toBe('PENDING');
      }

      try {
        await service.downloadAttachment(attachment.id);
        expect.unreachable('Should have thrown SCAN_NOT_CLEAN');
      } catch (err) {
        expect(err).toBeInstanceOf(UnprocessableEntityException);
        const response = (err as UnprocessableEntityException).getResponse() as {
          error: { code: string; scanStatus: string };
        };
        expect(response.error.code).toBe('SCAN_NOT_CLEAN');
        expect(response.error.scanStatus).toBe('PENDING');
      }
    });

    it('refuses preview/download with structured 422 SCAN_NOT_CLEAN when scanStatus is SCANNING', async () => {
      const { service, caseId } = await createServiceWithCase();
      const attachment = await service.createAttachment({
        caseId,
        fileName: 'scanning-file.pdf',
        contentType: 'application/pdf',
        sizeBytes: 2048,
        classification: 'EVIDENCE',
      });

      await service.updateAttachmentScanStatus(attachment.id, 'SCANNING');

      await expect(service.previewAttachment(attachment.id)).rejects.toThrow(
        UnprocessableEntityException,
      );
      await expect(service.downloadAttachment(attachment.id)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('refuses preview/download with structured 422 SCAN_NOT_CLEAN when scanStatus is REJECTED', async () => {
      const { service, caseId } = await createServiceWithCase();
      const attachment = await service.createAttachment({
        caseId,
        fileName: 'infected-file.pdf',
        contentType: 'application/pdf',
        sizeBytes: 2048,
        classification: 'EVIDENCE',
      });

      await service.updateAttachmentScanStatus(
        attachment.id,
        'REJECTED',
        'Malware signature detected',
      );

      try {
        await service.downloadAttachment(attachment.id);
        expect.unreachable('Should have thrown SCAN_NOT_CLEAN');
      } catch (err) {
        expect(err).toBeInstanceOf(UnprocessableEntityException);
        const response = (err as UnprocessableEntityException).getResponse() as {
          error: { code: string; scanStatus: string; scanReason: string };
        };
        expect(response.error.code).toBe('SCAN_NOT_CLEAN');
        expect(response.error.scanStatus).toBe('REJECTED');
        expect(response.error.scanReason).toBe('Malware signature detected');
      }
    });

    it('refuses preview/download with structured 422 SCAN_NOT_CLEAN when scanStatus is FAILED', async () => {
      const { service, caseId } = await createServiceWithCase();
      const attachment = await service.createAttachment({
        caseId,
        fileName: 'corrupt-file.pdf',
        contentType: 'application/pdf',
        sizeBytes: 2048,
        classification: 'EVIDENCE',
      });

      await service.updateAttachmentScanStatus(
        attachment.id,
        'FAILED',
        'Scanner internal I/O crash',
      );

      await expect(service.previewAttachment(attachment.id)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('permits preview and download when scanStatus is CLEAN', async () => {
      const { service, caseId } = await createServiceWithCase();
      const attachment = await service.createAttachment({
        caseId,
        fileName: 'clean-file.pdf',
        contentType: 'application/pdf',
        sizeBytes: 2048,
        classification: 'EVIDENCE',
      });

      await service.updateAttachmentScanStatus(attachment.id, 'CLEAN');

      const preview = await service.previewAttachment(attachment.id);
      expect(preview.id).toBe(attachment.id);
      expect(preview.scanStatus).toBe('CLEAN');
      expect(preview.previewUrl).toContain('/clean/');

      const download = await service.downloadAttachment(attachment.id);
      expect(download.id).toBe(attachment.id);
      expect(download.scanStatus).toBe('CLEAN');
      expect(download.downloadUrl).toContain('/clean/');

      const fetched = await service.getAttachment(attachment.id);
      expect(fetched.downloadUrl).toContain('/clean/');
      expect(fetched.previewUrl).toContain('/clean/');
    });
  });

  describe('3. Controller & RBAC Role Mappings', () => {
    it('wires Phase-01 permission roles correctly', () => {
      // ATTACHMENT_UPLOAD: Requester, HR, Coordinator, Assessor, PanelLead, Admin
      expect(ROUTE_PERMISSIONS.ATTACHMENT_UPLOAD).toContain('Requester');
      expect(ROUTE_PERMISSIONS.ATTACHMENT_UPLOAD).toContain('HR');
      expect(ROUTE_PERMISSIONS.ATTACHMENT_UPLOAD).toContain('Assessor');
      expect(ROUTE_PERMISSIONS.ATTACHMENT_UPLOAD).toContain('PanelLead');
      expect(ROUTE_PERMISSIONS.ATTACHMENT_UPLOAD).toContain('Admin');
      // Read-only Auditor must NOT have upload permission
      expect((ROUTE_PERMISSIONS.ATTACHMENT_UPLOAD as readonly string[]).includes('Auditor')).toBe(
        false,
      );

      // ATTACHMENT_READ: includes Auditor, BusinessApprover, Assessor, etc.
      expect(ROUTE_PERMISSIONS.ATTACHMENT_READ).toContain('Auditor');
      expect(ROUTE_PERMISSIONS.ATTACHMENT_READ).toContain('BusinessApprover');
      expect(ROUTE_PERMISSIONS.ATTACHMENT_READ).toContain('Requester');
    });

    it('controller delegates upload, get, preview, and download appropriately', async () => {
      const service = new CasesService();
      const calibration = new CalibrationService({ enabled: false } as any);
      const copilot = new CopilotService({ enabled: false } as any);
      const idempotency = new IdempotencyService();
      const controller = new CasesController(service, calibration, copilot, idempotency);

      const draft = await service.create({
        employeeId: 'emp-ctrl',
        employeeName: 'Ctrl Employee',
        department: 'Security',
        currentRole: 'Specialist',
        assessmentReason: 'PROMOTION',
        targetRole: 'Lead',
        targetLevel: 'L4',
        justification: 'Testing controller endpoints for attachment scan gate.',
        priority: 'NORMAL',
      });

      // 1. Controller createAttachment
      const created = await controller.createAttachment(
        {
          caseId: draft.id,
          fileName: 'review.pdf',
          contentType: 'application/pdf',
          sizeBytes: 1024,
          classification: 'EVIDENCE',
        },
        'assessor-1',
      );
      expect(created.id).toBeDefined();
      expect(created.scanStatus).toBe('PENDING');

      // 2. Controller getAttachment (metadata query)
      const metadata = await controller.getAttachment(created.id);
      expect(metadata.id).toBe(created.id);
      expect(metadata.scanStatus).toBe('PENDING');

      // 3. Controller previewAttachment refuses PENDING with 422
      await expect(controller.previewAttachment(created.id)).rejects.toThrow(
        UnprocessableEntityException,
      );

      // 4. Controller downloadAttachment refuses PENDING with 422
      await expect(controller.downloadAttachment(created.id)).rejects.toThrow(
        UnprocessableEntityException,
      );

      // 5. Query param action=download delegates to download and refuses PENDING with 422
      await expect(controller.getAttachment(created.id, 'download')).rejects.toThrow(
        UnprocessableEntityException,
      );

      // 6. Query param download=true delegates to download and refuses PENDING with 422
      await expect(controller.getAttachment(created.id, undefined, 'true')).rejects.toThrow(
        UnprocessableEntityException,
      );

      // 7. Transition to CLEAN -> controller endpoints succeed
      await service.updateAttachmentScanStatus(created.id, 'CLEAN');

      const cleanPreview = await controller.previewAttachment(created.id);
      expect(cleanPreview.scanStatus).toBe('CLEAN');
      expect(cleanPreview.previewUrl).toBeDefined();

      const cleanDownload = await controller.downloadAttachment(created.id);
      expect(cleanDownload.scanStatus).toBe('CLEAN');
      expect(cleanDownload.downloadUrl).toBeDefined();
    });
  });
});
