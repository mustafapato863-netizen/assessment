# AssessFlow Workflow State Machine (authoritative)

**Status:** Approved 2026-09-04 (`admin`, Gate 5). **Amended 2026-11-02** for the five-role model and the two-step approval route (HR Talent Manager, then Line Manager). See `docs/role-access-model.md`.
**Authority:** The NestJS server is the single enforcer. The UI renders
`availableActions` only; it never invents transitions. Every command requires
`expectedVersion` (409 `CONCURRENCY_CONFLICT` on stale) and accepts
`Idempotency-Key` + `x-actor-id` (persisted in PostgreSQL `IdempotencyKey`).

## Transitions

| # | From | Command (endpoint) | To | Owner after (2026-11-02) | Audit event |
|---|------|--------------------|----|--------------------------|-------------|
| 1 | DRAFT | submit (`POST cases/:id/submit`) | PENDING_ELIGIBILITY / ELIGIBILITY | HR Talent Manager | CASE_SUBMITTED |
| 2 | PENDING_ELIGIBILITY, NOT_ELIGIBLE | decide eligibility (`POST cases/:id/eligibility/decision`, ELIGIBLE) | READY_FOR_PLANNING / PLANNING | HR Talent Manager | ELIGIBILITY_APPROVED |
| 3 | PENDING_ELIGIBILITY, NOT_ELIGIBLE | decide eligibility (NOT_ELIGIBLE + reason) | NOT_ELIGIBLE / ELIGIBILITY | HR Talent Manager | ELIGIBILITY_REJECTED |
| 4 | NOT_ELIGIBLE | request override (`POST cases/:id/eligibility/override-request`) | PENDING_ELIGIBILITY / ELIGIBILITY | HR Governance (open question 5) | ELIGIBILITY_OVERRIDE_REQUESTED |
| 5 | READY_FOR_PLANNING | finalize plan (`POST cases/:id/plan/finalize`) | PLANNING / PLANNING | HR Talent Manager | PLAN_FINALIZED |
| 6 | PLANNING, SCHEDULED | schedule event (`POST cases/:id/events`) | SCHEDULED / ASSESSMENT | Admin (open question 1) | EVENT_SCHEDULED |
| 7 | SCHEDULED | submit evidence (`POST events/:id/evidence/submit`) | IN_PROGRESS / ASSESSMENT | Assessor | EVIDENCE_SUBMITTED |
| 8 | IN_PROGRESS | finalize result (`POST cases/:id/result/finalize`) | RESULT_FINALIZED / RESULT | HR Talent Manager | RESULT_FINALIZED |
| 9 | RESULT_FINALIZED | reopen result (`POST cases/:id/result/reopen` + reason ≥10) | IN_PROGRESS / ASSESSMENT | Admin (open question 2) | RESULT_REOPENED |
| 10 | RESULT_FINALIZED, PENDING_RECOMMENDATION | submit recommendation (`POST cases/:id/recommendation`; creates HR seq1 + LINE_MANAGER seq2) | PENDING_APPROVAL / APPROVAL | HR Talent Manager (step 1) | RECOMMENDATION_SUBMITTED |
| 11 | PENDING_APPROVAL | decide step (`POST approval-steps/:id/decision`, APPROVED × all) | APPROVED / APPROVAL | Line Manager (step 2, after the HR Talent Manager's step 1) | APPROVAL_GRANTED |
| 12 | PENDING_APPROVAL | decide step (REJECTED / CHANGES_REQUESTED) | PENDING_RECOMMENDATION / RECOMMENDATION | Assessor (proposes again) | APPROVAL_REJECTED / APPROVAL_CHANGES_REQUESTED |
| 13 | APPROVED, DEVELOPMENT_IN_PROGRESS | update development (`POST cases/:id/development`) | DEVELOPMENT_IN_PROGRESS / FOLLOW_UP | HR Talent Manager (Line Manager follows) | DEVELOPMENT_UPDATED |
| 14 | APPROVED, DEVELOPMENT_IN_PROGRESS, CLOSED | schedule reassessment (`POST cases/:id/reassessment` + reason ≥10; source immutable, new linked DRAFT) | (source unchanged) | Line Manager or HR Talent Manager (open question 3), new case | REASSESSMENT_SCHEDULED |
| 15 | APPROVED, DEVELOPMENT_IN_PROGRESS | close (`POST cases/:id/close`) | CLOSED / CLOSED | HR Talent Manager | CASE_CLOSED |

## Who may run each command (2026-11-02)

Admin can run every command. The list below shows the other roles that may run it. Segregation of duties applies to all approval commands.

| # | Roles that may run it |
|---|------------------------|
| 1 | Line Manager (raises the request for their team), Admin |
| 2, 3 | HR Talent Manager, Admin |
| 4 | HR Governance (open question 5), Admin |
| 5, 8 | HR Talent Manager, Admin |
| 6 | Admin (open question 1) |
| 7 | Assessor, for assigned cases and sessions only; Admin |
| 9 | Admin only, with a written reason (open question 2) |
| 10 | Assessor (proposes the recommendation), Admin |
| 11, step 1 | HR Talent Manager, Admin |
| 11, step 2 | Line Manager of the employee, Admin |
| 12 | The approver of the step that rejected or requested changes |
| 13 | HR Talent Manager, Admin |
| 14 | Line Manager or HR Talent Manager (open question 3), Admin |
| 15 | HR Talent Manager, Admin |

Approval segregation: nobody approves a case they scored, finalized, or recommended, and no one person approves both steps of one case.

## Invariants

- Scoring is disabled: no score field, validation, or metric may appear (`scoringEnabled=false`).
- Result, recommendation, approval, development, reassessment stay separate concepts and separate revisions.
- Self-approval prohibited. Approval is sequential: HR Talent Manager (seq 1), then the employee's Line Manager (seq 2). No one person approves both steps of one case.
- Submitted evidence is immutable (edit rejected with `ALREADY_SUBMITTED`); supplements only.
- Every state-changing command writes one audit event and one outbox record in the same transaction.
- Demo-memory mode mirrors the status flow only; expansion reads and PG idempotency require database mode.
