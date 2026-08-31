# AssessFlow Pre-Development Findings

## Requirements

- User wants the project taken from the current baseline to a complete 0–10 pre-development readiness state.
- Development must not begin until scope, policy, architecture, data, API, UX, security, testing, and operations are approved.
- The MVP is an employee assessment workflow covering promotion, internal mobility, and role realignment.

## Research Findings

- The workspace contains two documentation packs and no frontend/backend source code, package manifest, test suite, CI/CD configuration, or deployment configuration.
- The Planning Pack includes the BRD, workflow/status matrix, ERD/data dictionary, screen requirements, and technical guidelines.
- The System Design Pack includes a PostgreSQL DDL baseline, API contract, OpenAPI baseline, permissions/RACI workbook, database implementation document, and UI wireframes.
- The intended MVP workflow is request → eligibility → planning → scheduling/assessment → result → recommendation → approval → development/reassessment → closure.
- Numeric scoring is intentionally disabled by default and must not block MVP result finalization.
- The design correctly separates eligibility, evidence/result, business recommendation, and approval.
- The documents leave important owners and policy decisions pending, including eligibility thresholds, assessment complexity rules, approval routing, employee feedback visibility, retention, and scoring governance.
- The OpenAPI file is only a partial machine-readable implementation baseline compared with the larger endpoint catalog in the API contract.
- The SQL schema is a useful core baseline but does not fully represent configurable catalogs, complete audit/access history, outbox delivery, or all promised historical snapshots.
- The final SQL `ALTER TABLE ... ADD CONSTRAINT` section is not fully rerunnable even though most tables use `IF NOT EXISTS`.
- The permissions workbook defines ten roles, forty-two permissions, and scoped access rules, but these need to be implemented and tested at both API and UI boundaries.
- The UI artifacts are low fidelity and require approval of detailed responsive, accessibility, validation, and sensitive-data states before implementation.

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Use a modular monolith for MVP | The workflow is transaction-heavy and benefits from one authoritative database and simpler operations. |
| Keep scoring disabled for MVP | It reduces policy risk and preserves the approved human-judgment workflow. |
| Build one complete vertical slice before broadening | It validates the core business process early and prevents partially built modules. |
| Treat server-side workflow and permission rules as authoritative | UI-only enforcement would create security and data-integrity gaps. |
| Require configuration and seed-data ownership before coding | The BRD requires configurable criteria, methods, results, recommendations, and approval routes. |
| Require a Go/No-Go review at Gate 10 | Development should start only after cross-document and cross-owner consistency is proven. |

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| No executable application exists in the workspace | Treat the current state as a design baseline and define a readiness plan before implementation. |
| API catalog and OpenAPI are not fully aligned | Reconcile them at Gate 5 and make the OpenAPI contract complete. |
| Configuration requirements are broader than the standalone SQL model | Decide host configuration ownership or add versioned configuration tables and seed data at Gate 4. |
| Audit requirements exceed workflow transition history | Define business audit, data-access audit, export audit, and operational logging boundaries at Gate 7. |

## Resources

- `AssessFlow_Planning_Pack_v1.0/README.md`
- `AssessFlow_Planning_Pack_v1.0/01_AssessFlow_BRD_v1.0.docx`
- `AssessFlow_Planning_Pack_v1.0/02_AssessFlow_Workflow_Status_Matrix_v1.0.docx`
- `AssessFlow_Planning_Pack_v1.0/03_AssessFlow_ERD_Data_Dictionary_v1.0.docx`
- `AssessFlow_Planning_Pack_v1.0/04_AssessFlow_Screen_Requirements_v1.0.docx`
- `AssessFlow_Planning_Pack_v1.0/05_AssessFlow_Technical_Technology_Guidelines_v1.0.docx`
- `AssessFlow_System_Design_Pack_v1.0/06_AssessFlow_PostgreSQL_Schema_v1.0.sql`
- `AssessFlow_System_Design_Pack_v1.0/07_AssessFlow_API_Contract_v1.0.docx`
- `AssessFlow_System_Design_Pack_v1.0/07_AssessFlow_OpenAPI_v1.0.yaml`
- `AssessFlow_System_Design_Pack_v1.0/08_AssessFlow_Permissions_RACI_Matrix_v1.0.xlsx`
- `AssessFlow_System_Design_Pack_v1.0/09_AssessFlow_UI_Wireframes_v1.0.docx`

## Visual/Browser Findings

- No browser or visual inspection was performed; the wireframe and screen requirements content was extracted from the Word documents.

## Gate 1 Preparation Findings

- Gate 0 can be treated as complete for planning purposes: the workspace is specification-only, the MVP workflow and scoring decision are documented, and remaining uncertainty is policy/ownership rather than missing baseline inventory.
- No named accountable owners or approvers are recorded in the persistent readiness files, so Gate 1 cannot be approved yet.
- The highest-risk unresolved decisions are eligibility/overrides, approval routes, employee visibility, evidence protection, retention, HRIS/SSO ownership, organization scope, closure, and reassessment.
- Created `gate-1-business-decisions.md` as the approval register. It deliberately uses `[Assign]` placeholders and proposed baselines; it does not invent people or policy approvals.

## Frontend UI/UX Specification Review — 2026-08-18

- Gate 6 currently states the right categories but is not implementation-ready: it lacks a screen inventory baseline, component contracts, exact visual tokens, motion rules, responsive behavior, role-state matrices, and measurable acceptance criteria.
- The existing AssessFlow design reference establishes a useful visual foundation: Inter/system typography, indigo/teal/violet accents, slate enterprise surfaces, explicit semantic statuses, loading states, metric cards, and an eight-stage workflow simulator.
- A generated UI direction suggested “Liquid Glass,” but the same recommendation flags performance and text-contrast risk. AssessFlow should not use glassmorphism as the primary surface treatment; restrained translucency may be used only for decorative headers, overlays, and non-critical accents.
- Preserve the current product identity instead of switching to unrelated Lora/Raleway or orange-CTA recommendations. The system needs compact, legible, task-oriented enterprise typography and calm semantic color.
- A dedicated frontend specification is required and will be benchmarked against global talent/performance platforms plus mature design-system guidance before Gate 6 can be approved.

## Global Product Benchmark Findings — 2026-08-18

The benchmark uses current official product and help documentation to identify interaction patterns, not to copy another product's branding.

- **Workday Talent Optimization:** manager insight hubs, connected performance/feedback/goals, career visibility, and current workforce data support a role-specific AssessFlow home page with one task-and-insight surface instead of disconnected dashboards.
  - Source: https://www.workday.com/en-us/products/talent-management/talent-optimization.html
- **SAP SuccessFactors Performance & Goals:** continuous performance, 360 reviews, calibration, mobile access, and permission-controlled quick actions support persistent workflow context, mobile approval actions, and explicit role gates. SAP's newer meeting experience also reinforces tabbed workspaces, full-width writing surfaces, and switches for binary controls.
  - Sources: https://help.sap.com/docs/SAP_SUCCESSFACTORS_PERFORMANCE_AND_GOALS and https://learning.sap.com/courses/sap-successfactors-performance-and-goals/reviewing-sap-successfactors-performance-and-goals-enhancements-in-the-2h-2023-release_b40fd1d6-5dd6-4ff4-854b-9e5fb5cb8ce8-1
- **Oracle Talent Management:** a shared workforce data/security model, targeted manager guidance, team calibration, and review workspaces support a unified employee/case snapshot and a prominent, permission-aware next-action panel.
  - Source: https://www.oracle.com/human-capital-management/talent-management/
- **Lattice:** connected reviews, goals, feedback, persistent breadcrumbs, full-screen detail, progress monitoring, history, and configurable employee visibility support a focused case-detail route with progress, audit history, and policy-driven disclosure states.
  - Sources: https://lattice.com/platform/goals, https://help.lattice.com/hc/en-us/articles/360062124253-Why-Use-Reviews, and https://help.lattice.com/hc/en-us/articles/4404328972311-Performance-Reviews-Page-Overview
- **Culture Amp:** distinct Perform and Develop experiences, calibration/fairness workflows, and integrated people data support keeping assessment result, recommendation, development, and reassessment as related but clearly separated modules.
  - Source: https://www.cultureamp.com/platform

### Cross-system conclusions for AssessFlow

- Lead with role-specific tasks and decisions, then supporting metrics.
- Keep case context, progress, evidence, permissions, and history visible within one coherent workspace.
- Provide an explicit next action and explain why an action is unavailable.
- Make visibility and confidentiality policy-driven rather than hiding them in frontend assumptions.
- Treat calibration, development, and reassessment as first-class flows, not reporting afterthoughts.
- Preserve a mobile path for short, high-frequency actions such as approvals, comments, and evidence checks.
- Preserve AssessFlow's Inter typography and indigo/teal/violet/slate identity instead of borrowing vendor branding.

## Design-System and Motion Benchmark Findings — 2026-08-18

- Fluent 2 separates raw/global values from semantic alias tokens and applies the same token language across color, typography, spacing, elevation, and animation. AssessFlow should therefore expose semantic names such as `surface.canvas`, `text.danger`, and `motion.modal.enter` instead of scattering hex values and milliseconds through components.
  - Sources: https://fluent2.microsoft.design/design-tokens and https://fluent2.microsoft.design/color
- Fluent explicitly advises that color must not be the only status signal. AssessFlow statuses must combine color with an icon and visible text.
  - Source: https://fluent2.microsoft.design/color
- Atlassian's current motion guidance treats motion as clarification, not decoration; common interactions are 50–150 ms, screen transitions are 150–400 ms, exits are shorter than entrances, and reduced-motion mode can make transitions instant. This is a better enterprise baseline than 400–600 ms morphing for frequent AssessFlow tasks.
  - Sources: https://atlassian.design/foundations/motion and https://atlassian.design/foundations/motion/applying-motion
- Fluent and Carbon both recommend purposeful, natural, short motion whose duration matches element size. Carbon specifically avoids bounce/stretch/sudden-stop effects in productive enterprise UI.
  - Sources: https://fluent2.microsoft.design/motion and https://v10.carbondesignsystem.com/guidelines/motion/overview/
- WCAG 2.2 requires robust keyboard/focus/contrast behavior for AA conformance. Its motion guidance also supports disabling non-essential interaction-triggered animation, including by respecting the operating-system reduced-motion preference.
  - Sources: https://www.w3.org/TR/wcag/ and https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions

### AssessFlow motion decision

- Use fast semantic motion tokens: 0, 50, 100, 150, 200, 250, and 400 ms.
- Use animated gradients only for bounded progress/brand feedback, never as continuously moving card or page backgrounds.
- Limit each viewport to one attention-leading animation at a time.
- Make validation, focus, permission, and critical status feedback immediate; never delay it behind animation.
- Under `prefers-reduced-motion: reduce`, stop looping gradients, spinners, slides, scale effects, and decorative transforms; retain instant state changes and accessible progress text.

## Local UI Baseline Inventory — 2026-08-18

- The production plan's Gate 6 currently contains only five high-level bullets; it does not yet name the required routes, role contracts, exact tokens, or approval evidence.
- The reusable reference already stores global brand, neutral, semantic, radius, elevation, spacing, and typography values in `AssessFlow_Design_System_v1.0/tokens/design-tokens.json`.
- The project contains planning and system-design packs plus a separate static design-system and workflow-simulation reference. The new frontend specification must connect these artifacts without treating the static simulator as production application code.

## Full UI Plan Re-read — 2026-08-18

- Re-read the workflow/status matrix, screen requirements, and low-fidelity UI wireframes after the global benchmark.
- The local plan already establishes the correct domain separation: eligibility gate, independent evidence, human-entered result, reason-specific recommendation, approval, development/reassessment, and closure.
- The UI baseline requires a role-aware dashboard, queues, case detail, eligibility, planning/events, assessor evidence, result, decision, development, reports, and controlled configuration.
- The main gaps were specification depth rather than missing screens: exact route template behavior, permission/redaction semantics, complete page states, semantic token aliases, responsive rules, motion/reduced-motion behavior, performance budgets, and measurable Gate 6 evidence.
- `AssessFlow_Frontend_UI_UX_Spec_v1.1.md` now consolidates those requirements while keeping scoring disabled and development blocked until Gate 10.

## Frontend Specification Validation — 2026-08-18

- The specification contains 24 major sections, an eighteen-route inventory, explicit scoring-disabled safeguards, and repeated reduced-motion requirements.
- All referenced local baseline files exist.
- The proposed machine-readable production token file parses as valid JSON and is marked `proposed-gate-6`.
- Verified contrast ratios for key combinations: white/indigo 600 = 6.29:1, white/violet 600 = 5.70:1, teal 700/white = 5.47:1, and slate 600/white = 7.58:1.
- White/teal 500 is only 2.49:1; the specification correctly prohibits it for normal-size text and assigns teal 700 or dark semantic text where contrast is required.
- No application source, API, database, or production token implementation was created or changed.

## Implementation Authorization — 2026-08-18

- The project owner explicitly authorized implementation of the 9/10 delivery guide.
- The implementation baseline is a standalone TypeScript modular monolith with React/Vite frontend, NestJS API, PostgreSQL/Prisma target, worker boundary, shared contracts, and the approved AssessFlow design tokens.
- Selected defaults: one-company focused pilot, all three reasons, English/Arabic LTR/RTL, Entra ID adapter, scheduled HRIS sync, in-app/email notifications, approved-summary employee visibility, versioned eligibility with dual override, sequential approval, and hold-first retention.
- The workspace has no git repository and no existing application source; implementation must therefore create the application foundation without modifying the existing reference packs except for progress tracking.

## Implementation Verification Findings — 2026-08-18

- The Prisma schema is valid after normalizing enum declarations and adding explicit reassessment/evidence relation back-links. Validation uses a safe local fallback URL when `DATABASE_URL` is not present, so CI schema checks do not require a live database.
- The first runtime integration check found missing Nest validation dependencies; `class-validator` and `class-transformer` are now explicit API dependencies.
- The API is runnable in demo memory mode and exposes a database readiness boundary. The first vertical slice now has a Prisma repository path; the remaining workflow modules and production-grade repository coverage still need to be implemented and integration-tested before pilot deployment.
- Idempotency is currently process-local for the first slice. Production must move command idempotency records to PostgreSQL and preserve them across restarts and multiple replicas.
- The repository now has a reproducible quality baseline, but CI still needs integration services, Testcontainers, OpenAPI breaking-change checks, Playwright/axe, security scans, load testing, and migration/restore exercises before Gate 8/10 can close.
