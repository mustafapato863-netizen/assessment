<task>
Phase 04 — E2E + accessibility evidence (closes Gate 8 H1, H2). Depends on Phase 01 (login + roles).
Context: read `../gate-8-test-plan.md`, `../AssessFlow_Frontend_UI_UX_Spec_v1.1.md` §§17/23 (WCAG 2.2 AA,
keyboard/focus/contrast/zoom/reflow/touch/reduced-motion/no-color-only),
`../gate-6-frontend-pages.md` (18 routes), `../docs/workflow-state-machine.md`.

Do:
1. Playwright (add `@playwright/test` devDependency to `apps/web` via pnpm; chromium only): smoke spec
   covering request→submit→eligibility→plan→event→evidence→result→recommendation→approval→close against
   local API+web, plus denial specs (stale-version 409, validation 422, submitted-evidence immutability).
   Seed/reset via API between runs; document ports/DB assumptions (API 3000, web Vite port, PG host 5432).
2. axe-core spot scan of case workspace + approval decision views (add `@axe-core/playwright` or document
   manual axe DevTools run with screenshots in `../docs/a11y-evidence.md` if dependency install fails —
   report which path you took).
3. Manual evidence checklist in `../docs/a11y-evidence.md`: keyboard-only full journey, 200% zoom, 400%
   reflow, RTL Arabic pass, reduced-motion pass, touch targets on approval actions.

Do NOT touch: app/API source except test files + strictly-necessary testids/aria fixes (list each one).
Do NOT git add/commit.
</task>

<verification_loop>
`pnpm typecheck`, `pnpm test`, `pnpm build` green; `pnpm --filter @assessflow/web exec playwright test`
(or documented equivalent) green. `git status` shows only intended files.
</verification_loop>

<structured_output_contract>
Report: (1) what changed and why, (2) files touched, (3) gate outcomes with counts + evidence paths,
(4) deviations, open items, decisions needed.
</structured_output_contract>
