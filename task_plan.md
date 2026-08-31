# AssessFlow Pre-Development Plan

## Goal

Take AssessFlow from the current design-pack baseline to a signed-off, implementation-ready MVP v1 without starting application development until all readiness gates are passed.

## Current Phase

Implementation Phase 1 — Foundation and first vertical slice (user-authorized)

> The user explicitly authorized implementation on 18 August 2026 using the proposed 9/10 delivery guide. Gate 1–10 approval evidence remains required before production pilot release; implementation work is being developed against the selected proposed defaults and must not be treated as production-ready until those gates are signed.

## Gates 0–10

### Gate 0: Baseline and scope freeze

- Inventory the existing planning and system-design artifacts.
- Confirm that the current workspace is specification-only.
- Define the MVP success statement and pilot boundary.
- **Status:** complete
- **Completed:** 2026-08-10
- **Evidence:** Planning Pack and System Design Pack inventories are documented in `findings.md`; the workspace is specification-only; the MVP boundary and core workflow are recorded; unresolved policy and ownership decisions are explicitly carried into Gate 1.

### Gate 1: Business ownership and decision log

- Assign Product/Business, HR/Talent, Governance, Technical, Security, QA, and Operations owners.
- Record decisions for terminology, eligibility, assessment methods, approvals, employee visibility, retention, and integrations.
- Create an ADR/decision log with approver and date for every policy decision.
- **Status:** in_progress
- **Started:** 2026-08-10
- **Next output:** `gate-1-business-decisions.md` with owner roles, proposed defaults, approval status, and unresolved questions.

### Gate 2: MVP scope and acceptance criteria

- Keep the core flow: request → eligibility → plan → evidence → result → recommendation → approval → closure.
- Decide which reasons, roles, departments, and approval routes are included in the first pilot.
- Convert the BRD into testable acceptance criteria and explicit out-of-scope items.
- **Status:** pending

### Gate 3: Target architecture and deployment boundary

- Confirm modular monolith as the initial architecture.
- Confirm host-platform versus standalone ownership for identity, employees, organization, positions, levels, files, and notifications.
- Produce architecture decision records, integration boundaries, environment model, and ownership map.
- **Status:** pending

### Gate 4: Data model and migration readiness

- Finalize PostgreSQL tables, configuration ownership, historical snapshots, organization scope, audit records, outbox records, and attachment metadata.
- Make migrations safe, repeatable, backward-compatible, and seedable.
- Validate constraints, indexes, revision rules, and in-flight case migration behavior.
- **Status:** pending

### Gate 5: Workflow and API contract readiness

- Reconcile BRD, workflow matrix, API contract, OpenAPI, database, and permission catalog.
- Complete all command endpoints, read models, errors, concurrency, idempotency, and audit/event behavior.
- Define one authoritative workflow/state-machine policy on the server.
- **Status:** pending

### Gate 6: UX, permissions, and accessibility readiness

- Turn low-fidelity wireframes into approved screen flows and permission-aware states.
- Confirm role-based and organization/department scope behavior for every screen and API.
- Define validation, error, empty, loading, conflict, sensitive-data, and attachment states.
- Review keyboard navigation, labels, focus, semantic tables, and WCAG target.
- Review and approve the proposed production baseline in `AssessFlow_Frontend_UI_UX_Spec_v1.1.md`.
- Approve the production sitemap, eighteen-route inventory, case-workspace template, responsive layouts, and mobile approval path.
- Approve semantic color aliases, workflow/status mapping, analytics polarity, gradient restrictions, and light-theme scope.
- Approve semantic motion tokens, component transition behavior, progressive loading, animated-gradient limits, and reduced-motion fallback.
- Map every visible command and protected field to the permissions workbook, organization scope, server transition contract, version rule, and audit event.
- Produce contrast, keyboard, focus, screen-reader, zoom/reflow, touch, RTL/localization, responsive, and motion/reduced-motion evidence.
- **Preparation artifact:** `AssessFlow_Frontend_UI_UX_Spec_v1.1.md` drafted 18 August 2026; proposed only and blocked by unresolved Gate 1 policies.
- **Status:** pending

### Gate 7: Security, privacy, and operations readiness

- Approve authentication/SSO, authorization, data scope, attachment security, retention, export controls, and audit policy.
- Define secrets, backups, restore testing, monitoring, logging, correlation IDs, jobs, retries, and failed-job handling.
- Confirm production configuration and migration controls.
- **Status:** pending

### Gate 8: Test strategy and release evidence

- Define unit, integration, API, permission, migration, accessibility, and E2E coverage.
- Prepare isolated test data for all critical workflow paths.
- Define quality thresholds and release evidence required for pilot approval.
- **Status:** pending

### Gate 9: Delivery backlog and implementation sequencing

- Break approved requirements into vertical-slice epics and implementation stories.
- Estimate work, dependencies, risks, and ownership.
- Prepare repository structure, coding standards, CI checks, and development workflow.
- **Status:** pending

### Gate 10: Ready-to-code decision

- Confirm all blocking decisions are approved.
- Confirm the implementation backlog, architecture, schema, API, UX, security, test, and operations artifacts are internally consistent.
- Produce a signed Go/No-Go checklist.
- **Status:** pending

## Ready-to-Code Criteria

- No unresolved P0 business or security decision.
- One approved MVP scope and pilot workflow.
- One authoritative state machine and permission model.
- Complete API contract and database migration plan.
- Approved identity/HRIS/file-storage ownership boundaries.
- Test cases exist for every critical transition and denial path.
- CI/CD, environments, secrets, backups, monitoring, and rollback approach are defined.
- Product, HR/Talent, Technical, Security, and QA owners have approved the baseline.

## Key Decisions

| Decision | Current position | Required before development |
|----------|------------------|----------------------------|
| Initial architecture | Modular monolith | Confirm host-platform versus standalone boundary |
| MVP scoring | Disabled by default | Keep disabled and explicitly test the no-score path |
| Core workflow | Human-judgment result plus separate recommendation and approval | Approve as the pilot workflow |
| Database | PostgreSQL authoritative store | Finalize configuration, snapshots, audit, outbox, and scope |
| Files | Private object storage | Confirm provider, scanning, retention, and access audit |
| Integrations | HRIS/SSO recommended; calendar/email phased | Assign owners and define MVP minimum |

## Implementation execution phases

1. **Foundation:** monorepo, shared contracts, strict TypeScript, local configuration, API/web shells, and CI quality checks.
2. **Vertical slice:** request → submit → eligibility → override → planning task, with permissions, optimistic concurrency, audit, task, and outbox contracts.
3. **Workflow expansion:** planning/events, assessor evidence, attachments, result, recommendation, approval, development, reassessment, and closure.
4. **Operations:** reports, administration, HRIS/email adapters, background jobs, observability, migrations, and Azure deployment definitions.
5. **Quality and pilot:** unit/integration/E2E/accessibility/security/performance evidence, UAT, pilot flags, rollback, and Gate 10 sign-off.

## Current implementation checkpoint

- **Phase 1 foundation:** implemented and verified.
- **Phase 2 first vertical slice:** demo-memory path implemented and verified through request, submit, eligibility decision, override request, structured actions, optimistic concurrency, and process-local idempotency.
- **Database foundation:** Prisma schema, generated client boundary, seed, reviewed baseline migration, readiness check, local environment workflow, and first-slice Prisma repository implemented. Full workflow persistence, integration coverage, and production connection validation remain.
- **Delivery foundation:** CI, workspace README, local Docker services, Azure Bicep baseline, worker boundary, and quality scripts implemented.
- **Not yet production-ready:** Entra authentication, real permissions, persistent audit/outbox/idempotency, HRIS/storage/email adapters, remaining workflow modules, Testcontainers/Playwright/axe/security/load/restore evidence, and Gate 1–10 approvals.

## Implementation defaults selected by project owner

- Standalone modular application with adapters.
- One company, 2–3 pilot departments, all three assessment reasons.
- English and Arabic with LTR/RTL verification; light theme required.
- Entra ID OIDC + hourly HRIS delta sync + nightly reconciliation.
- In-app notifications + queued email; calendar deferred.
- Approved employee summary only; assessor-private evidence remains restricted.
- Versioned eligibility with dual-control override.
- Sequential HR → business approval; self-approval prohibited.
- Configurable hold-first retention; no automatic pilot deletion until HR/Legal approval.
- Medium-enterprise target: 25,000 employees, 100 concurrent users, 20,000 cases/year.

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| Automated analyzer initially received an unsupported `--analyze` flag | 1 | Re-ran with the script's supported arguments |
| Analyzer output failed under Windows code page because of emoji output | 1 | Re-ran with UTF-8 output enabled |
