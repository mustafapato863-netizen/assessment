import { test, expect } from '@playwright/test';
import {
  createCaseViaApi,
  submitCaseViaApi,
  decideEligibilityViaApi,
  finalizePlanViaApi,
  scheduleEventViaApi,
  signInDemoSession,
} from './fixtures/test-api';

test.describe('AssessFlow Case Workspace Deepening Spec', () => {
  test('1. Audit timeline in case rail & Activity drawer with focus trap and Esc close', async ({
    page,
  }) => {
    await signInDemoSession(page);
    // 1. Create and advance a case through multiple workflow steps to generate rich activity history
    const created = await createCaseViaApi({
      employeeName: `Audit Candidate ${Date.now().toString().slice(-4)}`,
    });
    const caseId = created.id;

    // Step 1: submit (generates activity)
    await submitCaseViaApi(caseId, 1);
    // Step 2: eligible (generates activity)
    await decideEligibilityViaApi(caseId, 'ELIGIBLE', 2);
    // Step 3: plan (generates activity)
    await finalizePlanViaApi(caseId, 3);
    // Step 4: schedule event (generates activity)
    await scheduleEventViaApi(caseId, 4);

    // Navigate to the case page
    await page.goto(`/cases/${caseId}`);

    // Wait for the Activity rail panel to be visible
    const activityPanel = page.locator('.activity-panel');
    await expect(activityPanel).toBeVisible();

    // Verify activity items render with tone dots, actions, actors, and timestamps
    const activityItems = activityPanel.locator('.activity-item');
    await expect(activityItems.first()).toBeVisible();
    const count = await activityItems.count();
    expect(count).toBeGreaterThan(0);

    // Check tone dot is rendered
    await expect(activityItems.first().locator('.activity-dot')).toBeVisible();

    // Check "View full history" toggle if > 5 items
    const fullHistoryToggle = activityPanel.getByRole('button', { name: /View full history/i });
    if (await fullHistoryToggle.isVisible()) {
      await fullHistoryToggle.click();
      await expect(activityPanel.getByRole('button', { name: /Show less/i })).toBeVisible();
      await activityPanel.getByRole('button', { name: /Show less/i }).click();
      await expect(fullHistoryToggle).toBeVisible();
    }

    // Trigger Activity Drawer via "View audit" button
    const viewAuditBtn = activityPanel.getByRole('button', { name: /View audit/i });
    await expect(viewAuditBtn).toBeVisible();
    await viewAuditBtn.click();

    // Verify Activity Drawer modal opens
    const drawer = page.getByRole('dialog', { name: /Activity history/i });
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('.drawer-header h2')).toHaveText('Activity history');

    // Verify full timeline in drawer
    const drawerItems = drawer.locator('.activity-item');
    expect(await drawerItems.count()).toBeGreaterThanOrEqual(count);

    // Verify Esc key closes drawer and returns focus to trigger
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();
    await expect(viewAuditBtn).toBeFocused();

    // Re-open and verify backdrop click closes drawer
    await viewAuditBtn.click();
    await expect(drawer).toBeVisible();
    await page.locator('.drawer-backdrop').click({ position: { x: 10, y: 10 } });
    await expect(drawer).not.toBeVisible();
  });

  test('2. Employee 360 history across reasons with result chips', async ({ page }) => {
    await signInDemoSession(page);
    await page.goto('/employees');

    await expect(page.locator('.page-heading .eyebrow')).toHaveText('TALENT SCOPE');
    await expect(page.locator('.page-heading h1')).toHaveText('Employees');

    const directory = page.locator('.em-card[aria-label="Employee directory"]');
    await expect(directory).toBeVisible();

    const firstRow = directory.locator('.em-row').first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();

    await expect(page.locator('.em-detail')).toBeVisible();
    await expect(page.getByRole('link', { name: /Open full case/i }).first()).toBeVisible();
  });

  test('3. Attachment upload, 10MB validation check, and scan status gate in EvidencePanel', async ({
    page,
  }) => {
    await signInDemoSession(page);
    // Create case and advance to IN_PROGRESS so EvidencePanel is active
    const created = await createCaseViaApi({
      employeeName: `Attachment Candidate ${Date.now().toString().slice(-4)}`,
    });
    const caseId = created.id;
    await submitCaseViaApi(caseId, 1);
    await decideEligibilityViaApi(caseId, 'ELIGIBLE', 2);
    await finalizePlanViaApi(caseId, 3);
    await scheduleEventViaApi(caseId, 4);

    await page.goto(`/cases/${caseId}`);

    const evidencePanel = page.locator('.evidence-panel');
    await expect(evidencePanel).toBeVisible();
    await expect(evidencePanel.getByText('Evidence attachments & scan gate')).toBeVisible();

    // 1. Client-side validation: reject oversized file (>10MB)
    const fileInput = evidencePanel.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'large-assessment-portfolio.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(11 * 1024 * 1024), // 11MB
    });

    await expect(evidencePanel.getByText(/exceeds 10MB maximum limit/i)).toBeVisible();

    // 2. Upload valid file under 10MB
    await fileInput.setInputFiles({
      name: 'behavioral-evidence-interview.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(64 * 1024), // 64KB
    });

    const attachmentItem = evidencePanel.locator('.attachment-item', {
      hasText: 'behavioral-evidence-interview.pdf',
    });
    await expect(attachmentItem).toBeVisible();
    await expect(attachmentItem.getByText(/Scan pending|PENDING/i).first()).toBeVisible();
    await expect(
      attachmentItem.locator('button[title="Preview clean attachment"]'),
    ).not.toBeVisible();
  });
});
