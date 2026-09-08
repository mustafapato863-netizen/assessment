# AssessFlow Gate 1 — Business Ownership and Decision Register

Status: complete
Started: 2026-08-10
Completed: 2026-09-04 (all 14 BIZ approved by `admin`; single-owner pilot risk accepted)
Purpose: close the business decisions and assign accountable owners before architecture, schema, API, UX, and implementation are treated as final.

## Gate rule

No gate passes while a P0 decision below is `Open`, `Proposed`, or `Blocked`. A decision becomes `Approved` only when an accountable owner and approver are named, the policy is written in plain language, and the impacted planning/system-design artifacts are identified for update.

Track B note (added 2026-09-04): owner-authorized early implementation against the proposed defaults in `task_plan.md` is permitted as demo-only evidence. It does not close Gate 1 and carries rework risk for BIZ-002, BIZ-003, BIZ-005–BIZ-009, BIZ-011, BIZ-013 until named owners approve with approver + date.

## Owner roles to assign

Names are intentionally blank. Assign one accountable person per role; a role may have contributors, but it must have one final decision owner.

| Role | Accountable for | Required approval contribution | Assigned owner |
|---|---|---|---|
| Product Sponsor | MVP outcome, priority, pilot boundary, Go/No-Go | Final product trade-offs | `admin` |
| Product/Business Owner | terminology, case reasons, closure definition, backlog acceptance | Business policy decisions | `admin` |
| HR/Talent Policy Owner | eligibility, methods, results, recommendations, employee visibility, reassessment | Final HR policy approval | `admin` |
| Technical Owner | host/platform boundary, implementation feasibility, workflow authority | Architecture and API impact | `admin` |
| Identity/HRIS Owner | SSO, employee/role/department source, synchronization ownership | Identity and master-data approval | `admin` |
| Security/Privacy Owner | access scope, evidence protection, retention, exports, audit | Security/privacy approval | `admin` |
| QA Owner | acceptance criteria, critical-path test coverage, release evidence | Quality sign-off | `admin` |
| Operations Owner | notifications, jobs, support, backups, restore, production runbook | Operational readiness | `admin` |

## Decision register

`P0` blocks development. `P1` may be resolved during a later readiness gate only when it cannot change the MVP workflow or data boundary.

| ID | Priority | Decision requiring approval | Proposed baseline from current packs | Accountable owner | Approver(s) | Status |
|---|---:|---|---|---|---|---|
| BIZ-001 | P0 | MVP reasons and terminology | Reasons: Promotion, Internal Mobility, Role Realignment. Eligibility, Assessment Result, Business Recommendation, Approval, Closure, and Reassessment stay separate terms. | `admin` | `admin` | Approved 2026-09-04 |
| BIZ-002 | P0 | Eligibility rules | Eligibility is a required gate before normal planning. Policy v2026.1 (approved 2026-09-04 by `admin`): TENURE 12mo in role, no active PIP/disciplinary, mandatory training complete, target position approved; training advisory, others blocking; no inferred rules. | `admin` | `admin` | Approved 2026-09-04 |
| BIZ-003 | P0 | Eligibility override | HR Governance only may override NOT_ELIGIBLE with written reason + evidence, 90-day expiry, `OVERRIDE_REQUESTED`/`OVERRIDE_APPROVED` audit. | `admin` | `admin` | Approved 2026-09-04 |
| BIZ-004 | P0 | Assessment method catalog | Methods: CBI, Case Study / Work Sample, Roleplay. Selected by target level + role complexity + reason; multiple allowed; change by Coordinator before evidence only. | `admin` | `admin` | Approved 2026-09-04 |
| BIZ-005 | P0 | Approval routes | Sequential HR → Business; no self-approval; delegation with audit; rejection → resubmit; 14-day expiry; route by reason/level/org/risk. | `admin` | `admin` | Approved 2026-09-04 |
| BIZ-006 | P0 | Employee visibility | Employee sees request, eligibility reason, methods/events, approved result/recommendation summary, development actions. No raw assessor/peer notes or routing comments. | `admin` | `admin` | Approved 2026-09-04 |
| BIZ-007 | P0 | Evidence and attachment policy | PDF/DOC/JPG/PNG max 10MB; private storage + scan/quarantine + signed URLs; no edit/retract after submit (supplement only). | `admin` | `admin` | Approved 2026-09-04 |
| BIZ-008 | P0 | Retention and deletion | Cases 7yr, evidence 3yr, logs 1yr, audit indefinite (anonymize after 7yr). Hold-first; no pilot auto-delete without HR/Legal. | `admin` | `admin` | Approved 2026-09-04 |
| BIZ-009 | P0 | HRIS and identity ownership | HRIS is system of record; Entra OIDC SSO; hourly delta + nightly reconcile; standalone app with adapters; leavers/transfers via sync. | `admin` | `admin` | Approved 2026-09-04 |
| BIZ-010 | P0 | Closure definition | Close after result + recommendation + approval + feedback ack + follow-up owner. Reopen by HR/Business with reason only. | `admin` | `admin` | Approved 2026-09-04 |
| BIZ-011 | P0 | Reassessment policy | Reassessment after 6mo minimum; employee/manager/HR trigger; prior case immutable; link via new case ID. | `admin` | `admin` | Approved 2026-09-04 |
| BIZ-012 | P1 | Scoring governance | `scoringEnabled=false` fixed for MVP. Future scoring needs HR/Talent + Product approval with validation evidence. | `admin` | `admin` | Approved 2026-09-04 |
| BIZ-013 | P0 | Organization and data scope | Single-company pilot, 2–3 departments; manager sees directs only; HR org-wide; cross-functional temp visibility with HR approval + expiry. | `admin` | `admin` | Approved 2026-09-04 |
| BIZ-014 | P1 | Notifications and SLA policy | In-app + queued email for eligibility/approval/overdue; calendar deferred; suppress in maintenance with queued redelivery. | `admin` | `admin` | Approved 2026-09-04 |

## Minimum approval evidence for each P0 decision

For each row, record:

1. The approved policy in one or two sentences.
2. The owner and approver names.
3. The affected source documents.
4. One example and one exception.
5. The audit/event expectation if the decision changes case state or access.

## Gate 1 exit checklist

- [ ] All owner roles have named accountable people.
- [ ] BIZ-001 through BIZ-014 have an owner, approver, and status.
- [ ] All P0 policies are approved or explicitly escalated to the Product Sponsor.
- [ ] Eligibility and approval route examples exist for the three MVP reasons.
- [ ] Employee visibility and evidence restrictions are approved by HR/Talent and Security.
- [ ] Retention and HRIS/SSO ownership are approved.
- [ ] Closure and reassessment definitions are approved.
- [ ] The approved decisions are mapped to the BRD, workflow matrix, data dictionary, API contract, permissions workbook, and UI requirements.
- [ ] `task_plan.md` and `progress.md` are updated before Gate 2 begins.

## What is needed from the project owner

Provide the names for the owner-role table and approve, edit, or reject the proposed baselines. The highest-impact first responses are: eligibility rules, approval routes, employee visibility, retention, HRIS/SSO ownership, closure, and reassessment.
