import { test, expect } from '@playwright/test';

test.describe('AssessFlow Talent Calibration & 9-Box Matrix (UX-18)', () => {
  test('renders 9-box talent calibration workspace and filters by department', async ({ page }) => {
    // Navigate to calibration workspace
    await page.goto('/#/calibration');

    // Verify workspace title
    await expect(page.getByRole('heading', { name: /Calibration/i }).first()).toBeVisible();

    // Verify 9-box grid rendered with all boxes
    await expect(page.getByText(/9-Box Talent Calibration Matrix/i)).toBeVisible();
    await expect(page.getByText('BOX 9')).toBeVisible();
    await expect(page.getByText('BOX 1')).toBeVisible();

    // Verify readiness distribution metric cards
    await expect(page.getByText('Ready Now', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('With Development', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Not Ready', { exact: true }).first()).toBeVisible();

    // Test department filtering
    const engineeringButton = page.getByRole('button', { name: 'Engineering' });
    await engineeringButton.click();

    // Verify cross-department comparison table
    await expect(page.getByRole('heading', { name: /Cross-Department Readiness Distribution/i })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Engineering' })).toBeVisible();

    // Test filtering by another department (e.g. Product)
    const productButton = page.getByRole('button', { name: 'Product' });
    await productButton.click();

    // Reset filter to All Departments
    const allDeptButton = page.getByRole('button', { name: 'All Departments' });
    await allDeptButton.click();
    await expect(page.getByText('Omar Khalil')).toBeVisible();
  });
});
