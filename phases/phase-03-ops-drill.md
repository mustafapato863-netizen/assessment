<task>
Phase 03 — Ops readiness: backup/restore drill, observability, retention job (closes Gate 7 must M4,
Gate 8 H5, backlog H-RET/H-OPS). Parallel-safe with Phases 01–02. Context: read
`../gate-7-security-ops.md` §§5–7, `../infra/bicep/README.md`, `../docker-compose.yml`,
`apps/worker/src/main.ts`, `packages/database/prisma/schema.prisma` (`RetentionPolicy`, `HrSyncBatch`,
outbox models), `../gate-1-business-decisions.md` (BIZ-008: cases 7yr, evidence 3yr, logs 1yr, audit
indefinite/anonymize 7yr, hold-first).

Do:
1. Backup/restore drill against the local Docker PG (`asses_db`, host port 5432 (real DB), dev password `123456`):
   pg_dump → drop → recreate → restore → app `/health/ready` → spot-check seed. Save the exact command
   transcript + timings to `../docs/ops-drill-log.md` (new file). Do NOT touch the host's own Postgres
   on port 5432.
2. Retention worker job: implement hold-first enforcement: skip categories under legal hold, soft-flag
   expired rows for review (no hard deletes in pilot); unit-test the policy math with fixed dates.
3. BullMQ DLQ/runbook: document retry + dead-letter handling per queue (`outbox`, `reminders`,
   `hris-sync`, `exports`) in `../docs/ops-runbook.md` (new file) matching the existing worker wiring;
   code only if a gap blocks the doc (small, tested).
4. Observability: wire OTEL exporter endpoint via env with safe no-op default; ensure every API error
   carries `correlationId` (already the shape — verify, don't refactor).

Do NOT touch: workflow logic, web UI, contracts, migrations. Do NOT git add/commit.
</task>

<verification_loop>
`pnpm typecheck`, `pnpm test`, `pnpm build` — all green, plus the drill transcript file. `git status`
shows only intended files.
</verification_loop>

<structured_output_contract>
Report: (1) what changed and why, (2) files touched, (3) gate outcomes + drill timings,
(4) deviations, open items, decisions needed.
</structured_output_contract>
