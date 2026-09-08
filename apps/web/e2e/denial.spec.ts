import { test, expect } from '@playwright/test';
import {
  API_BASE_URL,
  createCaseViaApi,
  decideEligibilityViaApi,
  finalizePlanViaApi,
  scheduleEventViaApi,
  submitCaseViaApi,
} from './fixtures/test-api';

test.describe('AssessFlow Denial & Invariant Specs', () => {
  test('Denial 1: Stale-version 409 (concurrency conflict protection)', async ({ page }) => {
    // 1. Create and submit case via API -> version becomes 2
    const created = await createCaseViaApi({
      employeeName: `Stale Test Candidate ${Date.now().toString().slice(-4)}`,
    });
    const submitRes = await submitCaseViaApi(created.id, 1);
    expect(submitRes.status).toBe(201);
    expect(submitRes.data.version).toBe(2);

    // 2. Direct API denial: Attempt transition with stale version 1
    const staleApiRes = await decideEligibilityViaApi(created.id, 'ELIGIBLE', 1);
    expect(staleApiRes.status).toBe(409);
    expect(staleApiRes.data.error?.code).toBe('CONCURRENCY_CONFLICT');

    // 3. UI denial verification: Open case in browser
    await page.goto('/');
    await page.getByRole('button', { name: /Assessments/i }).click();
    await page.getByPlaceholder('Search case, employee, department…').fill(created.employeeName);
    await page.getByText(created.employeeName).first().click();
    await expect(page.locator('.case-header-side .status-badge')).toContainText(
      'Pending eligibility',
    );

    // Advance the case out-of-band in the API to simulate concurrent update (version becomes 3)
    const concurrentUpdate = await decideEligibilityViaApi(created.id, 'ELIGIBLE', 2);
    expect(concurrentUpdate.status).toBe(201);

    // Now, without refreshing the page, the UI still holds version 2. Attempt "Mark not eligible" with reason
    await page.getByRole('button', { name: /Mark not eligible/i }).click();
    await page.locator('#eligibility-reason').fill('Conflicting decision attempt from stale session.');
    await page.getByRole('button', { name: /Confirm decision/i }).click();

    // Verify UI displays conflict alert (409) with refresh prompt
    const errorAlert = page.locator('[role="alert"]');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText(/Conflict detected \(409\)/i);
  });

  test('Denial 2: Validation 422 / 400 (malformed / incomplete inputs rejected)', async ({
    page,
    request,
  }) => {
    // 1. API validation: malformed case payload rejected with 400 BAD_REQUEST / VALIDATION_FAILED
    const invalidApiRes = await request.post(`${API_BASE_URL}/cases`, {
      data: {
        employeeName: '',
        department: '',
      },
      headers: { 'x-actor-id': 'e2e-tester' },
    });
    expect([400, 422]).toContain(invalidApiRes.status());
    const body = await invalidApiRes.json();
    expect(body.error?.code).toMatch(/VALIDATION_FAILED|BAD_REQUEST|VALIDATION_ERROR/);

    // 2. API gate read rejection (HTTP 422 UNPROCESSABLE_ENTITY on unscanned attachment preview)
    const caseForAtt = await createCaseViaApi({
      employeeName: `Scan Gate Candidate ${Date.now().toString().slice(-4)}`,
    });
    const attRes = await request.post(`${API_BASE_URL}/attachments`, {
      data: {
        caseId: caseForAtt.id,
        fileName: 'unscanned-evidence.pdf',
        contentType: 'application/pdf',
        sizeBytes: 4096,
        classification: 'EVIDENCE',
      },
      headers: { 'x-actor-id': 'e2e-tester' },
    });
    expect(attRes.status()).toBe(201);
    const attachment = await attRes.json();

    // Previewing before anti-malware scan completes is rejected with 422 SCAN_NOT_CLEAN
    const previewRes = await request.get(
      `${API_BASE_URL}/attachments/${attachment.id}/preview`,
      {
        headers: { 'x-actor-id': 'e2e-tester' },
      },
    );
    expect(previewRes.status()).toBe(422);
    const previewBody = await previewRes.json();
    expect(previewBody.error?.code).toBe('SCAN_NOT_CLEAN');

    // 3. UI validation: Drawer prevents submission when required fields are missing
    await page.goto('/');
    await page.getByRole('button', { name: /New assessment/i }).first().click();
    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();

    // Click "Save draft" with blank form
    await page.getByRole('button', { name: /Save draft/i }).click();

    // Verify client-side field validation errors are displayed
    await expect(drawer.locator('.field-error').first()).toBeVisible();
    await expect(drawer).toBeVisible();
  });

  test('Denial 3: Submitted-evidence immutability (audit seal enforcement)', async ({
    page,
    request,
  }) => {
    // 1. Prepare case up to SCHEDULED state via API
    const created = await createCaseViaApi({
      employeeName: `Immutability Test ${Date.now().toString().slice(-4)}`,
    });
    await submitCaseViaApi(created.id, 1);
    await decideEligibilityViaApi(created.id, 'ELIGIBLE', 2);
    await finalizePlanViaApi(created.id, 3);
    const eventRes = await scheduleEventViaApi(created.id, 4);
    expect(eventRes.status).toBe(201);
    const eventId = eventRes.data.eventId;
    expect(eventId).toBeTruthy();

    // 2. Submit evidence via UI in browser
    await page.goto('/');
    await page.getByRole('button', { name: /Assessments/i }).click();
    await page.getByPlaceholder('Search case, employee, department…').fill(created.employeeName);
    await page.getByText(created.employeeName).first().click();

    const evidencePanel = page.locator('.evidence-panel');
    await expect(evidencePanel).toBeVisible();

    const textarea = evidencePanel.locator('textarea');
    await textarea.fill(
      'Candidate exhibited outstanding analytical and situational leadership responses during live exercise.',
    );
    await evidencePanel.getByRole('button', { name: /Submit assessor evidence/i }).click();

    // 3. UI immutability verification: evidence is sealed and locked
    await expect(evidencePanel.getByText('Evidence submitted & locked')).toBeVisible();
    await expect(
      evidencePanel.getByText('This evidence record is sealed and read-only for audit integrity.'),
    ).toBeVisible();
    await expect(textarea).toBeDisabled();
    await expect(evidencePanel.getByRole('button', { name: /Submit assessor evidence/i })).not.toBeVisible();

    // 4. API lifecycle immutability verification:
    // Once the assessment moves forward (finalize result), any attempt to submit new evidence
    // on this closed assessment session is rejected by the server
    await request.post(`${API_BASE_URL}/cases/${created.id}/result/finalize`, {
      data: {
        resultCode: 'READY_NOW',
        evidenceSummary: 'Assessment finalized by panel lead.',
        expectedVersion: 6,
      },
      headers: { 'x-actor-id': 'panel-lead' },
    });

    const lateSubmission = await request.post(`${API_BASE_URL}/events/${eventId}/evidence/submit`, {
      data: {
        summary: 'Late modification attempt to sealed session.',
        expectedVersion: 7,
      },
      headers: { 'x-actor-id': 'assessor' },
    });

    // Server must reject out-of-lifecycle or already-submitted modification
    expect([400, 409]).toContain(lateSubmission.status());
    const errBody = await lateSubmission.json();
    expect(errBody.error?.code).toMatch(/INVALID_TRANSITION|ALREADY_SUBMITTED/);
  });
});
