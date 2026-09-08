# AssessFlow Phase Queue — Orchestrator Index

**Orchestrator/reviewer:** the coding agent (me). **Implementers:** models via `agy` relay or equivalent.
**Rule for every phase:** implementer edits the working tree and NEVER commits; orchestrator re-runs gates, reviews the diff, and lands it.

## Why phases exist

Gates 1–10 development scope is done (conditional Go, see `../gate-10-go-nogo.md`). What remains is the
production-pilot hardening queue (`../gate-9-backlog.md`). Each phase below is self-contained: a model with
no chat history can execute it using only the repo + the phase file.

## Dispatch (agy)

```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
node "<agy-skill-dir>/scripts/relay.mjs" --brief phases/<file>.md --cd "D:\Projects\Assessment workflow app" --model "gemini-3.8-flash-high" --dangerously-skip-permissions
```

`--dangerously-skip-permissions` is pre-approved by the repo owner for this queue. One phase per run, sequential.

## Order & dependencies

| # | Phase file | Musts closed | Depends on |
|---|-----------|--------------|------------|
| 1 | `phase-01-entra-rbac.md` | M1, M2 | — |
| 2 | `phase-02-attachment-scan.md` | M3 | 1 (actor identity) |
| 3 | `phase-03-ops-drill.md` | M4, H5, H-RET | — (parallel-safe with 1–2) |
| 4 | `phase-04-e2e-a11y.md` | H1, H2 | 1 (login + roles) |
| 5 | `phase-05-load-ci.md` | H3, H4 | — (parallel-safe) |
| 6 | `phase-06-cutover.md` | production Go | 1–5 |

## Reviewer gates (run before landing any phase)

```powershell
pnpm validate
```

Plus the phase's own evidence (live check, scan report, drill log). Update `../progress.md` + `../task_plan.md` on land.
Targets: real DB `asses_db` on host Postgres port 5432 (`postgres` superuser, DEV-ONLY password); Docker compose stack is the offline alternative (5433).
`/var/lib/postgresql`; dev password `123456` (DEV-ONLY, rotate before real deploy).
