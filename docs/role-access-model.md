# AssessFlow role access model

Status: **target model approved 2026-11-02** (product owner: Ibrahim). It **supersedes the 2026-10-17 model** and replaces the 8 web roles and 11 API roles that the code currently uses. Until phases 2–4 in "Implementation impact" are done, the running code still implements the 2026-10-17 model.

Sign-in uses an AssessFlow email and password. System Admins create accounts only for `@saudigerman.com` addresses and assign roles and data scopes inside the app. The company email suffix is an allow-list; it does not verify mailbox ownership. This document applies the approved employee-visibility and approval-route decisions in `gate-1-business-decisions.md` (BIZ-005, BIZ-006, BIZ-013).

## Identity and role administration

- The API checks the email suffix and verifies the password hash for an active AssessFlow account.
- A company email by itself does not grant access. A System Admin must create or enable the account and set its initial password.
- Passwords are stored as scrypt hashes. The API issues a signed session token and reads roles and scopes from the account record.
- Only the Admin role manages accounts, roles, data scopes, and settings. No other role can change them.
- **Employees do not sign in.** There is no Employee role and no Employee account. The line manager communicates the result.
- Sign-in locks an account for 15 minutes after 5 failed attempts (and an IP after 20). Changing a password requires the current password.
- New or unmatched company accounts receive no application access until an administrator adds them. Disabling or removing the AssessFlow account blocks sign-in.
- Roles and scopes must be loaded from trusted server-side storage for each request. Role values from browser storage, URL parameters, or client-supplied headers must never grant access.

## Roles and scope (approved 2026-11-02)

| Role | Data scope | Can do | Cannot do / read-only |
| --- | --- | --- | --- |
| **Admin** | Organization-wide | Runs the cycle and the system: accounts, roles, scopes, settings, and every workflow step (request, eligibility, plan, scheduling, scoring, result finalize and reopen with a written reason, recommendation, development, closure, approvals). | Cannot approve a case they scored, finalized, or recommended. |
| **Assessor** | Only the cases and sessions assigned to them | Enters scorecards, evidence, and notes. Proposes a recommendation. | Never approves. No account management. Cannot see unassigned cases. |
| **HR Talent Manager** | Organization, or their assigned departments | Raises requests. Decides eligibility and the plan. Finalizes the result. Approves the HR step (step 1). Manages development plans. | No account or settings management. Cannot approve a case they scored or finalized. |
| **Line Manager** | Direct reports only | Raises requests for their own team. Approves the final step (step 2, after HR). Follows their team's development plans. | Read-only after submitting a request. Sees results only after the HR step is approved. |
| **Executive** | Organization-wide | Reads dashboards, insights, and calibration. Can open any case to read it. | **Read-only.** Changes nothing. |

Common rules:
- Nobody approves a case they scored, finalized, or recommended.
- No one person approves both steps of one case.

## Approval route (approved 2026-11-02, BIZ-005)

Two sequential steps:

1. **Step 1: HR Talent Manager.**
2. **Step 2: the employee's Line Manager**, after step 1 is approved.

The Business Approver step is removed. Rejection returns the case for resubmission. Delegation is audited, and the 14-day expiry and routing rules from BIZ-005 still apply. Segregation of duties applies to both steps.

The `ALLOW_ADMIN_SELF_APPROVAL` bypass is not part of this model. Under this model the Admin is bound by the same segregation rules as everyone else, so the bypass must be removed in phase 2.

## Page matrix (sidebar visibility)

✓ = visible. – = hidden.

| Page | Admin | Assessor | HR Talent Manager | Line Manager | Executive |
| --- | --- | --- | --- | --- | --- |
| Overview | ✓ | – | ✓ | – | ✓ |
| My work | ✓ | ✓ | ✓ | ✓ | – |
| My assessments | ✓ | ✓ | – | – | – |
| My team (new) | ✓ | – | – | ✓ | – |
| Assessments (all cases) | ✓ | – | ✓ | – | ✓ |
| Employees | ✓ | – | ✓ | – | ✓ |
| Development | ✓ | – | ✓ | ✓ (own team only) | ✓ |
| Insights | ✓ | – | ✓ | – | ✓ |
| Calibration | ✓ | ✓ (own cases only) | ✓ | – | ✓ |
| Administration | ✓ | – | – | – | – |

## Home page after sign-in

| Role | Home page |
| --- | --- |
| Admin | Overview |
| Assessor | My assessments |
| HR Talent Manager | Overview |
| Line Manager | My team |
| Executive | Insights |

## Migration of current roles

| Current role (API / web) | New role | Notes |
| --- | --- | --- |
| Admin / SYS_ADMIN | Admin | Same role. |
| Assessor / ASSESSOR | Assessor | Scope changes from organization-wide to assigned cases and sessions. |
| PanelLead / ASSESSOR | Assessor | Scope changes from assigned sessions to assigned cases and sessions. |
| HR / HR_ADMIN | HR Talent Manager | Scope changes to organization or assigned departments. |
| Coordinator / HR_ADMIN | HR Talent Manager | Coordinator duties move to HR Talent Manager. |
| Manager / MANAGER | Line Manager | Scope must be direct reports from HRIS (see "Data needed"). |
| Requester / DEV_LEAD | Line Manager | Scope must be direct reports from HRIS. |
| EmployeeManager / EMPLOYEE_MANAGER | Line Manager | Scope must be direct reports from HRIS. |
| BusinessApprover / APPROVER | Line Manager | Being a business approver does not make someone the employee's line manager. Scope is set from HRIS, not copied from the old role. Needs manual review. |
| Auditor / HR_ADMIN | Executive | Read-only. Audit-trail access beyond the Admin's Administration page is an open question. |
| Employee / EMPLOYEE | **Removed.** Account disabled, history kept. | Employees do not sign in. |

Migration must not grant organization-wide scope automatically. Every account needs an explicit scope from an administrator.

## Access controls

Every account receives one role plus a data scope. Permissions are enforced at three points:

1. Navigation and pages hide unavailable areas and direct links.
2. Page actions show only commands permitted for the role and workflow stage.
3. API reads and writes enforce both the role and the record scope. Frontend hiding alone is not an access control.

Results reach the Line Manager only after the HR step is approved. Reopening a result hides it again and requires a written reason. Case pages show only the actions the viewer's role can run. Read-only viewers, including the Executive and a Line Manager after submission, see no workflow buttons. An Assessor's access is tied to assigned cases and sessions. An approver's access is tied to a pending approval step.

## Implementation sequence

1. Replace the 11 API roles and 8 web roles with the 5 roles above, with a role catalog in one place.
2. Resolve each signed-in AssessFlow account to its single role and data scope. The local browser demo session is only for first-time local setup.
3. Enforce role checks and record scoping in API list, detail, command, export, and attachment routes, including the new Assessor assignment scope and the Line Manager direct-report scope.
4. Add the role-aware sidebar, home pages, and My team page, then add account and access management for administrators.
5. Validate allow and deny paths for every role, including direct links, search, counts, exports, and attachments.

## Data needed for row-level scope

- Employee identity must map to one `EmployeeReference` record using a trusted HRIS identifier; company email can be used only when the HRIS mapping is maintained reliably.
- Line Manager scope needs a stable manager-to-direct-report relationship from HRIS. `managerName` text alone is not a reliable authorization key.
- Assessor scope needs case and session assignments. An Assessor sees only what is assigned to them.
- HR Talent Manager scope needs an organization flag or a list of assigned departments.
- Approver scope uses pending approval-step assignments: HR step to the HR Talent Manager, and the final step to the employee's Line Manager.

Until the trusted identity and relationship mappings are active, non-HR roles must not receive organization-wide case data. Local role previews, if enabled, are for UI review only and must be clearly marked as non-production.

## Open questions

These were not decided in the 2026-11-02 approval. Resolve them before phase 2 locks the permissions.

1. **Scheduling events:** the page matrix gives scheduling to Admin only. Should the HR Talent Manager or Assessor schedule events?
2. **Reopening a result:** the role table gives reopen to Admin only. Should HR Talent Manager also reopen?
3. **Reassessment trigger:** who raises a reassessment, the Line Manager, the HR Talent Manager, or both?
4. **Employee acknowledgement:** with no employee sign-in, how is an acknowledgement recorded? Does the Line Manager record it?
5. **HR Governance:** BIZ-003 (eligibility override) names "HR Governance". Is that the HR Talent Manager?
6. **Audit trail:** the Auditor role is removed. Can the Executive read the audit trail, or only the Admin?
7. **Admin and the segregation rule:** confirm that the Admin's segregation rule has no exceptions.

## Implementation impact (phases 2–4, not started)

No code has been changed for this model yet. The files below use the current role names and must change.

**Phase 2: API roles, permissions, scopes, and approval route**
- `apps/api/src/auth/auth.types.ts`: `AppRole` union, `APP_ROLES`, and the `normalizeRole` aliases.
- `apps/api/src/auth/permissions.map.ts`: `ROUTE_PERMISSIONS`.
- `apps/api/src/auth/roles.guard.ts`: role and scope checks, and the admin-only check.
- `apps/api/src/auth/auth.middleware.ts`: the demo role list used only when `DEV_AUTH_HEADERS=true`.
- `apps/api/src/access/access-accounts.service.ts`: `SCOPES`, `normalizeAccountInput`, `ROLE_TASK_QUEUES`, and the Assessor-cannot-manage-Admin rule.
- `apps/api/src/access/access-accounts.controller.ts`.
- `apps/api/src/cases/domain/approvals.domain.ts`: `APPROVAL_STEP_ROLES` (`HR` and `BUSINESS`), `assertSegregationOfDuties`, and the `ALLOW_ADMIN_SELF_APPROVAL` bypass. The bypass must be removed.
- `apps/api/src/cases/prisma-cases.repository.ts`: approval steps are created as HR seq 1 and BUSINESS seq 2. Also the scope filters and the admin-only employee-name correction.
- `apps/api/src/cases/workflow-actions.ts`: `actionsForActor` and the role-based actions.
- `apps/api/src/cases/cases.controller.ts` and `apps/api/src/cases/cases.service.ts`: `@Roles` decorators.
- Tests that use the old roles: `apps/api/src/auth/roles.guard.spec.ts`, `apps/api/src/auth/auth.middleware.spec.ts`, `apps/api/src/auth/actor-propagation.spec.ts`, `apps/api/src/cases/domain/approvals.domain.spec.ts`, `apps/api/src/cases/workflow-actions.spec.ts`, `apps/api/src/cases/attachment-scan-gate.spec.ts`, `apps/api/src/common/correlation-error.spec.ts`, and `apps/api/src/cases/prisma-cases.repository.spec.ts`.

**Phase 3: account migration with a dry run**
- New script, for example `scripts/migrate-roles.mjs`, which must run with `--dry-run` by default and print each account's old roles, the new role, and whether it needs manual review (see the BusinessApprover and Manager rows above).
- `packages/database/prisma/schema.prisma`: `AccessAccount.roles` is a `String[]`, so the migration is data-only. No schema change is expected, but confirm.
- `packages/database/prisma/seed.mjs`: demo accounts and assignee roles (for example `assessor-nadia`) must use the new roles.

**Phase 4: web sidebar, home pages, and My team**
- `apps/web/src/lib/auth.ts`: the `AppUser` role union and the `roleMap` in `login()`.
- `apps/web/src/lib/api.ts`: the `AppRole` type and role lists.
- `apps/web/src/app.tsx`: `RoleGate` role lists on every route (for example `/tasks`, `/assessments`, `/cases`, `/calibration`, `/admin`).
- `apps/web/src/components/shell.tsx`: sidebar role checks and the calibration condition. Add the home page per role and the new My team item.
- New My team page (route and component) for the Line Manager.
- `apps/web/src/routes/administration.tsx` and `apps/web/src/routes/access-accounts-panel.tsx`: role option lists and scope logic.
- `apps/web/src/routes/new-request.tsx`: role references.
- `apps/web/src/routes/login.tsx`: role display, if any.
- `apps/web/src/routes/calibration-view/calibrationLogic.test.ts` and `apps/web/src/routes/insights-logic.test.ts`: test data with the old roles.
- `apps/web/e2e/*`: not inspected for role names yet. Check before phase 4.

## Documents that define roles and were updated or flagged

- `docs/workflow-state-machine.md`: owner and actor columns, approval invariant (amended 2026-11-02).
- `gate-1-business-decisions.md`: BIZ-004, BIZ-005, BIZ-006, BIZ-010, BIZ-011, BIZ-013 (amended 2026-11-02).
- `gate-2-scope-acceptance.md`: approval route and actor names (amended 2026-11-02).
- `gate-3-architecture.md`: pilot boundary line (amended 2026-11-02).
- `README.md`: calibration viewers, access model, and approval steps.
- `AssessFlow_Frontend_UI_UX_Spec_v1.1.md`, section 8: role and visibility table (amended 2026-11-02).
- `phases/phase-01-entra-rbac.md`: role list for the RBAC task (amended 2026-11-02).
- `progress.md`: a dated 2026-11-02 entry was appended. Older entries are not changed.
- Flagged, not changed: `docs/ops-drill-log.md` (historical evidence), `AssessFlow_Planning_Pack_v1.0/README.md` (frozen v1.0), and the permissions RACI matrix in `AssessFlow_System_Design_Pack_v1.0/` (an `.xlsx` file that must be updated in phase 2).
- Conflict resolved: the UI spec's old Admin row said the Admin role alone does not grant unrestricted case access. The 2026-11-02 model gives Admin every workflow step, so the new model wins and the UI spec row was updated.
