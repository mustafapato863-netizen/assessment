# AssessFlow Simulation Reference Plan

## Goal

Build a clickable simulation reference inside the AssessFlow design-system lab. It must reuse the existing design tokens/components and demonstrate the approved MVP workflow without becoming production application code.

## Scope

Request → Eligibility → Assessment Plan → Evidence → Result → Recommendation → Approval → Closure.

## Phases

1. **Foundation** — add a discoverable simulation entry point and shared simulation styles.
2. **Workflow reference** — build the interactive state model and stage-specific views.
3. **System states** — add guarded transitions, reset, loading feedback, status/timeline updates, and responsive behavior.
4. **Verification** — run static checks, Playwright flow coverage, and focused visual capture.

## Non-goals

- No backend, database, authentication, real file storage, or production API.
- No changes to the parent pre-development readiness decision register.
- No numeric scoring; the simulator keeps the human-judgment result path.

## Current phase

Complete — simulation reference verified

### Phase 1: Foundation

- **Status:** complete
- Added `simulation.html` as a separate reference screen.
- Linked the simulator from `index.html` and added a simulation navigation entry.
- Added `styles/simulation.css` and project-local planning files.

### Phase 2: Workflow reference

- **Status:** complete
- Added the local state model and eight stage-specific views in `scripts/simulation.js`.
- Added server-style transition guardrails, request-changes return behavior, final closure, reset, and activity history.

### Phase 3: System states

- **Status:** complete
- Added progress/status badges, loading feedback during transitions, empty/pending/complete stage states, and responsive layouts.

### Phase 4: Verification

- **Status:** complete
- `node --check scripts/app.js` passed.
- `node --check scripts/simulation.js` passed.
- `python scripts/verify_interactions.py` passed.
- `python scripts/verify_simulation.py` passed, including the full workflow, request-changes path, reset, icon rendering, and mobile overflow check.

## Acceptance criteria

- The existing design-system page links to the simulation reference.
- A user can move through all eight MVP stages in order.
- Invalid stage progression is blocked with an explicit message.
- Reset returns the case to Request.
- The simulation visibly distinguishes active, complete, blocked, and pending states.
- Playwright verifies the core path and no JavaScript syntax errors are present.

## Errors encountered

| Error | Attempt | Resolution |
|---|---:|---|
| Simulation mobile check reported horizontal overflow | 1 | The check ran during the existing sidebar slide transition; added a settled-layout wait before measuring. |
| Inline debug runner could not resolve `__file__` | 1 | Abandoned the ad-hoc runner and added diagnostic output directly to the Playwright verification script. |
