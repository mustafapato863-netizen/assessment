# AssessFlow

AssessFlow is a standalone employee-assessment workflow platform for promotion, internal mobility, and role realignment. This repository is the implementation foundation for the approved 9/10 delivery guide.

## Current delivery slice

The application currently includes:

- React/Vite bilingual shell with English/Arabic LTR/RTL switching.
- AssessFlow semantic design tokens, role-aware navigation, responsive cards, loading/error/empty states, and reduced-motion behavior.
- NestJS API under `/api/v1/assessflow`.
- Full workflow: create draft → submit → eligibility decision → governance override → plan finalize → event schedule → evidence draft/submit → result finalize/reopen → recommendation → sequential HR/Business approval → development → reassessment (linked draft) → closure.
- Version-checked commands, PG-backed idempotency (`Idempotency-Key`), and structured API errors.
- Prisma/PostgreSQL schema for the complete MVP domain, seed data, a reviewed baseline migration, and a database readiness endpoint.
- Prisma-backed first-slice commands for cases, eligibility, tasks, audit events, outbox records, and optimistic version checks.
- Worker boundary for outbox, reminders, HRIS sync, and export queues with BullMQ/Redis wiring and a no-infrastructure stub mode.

The demo defaults to `DATA_MODE=memory` so the UI can be reviewed without infrastructure. The same API boundary switches to the Prisma-backed first slice with `DATA_MODE=database` after PostgreSQL is running and seeded.

## Local start

1. Install Node.js 20+ and pnpm 10+.
2. Copy `.env.example` to `.env` and keep `DATA_MODE=memory` for the first run.
3. Install dependencies:

   ```text
   pnpm install
   ```

4. Start the API, web app, and worker:

   ```text
   pnpm dev
   ```

5. Open the Vite URL shown in the terminal. `pnpm dev` starts with `PORT` from `.env` (otherwise 3001) for the API and `WEB_PORT` (otherwise 5174) for the web app. If either port is occupied, it automatically searches the next 100 ports and prints the selected URLs. The web app uses a same-origin proxy connected to the selected API port, overriding `VITE_API_URL` for this development session. Health checks are available at `/health` and `/health/ready` on either server.

Set `WEB_PORT` and `PORT` in `.env` to prefer different ports. Set `DEV_AUTO_PORT=false` or run `pnpm dev --strict-ports` to fail when a preferred port is unavailable. Existing servers are left running. These options apply to the root `pnpm dev` command; production startup is unchanged. Port checks happen before startup; if another process takes the API port during startup, rerun `pnpm dev`.

## PostgreSQL mode

Start the local services with `docker compose up -d`, set `DATA_MODE=database`, then run:

```text
pnpm --filter @assessflow/database build
pnpm --filter @assessflow/database db:push
pnpm --filter @assessflow/database db:seed
pnpm dev
```

Production migrations must use reviewed expand/contract migrations. Do not use destructive down migrations as a production rollback strategy.

## Quality checks

```text
pnpm typecheck
pnpm test
pnpm build
pnpm validate
```

The release bar remains the plan's 9/10 target: no unresolved P0/P1 defects, no critical/high security findings, WCAG 2.2 AA evidence, workflow/permission coverage, migration and restore evidence, and a successful pilot.

## Workspace map

| Workspace                       | Responsibility                                                          |
| ------------------------------- | ----------------------------------------------------------------------- |
| `apps/web`                      | React SPA, routes, design system, localization, role-aware UI           |
| `apps/api`                      | NestJS modular API and authoritative workflow commands                  |
| `apps/worker`                   | Background job boundary for notifications, reminders, sync, and exports |
| `packages/contracts`            | Zod validation and stable shared API types                              |
| `packages/database`             | Prisma schema, migrations, seed data, and PostgreSQL client             |
| `infra/bicep`                   | Azure deployment boundary and operational notes                         |
| `AssessFlow_Design_System_v1.0` | Static design-system reference, not production runtime code             |

## Important implementation guardrails

- Numeric scoring and calibration are not part of the MVP path.
- Result, recommendation, approval, development, and reassessment remain separate domain concepts.
- Employee disclosure is limited to approved summary, approved recommendation, and development actions.
- Server-side permissions and transitions are authoritative; UI actions are only a projection of `availableActions`.
- Teal is not used as white text on light surfaces; semantic colors always include visible text or an icon.
