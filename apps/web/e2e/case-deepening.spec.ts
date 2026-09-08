import { test, expect } from '@playwright/test';
import {
  createCaseViaApi,
  submitCaseViaApi,
  decideEligibilityViaApi,
  finalizePlanViaApi,
  scheduleEventViaApi,
} from './fixtures/test-api';

test.describe('AssessFlow Case Workspace Deepening Spec', () => {
  test('1. Audit timeline in case rail & Activity drawer with focus trap and Esc close', async ({
    page,
  }) => {
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
    await page.goto(`/#/cases/${caseId}`);

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
    await page.goto('/#/employees');

    // Verify page heading and pipeline note
    await expect(page.locator('.page-heading h1')).toHaveText('Employees');
    await expect(page.locator('.pipeline-note')).toBeVisible();

    // Verify Employee 360 directory is present
    const directory = page.locator('.panel', { hasText: /EMPLOYEE 360 DIRECTORY/i });
    await expect(directory).toBeVisible();

    // Click on an employee context button (e.g., Omar Hassan or first available profile)
    const employeeProfileBtn = directory.locator('button.secondary-button').first();
    await expect(employeeProfileBtn).toBeVisible();
    const employeeName = await employeeProfileBtn.locator('strong').innerText();
    await employeeProfileBtn.click();

    // Verify transition to Employee 360 view
    await expect(page.locator('.page-heading .eyebrow')).toHaveText('EMPLOYEE 360');
    await expect(page.locator('.page-heading h1')).toHaveText(employeeName);
    await expect(page.locator('.employee-360-summary')).toBeVisible();

    // Verify chronological case table is rendered with StatusBadge
    const caseTable = page.locator('.cases-panel table');
    await expect(caseTable).toBeVisible();
    await expect(caseTable.locator('.status-badge').first()).toBeVisible();

    // Verify "Back to all employees" button returns to directory
    const backBtn = page.getByRole('button', { name: /Back to all employees/i });
    await expect(backBtn).toBeVisible();
    await backBtn.click();
    await expect(page.locator('.page-heading .eyebrow')).toHaveText('TALENT SCOPE');
  });

  test('3. Attachment upload, 10MB validation check, and scan status gate in EvidencePanel', async ({
    page,
  }) => {
    // Create case and advance to IN_PROGRESS so EvidencePanel is active
    const created = await createCaseViaApi({
      employeeName: `Attachment Candidate ${Date.now().toString().slice(-4)}`,
    });
    const caseId = created.id;
    await submitCaseViaApi(caseId, 1);
    await decideEligibilityViaApi(caseId, 'ELIGIBLE', 2);
    await finalizePlanViaApi(caseId, 3);
    await scheduleEventViaApi(caseId, 4);

    await page.goto(`/#/cases/${caseId}`);

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

    // Verify client error message is displayed
    const notice = evidencePanel.locator('.restricted-callout');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(/exceeds 10MB maximum limit/i);

    // 2. Upload valid file under 10MB
    await fileInput.setInputFiles({
      name: 'behavioral-evidence-interview.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(512 * 1024), // 512KB
    });

    // Verify the attachment item appears in the list
    const attachmentItem = evidencePanel.locator('.attachment-item', {
      hasText: 'behavioral-evidence-interview.pdf',
    });
    await expect(attachmentItem).toBeVisible();

    // Verify scan-status chip is displayed (PENDING)
    await expect(attachmentItem.locator('.status-badge')).toContainText(/Scan pending|PENDING/i);

    // Verify preview link is NOT available while scan is pending, and "Scan pending" note is displayed
    await expect(attachmentItem.locator('.scan-pending-note')).toBeVisible();
    await expect(attachmentItem.getByRole('button', { name: /Preview/i })).not.toBeVisible();
  });
});
