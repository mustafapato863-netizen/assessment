# AssessFlow Gate 9 — Delivery Backlog & Sequencing

**Status:** Approved 2026-09-04 (`admin`) — remaining work is pilot-hardening + production cutover.
**Traceability:** each epic → Gate/BIZ clause.

## Done (Gates 1–8)

| Epic | Scope | Gate |
|---|---|---|
| BE-01 | Full command catalog + reads, tx + version + audit + outbox, PG idempotency | Gate 5 |
| BE-02 | Security headers, correlation IDs, rate limiting + 15 API tests | Gate 7 |
| FE-01–FE-03 | Shell, overview, tasks, cases, request drawer, EN/AR RTL | Gate 6 |
| FE-04–FE-10 | Case stage panels (plan/events/evidence/result/decision/development) + employees/dev/insights/admin/notifications | Gate 6 |
| OPS-01 | Compose PG18/Redis on 5433, Bicep baseline, worker boundary | Gates 3–4 |

## Pilot-hardening & Cutover Status (Phases 01–06, 2026-09-05)

| Epic | Scope | Status | Evidence |
|---|---|---|---|
| H-SEC | Entra OIDC + endpoint RBAC tests (Gate 7 M1–M2) | CLOSED | `apps/api/src/auth/` (RS256/HS256, RolesGuard) |
| H-SCAN | Attachment scan gate + quarantine enforcement (M3) | CLOSED | `attachment-scan-gate.spec.ts` (12 specs pass) |
| H-OPS | Backup/restore drill + App Insights + DLQ runbook (M4/H5) | CLOSED | `docs/ops-runbook.md`, `docs/ops-drill-log.md` |
| H-E2E | Playwright journey + denial paths (H1) | CLOSED | `apps/web/e2e/` (8/8 Playwright specs pass) |
| H-A11Y | axe + keyboard/zoom/reflow/RTL evidence (H2) | CLOSED | `apps/web/e2e/a11y.spec.ts` (0 axe violations, RTL pass) |
| H-LOAD | k6 100-concurrent run (H3, validates capacity) | PARTIAL | 100 VUs / 0% errors, p95 4,069ms vs 3,000ms SLA (`docs/load-evidence.md`) |
| H-CI | Testcontainers suite + OpenAPI break-gate in CI (H4) | CLOSED | `.github/workflows/ci.yml`, `scripts/check-openapi-routes.mjs` |
| H-RET | Retention enforcement job (BIZ-008) | CLOSED | `apps/worker/src/retention/` (23 specs pass) |
| CUTOVER | UAT seed refresh, pilot flags, rollback drill, cred rotation | CLOSED | `docs/cutover-runbook.md`, `scripts/refresh-uat-seed.mjs`, `scripts/rehearse-rollback.mjs` |

## Cutover Outcomes (Phase 06)

- Pilot flags: calibration route hidden behind `PILOT_FLAGS.calibration` (defaults to OFF).
- Rollback: expand/contract policy documented and rehearsed live on local stack (1,033ms recovery, 0 data loss).
- Dev credentials: owner keeps DEV-ONLY `123456` until real upload (an unapproved rotation was reverted and scrubbed); stack re-provisioned and verified clean.
- Governance: single `admin` ownership re-split into 8 named roles with `[Assign]`.
- Clean seed: `asses_db` verified with Demo Company + 3 employees (Product/Engineering/People), 0 smoke/proof cases.

## Residual Risks (Tracked in `docs/cutover-runbook.md`)

- Single `admin` owner for all roles: re-split into 8 roles, names left as `[Assign]` for human designation.
- In-memory rate limiter: Redis-backed limiter recommended before multi-replica scale.
- H3 load capacity: staging re-run recommended on production-like compute before expanding past 50 concurrent users.
- Live Entra ID federation: production tenant handshake test required during onboarding.

