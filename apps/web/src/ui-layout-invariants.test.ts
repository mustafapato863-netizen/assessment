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
    expect(stylesCss).toContain('--radius-card: 14px;');
    expect(stylesCss).toContain('--radius-control: 10px;');
    expect(stylesCss).toContain('--radius-avatar: 999px;');
    expect(stylesCss).toContain('--control-height: 40px;');
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
});
