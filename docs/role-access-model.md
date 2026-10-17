# AssessFlow role access model

Status: current implementation baseline, updated 2026-10-17 with the agreed access model (see below). Sign-in uses an AssessFlow email and password. System Admins create accounts only for `@saudigerman.com` addresses and assign application roles and data scopes inside the app. The company email suffix is an allow-list; it does not verify mailbox ownership. This document applies the selected local pilot roles and the approved employee-visibility and organization-scope baselines in `gate-1-business-decisions.md` (BIZ-006, BIZ-009, BIZ-013).

## Identity and role administration

- The API checks the email suffix and verifies the password hash for an active AssessFlow account.
- A company email by itself does not grant access. A System Admin must create or enable the account and set its initial password.
- Passwords are stored as scrypt hashes. The API issues a signed session token and reads roles and scopes from the account record.
- System Admin has full control over accounts, roles, scopes, cycle configuration, and workflow.
- Assessor operates the full assessment cycle across the organization. Assessors do not create accounts, change roles, or reset passwords.
- Sign-in locks an account for 15 minutes after 5 failed attempts (and an IP after 20). Changing a password requires the current password.
- New or unmatched company accounts receive no application access until an administrator adds them. Disabling or removing the AssessFlow account blocks sign-in.
- Roles and scopes must be loaded from trusted server-side storage for each request. Role values from browser storage, URL parameters, or client-supplied headers must never grant access.

## Implementation progress

- Added a persistent account record with a password hash, roles, scope, and active/disabled state.
- The access panel adds accounts with an initial password and can set passwords for existing accounts. Assessors cannot view, create, edit, disable, or remove System Admin accounts.
- The API rejects other email domains, signs local app sessions, and reloads role and scope data from the database. Department, direct-report employee-ID, assigned-case, and self scopes filter case lists and case-level routes.
- The local demo administrator remains available only on localhost to provision the first company account.
- The API has distinct Manager and Employee Manager scopes, a feedback-release flag, and a restricted employee results endpoint.

## Roles and scope

Agreed access model (2026-10-17): Admin and Assessor run the system; approvers decide their own step; managers raise requests for their team; everyone else reads within their scope.

| Role | Data scope | Can change | Read-only / restricted |
| --- | --- | --- | --- |
| System Admin | Organization-wide | Everything: accounts, roles, scopes, settings, and all workflow steps. Edits after a result is finalized go through reopen with a written reason (audited). | Cannot approve a case they scored, finalized, or recommended. |
| Assessor | Organization-wide assessment cycle | All case work: eligibility, planning, scheduling, scoring, evidence, result finalize and reopen (with reason), recommendation, development, reassessment, closure. | No account, role, or password management. **Never approves.** |
| HR (approver) | Organization or assigned departments | Decides the HR approval step. | Everything else read-only. Cannot approve a case they scored, finalized, or recommended, or both steps of one case. |
| Business Approver | Assigned cases plus cases waiting on the Business step | Decides the Business approval step. | Everything else read-only. Same segregation-of-duties rules as HR. |
| Manager (Requester) | Direct reports or assigned departments | Creates and submits assessment requests for people in their team only. | Read-only after submission. Sees results only after approval and feedback release. |
| Panel Lead | Assigned sessions | Enters scorecard and evidence **only** for sessions they are assigned to. | Everything else read-only. |
| Employee | Own record | Nothing. | Sees own result and development plan after approval and feedback release. |
| Coordinator, Manager (org-wide), Employee Manager, Auditor | Their configured scope | Nothing. | Read-only within scope. Employee Managers see results only after approval and release. |

## Access controls

Every account receives one or more approved role templates plus a data scope. Permissions are enforced at three points:

1. Navigation and pages hide unavailable areas and direct links.
2. Page actions show only commands permitted for the role and workflow stage.
3. API reads and writes enforce both the role and the record scope. Frontend hiding alone is not an access control.

Results reach employees, Employee Managers, and requesting managers only after final approval **and** after an Assessor or Admin releases the feedback (release is blocked before approval). Reopening a result hides it again. Case pages show only the actions the viewer's roles can run; read-only viewers see no workflow buttons. An assessor assignment is tied to the event, while an approver assignment is tied to a pending approval step.

## Implementation sequence

1. Use the app's role catalog for System Admin, HR, Manager, Assessor, Approver, and Employee; keep Auditor optional.
2. Resolve each signed-in AssessFlow account to its assigned roles and data scopes. The local browser demo session is only for first-time local setup.
3. Enforce role checks and record scoping in API list, detail, command, export, and attachment routes.
4. Add role-aware navigation and case-workspace actions, then add account/access management for administrators.
5. Validate allow and deny paths for every role, including direct links, search, counts, exports, and attachments.

## Data needed for row-level scope

- Employee identity must map to one `EmployeeReference` record using a trusted HRIS identifier; company email can be used only when the HRIS mapping is maintained reliably.
- Manager scope needs a stable manager-to-direct-report relationship from HRIS. `managerName` text alone is not a reliable authorization key.
- Assessor scope covers the organization-wide assessment cycle. Event assignments remain useful for scheduling and scorecard ownership, but do not limit an Assessor's cycle access.
- Approver scope uses pending approval-step assignments.

Until the trusted identity and relationship mappings are active, non-HR roles must not receive organization-wide case data. Local role previews, if enabled, are for UI review only and must be clearly marked as non-production.
