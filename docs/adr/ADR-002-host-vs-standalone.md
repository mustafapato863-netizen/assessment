# ADR-002: Host-vs-Standalone Ownership Boundary

## Status
Approved 2026-09-04 (`admin`, Gate 3)

## Context
AssessFlow needs to determine which components are owned and operated by the host organization (platform/central IT) versus standalone deployment managed by the AssessFlow administrators. Key domains include identity (Entra ID), HRIS synchronization, storage, and email notifications.

## Decision
We will adopt a hybrid model where:
- **Identity/SSO (Entra ID):** Host-owned. AssessFlow relies on the organization's Entra ID for authentication and user provisioning. AssessFlow will be registered as an enterprise application in the host's Entra tenant.
- **HRIS Synchronization:** Host-owned data source, standalone-managed sync process. HRIS remains the system of record for employee data (host-owned). AssessFlow will run a scheduled sync process (standalone-owned) that pulls delta changes hourly and performs full reconciliation nightly.
- **Storage (Blob/Object):** Host-owned infrastructure, standalone-managed lifecycle. Private blob storage containers are provisioned by host/platform team; AssessFlow owns the logic for upload, scanning, quarantine, retention, and signed URL generation.
- **Email (ACS):** Host-owned service, standalone-managed templates and triggers. Azure Communication Services Email is provisioned and managed by host/platform; AssessFlow owns email template content, trigger logic, and preference management.

This model leverages host investments in core infrastructure while giving AssessFlow operational control over workflow-specific configurations and data handling.

## Rationale
✅ **Security & Compliance**: Critical systems (identity, HRIS, storage) remain under host governance with established security baselines  
✅ **Operational Clarity**: Clear division reduces ambiguity in responsibility for incidents and updates  
✅ **Leverage Existing Investments**: Uses organization's already-paid-for Entra ID, HRIS, storage, and email services  
✅ **Workflow Flexibility**: AssessFlow can customize sync schedules, email triggers, and retention policies without host coordination  
✅ **Auditability**: Clear ownership boundaries simplify access logging and audit trails  

## Alternatives Considered
❌ **Fully Hosted**: AssessFlow has no ownership of any infrastructure; requires host team for every configuration change – too slow for workflow-specific needs  
❌ **Fully Standalone**: AssessFlow provisions its own Entra tenant, HRIS sync tools, storage accounts, and email service – duplicates effort and complicates user lifecycle  
❌ **Split by Data Type**: Some attributes host-owned, others standalone – creates complex synchronization and consistency challenges  

## Implications
### Positive
- Single sign-on with existing corporate credentials
- HRIS data remains authoritative in source system
- Storage costs and quotas managed by host platform
- Email delivery reputation tied to established domain

### Negative
- Requires coordination with host teams for initial provisioning and access
- Dependency on host SLAs for core services (Entra, storage, email)
- Need to handle host-driven changes (e.g., Entra schema updates)

### Mitigations
- Document clear provisioning checklist for host responsibilities
- Implement retry mechanisms and dead-letter queues for sync failures
- Use feature flags to disable AssessFlow-owned workflows if host services unavailable
- Regular coordination meetings with host platform owners

## Related Decisions
- ADR-001: Modular monolith architecture (deployment unit)
- ADR-003: Environment model (consistency across dev/test/prod)
- BIZ-009: HRIS and identity ownership (Gate 1 policy decision)
- BIZ-014: Notifications and SLA policy (Gate 1 policy decision)
- Gate 7: Security, privacy, and operations readiness (validation of boundary decisions)

## Notes
This decision assumes the host organization provides:
- Entra ID with app registration capabilities
- Azure Blob Storage with private networking option
- Azure Communication Services Email resource
- HRIS API or database access for synchronization

If any of these are not available, standalone alternatives would be re-evaluated.