<task>
Phase 05 — Load validation + CI hardening (closes Gate 8 H3, H4; validates Gate 3 capacity assumption
25k employees / 100 concurrent / 20k cases-yr). Parallel-safe. Context: read `../gate-8-test-plan.md`,
`../gate-3-architecture.md` §Capacity, `../.github/workflows/ci.yml`,
`../AssessFlow_System_Design_Pack_v1.0/07_AssessFlow_OpenAPI_v1.1-implemented.yaml`.

Do:
1. k6 script (`apps/api/load/` new dir, git-tracked .js): ramp to 100 concurrent VUs exercising
   overview/list/detail/submit-eligibility reads + one write path with unique idempotency keys; thresholds
   on p95 latency + error rate. Run against local Docker stack; save summary to `../docs/load-evidence.md`.
   If k6 binary is unavailable on the machine, install per k6 docs or report precisely what's missing.
2. CI (`.github/workflows/ci.yml`, extend only): add jobs for (a) Testcontainers-based PG/Redis integration
   smoke if a suite exists, else a placeholder job that boots `docker-compose.yml` and hits `/health/ready`;
   (b) OpenAPI breaking-change check: fail the job if an endpoint documented in the v1.1 yaml is missing
   from the NestJS routes (implement as a small node script comparing yaml paths to a route listing).
3. Keep everything green: full `pnpm validate` must pass with your additions.

Do NOT touch: app behavior, web UI, migrations. Do NOT git add/commit.
</task>

<verification_loop>
`pnpm validate` green; k6 summary saved; CI yaml valid (`actionlint` if available, else careful YAML).
`git status` shows only intended files.
</verification_loop>

<structured_output_contract>
Report: (1) what changed and why, (2) files touched, (3) gate outcomes + load numbers,
(4) deviations, open items, decisions needed.
</structured_output_contract>
