# AssessFlow Design System v1.0

This folder is the implementation-ready visual foundation for AssessFlow.

## Proposed production specification

The cross-product frontend baseline is documented in `../../AssessFlow_Frontend_UI_UX_Spec_v1.1.md`. It adds the production information architecture, route inventory, role and redaction rules, semantic color aliases, gradient restrictions, motion and reduced-motion tokens, responsive behavior, accessibility evidence, and Gate 6 approval criteria.

Its machine-readable proposed handoff is `../tokens/proposed-production-tokens-v1.1.json`. It extends the current raw palette with semantic light-theme aliases, gradient strings, motion/loading values, reduced-motion behavior, and responsive layout values.

That document is currently **proposed**, so this static v1.0 laboratory remains the active visual reference until Gate 6 approval. The laboratory is not production application code.

## What is included

- `index.html` — full interactive design-system laboratory / showcase.
- `styles/tokens.css` — CSS custom properties for brand, neutral and semantic tokens.
- `styles/base.css` — base typography and global surfaces.
- `styles/sidebar.css` — distinctive AssessFlow sidebar pattern.
- `styles/components.css` — buttons, forms, badges, cards, tables, workflows, alerts, timelines, charts and responsive behavior.
- `styles/layout.css` — higher-level composition utilities.
- `scripts/app.js` — sidebar collapse, mobile drawer, theme toggle, palette copy, component interactions and demo search.
- `tokens/design-tokens.json` — portable design token source.
- `assets/logo.svg` — AssessFlow logo mark.
- `assets/icons.svg` — local SVG icon sprite.
- `docs/sidebar-spec.md` — detailed sidebar design rules.
- `docs/component-guidelines.md` — implementation rules for product teams.

## Enhancement pass

- Search now returns section-level results and jumps directly to the matching foundation, component or workflow pattern.
- Sidebar state, mobile drawer state, theme preference, tabs and switches expose accessible interaction state.
- Keyboard shortcuts include `Ctrl/Cmd + K` for search and `Escape` for closing search or mobile navigation.
- SVG sprite references are inlined at runtime so navigation, utility and action icons remain visible in local-file previews.
- Primary actions preview a short loading state, while the Loading states section documents a ring loader and shimmer skeleton pattern.
- Filled buttons use a restrained gradient fill and sheen interaction; reduced-motion users receive a static fallback.
- Metrics cards now use semantic tones, status chips, comparison context and compact trend bars so each KPI can be scanned without relying on color alone.
- Negative or lowest-priority trends use the danger treatment with a descending arrow; loading feedback combines an orbit, progress rail, live-sync cue and step count.
- `simulation.html` is a standalone clickable reference for the MVP workflow: Request, Eligibility, Plan, Evidence, Result, Recommendation, Approval, and Closure.
- `scripts/simulation.js` simulates guarded transitions, request-changes return, activity history, reset, and final closure without backend or production data.
- The simulation also exposes a live transition contract: current rule, permission owner, allowed next state, and audit event.
- `scripts/verify_simulation.py` covers the full reference journey and the settled mobile layout.
- `styles/enhancements.css` contains the interaction-focused visual refinements.
- `scripts/verify_interactions.py` verifies the laboratory with Playwright.
- The reference remains a static offline laboratory; no API or production workflow behavior is implied.

## Run locally

Open `index.html` directly in a modern browser. For the best local-file behavior, use any static server, for example:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080/AssessFlow_Design_System_v1.0/` depending on your working directory.

## Core visual direction

- Primary: Indigo `#4F46E5`
- Secondary: Teal `#14B8A6`
- Accent: Violet `#7C3AED`
- Navigation / dark emphasis: Slate `#0F172A`
- App background: `#F8FAFC`
- Surface: `#FFFFFF`

## Product rule

AssessFlow MVP does not require numeric scoring. The visual system therefore treats the explicit assessment result as the primary decision output. Future scoring widgets may be added without changing the status/result hierarchy.
