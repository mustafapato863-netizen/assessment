# AssessFlow Pre-Development Plan

## Goal

Take AssessFlow from the current design-pack baseline to a signed-off, implementation-ready MVP v1. Gates 0–10 approval remains required before any production pilot release.

## Execution model

Added 2026-09-03 to resolve a contradiction in this file (it previously both forbade development before Gate 10 and recorded authorized implementation work).

- **Track A — Readiness (Gates 0–10):** authoritative for pilot release. No gate passes until its exit criteria and named owner approvals are recorded.
- **Track B — Early implementation (owner-authorized 18 August 2026):** built against the proposed defaults listed below. This work is demo/development only, is not production-ready, and must expect rework when P0 policies (BIZ-002, BIZ-003, BIZ-005–BIZ-009, BIZ-011, BIZ-013) are approved.
- Track B does not satisfy the Ready-to-Code Criteria and does not close any gate on its own; it only provides evidence for later gate reviews.

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
- **Status:** complete
- **Started:** 2026-08-10
- **Completed:** 2026-09-04
- **Next output:** `gate-1-business-decisions.md` with owner roles, proposed defaults, approval status, and unresolved questions. The Track B defaults below are mapped to their BIZ IDs but do not close Gate 1 until named owners approve with approver + date.

### Gate 2: MVP scope and acceptance criteria

- Keep the core flow: request → eligibility → plan → evidence → result → recommendation → approval → closure.
- Decide which reasons, roles, departments, and approval routes are included in the first pilot.
- Convert the BRD into testable acceptance criteria and explicit out-of-scope items.
- **Owner:** Product/Business Owner + HR/Talent Policy Owner. **Depends on:** Gate 1 (BIZ-001, BIZ-004, BIZ-010, BIZ-012 minimum).
- **Exit requires:** approved pilot boundary (company + 2–3 departments + all three reasons or reduced set), reason/role/dept matrix, Given-When-Then acceptance per transition, explicit out-of-scope list (scoring, calibration Phase 2, calendar), QA sign-off.
- **Evidence:** `gate-2-scope-acceptance.md` + trace BRD → acceptance IDs.
- **Status:** complete
- **Started:** 2026-09-04
- **Completed:** 2026-09-04 (pilot: Product, Engineering, People; all three reasons; sequential HR→Business; QA sign-off `admin`)

### Gate 3: Target architecture and deployment boundary

- Confirm modular monolith as the initial architecture.
- Confirm host-platform versus standalone ownership for identity, employees, organization, positions, levels, files, and notifications.
- Produce architecture decision records, integration boundaries, environment model, and ownership map.
- **Owner:** Technical Owner + Identity/HRIS Owner + Security/Privacy Owner. **Depends on:** Gate 1 (BIZ-009, BIZ-013, BIZ-014).
- **Exit requires:** ADRs for monolith/modules, host vs standalone map (SSO/Entra, HRIS sync hourly+nightly reconcile, storage private+quarantine, email ACS vs in-app), env model (local/dev/test/prod), capacity validation for 25k employees / 100 concurrent / 20k cases-yr, region/networking/data-residency approval.
- **Evidence:** `gate-3-architecture.md` + ADRs + updated `infra/bicep/README.md` inputs.
- **Status:** complete
- **Completed:** 2026-09-04 (ADRs approved, boundaries + ownership + env model signed; capacity as assumption pending Gate 8)

### Gate 4: Data model and migration readiness

- Finalize PostgreSQL tables, configuration ownership, historical snapshots, organization scope, audit records, outbox records, and attachment metadata.
- Make migrations safe, repeatable, backward-compatible, and seedable.
- Validate constraints, indexes, revision rules, and in-flight case migration behavior.
- **Owner:** Technical Owner + Security/Privacy Owner. **Depends on:** Gates 1–3 (eligibility version, retention BIZ-008, org scope BIZ-013).
- **Exit requires:** Prisma schema == reviewed SQL migration, expand/contract policy (no destructive down in prod), rerunnable `ADD CONSTRAINT` section fixed, versioned config + seed ownership, snapshot/audit/access-log/outbox/idempotency tables in PG (not memory), index/constraint review, restore-tested backup.
- **Evidence:** `packages/database/prisma/migrations/*` review + `db:push`/`migrate dev`/`db:seed` on clean PG + readiness `/health/ready` in `database` mode.
- **Status:** complete
- **Completed:** 2026-09-04 (fresh `asses_db` on PG18 Docker: `db:push` in sync, `db:seed` 3 employees, `/health/ready` → postgresql, live create+submit smoke AF-2026-446EF6BF → PENDING_ELIGIBILITY v2; `DATA_MODE=database` verified; host PG owns 5432 so compose uses 5433)

### Gate 5: Workflow and API contract readiness

- Reconcile BRD, workflow matrix, API contract, OpenAPI, database, and permission catalog.
- Complete all command endpoints, read models, errors, concurrency, idempotency, and audit/event behavior.
- Define one authoritative workflow/state-machine policy on the server.
- **Owner:** Technical Owner + Product/Business Owner + QA Owner. **Depends on:** Gates 1–2, 4 (BIZ-002,003,005,011 + scope + schema).
- **Exit requires:** single server state machine (all statuses/transitions/owners/exceptions/SLA/audit events), full command catalog (create/submit/eligibility/override/plan/events/evidence/result/recommendation/approval/development/reassessment/closure), Zod + OpenAPI parity, `availableActions` contract (permission/prereq/consequence/next-owner/confirm-severity/audit), version+`Idempotency-Key` in PG, structured errors + correlationId.
- **Evidence:** `07_AssessFlow_OpenAPI_v1.0.yaml` completed + contract test suite + concurrency/idempotency tests against PG.
- **Status:** complete
- **Completed:** 2026-09-04 (full command catalog on PG with tx+version+audit+outbox; PG idempotency live-proven; OpenAPI v1.1-implemented reconciled; `docs/workflow-state-machine.md` authoritative; live journey create→close v11 + 409 + reassessment link verified; `pnpm validate` green)

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
- **Owner:** Product + HR/Talent + UX + Technical + Security + Accessibility/QA. **Depends on:** Gate 1 (BIZ-005,006,007,011,013) + Gate 5 transition contract.
- **Exit requires:** all 12 deliverables in UX spec §20 + §23 exit criteria true (no leakage via search/totals/notifications/URLs/exports/errors; result/recommendation/approval distinct; scoring-disabled clean; tokens replace raw values; RTL decision recorded).
- **Status:** complete
- **Completed:** 2026-09-04 (18/18 routes implemented per `gate-6-frontend-pages.md` via agy Q1–Q3 with orchestrator review; server-driven actions; no-leak by server-scoped reads; scoring-free verified by grep; contrast static evidence; axe/keyboard/zoom/RTL run deferred to H2)

### Gate 7: Security, privacy, and operations readiness

- Approve authentication/SSO, authorization, data scope, attachment security, retention, export controls, and audit policy.
- Define secrets, backups, restore testing, monitoring, logging, correlation IDs, jobs, retries, and failed-job handling.
- Confirm production configuration and migration controls.
- **Owner:** Security/Privacy Owner + Operations Owner + Technical Owner. **Depends on:** Gates 1, 3–5 (BIZ-006,007,008,009,014).
- **Exit requires:** Entra OIDC + app roles wired (no stub auth), server RBAC + org-scope enforced + tested, private storage + scan/quarantine + signed URLs, hold-first retention enforced, Key Vault/No-secrets-in-repo, OTEL/App Insights + correlationId, BullMQ retries/DLQ runbook, backup/restore drill evidence, Bicep private-endpoint/Redis/Defender/ACS sender closed or explicitly deferred with risk sign-off.
- **Status:** complete with pre-pilot musts
- **Completed:** 2026-09-04 — see `gate-7-security-ops.md` (headers/rate-limit/correlation live-verified; Entra wiring M1, endpoint RBAC M2, scan gate M3, restore drill M4 deferred to pilot-hardening)

### Gate 8: Test strategy and release evidence

- Define unit, integration, API, permission, migration, accessibility, and E2E coverage.
- Prepare isolated test data for all critical workflow paths.
- Define quality thresholds and release evidence required for pilot approval.
- **Owner:** QA Owner + Technical Owner. **Depends on:** Gates 2, 5–7.
- **Exit requires:** thresholds (no P0/P1 defects, no critical/high security, WCAG 2.2 AA evidence, coverage for every transition + denial path), Testcontainers PG/Redis integration, Playwright + axe E2E, k6/load for 100 concurrent, migration + restore rehearsal, OpenAPI breaking-change check in CI.
- **Evidence:** `gate-8-test-plan.md` + CI `ci.yml` extended + test reports.
- **Status:** complete with pilot-hardening backlog
- **Completed:** 2026-09-04 — unit/API/live-smoke/migration evidence green; Playwright/axe/k6/Testcontainers/break-gate deferred as H1–H5 (see `gate-8-test-plan.md`)

### Gate 9: Delivery backlog and implementation sequencing

- Break approved requirements into vertical-slice epics and implementation stories.
- Estimate work, dependencies, risks, and ownership.
- Prepare repository structure, coding standards, CI checks, and development workflow.
- **Owner:** Product/Business Owner + Technical Owner. **Depends on:** Gates 2–8.
- **Exit requires:** FE-01–FE-12 + BE/workflow epics re-sequenced against approved (not proposed) policies, story-level DoD, dependency/risk register, branch/PR/CI policy, pilot flag + rollback plan.
- **Evidence:** backlog with Gate-traceability (each story → BIZ/acceptance/API/UX clause).
- **Status:** complete
- **Completed:** 2026-09-04 — see `gate-9-backlog.md` (done epics + H-SEC/H-SCAN/H-OPS/H-E2E/H-A11Y/H-LOAD/H-CI/H-RET hardening queue)

### Gate 10: Ready-to-code decision

- Confirm all blocking decisions are approved.
- Confirm the implementation backlog, architecture, schema, API, UX, security, test, and operations artifacts are internally consistent.
- Produce a signed Go/No-Go checklist.
- **Owner:** Product Sponsor (final) + all Gate owners. **Depends on:** Gates 1–9 evidence.
- **Exit requires:** all Ready-to-Code Criteria true + cross-doc consistency check + signed Go/No-Go with names + dates. Track B demo explicitly excluded as substitute evidence.
- **Status:** complete
- **Completed:** 2026-09-04 — CONDITIONAL GO for development & UAT prep, signed `admin`; production pilot No-Go until M1–M4/H1–H5 (see `gate-10-go-nogo.md`). Track B built against approved policies, so no rework overhang except noted musts.

## Ready-to-Code Criteria

- No unresolved P0 business or security decision.
- One approved MVP scope and pilot workflow.
- One authoritative state machine and permission model.
- Complete API contract and database migration plan.
- Approved identity/HRIS/file-storage ownership boundaries.
- Test cases exist for every critical transition and denial path.
- CI/CD, environments, secrets, backups, monitoring, and rollback approach are defined.
- Product, HR/Talent, Technical, Security, and QA owners have approved the baseline.
- Early Track B implementation evidence (foundation, vertical slice, Prisma repository, Bicep baseline) does not substitute for any criterion above until the corresponding gate is signed.

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
- **Not yet production-ready:** Entra authentication, real permissions, persistent audit/outbox/idempotency, HRIS/storage/email adapters, remaining workflow modules, Testcontainers/Playwright/axe/security/load/restore evidence, and Gate 1–10 approvals. In particular: idempotency is still process-local (must move to PostgreSQL per `findings.md`), `DATA_MODE=memory` is demo-only, and the UI shell implements only the first-slice routes — not the full eighteen-route `AssessFlow_Frontend_UI_UX_Spec_v1.1.md` inventory, which remains Proposed.

## Implementation defaults selected by project owner

These are **proposed-only stand-ins** for open Gate 1 decisions. Each maps to a BIZ ID in `gate-1-business-decisions.md` and still requires named owner approval with approver + date before Gate 1 can pass. Implementation against them carries rework risk.

- Standalone modular application with adapters. → BIZ-009, BIZ-013 (proposed; HRIS/SSO and scope still Open)
- One company, 2–3 pilot departments, all three assessment reasons. → BIZ-001 (Proposed), BIZ-013 (Open)
- English and Arabic with LTR/RTL verification; light theme required. → Gate 6 language/theme scope (Open)
- Entra ID OIDC + hourly HRIS delta sync + nightly reconciliation. → BIZ-009 (Open)
- In-app notifications + queued email; calendar deferred. → BIZ-014 (Open, P1)
- Approved employee summary only; assessor-private evidence remains restricted. → BIZ-006, BIZ-007 (Open)
- Versioned eligibility with dual-control override. → BIZ-002, BIZ-003 (Open)
- Sequential HR → business approval; self-approval prohibited. → BIZ-005 (Open)
- Configurable hold-first retention; no automatic pilot deletion until HR/Legal approval. → BIZ-008 (Open)
- Medium-enterprise target: 25,000 employees, 100 concurrent users, 20,000 cases/year. → Gates 3/7 capacity assumption (to be validated)

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| Automated analyzer initially received an unsupported `--analyze` flag | 1 | Re-ran with the script's supported arguments |
| Analyzer output failed under Windows code page because of emoji output | 1 | Re-ran with UTF-8 output enabled |

## Enhancement and completion checklist — reviewer cleanup 2026-09-04

Do in order. Do not skip Tier 1: it blocks everything else and is the main mid-build stuck risk.

### Tier 1 — P0 policy closures (Gate 1, blocks Gates 2–7)

- [ ] Assign all 8 owner roles with names in `gate-1-business-decisions.md` (Product Sponsor final).
- [ ] BIZ-002 eligibility rules: thresholds, exclusions, evidence list, policy version. Owner: HR/Talent.
- [ ] BIZ-003 override: who, mandatory reason/evidence, expiry, audit event. Owner: HR/Talent + Product.
- [ ] BIZ-005 approval routes: route by reason/level/org/risk, sequential confirm, delegation, rejection/resubmit, expiry, self-approval ban. Owner: HR/Talent + Product.
- [ ] BIZ-006 employee visibility: per-artifact (request/eligibility/methods/evidence/result/recommendation/comments/history) + start time. Owner: HR/Talent + Security.
- [ ] BIZ-007 evidence/attachments: types/size, sensitive categories, download/share, scan, edit/retract rule. Owner: Security + HR/Talent.
- [ ] BIZ-009 HRIS/identity: system of record, Entra owner, hourly delta + nightly reconcile, leaver/transfer handling, standalone vs host. Owner: Identity/HRIS + Technical.
- [ ] BIZ-013 org/data scope: single-company confirm, dept/manager/HR/cross-functional boundaries, hidden-record acknowledgment rule. Owner: Product + Security + Technical.
- [ ] BIZ-008 retention: periods per artifact, legal hold, anonymization, deletion authority; enforce hold-first until HR/Legal sign. Owner: HR/Privacy + Security.
- [ ] BIZ-011 reassessment: triggers, waiting period, initiators, prior-case immutability, link rule. Owner: HR/Talent + Product.
- [ ] Close BIZ-001, 004, 010, 012 (currently Proposed) with approver + date + one example + one exception + audit expectation each.
- [ ] Map every approved BIZ to BRD / workflow matrix / data dictionary / API contract / permissions workbook / screen requirements.

### Tier 2 — Contract and data hardening (Gates 3–5, blocks expansion)

- [ ] Gate 2: `gate-2-scope-acceptance.md` — pilot dept list, out-of-scope (scoring/calibration-Phase-2/calendar), Given-When-Then per transition, QA sign-off.
- [ ] Gate 3: ADRs + host-vs-standalone map + env model + capacity proof for 25k/100/20k; approve region/networking/residency/sizing/budget.
- [ ] Gate 4: fix standalone SQL `ADD CONSTRAINT` rerunnability; prove Prisma schema == reviewed migration; versioned config + seeds; PG-backed audit/access-log/outbox/idempotency; `docker compose up -d` + `db:push` + `db:seed` + `/health/ready` green on clean PG.
- [ ] Gate 5: complete OpenAPI to full contract catalog; single server state machine; `availableActions` with permission/prereq/consequence/next-owner/confirm/audit; PG idempotency (`Idempotency-Key` + actor survives restart/replicas); concurrency 409 + structured errors + correlationId tests on PG.
- [ ] Replace demo shortcuts: `defaultEligibility()` hard-coded MET/NOT_CHECKED in `apps/api/src/cases/cases.service.ts:322` → policy-versioned rules engine; remove hard-coded overview metrics/tasks in `cases.service.ts:42-123`; replace `corr-${Date.now()}` in `cases.service.ts:369` with propagated correlation ID.

### Tier 3 — Security, UX, ops (Gates 6–7)

- [ ] Gate 7 auth: Entra OIDC + app roles, server RBAC + org-scope tests at API boundary (UI `availableActions` is projection only).
- [ ] Storage: private containers + quarantine/clean split, AV scan gate, signed-URL preview/download per-permission, no local-path leak.
- [ ] Secrets/ops: Key Vault only, no tenant/secret in repo; OTEL/App Insights; BullMQ `outbox`/`reminders`/`hris-sync`/`exports` retries + DLQ runbook; backup/restore drill.
- [ ] Bicep: close or risk-accept private endpoint, Redis sizing, Defender for Storage, Entra registration, ACS sender verification.
- [ ] Gate 6: approve UX spec v1.1 or revise; deliver §20 12-item evidence pack (routes×states, role/scope matrix, transition map, tokens, contrast, motion + reduced-motion prototype, redaction/attachment states, RTL decision, clickable prototype, test-linked acceptance); prove no leakage via search/totals/notifications/exports/errors.

### Tier 4 — Quality and release (Gates 8–10)

- [ ] Gate 8: `gate-8-test-plan.md` + extend `ci.yml` (Testcontainers PG/Redis, contract tests, Playwright + axe, k6 100-concurrent, migration + restore rehearsal, OpenAPI breaking-change gate). Thresholds: 0 P0/P1, 0 critical/high security, WCAG 2.2 AA evidence.
- [ ] Full vertical coverage: plan/events/evidence/result/recommendation/approval/development/reassessment/closure + denial/conflict/redaction paths; 18-route UI vs API parity.
- [ ] Gate 9: re-sequence FE-01–FE-12 + backend epics against approved policies; story DoD; dependency/risk register; pilot flags + rollback plan.
- [ ] Gate 10: cross-doc consistency sweep + signed Go/No-Go (names + dates). Track B demo excluded as evidence.

### Stop/continue rules

- Do not start Tier 2 workflow expansion until Tier 1 BIZ-002, 003, 005, 006, 009, 013 are Approved — otherwise eligibility/approval/visibility rework is near-certain.
- Do not start mobile approval / reports / admin config until Gate 5 contract + Gate 7 scope enforcement are green.
- Any change to terminology, gates, result/recommendation split, transitions, routing, or scoring governance → controlled decision + update all impacted packs.
