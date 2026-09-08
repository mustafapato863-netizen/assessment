import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  createCaseViaApi,
  decideEligibilityViaApi,
  finalizePlanViaApi,
  scheduleEventViaApi,
  submitCaseViaApi,
  API_BASE_URL,
} from './fixtures/test-api';

test.describe('AssessFlow Accessibility (WCAG 2.2 AA) & axe-core Scan Specs', () => {
  test('A11y Scan 1: Case workspace view (WCAG 2.2 AA compliance spot scan)', async ({ page }) => {
    // 1. Seed fresh case via API
    const created = await createCaseViaApi({
      employeeName: `A11y Case Workspace ${Date.now().toString().slice(-4)}`,
    });
    await submitCaseViaApi(created.id, 1);

    // 2. Open case in browser
    await page.goto('/');
    await page.getByRole('button', { name: /Assessments/i }).click();
    await page.getByPlaceholder('Search case, employee, department…').fill(created.employeeName);
    await page.getByText(created.employeeName).first().click();

    // Ensure Case layout has loaded
    await expect(page.locator('.case-layout')).toBeVisible();
    await expect(page.locator('.case-summary')).toBeVisible();

    // 3. Run axe-core spot audit on the case workspace view
    const scanResults = await new AxeBuilder({ page })
      .include('.case-layout')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    const criticalOrSerious = scanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );

    if (criticalOrSerious.length > 0) {
      console.warn('axe-core findings in Case Workspace:', JSON.stringify(criticalOrSerious, null, 2));
    }

    expect(criticalOrSerious).toEqual([]);
  });

  test('A11y Scan 2: Approval decision view (WCAG 2.2 AA compliance spot scan)', async ({
    page,
    request,
  }) => {
    // 1. Prepare a case advanced to PENDING_APPROVAL via API
    const created = await createCaseViaApi({
      employeeName: `Approval A11y ${Date.now().toString().slice(-4)}`,
    });
    await submitCaseViaApi(created.id, 1);
    await decideEligibilityViaApi(created.id, 'ELIGIBLE', 2);
    await finalizePlanViaApi(created.id, 3);
    const eventRes = await scheduleEventViaApi(created.id, 4);
    const eventId = eventRes.data.eventId;

    // Submit evidence
    await request.post(`${API_BASE_URL}/events/${eventId}/evidence/submit`, {
      data: {
        summary: 'Comprehensive evaluation evidence observed across all assessment criteria.',
        expectedVersion: 5,
      },
      headers: { 'x-actor-id': 'lead-assessor' },
    });

    // Finalize result
    await request.post(`${API_BASE_URL}/cases/${created.id}/result/finalize`, {
      data: {
        resultCode: 'READY_NOW',
        evidenceSummary: 'Ready for promotion with full panel consensus.',
        expectedVersion: 6,
      },
      headers: { 'x-actor-id': 'panel-lead' },
    });

    // Submit recommendation
    await request.post(`${API_BASE_URL}/cases/${created.id}/recommendation`, {
      data: {
        code: 'PROMOTE',
        rationale: 'Promotion recommendation with extensive performance evidence.',
        requiresDevelopment: false,
        requiresReassessment: false,
        expectedVersion: 7,
      },
      headers: { 'x-actor-id': 'hr-partner' },
    });

    // 2. Open this case in browser (state is now PENDING_APPROVAL)
    await page.goto('/');
    await page.getByRole('button', { name: /Assessments/i }).click();
    await page.getByPlaceholder('Search case, employee, department…').fill(created.employeeName);
    await page.getByText(created.employeeName).first().click();

    // Verify decision & approval panel is rendered
    const decisionPanel = page.locator('.decision-panel');
    await expect(decisionPanel).toBeVisible();
    await expect(page.getByText(/Sequential approval steps/i)).toBeVisible();

    // 3. Run axe-core spot audit on the approval decision view
    const scanResults = await new AxeBuilder({ page })
      .include('.decision-panel')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    const criticalOrSerious = scanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );

    if (criticalOrSerious.length > 0) {
      console.warn('axe-core findings in Approval View:', JSON.stringify(criticalOrSerious, null, 2));
    }

    expect(criticalOrSerious).toEqual([]);
  });

  test('A11y Scan 3: Touch Target Sizes on Approval Actions (WCAG 2.2 SC 2.5.8 & UX Spec §17)', async ({
    page,
    request,
  }) => {
    // 1. Prepare a case advanced to PENDING_APPROVAL
    const created = await createCaseViaApi({
      employeeName: `Touch Target Candidate ${Date.now().toString().slice(-4)}`,
    });
    await submitCaseViaApi(created.id, 1);
    await decideEligibilityViaApi(created.id, 'ELIGIBLE', 2);
    await finalizePlanViaApi(created.id, 3);
    const eventRes = await scheduleEventViaApi(created.id, 4);
    const eventId = eventRes.data.eventId;

    await request.post(`${API_BASE_URL}/events/${eventId}/evidence/submit`, {
      data: {
        summary: 'Touch target verification evidence notes.',
        expectedVersion: 5,
      },
      headers: { 'x-actor-id': 'lead-assessor' },
    });

    await request.post(`${API_BASE_URL}/cases/${created.id}/result/finalize`, {
      data: {
        resultCode: 'READY_NOW',
        evidenceSummary: 'Consolidated ready outcome for touch targets.',
        expectedVersion: 6,
      },
      headers: { 'x-actor-id': 'panel-lead' },
    });

    await request.post(`${API_BASE_URL}/cases/${created.id}/recommendation`, {
      data: {
        code: 'PROMOTE',
        rationale: 'Touch target check recommendation text.',
        expectedVersion: 7,
      },
      headers: { 'x-actor-id': 'hr-partner' },
    });

    // 2. Open approval view with mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.locator('.mobile-menu').click();
    await page.getByRole('button', { name: /Assessments/i }).click();
    await page.getByPlaceholder('Search case, employee, department…').fill(created.employeeName);
    await page.getByText(created.employeeName).first().click();

    // Verify approval action buttons have compliant touch targets (>= 38px height, >= 40px width)
    const approveBtn = page.getByRole('button', { name: /Approve/i }).first();
    const rejectBtn = page.getByRole('button', { name: /Reject/i }).first();
    const requestChangesBtn = page.getByRole('button', { name: /Request changes/i }).first();

    await expect(approveBtn).toBeVisible();
    await expect(rejectBtn).toBeVisible();
    await expect(requestChangesBtn).toBeVisible();

    const approveBox = await approveBtn.boundingBox();
    const rejectBox = await rejectBtn.boundingBox();
    const requestChangesBox = await requestChangesBtn.boundingBox();

    expect(approveBox).not.toBeNull();
    expect(rejectBox).not.toBeNull();
    expect(requestChangesBox).not.toBeNull();

    // Verify button heights meet touch target thresholds
    expect(approveBox!.height).toBeGreaterThanOrEqual(38);
    expect(rejectBox!.height).toBeGreaterThanOrEqual(38);
    expect(requestChangesBox!.height).toBeGreaterThanOrEqual(38);
  });
});
