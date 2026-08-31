# AssessFlow Frontend UI/UX Specification

**Document code:** AF-UX-002  
**Version:** 1.1 Proposed  
**Date:** 18 August 2026  
**Purpose:** Gate 6 design baseline before application development  
**Status:** Proposed; not approved for development  
**Required approvers:** Product, HR/Talent, UX, Technical, Security, Accessibility/QA

## 1. Scope and authority

This specification upgrades the existing screen requirements, low-fidelity wireframes, design-system reference, and workflow simulator into one implementation-ready frontend baseline.

It does not authorize application development. Gate 1 policy decisions, Gates 3–5 architecture/data/API contracts, and the final Gate 10 Go/No-Go review remain mandatory.

The server is authoritative for workflow transitions, permissions, organization scope, concurrency, and audit. The frontend explains and presents those decisions; it does not recreate them as a separate business-rule engine.

## 2. Source baseline and resolved inconsistencies

The specification reads together:

- `AssessFlow_Planning_Pack_v1.0/02_AssessFlow_Workflow_Status_Matrix_v1.0.docx`
- `AssessFlow_Planning_Pack_v1.0/04_AssessFlow_Screen_Requirements_v1.0.docx`
- `AssessFlow_System_Design_Pack_v1.0/08_AssessFlow_Permissions_RACI_Matrix_v1.0.xlsx`
- `AssessFlow_System_Design_Pack_v1.0/09_AssessFlow_UI_Wireframes_v1.0.docx`
- `AssessFlow_Design_System_v1.0/`
- `task_plan.md`, `findings.md`, and `gate-1-business-decisions.md`

The older screen specification names violet `#7C3AED` as the primary color, while the newer design tokens use indigo `#4F46E5` as the primary and violet as the accent. This v1.1 proposal resolves the conflict as follows:

- Indigo `#4F46E5` is the primary interaction color.
- Violet `#7C3AED` identifies decisions, recommendation, approval, and branded emphasis.
- Teal `#14B8A6` indicates progress and supporting accent, but teal 500 is not used behind white normal-size text.
- Slate colors remain the dominant enterprise surfaces and text.

This resolution is proposed and requires Gate 6 approval.

## 3. Global-system comparison

The comparison identifies proven product patterns without copying any vendor's branding or page composition.

| System | Strong pattern | AssessFlow adoption | What not to copy |
|---|---|---|---|
| Workday Talent Optimization | Manager insight hub and connected talent context | Role-aware home combining tasks, deadlines, and a few actionable metrics | A broad HCM mega-navigation for the smaller MVP |
| SAP SuccessFactors | Continuous workflow, calibration, permission-controlled quick actions, tabbed workspaces | Persistent case context, full-width evidence writing, mobile approval actions, explicit role gates | Dense legacy configuration exposure in everyday screens |
| Oracle Talent Management | Unified data/security model and targeted manager guidance | One employee/case summary and a clear “next action” contract | Generic AI guidance without source, permission, or policy context |
| Lattice | Guided reviews, persistent breadcrumbs, full-screen detail, history, configurable visibility | Focused case-detail route, visible progress/history, policy-driven feedback disclosure | Treating assessment as a single review form |
| Culture Amp | Clear separation between performance, development, and calibration | Separate result, recommendation, development, and reassessment modules | Mixing development follow-up into outcome reporting |

### Adopted cross-system principles

1. Show the user's next task before analytics.
2. Keep case identity, stage, owner, due date, and confidentiality visible.
3. Keep result, recommendation, approval, development, and reassessment separate.
4. Explain unavailable actions instead of relying on disabled buttons.
5. Keep history and policy context close to the decision.
6. Support short mobile workflows for approvals, comments, task checks, and uploads.
7. Reserve calibration as a feature-gated post-MVP workspace, while designing result data so it can be added without restructuring the case page.

## 4. Product experience principles

### 4.1 Calm enterprise clarity

- Neutral surfaces carry most content.
- Color identifies hierarchy, state, or meaning; it is not decoration.
- One page has one dominant action and no more than one attention-leading animation.
- Cards group related information; they are not containers around every line of content.

### 4.2 Decision confidence

Every sensitive decision view must answer:

- What case and employee am I acting on?
- What stage and status is active?
- What evidence or policy supports the action?
- Do I have permission and scope?
- What changes after confirmation?
- Who receives the next task?
- What audit event will be recorded?

### 4.3 Progressive disclosure

- Default views show current context and required work.
- Secondary metadata, policy details, and history remain available without obscuring the task.
- Sensitive information is hidden by permission and replaced by a clear restricted-state explanation where disclosure of its existence is allowed.

### 4.4 Human judgment in MVP

- Numeric scoring controls remain absent when `scoringEnabled=false`.
- No placeholder, hidden field, chart, validation rule, or calculated metric may imply a score.
- Result options always use visible labels and guidance; recommendation and approval remain separate stages.

## 5. Information architecture

### 5.1 Production navigation

| Group | Destination | Visibility |
|---|---|---|
| Home | Overview | All authorized users; role-specific content |
| My Work | Tasks, Notifications, Upcoming Events | All authorized users |
| Assessments | Cases, Eligibility Queue, Planning Queue, Calendar, Result Queue, Approval Inbox | Permission-controlled |
| Employees | Employee Assessment History | Scope- and visibility-controlled |
| Development | Development Plans, Reassessment Queue | Permission-controlled |
| Insights | Operational Reports | HR/leadership/report permission |
| Administration | Configuration, Users/Roles, Audit Logs | Admin/governance permission |

`Design System` and `Component Library` are documentation destinations and must not appear in the production user's navigation.

Calibration is hidden behind a feature flag until the Phase 2 policy and data contract are approved.

### 5.2 Global shell

- Collapsible sidebar: 264 px expanded, 72 px compact on desktop.
- Top bar: 64 px desktop, 56 px mobile.
- Main content: maximum readable width 1600 px; data tables may use the full available width.
- Breadcrumbs appear below the top bar on detail and nested administration routes.
- Global search returns only entities the current user is permitted to know exist.
- Notifications and task counts must be server-scoped; hidden cases must not leak through totals.

## 6. Route and screen inventory

| ID | Route | Screen | MVP | Primary action |
|---|---|---|---|---|
| UX-01 | `/assessflow` | Role-aware overview | Yes | Open highest-priority task |
| UX-02 | `/assessflow/tasks` | My Tasks | Yes | Perform selected task |
| UX-03 | `/assessflow/notifications` | Notifications | Yes | Open related authorized context |
| UX-04 | `/assessflow/cases` | Assessment case list | Yes | Create request or open case |
| UX-05 | `/assessflow/cases/new` | Create request | Yes | Save draft / submit |
| UX-06 | `/assessflow/cases/{id}` | Case overview | Yes | Server-provided next action |
| UX-07 | `/assessflow/cases/{id}/eligibility` | Eligibility review | Yes | Record eligibility decision |
| UX-08 | `/assessflow/cases/{id}/plan` | Assessment plan | Yes | Finalize plan |
| UX-09 | `/assessflow/events` | Calendar and event list | Yes | Open or schedule event |
| UX-10 | `/assessflow/events/{id}` | Event management | Yes | Save/schedule/reschedule |
| UX-11 | `/assessflow/events/{id}/my-assessment` | Assessor evidence workspace | Yes | Save or submit evidence |
| UX-12 | `/assessflow/cases/{id}/result` | Result finalization | Yes | Finalize result |
| UX-13 | `/assessflow/cases/{id}/decision` | Recommendation and approval | Yes | Submit or decide |
| UX-14 | `/assessflow/cases/{id}/development` | Development and reassessment | Yes | Update action / schedule reassessment |
| UX-15 | `/assessflow/employees/{id}/history` | Employee assessment history | Yes | Open permitted historical case |
| UX-16 | `/assessflow/reports` | Operational reports | Baseline | Apply filter / export if allowed |
| UX-17 | `/assessflow/admin/*` | Controlled configuration | Baseline | Publish versioned change |
| UX-18 | `/assessflow/calibration` | Calibration workspace | Phase 2 | Review calibrated outcomes |

## 7. Page templates

### 7.1 Home and queue template

Order of content:

1. Greeting and scope label.
2. Urgent task strip with owner, SLA, and direct action.
3. Four maximum KPI cards; additional metrics move below the fold.
4. Task queue or upcoming events.
5. Operational charts and recent activity.

KPI cards must show label, value, context, trend meaning, icon, and click-through filter. Trend color is based on business desirability, not mathematical sign. For example, lower overdue cases is success while lower completion rate is danger. Each metric contract must declare `higherIsBetter`, `lowerIsBetter`, or `targetRange`.

### 7.2 List and table template

- Page title, short purpose, and primary action.
- Summary counts that act as filters, not decorative cards.
- Search and high-value filters visible; advanced filters in a drawer.
- Active filters shown as removable chips with “Clear all”.
- Table uses a sticky header, server pagination, column preferences, row action menu, and an accessible table caption.
- On mobile, essential columns become stacked result cards; actions remain in a labeled menu.
- Export is absent when unauthorized, not merely disabled.

### 7.3 Case workspace template

The case page is the primary product workspace:

1. **Sticky case header:** case code, employee, reason, target, stage, status, current owner, due date, and confidentiality marker.
2. **Stage navigator:** Request → Eligibility → Plan → Evidence → Result → Recommendation → Approval → Closure. Development/Reassessment appears as a conditional branch after approval.
3. **Next-action panel:** command label, permission, prerequisites, consequences, next owner, and audit event supplied by the API.
4. **Main workspace:** current stage content using tabs only for stable sibling information.
5. **Context rail:** tasks, SLA, attachments, policy version, and recent activity. It collapses below content on tablet/mobile.
6. **Activity drawer:** full audit timeline without navigating away from unsaved work.

The header and navigator show result, recommendation, and approval as independent states. A finalized result must never visually imply an approved promotion or move.

### 7.4 Long-form workspace

Evidence, result, recommendation, and configuration forms use a full-width editor with:

- section navigation;
- autosave indicator where the API supports drafts;
- explicit manual Save Draft;
- unsaved-change protection;
- character guidance rather than arbitrary low limits;
- a sticky action footer on desktop and mobile;
- no modal for substantial authoring.

## 8. Role and visibility contract

This matrix is a UI baseline; the permissions workbook and API scope remain authoritative.

| Role | Default home | Allowed context | Protected behavior |
|---|---|---|---|
| Employee | Development actions and disclosed feedback | Own permitted history, assigned actions, reassessment dates | Independent evidence, private notes, routing comments, and undisclosed result are hidden |
| Requester / Manager | Team requests, tasks, and follow-up | Scoped direct/indirect reports according to policy | Cannot view assessor-private evidence or approve own request unless policy allows |
| HR / Talent Reviewer | Eligibility queue and policy exceptions | Assigned organization scope | Override controls require separate permission and reason |
| Assessment Coordinator | Plans, events, and missing inputs | Assigned cases/events | Cannot finalize result unless separately granted |
| Assessor | Assigned events and evidence drafts | Minimum employee/target context required for assessment | Cannot see peer submissions before independent submission unless policy explicitly permits |
| Panel Lead / Result Finalizer | Evidence readiness and result queue | Consolidated authorized evidence | Reopen requires separate permission, reason, and revision warning |
| Business Owner / Approver | Approval inbox and decision snapshot | Result summary, recommendation, route, relevant policy | No unrelated employee relations or private assessor content |
| Administrator / Governance | Versioned configuration and audit operations | Configuration metadata; evidence only by explicit separate permission | Admin role alone does not grant unrestricted case/evidence access |
| Auditor | Audit/access/export history | Read-only records within audit mandate | No workflow command controls |

Every hidden or read-only field must distinguish among: not applicable, not yet available, hidden by policy, outside organization scope, and insufficient permission.

## 9. UI state contract

Every route and reusable component requires approved examples for these states:

| State | Required behavior |
|---|---|
| Initial loading | Layout-matched skeleton; reserve final dimensions; announce loading text once |
| Background refresh | Keep current content; use a small inline progress cue; never blank the page |
| Empty | Explain why it is empty and show an authorized next step |
| No search result | Preserve filters; suggest clearing or changing filters |
| Recoverable error | Preserve user input; state what failed and provide retry |
| Validation error | Summary at top plus field-level message; focus the summary on submit |
| Permission denied | Explain missing access without leaking protected data; provide safe navigation |
| Scope denied | State that the record is outside the current business scope if disclosure is permitted |
| Conflict / stale version | Show what changed, refresh server state, and require deliberate retry or merge |
| Sensitive content | Use classified placeholder, visibility reason, and access-request guidance where permitted |
| Attachment validating | Show filename, size, type validation, progress, and cancel |
| Attachment scanning | Block preview/download; show “Security scan in progress” |
| Attachment rejected | Explain allowed type/size or security rejection without exposing scanner internals |
| Partial data | Identify unavailable integration data and whether the workflow can proceed |
| Long-running command | Preserve context, show progress or queued state, and prevent duplicate submission |
| Success | Confirm the action, resulting status, next owner, and audit/event reference where useful |

Disabled buttons may be used for temporarily incomplete local forms, but workflow commands denied by server policy should be absent or accompanied by an explicit explanation. A tooltip alone is not sufficient for critical explanations.

## 10. Color system

### 10.1 Raw palette

The existing token file remains the raw palette source.

The proposed semantic handoff is stored in `AssessFlow_Design_System_v1.0/tokens/proposed-production-tokens-v1.1.json`. It is design documentation only until Gate 6 and Gate 10 pass.

| Family | Core values | Purpose |
|---|---|---|
| Indigo | `#EEF2FF` to `#312E81`; primary `#4F46E5` | Primary actions, active navigation, focus hierarchy |
| Teal | `#F0FDFA` to `#0F766E`; accent `#14B8A6` | Progress, supporting highlight, completion bridge |
| Violet | `#8B5CF6`, `#7C3AED` | Decision/approval identity and brand emphasis |
| Slate | `#FFFFFF`, `#F8FAFC` to `#0F172A` | Canvas, surfaces, borders, text |
| Success | `#F0FDF4`, `#DCFCE7`, `#16A34A`, `#166534` | Completed/approved/positive health |
| Warning | `#FFFBEB`, `#FEF3C7`, `#D97706`, `#92400E` | Due soon, pending, needs attention |
| Danger | `#FEF2F2`, `#FEE2E2`, `#DC2626`, `#991B1B` | Failure, rejected, overdue, destructive |
| Info | `#EFF6FF`, `#DBEAFE`, `#2563EB`, `#1E40AF` | Informational and active processing states |

### 10.2 Required semantic aliases

| Alias | Light value | Usage |
|---|---|---|
| `surface.canvas` | `#F8FAFC` | App background |
| `surface.default` | `#FFFFFF` | Primary panels |
| `surface.subtle` | `#F1F5F9` | Grouped secondary regions |
| `surface.brand.soft` | `#EEF2FF` | Selected/brand context |
| `text.primary` | `#0F172A` | Primary text |
| `text.secondary` | `#475569` | Supporting text |
| `text.muted` | `#64748B` | Metadata only; verify size/contrast |
| `border.default` | `#E2E8F0` | Standard boundaries |
| `border.strong` | `#CBD5E1` | Emphasized boundaries |
| `action.primary.rest` | `#4F46E5` | Primary button |
| `action.primary.hover` | `#4338CA` | Primary hover |
| `action.primary.pressed` | `#3730A3` | Primary pressed |
| `action.primary.text` | `#FFFFFF` | Primary button label |
| `focus.ring` | `#0F766E` | 3 px focus outline with 2 px offset |
| `selection.bg` | `#EEF2FF` | Selected row/card |
| `selection.border` | `#A5B4FC` | Selected boundary |
| `selection.text` | `#3730A3` | Selected label |

Do not place white normal-size text on teal 500, success 600, or warning 600 without a measured contrast pass. Use the darker semantic text on a light semantic background.

### 10.3 Workflow status mapping

| Status group | Treatment | Examples |
|---|---|---|
| Neutral | Slate icon + text + subtle surface | Draft, Closed |
| Active | Indigo/info icon + text + soft surface | Submitted, Planning, In Progress |
| Waiting | Warning icon + text + soft surface | Pending Eligibility, Pending Result, Pending Approval |
| Positive | Success icon + text + soft surface | Eligible, Result Finalized, Approved, Completed |
| Decision | Violet icon + text + soft indigo/violet surface | Pending Recommendation, Recommendation Submitted |
| Negative | Danger icon + text + soft surface | Not Eligible, Rejected, Cancelled, Overdue |
| Follow-up | Teal dark text + light teal surface | Development In Progress, Reassessment Planned |

Every status uses text and, when space allows, an icon. Color alone is never the meaning.

### 10.4 Analytics health colors

- Metric health comes from configured business polarity, not whether the number has a plus or minus sign.
- The lowest-performing category uses danger only when lower is actually worse.
- Danger is limited to the value, health marker, or one narrow card edge; do not flood the whole KPI card red.
- Neutral comparisons use slate when the change has no approved positive/negative interpretation.
- Charts use a color-blind-safe sequence and direct labels; legends cannot rely only on hue.

### 10.5 Theme scope

Light theme is required for the MVP. Dark and high-contrast alias values may be designed in parallel, but dark mode is not a release requirement unless Product approves the extra QA scope. Components must not hardcode raw light-theme values.

## 11. Gradient system

Gradients are an AssessFlow identity layer, not a substitute for semantic status.

| Token | Value | Allowed use |
|---|---|---|
| `gradient.brand` | `linear-gradient(135deg, #4F46E5 0%, #7C3AED 55%, #14B8A6 100%)` | Logo field, selected module marker, milestone confirmation |
| `gradient.brand.horizontal` | `linear-gradient(90deg, #4F46E5 0%, #7C3AED 52%, #14B8A6 100%)` | Progress bar and controlled primary highlight |
| `gradient.brand.soft` | `linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 56%, #F0FDFA 100%)` | Static hero/summary background only |
| `gradient.success.soft` | `linear-gradient(135deg, #F0FDF4 0%, #F0FDFA 100%)` | Completion summary, static |
| `gradient.danger.soft` | `linear-gradient(135deg, #FEF2F2 0%, #FFF7ED 100%)` | Destructive impact panel, static |
| `gradient.skeleton` | `linear-gradient(90deg, #F1F5F9 20%, #E0E7FF 50%, #F1F5F9 80%)` | Loading skeleton only |

Rules:

- Body backgrounds, tables, standard cards, warning banners, and status badges remain solid.
- Text over a gradient requires a tested solid contrast region or an opaque overlay.
- No animated gradient behind paragraphs, forms, tables, or charts.
- Maximum one looping gradient animation per viewport.
- Semantic danger/success meaning must not be animated.

## 12. Motion and animated-gradient system

Motion clarifies what changed, where content came from, and what happens next. It must never delay a task.

### 12.1 Duration tokens

| Token | Value | Use |
|---|---:|---|
| `motion.instant` | 0 ms | Focus, validation, critical state |
| `motion.xxfast` | 50 ms | High-frequency row/list hover |
| `motion.xfast` | 100 ms | Pressed state and quick exit |
| `motion.fast` | 150 ms | Button, chip, dropdown entrance |
| `motion.standard` | 200 ms | Toast exit, inline expand/collapse |
| `motion.deliberate` | 250 ms | Modal/drawer entrance |
| `motion.route` | 400 ms maximum | Large page-region transition; rare |

### 12.2 Easing tokens

| Token | Value | Use |
|---|---|---|
| `motion.ease.out.practical` | `cubic-bezier(0.4, 1, 0.6, 1)` | Everyday entrance and hover |
| `motion.ease.out.bold` | `cubic-bezier(0, 0.4, 0, 1)` | Important toast/panel entrance |
| `motion.ease.in.practical` | `cubic-bezier(0.6, 0, 0.8, 0.6)` | Exit |
| `motion.ease.inout.bold` | `cubic-bezier(0.4, 0, 0, 1)` | Repositioning and modal scale |

### 12.3 Component behavior

| Component | Enter / interaction | Exit | Reduced motion |
|---|---|---|---|
| Button | color 150 ms; optional `translateY(-1px)` on pointer hover only | 100 ms | color only; no transform |
| Dropdown | 150 ms fade + 4 px origin slide | 100 ms fade | instant |
| Tooltip | 100 ms fade after appropriate delay | 50 ms | instant |
| Modal | 250 ms fade + scale from 0.98 | 200 ms fade | instant, focus moves immediately |
| Drawer | 250 ms transform from related edge | 200 ms | instant |
| Toast | 250 ms 8 px slide + fade | 200 ms | instant |
| Stage content | 200 ms fade + 8 px directional slide | 150 ms | instant content swap |
| Accordion | 200 ms height/opacity | 150 ms | instant |
| KPI update | 150 ms color/fade; no rolling digits by default | — | instant |
| Chart | 250–400 ms one-time reveal after data loads | — | render final state immediately |

Focus, errors, confirmations, and screen-reader announcements occur at state change, not after animation ends. Exits are shorter than entrances.

### 12.4 Loading motion

- Prefer a layout-matched skeleton for initial page loading.
- Use a 16–20 px spinner only for compact, indeterminate controls.
- Button loading preserves width and changes the label to the active verb, such as “Submitting…”.
- Commands longer than 2 seconds show a plain-language progress message.
- Queued exports and long operations may be left safely; the user receives a notification when complete.
- Never block the full application shell for a panel-level refresh.

Animated loading tokens:

- Skeleton shimmer: background size `200% 100%`, 1.4 s ease-in-out infinite.
- Indeterminate progress: `gradient.brand.horizontal`, background size `200% 100%`, 1.6 s linear infinite.
- Compact spinner: 0.9 s linear infinite, maximum one spinner per loading region.
- Primary gradient button: static at rest; background-position may move once over 150 ms on hover. During submission, a bounded 1.2 s progress sweep may loop inside that button only.

### 12.5 Reduced motion and animation safety

When `prefers-reduced-motion: reduce` is active:

- stop skeleton shimmer, spinner rotation, gradient travel, count-up, parallax, slide, scale, and decorative transforms;
- show static skeletons, text status, and native progress semantics;
- change route/component state instantly or with a maximum 100 ms opacity-only transition;
- retain every action and every piece of information.

No bounce, elastic stretch, confetti, flashing, autoplay illustration, or continuously moving page background is allowed in the operational product.

## 13. Typography

Font stack: `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.

| Style | Desktop | Mobile | Weight / line height |
|---|---:|---:|---|
| Display | 32 px | 28 px | 800 / 1.15 |
| Page H1 | 28 px | 24 px | 750 / 1.2 |
| Section H2 | 22 px | 20 px | 700 / 1.25 |
| Card H3 | 18 px | 18 px | 700 / 1.3 |
| Body | 14 px | 16 px | 450 / 1.5 |
| Form label | 13 px | 14 px | 650 / 1.35 |
| Metadata | 12 px | 13 px | 500 / 1.4 |
| KPI value | 30–36 px | 28–32 px | 800 / 1.1; tabular numerals |

- Dense desktop tables may use 13 px only with sufficient row height and contrast.
- Mobile form controls use at least 16 px text.
- Uppercase is limited to short overlines; never use it for long labels or body content.
- Numbers, dates, and durations use locale-aware formatting.

## 14. Spacing, shape, and elevation

- Base spacing unit: 4 px.
- Standard sequence: 4, 8, 12, 16, 20, 24, 32, 40, 48 px.
- Page padding: 32 px desktop, 24 px tablet, 16 px mobile.
- Grid gap: 16 px compact, 24 px standard.
- Input height: 40 px desktop, 44 px touch layouts.
- Button height: 32 px small, 40 px standard, 44 px touch.
- Radius: 8 px controls, 12 px cards, 16 px large panels, pill only for badges/chips.
- Standard cards use a 1 px border and minimal shadow. Elevated shadow is reserved for overlays and floating navigation.
- Avoid nested card-on-card layouts deeper than two levels.
- KPI cards use a narrow semantic/brand edge, purposeful icon field, comparison context, and an optional small sparkline—not empty space and a floating icon alone.

## 15. Core component contracts

### Buttons

- Variants: primary, secondary, tertiary, danger, icon.
- One primary button per action region.
- Danger is used only for destructive or irreversible commands.
- Icon-only buttons require an accessible name and tooltip.
- Loading, disabled, focus, hover, pressed, and success states are documented.

### Form controls

- Persistent visible label; placeholder is example content, not a label.
- Helper/error text is linked programmatically.
- Required and optional rules are consistent.
- Date/time controls expose timezone.
- Switches are only for immediate binary settings; checkboxes are for selections and acknowledgments.

### Status badges

- Badge includes visible status text and optional icon.
- Badge is not the only status explanation on a decision page.
- Long localized status labels may wrap or use the full label outside the badge.

### Stepper / stage navigator

- Shows complete, current, pending, blocked, and conditional stages.
- Keyboard users can move through available stage summaries.
- It does not permit navigation to content the user cannot view.
- It does not imply that completion of Result equals business approval.

### Data table

- Native/semantic table structure where data is tabular.
- Sort direction and selected rows announced.
- Bulk actions state selection count and scope.
- Sticky columns do not cover focus indicators at 200% zoom.
- Mobile transformation preserves field labels and row actions.

### Timeline

- Actor, action, object, timestamp/timezone, comment availability, and audit classification.
- System events are visually distinct from human decisions without lower contrast.
- Large histories load incrementally and preserve chronological semantics.

### Attachment uploader

- Allowed type/size/classification shown before upload.
- Validation, upload, scan, ready, rejected, and failed states.
- Preview/download controls are individually permission checked.
- Filename and metadata never expose a local filesystem path.

### Modal and drawer

- Modal: confirmation, short focused input, or destructive impact.
- Drawer: filters, activity, supporting details, or quick edit.
- Long evidence/recommendation authoring stays on a full page.
- Focus is trapped, restored to the trigger, and never obscured.

## 16. Responsive behavior

| Range | Layout behavior |
|---|---|
| 360–479 px | Mobile: top app bar, sidebar becomes modal navigation, one column, sticky bottom action bar |
| 480–767 px | Large mobile: one column; compact paired fields when safe |
| 768–1023 px | Tablet: compact sidebar, two-column summaries, context rail moves below main content |
| 1024–1439 px | Desktop: expanded/compact sidebar, main + context rail, full tables |
| 1440 px and above | Wide: constrained reading columns; tables/charts use additional width deliberately |

Responsive requirements:

- No horizontal page scroll at 320 CSS px except an intentionally scrollable data region with visible affordance.
- Approval, request changes, reject, comments, task completion, and evidence upload are fully usable by touch.
- Destructive and sensitive actions remain explicit dialogs/pages; they are not compressed into accidental swipe gestures.
- Hover is enhancement only; all information is available by keyboard and touch.
- Landscape and portrait tablet states require design review.

## 17. Accessibility, localization, and content

Target: WCAG 2.2 AA for the production web application.

Required acceptance:

- Keyboard access and logical focus order for all operations.
- Visible focus that is not hidden by sticky headers, footers, dialogs, or columns.
- Minimum 4.5:1 contrast for normal text, 3:1 for large text and meaningful non-text UI boundaries.
- Touch target baseline 44 × 44 px where the responsive layout is touch-oriented; smaller adjacent controls must still meet WCAG 2.2 target-spacing rules.
- Correct headings, landmarks, form labels, descriptions, table headers, live regions, dialog names, and progress semantics.
- Error summary, field error linkage, and preserved values after failure.
- 200% text zoom and 400% reflow checks on critical routes.
- Reduced motion, forced colors/high contrast, and browser zoom verification.
- No color-only, icon-only, animation-only, or position-only meaning.

English is the pilot content language. Architecture and components must be localization-ready before coding:

- no string concatenation that fixes English word order;
- no fixed-width label assumptions;
- allow at least 40% text expansion;
- locale-aware date, time, numbers, and timezones;
- direction-aware icons and spacing;
- RTL shell, table, stepper, drawer, and form proof before Gate 6 approval if Arabic is in the first release; otherwise it becomes an explicit post-pilot release criterion.

Content tone is concise, respectful, and procedural. Avoid judgmental employee labels. Use “Result: Not Ready” only as an approved result value with supporting evidence and policy context, not as a person-level description.

## 18. Frontend performance and resilience budgets

Project acceptance budgets:

- LCP at or below 2.5 s at the 75th percentile on the agreed pilot profile.
- INP at or below 200 ms at the 75th percentile.
- CLS at or below 0.10.
- No large animated blur or backdrop-filter surfaces.
- Animate transform and opacity where possible; avoid layout-triggering motion on large regions.
- Initial charts and low-priority panels load after the primary task surface.
- Virtualize or paginate large queues; never render the full case history eagerly.
- Skeletons reserve final layout dimensions.
- Failed secondary widgets do not take down the case task surface.
- Draft recovery behavior is defined for network loss and expired sessions.

## 19. Design and API handoff contract

Each command endpoint used by the UI must provide enough information to render:

- current stage/status and version;
- allowed command or denial reason;
- required fields/prerequisites;
- user and organization scope outcome;
- consequences and confirmation severity;
- resulting stage/status;
- next owner/task and due date;
- audit event/correlation reference where appropriate;
- retry/idempotency behavior.

Each read model must mark fields as present, unavailable, redacted, or not applicable where ambiguity would create a privacy or workflow error.

Frontend telemetry records route performance, failed commands, validation categories, conflict frequency, and task completion—not protected evidence text or sensitive field values.

## 20. Gate 6 design deliverables

The following are required before Gate 6 can pass:

1. Approved sitemap and route inventory.
2. Desktop, tablet, and mobile flows for every MVP route.
3. Role/permission/organization-scope state matrix mapped to the permissions workbook.
4. Server transition contract mapped to every primary and sensitive action.
5. Component library with all interactive and data states.
6. Token source with raw and semantic aliases for light theme.
7. Color contrast evidence for text, actions, focus, statuses, and charts.
8. Motion prototype showing default and reduced-motion behavior.
9. Loading, empty, error, validation, permission, conflict, redaction, and attachment-scan examples.
10. Localization/content matrix and RTL decision.
11. Annotated clickable prototype of the complete pilot workflow.
12. UX acceptance criteria linked to test cases and release evidence.

## 21. Frontend delivery backlog proposal

This sequence is planning only and remains blocked until Gate 10.

| Epic | Scope | Gate dependencies |
|---|---|---|
| FE-01 Foundations | Semantic tokens, typography, icons, motion, responsive shell, accessibility utilities | Gates 3, 6, 7 |
| FE-02 Identity and access states | Session, SSO states, role/scope handling, forbidden/redacted patterns | Gates 3, 5, 7 |
| FE-03 Home and My Work | Role home, tasks, notifications, upcoming events, KPI contracts | Gates 5, 6 |
| FE-04 Cases | List, filters, request form, case shell, stage navigator, activity | Gates 4, 5, 6 |
| FE-05 Eligibility | Criteria, decisions, override states, policy version | Gates 1, 4, 5, 6 |
| FE-06 Plan and events | Method planning, deviation, calendar, event operations | Gates 1, 4, 5, 6 |
| FE-07 Evidence | Independent assessor workspace, drafts, attachments, scanning states | Gates 1, 5, 7 |
| FE-08 Result | Readiness, missing input, finalize/reopen/revision | Gates 1, 5, 6 |
| FE-09 Recommendation and approval | Reason-specific recommendation, route preview, mobile decisions | Gates 1, 5, 6 |
| FE-10 Development and reassessment | Actions, evidence, dates, linked reassessment case | Gates 1, 4, 5 |
| FE-11 Reports and administration | Operational reporting, export, versioned configuration | Gates 4, 5, 7 |
| FE-12 Quality evidence | Accessibility, responsive, visual regression, E2E, performance, reduced motion | Gates 6, 8 |

## 22. UI-specific blockers and policy dependencies

Gate 6 cannot be approved while these decisions remain unresolved:

- employee visibility into result, recommendation, assessor evidence, comments, and history;
- assessor visibility into peer evidence before independent submission;
- approval routes, self-approval restrictions, delegation, and change-request behavior;
- organization/company/department scope and whether hidden records may be acknowledged;
- attachment types, size, classification, retention, preview, download, and export restrictions;
- eligibility override policy and approver identity;
- closure criteria and development/reassessment obligations;
- first-release language, Arabic/RTL scope, and dark-theme scope;
- KPI polarity/targets and which leadership metrics are safe for each scope.

## 23. Gate 6 exit criteria

Gate 6 passes only when all statements are true:

- Every MVP route has approved default, loading, empty, error, validation, denied, conflict, sensitive, and responsive states where applicable.
- Every visible action maps to an API command, permission, organization scope, version rule, confirmation, and audit event.
- No employee-sensitive information appears through search, totals, notifications, URLs, exports, or error messages without permission.
- Result, recommendation, approval, development, and reassessment remain visibly distinct.
- Scoring-disabled flows contain no score control or score validation.
- Semantic tokens replace raw values in component specifications.
- Color contrast, focus, keyboard, screen-reader, zoom/reflow, touch, reduced-motion, and locale checks have evidence.
- Gradient and motion usage follows this specification and remains fully usable when motion is disabled.
- Product, HR/Talent, UX, Technical, Security, and QA/accessibility owners approve the design baseline.

## 24. Reference sources

### Product benchmark

- Workday Talent Optimization: https://www.workday.com/en-us/products/talent-management/talent-optimization.html
- SAP SuccessFactors Performance & Goals: https://help.sap.com/docs/SAP_SUCCESSFACTORS_PERFORMANCE_AND_GOALS
- SAP Performance & Goals enhancements: https://learning.sap.com/courses/sap-successfactors-performance-and-goals/reviewing-sap-successfactors-performance-and-goals-enhancements-in-the-2h-2023-release_b40fd1d6-5dd6-4ff4-854b-9e5fb5cb8ce8-1
- Oracle Talent Management: https://www.oracle.com/human-capital-management/talent-management/
- Lattice Goals and Reviews: https://lattice.com/platform/goals and https://help.lattice.com/hc/en-us/articles/360062124253-Why-Use-Reviews
- Culture Amp Platform: https://www.cultureamp.com/platform

### Design-system and accessibility benchmark

- Fluent 2 design tokens, color, and motion: https://fluent2.microsoft.design/design-tokens, https://fluent2.microsoft.design/color, and https://fluent2.microsoft.design/motion
- Atlassian motion foundation: https://atlassian.design/foundations/motion and https://atlassian.design/foundations/motion/applying-motion
- Carbon motion guidance: https://v10.carbondesignsystem.com/guidelines/motion/overview/
- WCAG 2.2: https://www.w3.org/TR/wcag/
- W3C animation from interactions: https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions
