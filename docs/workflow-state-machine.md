# AssessFlow Workflow State Machine (authoritative)

**Status:** Approved 2026-09-04 (`admin`, Gate 5)
**Authority:** The NestJS server is the single enforcer. The UI renders
`availableActions` only; it never invents transitions. Every command requires
`expectedVersion` (409 `CONCURRENCY_CONFLICT` on stale) and accepts
`Idempotency-Key` + `x-actor-id` (persisted in PostgreSQL `IdempotencyKey`).

## Transitions

| # | From | Command (endpoint) | To | Owner after | Audit event |
|---|------|--------------------|----|-------------|-------------|
| 1 | DRAFT | submit (`POST cases/:id/submit`) | PENDING_ELIGIBILITY / ELIGIBILITY | HR / Talent | CASE_SUBMITTED |
| 2 | PENDING_ELIGIBILITY, NOT_ELIGIBLE | decide eligibility (`POST cases/:id/eligibility/decision`, ELIGIBLE) | READY_FOR_PLANNING / PLANNING | Assessment Coordinator | ELIGIBILITY_APPROVED |
| 3 | PENDING_ELIGIBILITY, NOT_ELIGIBLE | decide eligibility (NOT_ELIGIBLE + reason) | NOT_ELIGIBLE / ELIGIBILITY | HR / Talent | ELIGIBILITY_REJECTED |
| 4 | NOT_ELIGIBLE | request override (`POST cases/:id/eligibility/override-request`) | PENDING_ELIGIBILITY / ELIGIBILITY | HR Governance | ELIGIBILITY_OVERRIDE_REQUESTED |
| 5 | READY_FOR_PLANNING | finalize plan (`POST cases/:id/plan/finalize`) | PLANNING / PLANNING | Assessment Coordinator | PLAN_FINALIZED |
| 6 | PLANNING, SCHEDULED | schedule event (`POST cases/:id/events`) | SCHEDULED / ASSESSMENT | Assessment Coordinator | EVENT_SCHEDULED |
| 7 | SCHEDULED | submit evidence (`POST events/:id/evidence/submit`) | IN_PROGRESS / ASSESSMENT | Assessor Panel | EVIDENCE_SUBMITTED |
| 8 | IN_PROGRESS | finalize result (`POST cases/:id/result/finalize`) | RESULT_FINALIZED / RESULT | Panel Lead | RESULT_FINALIZED |
| 9 | RESULT_FINALIZED | reopen result (`POST cases/:id/result/reopen` + reason ≥10) | IN_PROGRESS / ASSESSMENT | Panel Lead | RESULT_REOPENED |
| 10 | RESULT_FINALIZED, PENDING_RECOMMENDATION | submit recommendation (`POST cases/:id/recommendation`; creates HR seq1 + BUSINESS seq2) | PENDING_APPROVAL / APPROVAL | Business Approver | RECOMMENDATION_SUBMITTED |
| 11 | PENDING_APPROVAL | decide step (`POST approval-steps/:id/decision`, APPROVED × all) | APPROVED / APPROVAL | HR / Talent | APPROVAL_GRANTED |
| 12 | PENDING_APPROVAL | decide step (REJECTED / CHANGES_REQUESTED) | PENDING_RECOMMENDATION / RECOMMENDATION | Business Owner | APPROVAL_REJECTED / APPROVAL_CHANGES_REQUESTED |
| 13 | APPROVED, DEVELOPMENT_IN_PROGRESS | update development (`POST cases/:id/development`) | DEVELOPMENT_IN_PROGRESS / FOLLOW_UP | Manager | DEVELOPMENT_UPDATED |
| 14 | APPROVED, DEVELOPMENT_IN_PROGRESS, CLOSED | schedule reassessment (`POST cases/:id/reassessment` + reason ≥10; source immutable, new linked DRAFT) | (source unchanged) | Requester (new case) | REASSESSMENT_SCHEDULED |
| 15 | APPROVED, DEVELOPMENT_IN_PROGRESS | close (`POST cases/:id/close`) | CLOSED / CLOSED | HR / Talent | CASE_CLOSED |

## Invariants

- Scoring is disabled: no score field, validation, or metric may appear (`scoringEnabled=false`).
- Result, recommendation, approval, development, reassessment stay separate concepts and separate revisions.
- Self-approval prohibited; approval is sequential HR (seq 1) then Business (seq 2).
- Submitted evidence is immutable (edit rejected with `ALREADY_SUBMITTED`); supplements only.
- Every state-changing command writes one audit event and one outbox record in the same transaction.
- Demo-memory mode mirrors the status flow only; expansion reads and PG idempotency require database mode.
