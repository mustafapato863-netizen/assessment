import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const srcDir = dirname(fileURLToPath(import.meta.url));
const readSrc = (relPath: string) => readFileSync(resolve(srcDir, relPath), 'utf8');

describe('Frontend UI & Layout Invariants', () => {
  const stylesCss = readSrc('styles.css');
  const shellTsx = readSrc('components/shell.tsx');
  const loginTsx = readSrc('routes/login.tsx');
  const sghLogoTsx = readSrc('design-system/brand/sgh-logo.tsx');
  const sghAnimLogoTsx = readSrc('design-system/brand/sgh-animated-logo.tsx');
  const aiCopilotTsx = readSrc('features/case/ai-copilot-card.tsx');
  const caseTsx = readSrc('routes/case.tsx');
  const assessmentsTsx = readSrc('routes/assessments.tsx');
  const employeesTsx = readSrc('routes/employees.tsx');
  const calibrationTsx = readSrc('routes/calibration-view/Calibration.tsx');

  it('defines canonical :root tokens and synchronizes collapsed sidebar grid track', () => {
    expect(stylesCss).toContain('--font: var(--font-sans);');
    expect(stylesCss).toContain('--font-mono:');
    expect(stylesCss).toContain('--background: #e0f2fe;');
    expect(stylesCss).toContain('--app-bg-gradient:');
    expect(stylesCss).toContain('--primary: #0084ce;');
    expect(stylesCss).toContain('--radius-card: 16px;');
    expect(stylesCss).toContain('--radius-control: 8px;');
    expect(stylesCss).toContain('--radius-avatar: 999px;');
    expect(stylesCss).toContain('--control-height: 38px;');
    expect(stylesCss).toContain('--sgh-cyan-primary: #00a3e0;');
    expect(stylesCss).toContain('--sgh-emerald-primary: #00a859;');
    expect(stylesCss).toContain('--sgh-gradient-brand:');
    expect(stylesCss).toContain('text-decoration: none !important;');
    expect(stylesCss).not.toContain('text-decoration: underline');
    expect(stylesCss).toMatch(
      /\.app-shell:has\(\.sidebar\.collapsed\)\s*\{\s*grid-template-columns:\s*82px minmax\(0, 1fr\);/,
    );
  });

  it('removes duplicate sidebar collapse trigger and mounts mobile backdrop with accessible labels', () => {
    expect(shellTsx).not.toContain("querySelector<HTMLButtonElement>('[data-sidebar-toggle]')");
    expect(shellTsx).toContain('collapsed={collapsed && !mobileMenuOpen}');
    expect(shellTsx).toContain('className="sidebar-backdrop"');
    expect(shellTsx).toContain('setMobileMenuOpen(false)');
    expect(stylesCss).toContain('.sidebar-backdrop');
  });

  it('replaces uninstalled Tailwind utility classes in brand, login, and AI Copilot components', () => {
    for (const fileContent of [loginTsx, sghLogoTsx, sghAnimLogoTsx]) {
      expect(fileContent).not.toContain('text-[9px]');
      expect(fileContent).not.toContain('text-[10px]');
      expect(fileContent).not.toContain('text-[11px]');
      expect(fileContent).not.toContain('bg-white/15');
      expect(fileContent).not.toContain('gap-3.5');
      expect(fileContent).not.toContain('inset-0');
      expect(fileContent).not.toContain('shrink-0');
    }
    expect(aiCopilotTsx).toContain('className="spin"');
    expect(aiCopilotTsx).not.toContain('className="spinner"');
  });

  it('consolidates Case Detail stage navigation and removes duplicate stage-tab-bar', () => {
    expect(caseTsx).toContain('stepper panel interactive stepper-with-head');
    expect(caseTsx).toContain('className="stepper-head"');
    expect(caseTsx).toContain('className="stepper-track"');
    expect(caseTsx).toContain("aria-pressed={activeStageTab === 'ALL'}");
    expect(caseTsx).not.toContain('className="stage-tab-bar"');
  });

  it('adds responsive data-label attributes and preserves Employees page heading selectors', () => {
    expect(assessmentsTsx).toContain('data-label="Reason"');
    expect(assessmentsTsx).toContain('data-label="Stage"');
    expect(assessmentsTsx).toContain('data-label="Owner"');
    expect(assessmentsTsx).toContain('data-label="Requested"');

    expect(employeesTsx).toContain('className="page-heading"');
    expect(employeesTsx).toContain('className="eyebrow"');
    expect(employeesTsx).toContain('className="pipeline-note"');
    expect(employeesTsx).toContain('data-label="Department"');
    expect(employeesTsx).toContain('data-label="Cases"');
    expect(employeesTsx).toContain('data-label="Latest stage"');

    expect(calibrationTsx).toContain('data-label="Department"');
    expect(calibrationTsx).toContain('data-label="Level move"');
    expect(calibrationTsx).toContain('data-label="Box"');
  });

  it('removes dead CSS blocks and blanket Overview 13px !important overrides while keeping .spin', () => {
    expect(stylesCss).not.toContain('.login-page-container');
    expect(stylesCss).not.toContain('.login-page-root');
    expect(stylesCss).not.toContain('.calibration-workspace');
    expect(stylesCss).not.toContain('.assessment-scorecard');
    expect(stylesCss).not.toContain('font-size: 13px !important');
    expect(stylesCss).not.toContain('font-weight: 650');
    expect(stylesCss).not.toContain('font-weight: 750');
    expect(stylesCss).not.toContain('font-weight: 850');
    expect(stylesCss).toContain('@keyframes spin');
    expect(stylesCss).toContain('.spin {');
  });

  it('enforces non-zero internal padding on .panel and all multi-scenario workflow panels across desktop and mobile', () => {
    expect(stylesCss).toMatch(/\.panel\s*\{[^}]*padding:\s*20px 24px;/s);
    expect(stylesCss).toMatch(/\.admin-reopen-panel\s*\{[^}]*padding:\s*20px 24px;/s);
    expect(stylesCss).toMatch(
      /\.case-summary,\s*\.decision-panel,\s*\.override-panel,\s*\.decision-summary-panel,\s*\.admin-reopen-panel,\s*\.next-panel,\s*\.plan-panel,\s*\.events-panel,\s*\.evidence-panel,\s*\.result-panel,\s*\.development-panel\s*\{\s*padding:\s*20px 24px;/s,
    );
    expect(stylesCss).toMatch(/\.case-rail\s+\.panel\s*\{\s*padding:\s*18px 20px;/s);
    expect(stylesCss).toContain(
      '.panel:not(.settings-dialog-card):not(.user-dropdown-menu):not(.action-queue-section):not(\n      .ai-copilot-card\n    )',
    );
    expect(stylesCss).toMatch(/\.settings-dialog-card\s*\{[^}]*padding:\s*0;/s);
    expect(stylesCss).toMatch(/\.ai-copilot-card\.panel\s*\{\s*padding:\s*0;/s);
    expect(stylesCss).toMatch(/\.user-dropdown-menu\s*\{[^}]*padding:\s*0;/s);
  });

  it('aligns standalone and admin panels (AccessAccountsPanel, NewRequest) and route cards across empty/filtered/active scenarios', () => {
    const accessAccountsTsx = readSrc('routes/access-accounts-panel.tsx');
    const myWorkCss = readSrc('routes/my-work.css');
    const assessmentsCss = readSrc('routes/assessments.css');
    const employeesCss = readSrc('routes/employees.css');
    const developmentCss = readSrc('routes/development.css');
    const insightsCss = readSrc('routes/insights.css');
    const administrationCss = readSrc('routes/administration.css');
    const calibrationCss = readSrc('routes/calibration-view/calibration.css');

    // AccessAccountsPanel should rely on .panel padding without misaligned 16px inner wrapper
    expect(accessAccountsTsx).toContain('<section className="panel"');
    expect(accessAccountsTsx).not.toContain('<div style={{ padding: 16 }}>');

    // Route headers, cards, and empty states across all 7 route stylesheets must have explicit padding
    expect(myWorkCss).toMatch(/\.mw-head\s*\{[^}]*padding:\s*20px 24px;/s);
    expect(myWorkCss).toMatch(/\.mw-card--pad\s*\{[^}]*padding:\s*20px 24px;/s);
    expect(myWorkCss).toMatch(/\.mw-empty\s*\{[^}]*padding:\s*24px;/s);

    expect(assessmentsCss).toMatch(/\.as-head\s*\{[^}]*padding:\s*20px 24px;/s);
    expect(assessmentsCss).toMatch(/\.as-tabs\s*\{[^}]*padding:\s*18px 24px 0;/s);
    expect(assessmentsCss).toMatch(/\.as-tools\s*\{[^}]*padding:\s*16px 24px;/s);
    expect(assessmentsCss).toMatch(/\.as-empty\s*\{[^}]*padding:\s*24px;/s);

    expect(employeesCss).toMatch(/\.em-head\s*\{[^}]*padding:\s*20px 24px 0;/s);
    expect(employeesCss).toMatch(/\.em-tools\s*\{[^}]*padding:\s*16px 24px;/s);
    expect(employeesCss).toMatch(/\.em-detail\s*\{[^}]*padding:\s*20px 24px;/s);
    expect(employeesCss).toMatch(/\.em-empty\s*\{[^}]*padding:\s*24px;/s);

    expect(developmentCss).toMatch(/\.dv\s*>\s*header\s*\{[^}]*padding:\s*20px 24px;/s);
    expect(developmentCss).toMatch(/\.dv-plan-head\s*\{[^}]*padding:\s*20px 24px 16px;/s);
    expect(developmentCss).toMatch(/\.dv-card__head\s*\{[^}]*padding:\s*20px 24px 12px;/s);
    expect(developmentCss).toMatch(/\.dv-empty\s*\{[^}]*padding:\s*20px 24px;/s);

    expect(insightsCss).toMatch(/\.in-head\s*\{[^}]*padding:\s*20px 24px;/s);
    expect(insightsCss).toMatch(/\.in-filters\s*\{[^}]*padding:\s*16px 20px;/s);
    expect(insightsCss).toMatch(/\.in-card\s*\{[^}]*padding:\s*20px 24px;/s);
    expect(insightsCss).toMatch(/\.in-empty\s*\{[^}]*padding:\s*14px 20px;/s);

    expect(administrationCss).toMatch(/\.administration-heading\s*\{[^}]*padding:\s*20px 24px;/s);
    expect(administrationCss).toMatch(/\.administration-card\s*\{[^}]*padding:\s*20px 24px;/s);

    expect(calibrationCss).toMatch(/\.cb-top\s*\{[^}]*padding:\s*20px 24px;/s);
    expect(calibrationCss).toMatch(/\.cb-pad\s*\{\s*padding:\s*20px 24px;/s);
    expect(calibrationCss).toMatch(/\.cb-filters\s*\{[^}]*padding:\s*16px 24px;/s);
    expect(calibrationCss).toMatch(/\.cb-empty\s*\{[^}]*padding:\s*14px 20px;/s);
  });
});
