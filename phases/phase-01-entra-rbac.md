<task>
Phase 01 — Entra OIDC + endpoint RBAC (closes Gate 7 musts M1, M2). Repo: AssessFlow NestJS API
(`apps/api/src`) with stub identity (`x-actor-id`, default `demo-user`). Context: read
`../gate-7-security-ops.md`, `../docs/adr/ADR-002-host-vs-standalone.md`, `../gate-1-business-decisions.md`
(BIZ-009), `apps/api/src/cases/cases.controller.ts`, `apps/api/src/common/security.middleware.ts`.

Do:
1. Add Entra ID OIDC JWT verification behind env flags (`ENTRA_ISSUER_URL`, `ENTRA_CLIENT_ID`): when set,
   require + verify bearer tokens and derive `{ id, name, roles }` from claims; when unset, keep the current
   stub path unchanged (local dev must keep working with zero config).
2. Add a roles guard: map app roles (Requester, HR, Coordinator, Assessor, PanelLead, BusinessApprover,
   Admin, Auditor) to controller routes per `../AssessFlow_System_Design_Pack_v1.0/08_AssessFlow_Permissions_RACI_Matrix_v1.0.xlsx`
   (inspect with a script if needed); deny with structured 403 `{ error: { code: 'FORBIDDEN', … } }`.
   Zero new npm dependencies — hand-roll JWT claim checks with node:crypto, or reuse existing deps only.
3. Thread the verified actor (id/name/roles) into audit fields currently hardcoded as `demo-user`
   (repository `auditData`, decidedBy/createdBy/finalizedBy) via request context; keep `demo-user` fallback.
4. Unit tests (vitest, existing setup): auth on/off paths, role allow/deny matrix, actor propagation.

Do NOT touch: database schema/migrations, web UI, contracts, Bicep. Do NOT git add/commit.
</task>

<verification_loop>
`pnpm --filter @assessflow/api typecheck`, `pnpm --filter @assessflow/api test`,
`pnpm --filter @assessflow/api build` — all green. `git status` shows only intended files.
</verification_loop>

<structured_output_contract>
Report: (1) what changed and why, (2) files touched, (3) gate outcomes with counts,
(4) deviations, open items, decisions needed (esp. claim→role mapping assumptions).
</structured_output_contract>
