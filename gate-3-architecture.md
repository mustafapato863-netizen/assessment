# AssessFlow Gate 3 — Target Architecture and Deployment Boundary

**Status:** Approved 2026-09-04 by `admin` (Technical + Identity/HRIS + Security owners)
**Pilot boundary (from Gate 2):** single company; Product, Engineering, People; all three reasons; sequential HR→Business
**Purpose:** Confirm modular monolith as the initial architecture, define host-platform versus standalone ownership, and produce architecture decision records, integration boundaries, environment model, and ownership map.  
**Dependencies:** Gate 1 (BIZ-009, BIZ-013, BIZ-014)  
**Owner:** Technical Owner + Identity/HRIS Owner + Security/Privacy Owner  

## Architecture Decision Records (ADRs)

The following ADRs capture key architectural decisions for AssessFlow:

1. **ADR-001: Modular Monolith Architecture**
   - *Status:* Approved 2026-09-04 (`admin`)  
   - *Summary:* AssessFlow will use a modular monolith architecture for the MVP, with a single PostgreSQL database as the authoritative data store. Components (API, web, worker) are deployed as a single unit but organized as separate modules with clear boundaries.

2. **ADR-002: Host-vs-Standalone Ownership Boundary**
   - *Status:* Approved 2026-09-04 (`admin`)  
   - *Summary:* Ownership is split between host organization (platform/central IT) and standalone AssessFlow administration:  
     - **Identity/SSO (Entra ID):** Host-owned  
     - **HRIS Synchronization:** Host-owned data source, standalone-managed sync process  
     - **Storage (Blob/Object):** Host-owned infrastructure, standalone-managed lifecycle  
     - **Email (ACS):** Host-owned service, standalone-managed templates and triggers  

3. **ADR-003: Environment Model**
   - *Status:* Approved 2026-09-04 (`admin`)  
   - *Summary:* Three-tier environment model with explicit promotion paths:  
     - **Development (local/dev):** Individual developer environments using Docker Compose  
     - **Test (shared/stable):** Persistent environment for integration and performance testing  
     - **Production:** Live environment serving the pilot user base  

## Integration Boundaries

AssessFlow integrates with the following external systems, with clear ownership boundaries:

| System | Ownership | Integration Point | Notes |
|--------|-----------|-------------------|-------|
| Entra ID (Azure AD) | Host | Authentication (OIDC) and user provisioning via SCIM or Graph API | AssessFlow relies on host for user lifecycle management |
| HRIS (e.g., Workday, SAP SuccessFactors) | Host | Data synchronization via scheduled jobs (delta hourly, full nightly) | HRIS remains system of record for employee data |
| Private Blob Storage (Azure) | Host (infrastructure), AssessFlow (lifecycle) | Storage of evidence attachments with quarantine/clean split, virus scanning, signed URLs | AssessFlow manages upload, scan, retention, and access controls |
| Azure Communication Services (ACS) Email | Host (service), AssessFlow (templates/triggers) | Email notifications for eligibility decisions, approval requests, overdue actions | AssessFlow owns email content and trigger logic |
| Azure Managed Redis | Host (infrastructure), AssessFlow (usage) | Backing store for BullMQ queues (outbox, reminders, hris-sync, exports) | Used for reliable background job processing |
| Azure Key Vault | Host (infrastructure), AssessFlow (secrets) | Storage of application secrets (e.g., database connection strings, API keys) | No secrets stored in repository |
| Azure Monitor / Application Insights | Host (infrastructure), AssessFlow (instrumentation) | Logging, metrics, tracing, and correlation ID propagation | Supports observability and alerting |

## Environment Model Detail

As defined in ADR-003, the environment model ensures consistency across development, testing, and production:

- **Development:**  
  - Individual developer workstations  
  - Docker Compose with local PostgreSQL and Redis  
  - Feature flags for enabling/disabling incomplete features  
  - Data is ephemeral and reset frequently  

- **Test:**  
  - Shared, persistent environment  
  - Matches production configuration (same database version, similar sizing)  
  - Used for integration testing, performance testing, and stakeholder review  
  - Infrastructure-as-code (Bicep) with parameter files per environment  

- **Production:**  
  - Live environment serving the pilot  
  - Strict change management procedures  
  - Monitoring, logging, and alerting enabled  
  - Backup and disaster recovery procedures in place  

Promotion path: Development → Test → Production, with versioned infrastructure and code.

## Ownership Map

The ownership map clarifies responsibilities for key domains:

| Domain | Host Organization | AssessFlow Standalone | Shared Responsibility |
|--------|-------------------|------------------------|------------------------|
| Identity & Authentication | Entra ID configuration, user lifecycle | Application registration in Entra, role mapping | SSO integration testing |
| HRIS Data | HRIS system maintenance, data accuracy | Sync job scheduling, error handling, data mapping | Data validation and reconciliation |
| Storage | Provisioning of blob storage accounts, networking | Upload logic, virus scanning, quarantine, retention, signed URLs | Access monitoring and audit |
| Email | Provisioning of ACS Email service, domain reputation | Email template design, trigger logic, preference management | Delivery monitoring and bounce handling |
| Infrastructure | Networking, virtual machines, Kubernetes clusters | Container Apps configuration, autoscaling rules, health checks | Cost optimization and performance tuning |
| Security | Host-based intrusion detection, firewall rules | Application-level security (input validation, authz), audit logging | Vulnerability assessments and penetration testing |
| Operations | Host monitoring, alerting infrastructure | Application-specific metrics, logs, tracing | Incident response and runbooks |

## Capacity Plan (for 25k employees, 100 concurrent users, 20k cases/year)

The architecture is designed to support the following baseline capacity targets:

- **Employee Base:** 25,000 employees (single organization scope)  
- **Concurrent Users:** 100 peak concurrent users  
- **Annual Case Volume:** 20,000 assessment cases per year (~1,667/month, ~55/day)  
- **Case Lifecycle:** Average case duration of 30 days from request to closure  
- **Active Cases:** Approximately 500-700 open cases at any given time (based on 20k/year * 30/365)  

### Resource Requirements Estimate

| Resource | Target Specification | Notes |
|----------|----------------------|-------|
| **Compute (Azure Container Apps)** | 2-4 replicas for API and Web, 1-2 for Worker | Autoscaling based on CPU/memory; t-shirt sizes: Medium (2 vCPU, 4 GiB RAM) |
| **Database (PostgreSQL Flexible Server 18)** | 4 vCPU, 16 GiB RAM, Premium SSD | With High Availability (zone-redundant); read replicas for reporting if needed |
| **Cache (Azure Managed Redis)** | 1 Standard (C1) instance, 1 GiB | For BullMQ job queues; persistence enabled |
| **Storage (Azure Blob Storage)** | 100 GB initial, lifecycle management | Hot/cool/archive tiers; quarantine and clean containers |
| **Monitoring (Azure Monitor/App Insights)** | Standard tier | Logs, metrics, distributed tracing; alerts on error rates and latency |
| **Networking** | Private endpoints for database and storage | Service endpoints for Key Vault and ACS; no public exposure of sensitive services |

### Assumptions and Validation

- Assumes average request size of 10KB and response size of 50KB for API calls  
- Peak concurrency of 100 users translates to ~20-30 requests/second average, with bursts higher  
- Database designed for read-heavy workload (case lookups) with moderate writes (case updates)  
- Background jobs (HRIS sync, email sending, evidence processing) processed via BullMQ with configurable concurrency  

**Validation Required:**  
- Load testing with k6 at 100 concurrent users (Gate 8)  
- Database connection pooling and query optimization  
- Autoscaling rules based on actual metrics  
- Backup and restore procedures tested (Gate 7)  

## Next Steps and Exit Criteria

To exit Gate 3, the following must be approved and documented:

- [x] ADR-001, ADR-002, and ADR-003 approved by Technical Owner, Identity/HRIS Owner, and Security/Privacy Owner (`admin`, 2026-09-04)
- [x] Integration boundaries documented (Entra OIDC, HRIS hourly-delta/nightly-reconcile, private storage quarantine/clean, ACS email, Redis, Key Vault, App Insights)
- [x] Ownership map reviewed and approved (`admin`, 2026-09-04)
- [x] Environment model: Docker Compose for dev, Bicep baseline for test/prod (`infra/bicep/main.bicep` + README with explicit deferred inputs)
- [ ] Capacity plan validated via load testing — recorded as assumption (25k/100/20k), validation deferred to Gate 8 k6 run
- [x] `gate-3-architecture.md` completed with ADRs, integration boundaries, ownership map, environment model, and capacity plan
- [x] `infra/bicep/README.md` reviewed: baseline + deferred inputs (private endpoint, Redis sizing, Defender, Entra registration, ACS sender) consistent with this boundary

---
*Gate 3 approved 2026-09-04 by `admin`. Capacity numbers remain assumptions until Gate 8 load evidence.*