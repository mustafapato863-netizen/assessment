# AssessFlow role access model

Status: current implementation baseline. Sign-in uses an AssessFlow email and password. Assessors and System Admins create accounts only for `@saudigerman.com` addresses and assign application roles and data scopes inside the app. The company email suffix is an allow-list; it does not verify mailbox ownership. This document applies the selected local pilot roles and the approved employee-visibility and organization-scope baselines in `gate-1-business-decisions.md` (BIZ-006, BIZ-009, BIZ-013).

## Identity and role administration

- The API checks the email suffix and verifies the password hash for an active AssessFlow account.
- A company email by itself does not grant access. An Assessor or System Admin must create or enable the account and set its initial password.
- Passwords are stored as scrypt hashes. The API issues a signed session token and reads roles and scopes from the account record.
- System Admin has full control over accounts, roles, scopes, cycle configuration, and workflow.
- Assessor manages company access for every account except System Admin accounts, and operates the full assessment cycle across the organization.
- New or unmatched company accounts receive no application access until an administrator adds them. Disabling or removing the AssessFlow account blocks sign-in.
- Roles and scopes must be loaded from trusted server-side storage for each request. Role values from browser storage, URL parameters, or client-supplied headers must never grant access.

## Implementation progress

- Added a persistent account record with a password hash, roles, scope, and active/disabled state.
- The access panel adds accounts with an initial password and can set passwords for existing accounts. Assessors cannot view, create, edit, disable, or remove System Admin accounts.
- The API rejects other email domains, signs local app sessions, and reloads role and scope data from the database. Department, direct-report employee-ID, assigned-case, and self scopes filter case lists and case-level routes.
- The local demo administrator remains available only on localhost to provision the first company account.
- The API has distinct Manager and Employee Manager scopes, a feedback-release flag, and a restricted employee results endpoint.

## Roles and scope

| Role                 | Data scope                                      | Allowed work                                                                                                                                                         | Restricted data/actions                                                            |
| -------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| System Admin         | Organization-wide                               | Full control of accounts, access scopes, system settings, and the assessment cycle                                                                                  | None                                                                               |
| HR                   | Organization or explicitly assigned departments | Create and review requests, decide eligibility, coordinate plans and sessions, route recommendations, monitor cycle progress, and view released results              | Raw assessor notes remain limited to authorized workflow participants              |
| Manager              | Entire organization                             | Read the full assessment cycle, cases, decisions, and progress                                                                                                       | Read-only; cannot manage accounts or change workflow decisions                     |
| Employee Manager     | Selected departments                            | Read cases, results, and follow-up for their departments after the Assessor releases feedback                                                                       | Hidden cases stay inaccessible; cannot change workflow or see assessor-only notes   |
| Assessor             | Organization-wide assessment cycle             | Create and edit cases, manage workflow stages, schedule sessions, enter scores and evidence, finalize or reopen results, manage development and closure, and manage non-admin access | Cannot view, create, or change System Admin access or system configuration        |
| Approver / Committee | Cases assigned in the approval route            | Review the decision packet and released evidence, approve, reject, or request changes                                                                                | Cannot edit assessment evidence or view unrelated cases                            |
| Employee             | Own employee record                             | View only their own assessment result after feedback is released                                                                                                    | No access to case details, other employees, or unreleased results                   |
| Auditor (optional)   | Explicit audit scope                            | Read audit trail and compliance evidence                                                                                                                             | Read-only; no workflow changes or private evidence unless separately authorized    |

## Access controls

Every account receives one or more approved role templates plus a data scope. Permissions are enforced at three points:

1. Navigation and pages hide unavailable areas and direct links.
2. Page actions show only commands permitted for the role and workflow stage.
3. API reads and writes enforce both the role and the record scope. Frontend hiding alone is not an access control.

Managers can read all cycle records. Employee Managers and employees only see records marked viewable by an Assessor after the result is finalized and the feedback conversation has happened. Reopening a result hides it again. An assessor assignment is tied to the event, while an approver assignment is tied to a pending approval step.

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
