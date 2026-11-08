# AssessFlow

AssessFlow is a standalone employee-assessment workflow platform for promotion, internal mobility, role realignment and external recruitment. Built for Saudi German Health.

## What is in the product today

- **Web app** (React + Vite, English, LTR): overview, My work, assessments, case workspace, employees, development, insights, calibration (9-box), administration, sign-in.
- **API** (NestJS, `/api/v1/assessflow`): the full case workflow, from request to closure:
  draft → submit → eligibility (with governance override) → plan → events → evidence → **scorecard** → result → recommendation → sequential HR Talent Manager → Line Manager approval → development → reassessment → closure.
- **Worker**: outbox, reminders, retention (hold-first), attachment scanning, HRIS sync and export queues on BullMQ/Redis, with a stub mode when Redis is absent.
- **Database**: PostgreSQL through Prisma, with migrations `0001`–`0007` and seed data.

### Assessment scoring

Assessors rate each scorecard criterion from **0 to 5**. Each dimension score is the weighted average rating, and the overall score blends Technical and Behavioral by their configured weights.

| Overall score | Result                 |
| ------------- | ---------------------- |
| 4.0 and above | READY_NOW              |
| 3.0 to 3.99   | READY_WITH_DEVELOPMENT |
| below 3.0     | NOT_READY              |

A **knockout** criterion rated below **2** by any assessor forces NOT_READY. Finalizing a result uses the computed code. The constants live in `packages/contracts/src/scorecard.ts`.

### Calibration (9-box)

- **Performance (x-axis):** Technical scorecard score. This is a proxy until annual performance ratings are imported.
- **Potential (y-axis):** Behavioral / leadership scorecard score.
- **Bands:** below 3 is low, 3 to 3.99 is medium, 4 and above is high.
- **Who is placed:** only candidates with a finalized result and a complete scorecard. Everyone else appears under _Not yet placed_ with the reason.
- **Who can view:** Admin, HR Talent Manager, Assessor (own cases only) and Executive (read-only). Each viewer sees only the cases in their own data scope.

### Access and approvals

- **Access model (approved 2026-11-02):** Admin runs the system and every workflow step; Assessor works only on assigned cases and sessions and never approves; HR Talent Manager decides step 1; the employee's Line Manager decides step 2 and raises requests for their team; Executive is read-only across the organization. Full matrix: `docs/role-access-model.md`.
- **Results** reach the Line Manager only after the HR step is approved. Employees do not sign in; the line manager communicates the result.

- **Sign-in:** company email and password (`@saudigerman.com` by default; see `ACCESS_ALLOWED_EMAIL_DOMAIN`). An Admin creates accounts and sets roles and data scope.
- **Lockout:** an account is locked for 15 minutes after 5 failed sign-ins, and an IP after 20.
- **Changing a password** requires the current password.
- **Server-side rules:** roles and data scope are enforced by the API. The UI only reflects `availableActions`.
- **Segregation of duties:**
  - Step 1 is decided by the HR Talent Manager or Admin, and step 2 by the employee's Line Manager or Admin.
  - The approver cannot be anyone who scored the candidate, finalized the result, submitted the recommendation, or decided the other step.
  - Assessors cannot approve.
- **Role task queues:** workflow tasks go to role queues (for example `hr-approver` or `business-approver`). Users with that role see the tasks within their scope.

## Run it locally (Windows)

1. Install Node.js 20+ and pnpm 10+, and start **Docker Desktop**.
2. Start PostgreSQL and Redis. The compose project name is pinned to `assessmentworkflow`, so the existing data volume is reused:

   ```text
   docker compose up -d postgres redis
   ```

3. Create `.env` from `.env.example` and point `DATABASE_URL` at your database. The Docker database listens on port **5433**.
4. Install dependencies and start everything:

   ```text
   pnpm install
   pnpm dev
   ```

5. Open http://localhost:5174. The API runs on `PORT` (default 8080 from `.env`).

Outside `pnpm dev`, the API refuses requests without a bearer token unless `DEV_AUTH_HEADERS=true` is set. Never set it in a shared or production environment.

To run without a database, set `DATA_MODE=memory`. This is a demo with a single all-roles user, and approval separation is not enforced in that mode.

### First-time database setup

```text
pnpm --filter @assessflow/database build
pnpm --filter @assessflow/database db:migrate:deploy
pnpm --filter @assessflow/database db:seed
```

Production migrations must be reviewed expand/contract migrations. Never roll back with destructive down migrations.

### First System Admin

Create the first admin once, after the database is migrated. Set the values in the same PowerShell session, so the password is not saved to a file:

```text
$env:BOOTSTRAP_ADMIN_EMAIL = 'you@saudigerman.com'
$env:BOOTSTRAP_ADMIN_PASSWORD = 'at least 12 characters'
pnpm bootstrap:admin
```

The email must end with `ACCESS_ALLOWED_EMAIL_DOMAIN` (default `saudigerman.com`). The command never changes an existing account, so running it twice is safe. Then sign in at http://localhost:5174 with that email and password. `BOOTSTRAP_ADMIN_NAME` sets the display name (default "System Administrator").

To reset the password of an existing System Admin, set the new password in `BOOTSTRAP_ADMIN_PASSWORD` and also set `BOOTSTRAP_ADMIN_RESET=true`, then run `pnpm bootstrap:admin` again. This works only for accounts that already have the Admin role. Restarting the API clears any temporary sign-in lock.

## Quality checks

```text
pnpm validate        # typecheck + unit tests + production build
pnpm --filter @assessflow/web exec playwright test   # browser E2E (needs the app running)
```

Read-only check of stored results against the current scoring formula:

```text
node scripts/audit-scorecard-results.mjs
```

## Configuration notes

| Variable                    | Purpose                                                                                                                                                                                                               |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV=production`       | **Required in any shared environment.** Without `DEV_AUTH_HEADERS=true`, requests without a valid bearer token get `401`.                                                                                             |
| `DEV_AUTH_HEADERS`          | `true` enables the header-based demo sign-in (`x-actor-id`, `x-actor-roles`) for local development only. Off by default, ignored when `NODE_ENV=production`. `pnpm dev` sets it to `true` unless you set it yourself. |
| `AUTH_JWT_SECRET`           | Required in production (32+ random characters). Locally a development fallback is used.                                                                                                                               |
| `TRUST_PROXY`               | Which proxies may set `X-Forwarded-For` (default: private networks). Use a hop count such as `1` behind a public load balancer.                                                                                       |
| `VITE_FEATURE_CALIBRATION`  | Shows the calibration module.                                                                                                                                                                                         |
| `ALLOW_ADMIN_SELF_APPROVAL` | `true` lets the System Admin run a case end-to-end alone (score, finalize, recommend, approve both steps). Each bypass is audited as `ADMIN_SELF_APPROVAL`. Set `false` before real use.                              |

## Workspace map

| Workspace            | Responsibility                                                         |
| -------------------- | ---------------------------------------------------------------------- |
| `apps/web`           | React SPA, routes, design system, role-aware UI                        |
| `apps/api`           | NestJS API, workflow commands, auth, permissions                       |
| `apps/worker`        | Background jobs: outbox, reminders, retention, scanning, sync, exports |
| `packages/contracts` | Zod schemas, shared types, scorecard calculation                       |
| `packages/database`  | Prisma schema, migrations, seed, client                                |
| `infra/bicep`        | Azure deployment baseline                                              |
| `docs/`              | ADRs, runbooks, role-access model, workflow state machine              |

## Known gaps

See `progress.md` for the latest session log. The main open items are:

- **Performance:** no pagination on case lists and the overview.
- **Duplicated workflow:** the logic exists twice, once in memory and once in Prisma.
- **Sign-in lockout:** counters are in memory, so they are per API instance.
- **Annual performance ratings:** not imported yet, so calibration uses a performance proxy.
- **E2E smoke journey:** still approves both steps as one user and needs two approver accounts.
