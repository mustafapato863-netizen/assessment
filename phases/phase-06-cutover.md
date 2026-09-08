<task>
Phase 06 — UAT/pilot cutover (final production-Go evidence). Depends on Phases 01–05 landed. Context:
read `../gate-10-go-nogo.md`, `../gate-9-backlog.md` (Cutover + Risks), `../gate-7-security-ops.md`,
`../gate-8-test-plan.md`, `../task_plan.md` (all gates).

Do:
1. UAT seed refresh: script or documented procedure to reset `asses_db` to clean demo seed (Demo Company +
   3 employees, Product/Engineering/People) and purge all smoke/proof cases; verify counts after refresh.
2. Pilot flags + rollback rehearsal: feature-flag the calibration route OFF (verify hidden), document the
   expand/contract-only migration policy + rollback steps in `../docs/cutover-runbook.md` (new file),
   rehearse rollback on the local stack and log it.
3. Rotate dev credentials: replace the DEV-ONLY password `123456` with a generated secret across
   `docker-compose.yml`, `.env.example`, `packages/database/scripts/*.mjs`; re-provision + re-verify
   `/health/ready` (document that real deploys use Key Vault/secret store, never repo files).
4. Closeout checklist in `../docs/cutover-runbook.md`: M1–M4 + H1–H5 re-verified with dates, single-`admin`
   ownership re-split into named owners (leave names as `[Assign]` for the human), demo-data purge
   confirmed, Go/No-Go recommendation for production pilot with explicit residual risks.

Do NOT touch: workflow logic, UI behavior, contracts. Do NOT git add/commit.
</task>

<verification_loop>
`pnpm validate` green; runbooks saved; re-provisioned stack healthy. `git status` shows only intended files.
</verification_loop>

<structured_output_contract>
Report: (1) what changed and why, (2) files touched, (3) gate outcomes,
(4) Go/No-Go recommendation with residual risks.
</structured_output_contract>
