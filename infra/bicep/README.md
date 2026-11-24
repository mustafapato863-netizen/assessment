# AssessFlow Azure infrastructure

The production target is Azure managed services. The first infrastructure milestone must provision development and test environments before production:

- Azure Container Apps environment with private/internal ingress.
- Web/API Container App and internal worker Container App.
- Azure Database for PostgreSQL Flexible Server 18 with private networking and HA in production.
- Private Blob Storage with quarantine and clean containers.
- Azure Managed Redis.
- Key Vault, Application Insights/OpenTelemetry, and Azure Communication Services Email.
- Entra ID application registration and app roles.

Infrastructure should be added as reviewed Bicep modules after the Security and Operations owners approve region, networking, data residency, sizing, and budget. Do not commit real tenant IDs, secrets, connection strings, or production resource names.

`main.bicep` is the non-secret baseline for development/test topology. It deliberately leaves private endpoint wiring, Entra application registration, Defender for Storage, Azure Managed Redis sizing, and ACS Email sender verification as explicit deployment inputs/operations approvals rather than silently creating insecure defaults.

## Attachment Security & Quarantine/Clean Blob Architecture (Gate 7 / BIZ-007)

### 1. Storage Container Layout

In `main.bicep`, the storage account provisions two dedicated, private containers with `publicAccess: 'None'`:

- **`quarantine` container (`${storage.name}/default/quarantine`)**:
  - Ingress point for all newly uploaded attachments.
  - Upload metadata is recorded with `scanStatus: PENDING`.
  - Write-only access via short-lived user delegation SAS tokens (or backend API proxy).
  - Preview and download access from this container is strictly blocked at the API gate (refuses non-CLEAN attachments with HTTP 422 `SCAN_NOT_CLEAN`).
- **`clean` container (`${storage.name}/default/clean`)**:
  - Destination for attachments that have successfully passed anti-malware and file policy scans.
  - Download and preview URLs (short-lived read SAS URLs) are generated strictly for blobs promoted to this container.
  - Direct public access is disabled (`publicAccess: 'None'`); access requires authenticated sessions and valid Phase-01 RBAC roles.

### 2. Real-Scanner Swap Point

The background scan engine is architected around a pluggable interface:

- **Interface**: `AttachmentScanner` in `apps/worker/src/scanner/scanner.interface.ts`
  ```typescript
  export interface AttachmentScanner {
    readonly name: string;
    scan(attachment: AttachmentScanInput): Promise<ScanResult>;
  }
  ```
- **Development/Test Default**: `LocalAllowListStubScanner` (`apps/worker/src/scanner/local-allowlist-scanner.ts`). Enforces the BIZ-007 file extension and MIME type allow-lists (PDF, DOC, DOCX, JPG, PNG), strict 10MB size limit, and identifies simulated malware test vectors (e.g. EICAR).
- **Production Integration Paths**:
  1. **Microsoft Defender for Storage (Recommended)**: Enable malware scanning in Defender for Cloud on the Storage Account. Configure Azure Event Grid subscription on blob creation in `quarantine` container. Event Grid delivers scan verdicts (`MalwareScanningResult`) to Azure Service Bus or BullMQ queue (`attachment-scan`). Implement an `AzureDefenderAttachmentScanner` implementing `AttachmentScanner` to consume Defender scan findings and promote blobs to `clean`.
  2. **Containerized ClamAV / ICAP Microservice**: Deploy a private Container App running ClamAV / ICAP daemon with automated virus definition updates (`freshclam`). Implement a `ClamAvAttachmentScanner` that streams unverified blobs from `quarantine`, evaluates them, moves verified clean blobs to `clean`, and marks `Attachment.scanStatus` as `CLEAN` or `REJECTED` with reason.
