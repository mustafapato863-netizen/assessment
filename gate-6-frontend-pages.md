# AssessFlow Gate 6 — Frontend Pages (18-route implementation map)

**Status:** complete — English-only product decision recorded 2026-09-05 (Arabic copy, locale switch,
RTL branches removed; `<html lang="en" dir="ltr">`; RTL test deleted).
**Structure:** `apps/web/src/{app.tsx, main.tsx, routes/*.tsx, components/{shell,ui}.tsx, lib/{api,labels,flags}.ts, hooks/use-toast.ts, styles.css}`.
**Design authority:** `AssessFlow_Frontend_UI_UX_Spec_v1.1.md` + `AssessFlow_Design_System_v1.0/tokens/`
**Rule:** every command panel renders `availableActions` from the API; no client-side transition logic.

## Shared shell (all pages)

- Sidebar 264/72px, topbar 64/56px, content max 1600px; `PageHeading` (eyebrow/H1/subtitle/action), `panel` + `PanelHeader`, `StatusBadge` (color + icon + text, never color-only), `ErrorBanner`, `InlineError`, skeleton/loading/empty states, toast (`role=status`), reduced-motion via CSS media query, RTL via `document.dir`, Inter stack, 40/44px controls, 8/12/16px radii.
- Tokens: indigo `#4F46E5` primary, violet `#7C3AED` decision, teal progress accents (never white-on-teal-500), slate surfaces/text, semantic success/warning/danger/info.

| # | UX route | View in `app.tsx` | Primary action (API) | States covered |
|---|----------|-------------------|----------------------|----------------|
| UX-01 | `/assessflow` overview | `OverviewPage` | Open highest-priority task (`GET /overview`) | loading skeletons, error banner, empty tasks |
| UX-02 | `/assessflow/tasks` | `TasksPage` | Perform task (`GET /overview`, `GET /cases`) | loading rows, open count, empty |
| UX-03 | `/assessflow/notifications` | Notifications view (Q3) | Open related context | empty, read states |
| UX-04 | `/assessflow/cases` | `CasesPage` | Create/open (`GET /cases?search=`) | loading, error, empty, search |
| UX-05 | `/assessflow/cases/new` | `NewRequestDrawer` (dialog, Zod-validated) | Save draft (`POST /cases`) | validation summary + field errors, pending, server error |
| UX-06 | `/assessflow/cases/{id}` | `CasePage` header + stepper + context rail + activity | Server next action (`GET /cases/{id}`) | loading, error, conflict retry (409 message), version display |
| UX-07 | `…/eligibility` | `CasePage` decision panel + override panel | Decide/request override (`POST …/eligibility/decision`, `…/override-request`) | criteria table, reason-required, confirm, pending |
| UX-08 | `…/plan` | `CasePage` plan panel (Q2) | Finalize (`POST …/plan/finalize`, `GET …/plan`) | method select (CBI/Case Study/Roleplay), deviation, pending |
| UX-09 | `/assessflow/events` | Events view (Q3) | Open/schedule (`GET …/events`, `POST cases/{id}/events`) | list, schedule form, timezone shown |
| UX-10 | `/assessflow/events/{id}` | Event section in `CasePage` (Q2) | Save/reschedule | status, assessors, validation |
| UX-11 | `…/my-assessment` | Evidence panel (Q2) | Save/submit (`POST /events/{id}/evidence[/submit]`) | draft vs submitted, min-length, scan-pending note |
| UX-12 | `…/result` | Result panel (Q2) | Finalize/reopen (`POST …/result/finalize`, `…/result/reopen`) | result codes, revision note, reopen reason ≥10 |
| UX-13 | `…/decision` | Decision panel (Q2) | Submit/decide (`POST …/recommendation`, `POST /approval-steps/{id}/decision`, route preview) | mobile-usable approve/reject, comment, step list |
| UX-14 | `…/development` | Development panel (Q2) | Update/schedule reassessment (`POST …/development`, `POST …/reassessment`) | actions table, dates, linked-case chip |
| UX-15 | `/assessflow/employees/{id}/history` | Employees view (Q3) | Open permitted history (`GET /cases?search=`) | scope-denied message, redacted fields |
| UX-16 | `/assessflow/reports` | Insights view (Q3) | Filter/export if allowed (read-only aggregates) | export-hidden-when-unauthorized, empty |
| UX-17 | `/assessflow/admin/*` | Admin view (Q3) | Publish versioned change (read-only until Gate 7 RBAC) | permission-denied state |
| UX-18 | `/assessflow/calibration` | Hidden behind flag (spec §5.1) | Phase 2 only | not rendered in MVP |

## Implementation queue (agy, sequential)

- Q1: `api.ts` clients for all §13/§19 endpoints (this doc's Primary action column) + shared mutation helpers.
- Q2: `CasePage` stage panels UX-08–UX-14 (plan, events, evidence, result, decision, development) driven by `availableActions`.
- Q3: UX-03/UX-09/UX-15/UX-16/UX-17 views replacing `PlaceholderPage`; calibration stays hidden.

## Exit mapping (spec §23)

- Route×state matrix: table above; permission mapping follows `availableActions` + redaction notes per page.
- No-leak proof: search/totals/notifications filter server-side (`GET /cases`, `GET /tasks`, `GET /overview`); export absent when unauthorized.
- Scoring-disabled: no score control exists in any view; verified by grep in Q3 review.
- Contrast/motion/RTL evidence recorded in Gate 8 test plan.
