# AssessFlow Gate 1 — Business Ownership and Decision Register

Status: in progress  
Started: 2026-08-10  
Purpose: close the business decisions and assign accountable owners before architecture, schema, API, UX, and implementation are treated as final.

## Gate rule

No application development starts while a P0 decision below is `Open`, `Proposed`, or `Blocked`. A decision becomes `Approved` only when an accountable owner and approver are named, the policy is written in plain language, and the impacted planning/system-design artifacts are identified for update.

## Owner roles to assign

Names are intentionally blank. Assign one accountable person per role; a role may have contributors, but it must have one final decision owner.

| Role | Accountable for | Required approval contribution | Assigned owner |
|---|---|---|---|
| Product Sponsor | MVP outcome, priority, pilot boundary, Go/No-Go | Final product trade-offs | `[Assign]` |
| Product/Business Owner | terminology, case reasons, closure definition, backlog acceptance | Business policy decisions | `[Assign]` |
| HR/Talent Policy Owner | eligibility, methods, results, recommendations, employee visibility, reassessment | Final HR policy approval | `[Assign]` |
| Technical Owner | host/platform boundary, implementation feasibility, workflow authority | Architecture and API impact | `[Assign]` |
| Identity/HRIS Owner | SSO, employee/role/department source, synchronization ownership | Identity and master-data approval | `[Assign]` |
| Security/Privacy Owner | access scope, evidence protection, retention, exports, audit | Security/privacy approval | `[Assign]` |
| QA Owner | acceptance criteria, critical-path test coverage, release evidence | Quality sign-off | `[Assign]` |
| Operations Owner | notifications, jobs, support, backups, restore, production runbook | Operational readiness | `[Assign]` |

## Decision register

`P0` blocks development. `P1` may be resolved during a later readiness gate only when it cannot change the MVP workflow or data boundary.

| ID | Priority | Decision requiring approval | Proposed baseline from current packs | Accountable owner | Approver(s) | Status |
|---|---:|---|---|---|---|---|
| BIZ-001 | P0 | MVP reasons and terminology | Reasons: Promotion, Internal Mobility, Role Realignment. Keep separate terms for Eligibility, Assessment Result, Business Recommendation, Approval, Closure, and Reassessment. | `[Assign]` | `[Assign]` | Proposed |
| BIZ-002 | P0 | Eligibility rules | Eligibility is a required gate before normal planning. The exact rules, thresholds, exclusions, and evidence must be explicitly listed; no undocumented policy may be inferred by the application. | `[Assign]` | `[HR/Talent]` | Open |
| BIZ-003 | P0 | Eligibility override | Define who may override an ineligible decision, mandatory reason/evidence, whether the override expires, and which audit event is created. | `[Assign]` | `[HR/Talent + Product]` | Open |
| BIZ-004 | P0 | Assessment method catalog | Use CBI, Case Study / Work Sample, and Roleplay. Define whether methods are selected by target level + role complexity + reason, whether multiple methods are allowed, and who can change a planned method. | `[Assign]` | `[HR/Talent]` | Proposed |
| BIZ-005 | P0 | Approval routes | Define route by reason, target level, organization/department, and risk. Confirm sequential versus parallel approval, delegation, rejection, resubmission, and approval expiry. | `[Assign]` | `[HR/Talent + Product]` | Open |
| BIZ-006 | P0 | Employee visibility | Define what employees can see: request, eligibility reason, planned methods/events, assessor evidence, result, recommendation, development plan, and approval comments. Define when visibility begins and what remains restricted. | `[Assign]` | `[HR/Talent + Security]` | Open |
| BIZ-007 | P0 | Evidence and attachment policy | Define allowed file types/size, sensitive evidence categories, download/share rules, scanning requirements, and whether an assessor can edit or retract evidence after submission. | `[Assign]` | `[Security + HR/Talent]` | Open |
| BIZ-008 | P0 | Retention and deletion | Define retention periods for cases, evidence, attachments, recommendations, approvals, access logs, and audit history. Define legal hold, anonymization, and deletion authority. | `[Assign]` | `[HR/Privacy + Security]` | Open |
| BIZ-009 | P0 | HRIS and identity ownership | Confirm system of record for employee, manager, role, level, department, and employment status. Confirm SSO owner, sync frequency, handling of leavers/transfers, and host-platform versus standalone ownership. | `[Assign]` | `[Identity/HRIS + Technical]` | Open |
| BIZ-010 | P0 | Closure definition | A case closes only after the required result, recommendation, approval outcome, required feedback, and follow-up ownership are complete. Confirm exceptions and who may reopen a closed case. | `[Assign]` | `[Product + HR/Talent]` | Proposed |
| BIZ-011 | P0 | Reassessment policy | Define triggers, minimum waiting period, allowed reasons, who initiates reassessment, whether the prior case is immutable, and how the new case links to the previous case. | `[Assign]` | `[HR/Talent + Product]` | Open |
| BIZ-012 | P1 | Scoring governance | Keep numeric scoring disabled for MVP. Confirm the owner and approval path for any future scoring profile, component, weighting, calibration, or score visibility. | `[Assign]` | `[HR/Talent + Product]` | Proposed |
| BIZ-013 | P0 | Organization and data scope | Confirm whether the MVP is single-company or organization-scoped. Define department, manager, HR, and cross-functional visibility boundaries. | `[Assign]` | `[Product + Security + Technical]` | Open |
| BIZ-014 | P1 | Notifications and SLA policy | Define required notifications, recipients, reminder timing, escalation, business calendar, and whether email/in-app delivery is MVP or host-platform owned. | `[Assign]` | `[Operations + Product]` | Open |

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
