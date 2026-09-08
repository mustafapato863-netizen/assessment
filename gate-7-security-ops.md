# AssessFlow Gate 7 — Security, Privacy & Operations

**Status:** complete with pre-pilot musts (see §7) — Approved 2026-09-04 (`admin`)
**Owner:** Security/Privacy + Operations + Technical (`admin`, single-owner pilot)

## 1. Authentication / SSO

- Local/dev: stub identity (`x-actor-id`, default `demo-user`); all actor fields traceable in audit.
- Production path (approved, not yet wired): Entra ID OIDC + app roles per ADR-002/BIZ-009.
- **Pre-pilot must M1:** wire Entra OIDC, replace stub, test login + role mapping.

## 2. Authorization & data scope

- Server enforces workflow transitions + version checks on every command; UI renders `availableActions` only.
- Org-scope filtering on list/overview/tasks queries (`organizationId`); employee search scoped.
- Real RBAC (role → permission check per endpoint) is stub-level in pilot.
- **Pre-pilot must M2:** endpoint-level RBAC tests against the permissions workbook before any production data.

## 3. Attachment security (BIZ-007)

- Allowed types PDF/DOC/JPG/PNG, 10MB max (policy); `Attachment.scanStatus` lifecycle PENDING → SCANNING → CLEAN/REJECTED/FAILED in schema.
- Scanner worker + quarantine/clean containers are defined in `infra/bicep` boundary and implemented via worker `attachment-scan` job with pluggable scanner interface.
- **Pre-pilot must M3 (CLOSED 2026-09-05):** implement scan gate blocking preview/download until CLEAN. Verified with 12 API/service gate tests and 9 worker scanner tests.

## 4. Transport & API hardening (verified live 2026-09-04)

- `apps/api/src/common/security.middleware.ts`: nosniff, DENY framing, no-referrer, locked permissions-policy, same-origin opener, HSTS in production.
- `x-correlation-id` echo/generate on every response (live: `corr-…` observed).
- In-memory 120 req/min/IP limiter on POST commands → structured 429 `RATE_LIMITED`; Redis-backed limiter noted as scaling follow-up.
- Unit suite: 10/10 security specs green.

## 5. Secrets & config

- No secrets in repo (`.env.example` only, local-only credentials); Key Vault boundary in Bicep; `.env` git-ignored.

## 6. Retention (BIZ-008)

- Approved: cases 7yr, evidence 3yr, logs 1yr, audit indefinite (anonymize 7yr), hold-first, no pilot auto-delete.
- Retention enforcement job is a Gate 9 hardening epic (worker queue `reminders` exists as boundary).

## 7. Backups, monitoring, ops

- Docker volumes for local PG/Redis; Azure backup/HA per Bicep baseline; OTEL service name set, exporter endpoint pending.
- **Pre-pilot must M4:** backup/restore drill evidence + App Insights wiring + BullMQ DLQ runbook walkthrough.

## Verdict

Pilot-development Go; production-pilot No-Go until M1–M4 close.
