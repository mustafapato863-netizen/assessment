<task>
Phase 02 — Attachment scan gate (closes Gate 7 must M3). Repo: AssessFlow (`apps/api/src`,
`apps/worker/src`, `packages/database/prisma/schema.prisma`). Context: read
`../gate-7-security-ops.md` §3, `../gate-1-business-decisions.md` (BIZ-007: PDF/DOC/JPG/PNG, 10MB max,
private storage, quarantine/clean, signed URLs), the `Attachment` model (`scanStatus`
PENDING→SCANNING→CLEAN/REJECTED/FAILED), `../docs/workflow-state-machine.md`.

Depends on Phase 01 for actor identity (fallback `demo-user` acceptable if 01 not landed: read actor the
same way the current code does).

Do:
1. Enforce upload validation in the API: type allow-list, 10MB cap, classification required; store metadata
   with `scanStatus=PENDING`. Add `POST /attachments` + `GET /attachments/:id` endpoints if missing (check
   the controller first; extend, don't duplicate).
2. Worker job `attachment-scan`: picks PENDING rows, marks SCANNING, runs a pluggable scanner interface with
   a local allow-list stub implementation, marks CLEAN or REJECTED+reason with `scannedAt`.
3. Gate reads: preview/download endpoints (or service methods) must refuse anything not CLEAN with
   structured 422 `SCAN_NOT_CLEAN`; wire permission check hooks for the Phase-01 roles.
4. Unit tests for validation matrix + gate behavior (vitest, existing setup). Document the real-scanner
   swap point + quarantine/clean container layout in `../infra/bicep/README.md` (append, don't rewrite).

Do NOT touch: workflow transitions, web UI, migrations (schema already supports this; if a column is
genuinely missing, stop and report instead of migrating). Do NOT git add/commit.
</task>

<verification_loop>
`pnpm typecheck`, `pnpm test`, `pnpm build` — all green. `git status` shows only intended files.
</verification_loop>

<structured_output_contract>
Report: (1) what changed and why, (2) files touched, (3) gate outcomes with counts,
(4) deviations, open items, decisions needed.
</structured_output_contract>
