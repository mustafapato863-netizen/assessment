import { test, expect } from '@playwright/test';
import { signInDemoSession } from './fixtures/test-api';

test.describe('AssessFlow Talent Calibration & 9-Box Matrix (UX-18)', () => {
  test('renders 9-box talent calibration workspace and filters by department', async ({ page }) => {
    await signInDemoSession(page);
    await page.goto('/calibration');

    await expect(page.getByRole('heading', { name: /^Calibration$/i }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /9-box heatmap/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Readiness by department/i })).toBeVisible();

    await expect(page.getByText('Ready now', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('With development', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Not ready', { exact: true }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Table' }).click();
    await expect(page.getByRole('heading', { name: /Candidates/i })).toBeVisible();

    const deptSelect = page.locator('.cb-filters select').first();
    await expect(deptSelect).toBeVisible();
    await expect(deptSelect.locator('option', { hasText: 'All departments' })).toBeAttached();
  });
});
