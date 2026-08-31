# AssessFlow Simulation Findings

## Baseline

- The target is a static HTML design-system laboratory with shared tokens, base styles, component styles, sidebar/layout styles, enhancements, and an icon fallback in `scripts/app.js`.
- The parent readiness work correctly treats this folder as a reference artifact, not the production application.
- The approved reference workflow is human-judgment based; numeric scoring remains disabled for the simulator.

## Design decision

- Use a separate `simulation.html` entry point so the design-system catalog remains readable while the workflow reference can behave like an application shell.
- Reuse `styles/tokens.css`, `styles/base.css`, `styles/sidebar.css`, `styles/components.css`, `styles/layout.css`, and `styles/enhancements.css`.
- Add only simulation-specific layout/state rules in `styles/simulation.css` and state behavior in `scripts/simulation.js`.

## Simulation behavior

- The state machine will expose Request, Eligibility, Plan, Evidence, Result, Recommendation, Approval, and Closure.
- Each transition is guarded by the required state for that stage.
- The simulator will show an assessment case summary, stage rail, current-stage workspace, activity timeline, toast feedback, reset, and a final closed state.

## Foundation implementation

- `simulation.html` reuses the existing shell, icon sprite, theme, search, token, component, and enhancement layers.
- The simulation is a separate page to keep the design-system catalog focused while providing a realistic workflow surface.
- `scripts/app.js` now excludes simulation action buttons from generic loading/toast previews so the simulator can own its transition feedback.
- The simulation workspace now includes a live contract inspector for transition rule, permission context, allowed next state, and audit event; this makes the reference useful for product, API, permissions, and QA discussions.
- The workspace card height was tightened to remove unused vertical space while preserving a stable stage workspace.
