import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const srcDir = dirname(fileURLToPath(import.meta.url));
const readSrc = (relPath: string) => readFileSync(resolve(srcDir, relPath), 'utf8');

describe('Frontend UI & Layout Invariants', () => {
  const tokensCss = readSrc('styles/tokens.css');
  const stylesCss = `${tokensCss}\n${readSrc('styles.css')}`;
  const shellTsx = readSrc('components/shell.tsx');
  const loginTsx = readSrc('routes/login.tsx');
  const sghLogoTsx = readSrc('design-system/brand/sgh-logo.tsx');
  const sghAnimLogoTsx = readSrc('design-system/brand/sgh-animated-logo.tsx');
  const aiCopilotTsx = readSrc('features/case/ai-copilot-card.tsx');
  const caseTsx = readSrc('routes/case.tsx');
  const caseHeaderTsx = readSrc('features/case/case-header.tsx');
  const scorecardPanelTsx = readSrc('features/case/scorecard-panel.tsx');
  const assessmentsTsx = readSrc('routes/assessments.tsx');
  const employeesTsx = readSrc('routes/employees.tsx');
  const calibrationTsx = readSrc('routes/calibration-view/Calibration.tsx');
  const administrationTsx = readSrc('routes/administration.tsx');

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
    expect(caseHeaderTsx).toContain('stepper panel interactive stepper-with-head');
    expect(caseHeaderTsx).toContain('className="stepper-head"');
    expect(caseHeaderTsx).toContain('className="stepper-track"');
    expect(caseHeaderTsx).toContain("aria-pressed={activeStageTab === 'ALL'}");
    expect(caseHeaderTsx).not.toContain('className="stage-tab-bar"');
    expect(caseTsx).toContain('<CaseHeader');
    expect(scorecardPanelTsx).toContain('export const AssessorScorecard = memo(');
    expect(scorecardPanelTsx).toContain('export const AssessmentSummary = memo(');
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

  it('aligns standalone and admin panels (Administration, RolesMatrix) and route cards across scenarios', () => {
    const myWorkCss = readSrc('routes/my-work.css');
    const assessmentsCss = readSrc('routes/assessments.css');
    const employeesCss = readSrc('routes/employees.css');
    const developmentCss = readSrc('routes/development.css');
    const insightsCss = readSrc('routes/insights.css');
    const administrationCss = readSrc('routes/administration.css');
    const calibrationCss = readSrc('routes/calibration-view/calibration.css');

    // Administration should not nest <main> inside Shell and should mount RolesMatrixSection
    expect(administrationTsx).toContain('<RolesMatrixSection');
    expect(administrationTsx).not.toContain('<main');
    expect(administrationTsx).not.toContain('role="row"');
    expect(assessmentsTsx).not.toContain('role="row"');

    // Legacy indigo hex codes must remain purged from shared stylesheets
    expect(stylesCss).not.toContain('#4f46e5');
    expect(stylesCss).not.toContain('#4338ca');
    expect(stylesCss).not.toContain('#312e81');
    expect(calibrationCss).not.toContain('#312e81');
    expect(calibrationCss).not.toContain('#dedbff');
    expect(employeesCss).not.toContain('#4338ca');

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
    expect(administrationCss).toContain('.administration-page .sr-only');
    expect(stylesCss).toContain('.sr-only {');
    expect(administrationCss).toMatch(/\.admin-account-grid\s*\{[^}]*padding:\s*14px 16px;/s);
    expect(administrationCss).toMatch(/\.admin-row-actions\s*\{[^}]*flex-wrap:\s*nowrap;/s);
    expect(administrationCss).toMatch(/\.admin-audit-grid\s*\{[^}]*padding:\s*12px 16px;/s);

    expect(calibrationCss).toMatch(/\.cb-top\s*\{[^}]*padding:\s*20px 24px;/s);
    expect(calibrationCss).toMatch(/\.cb-pad\s*\{\s*padding:\s*20px 24px;/s);
    expect(calibrationCss).toMatch(/\.cb-filters\s*\{[^}]*padding:\s*16px 24px;/s);
    expect(calibrationCss).toMatch(/\.cb-empty\s*\{[^}]*padding:\s*14px 20px;/s);
  });
});
