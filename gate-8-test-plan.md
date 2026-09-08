# AssessFlow Gate 8 — Test Strategy & Release Evidence

**Status:** complete with pilot-hardening backlog (see §5) — Approved 2026-09-04 (`admin`, QA)
**Owner:** QA + Technical (`admin`)

## 1. Thresholds (release bar)

- 0 P0/P1 defects open; 0 critical/high security findings; WCAG 2.2 AA evidence; every transition + denial path covered; migration + restore rehearsed.

## 2. Evidence present (2026-09-04)

| Layer | Evidence | Result |
|---|---|---|
| Unit | API vitest: 15/15 (5 journey/transition + 10 security/rate-limit); contracts 2/2 | PASS |
| Contract | zod schemas ↔ OpenAPI v1.1-implemented aligned; `pnpm typecheck` green all workspaces | PASS |
| API/live | Full PG journey create→close v11 + idempotent replay + stale-409 + reassessment link; `/health/ready` → postgresql | PASS |
| Web build | `tsc -b` + vite build green; prettier clean | PASS |
| Migration | `db:push` in-sync on fresh `asses_db`; dedup fix; seed green | PASS |
| Contrast | Spec-time pairs verified (indigo 6.29, violet 5.70, teal-700 5.47, slate-600 7.58; teal-500 banned for text) | PASS (static) |

## 3. Test data

- Seed: Demo Company + 3 employees (Product/Engineering/People); smoke cases from live proofs remain labeled in DB.

## 4. Denial/conflict coverage

- Unit: stale-version reject, invalid close, submitted-evidence immutability (server), self-transition guards.
- Live: 409 on stale close; 422 on bad input; PG idempotent replay returns stored response.

## 5. Pilot-hardening status (2026-09-05)

- H1 Playwright E2E: CLOSED — 8/8 green (journey smoke, 3 denial, 4 a11y).
- H2 axe/keyboard/zoom/reflow/RTL: CLOSED — axe critical/serious clean on workspace/decision/RTL views; one real `th` contrast failure fixed; touch targets verified ≥38px.
- H3 k6 load: PARTIAL — run executed (100 VUs, 0% errors) but p95 4,069ms misses the 3,000ms bar on single-node dev; capacity assumption NOT validated, remediation + staging re-run required (`docs/load-evidence.md`).
- H4 Testcontainers + OpenAPI break-gate: CLOSED — CI `integration-smoke` + `openapi-breaking-change` jobs added (25/25 route parity PASS locally).
- H5 Backup/restore drill: CLOSED with Gate 7 M4.

## Verdict

Development/UAT Go; production-pilot No-Go until H1–H5 close.
