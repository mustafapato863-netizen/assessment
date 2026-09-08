import { test, expect } from '@playwright/test';
import { submitCaseViaApi } from './fixtures/test-api';

test.describe('AssessFlow End-to-End Workflow Smoke Spec', () => {
  test('Full Journey: request -> submit -> eligibility -> plan -> event -> evidence -> result -> recommendation -> approval -> close', async ({
    page,
  }) => {
    // -------------------------------------------------------------
    // Step 1: REQUEST (New assessment request created via Web UI)
    // -------------------------------------------------------------
    await page.goto('/');
    await expect(page.locator('.brand-copy strong')).toHaveText('AssessFlow');

    // Click "New assessment" in header/action
    const newRequestBtn = page.getByRole('button', { name: /New assessment/i }).first();
    await expect(newRequestBtn).toBeVisible();
    await newRequestBtn.click();

    // Drawer modal opens
    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();

    const candidateName = `Candidate E2E-${Date.now().toString().slice(-4)}`;
    await page.getByPlaceholder('Search employee').fill(candidateName);
    await page.getByPlaceholder('e.g. Product').fill('Product');
    await page.getByPlaceholder('Current position').fill('Senior Product Specialist');
    await page.getByPlaceholder('Target position').fill('Lead Product Manager');
    await page.getByPlaceholder('L4').fill('L5');
    await page
      .getByPlaceholder('Explain the business context, target scope, and reason for review…')
      .fill(
        'Demonstrated strong strategic ownership, driving market expansion and cross-team alignment.',
      );

    // Save draft and intercept the created case response
    const [createResponse] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/cases') && res.request().method() === 'POST',
      ),
      page.getByRole('button', { name: /Save draft/i }).click(),
    ]);

    expect(createResponse.status()).toBe(201);
    const createdCase = await createResponse.json();
    const caseId = createdCase.id;
    expect(caseId).toBeTruthy();

    // Verify Case view opened and displays Draft status
    await expect(page.locator('.case-code')).toBeVisible();
    await expect(page.locator('h1')).toHaveText(candidateName);
    await expect(page.locator('.case-header-side .status-badge')).toContainText('Draft');

    // -------------------------------------------------------------
    // Step 2: SUBMIT (Submit draft case for eligibility review)
    // -------------------------------------------------------------
    // Advance via API transition (POST /cases/:id/submit)
    const submitResult = await submitCaseViaApi(caseId, 1);
    expect(submitResult.status).toBe(201);
    expect(submitResult.data.status).toBe('PENDING_ELIGIBILITY');

    // The submit happened outside React Query: reload so the case view fetches fresh state.
    await page.reload();

    // Navigate to Assessments list and re-open case to load updated status
    await page.getByRole('button', { name: /Assessments/i }).click();
    await page.getByPlaceholder('Search case, employee, department…').fill(candidateName);
    await page.getByText(candidateName).first().click();

    await expect(page.locator('.case-header-side .status-badge')).toContainText(
      'Pending eligibility',
    );

    // -------------------------------------------------------------
    // Step 3: ELIGIBILITY (Review criteria and decide eligibility)
    // -------------------------------------------------------------
    const eligibilityPanel = page.locator('.decision-panel');
    await expect(eligibilityPanel).toBeVisible();
    await expect(eligibilityPanel.getByText('Eligibility review')).toBeVisible();

    // Click "Mark eligible"
    const markEligibleBtn = page.getByRole('button', { name: /Mark eligible/i });
    await expect(markEligibleBtn).toBeVisible();
    await markEligibleBtn.click();

    // Verify transition to READY_FOR_PLANNING
    await expect(page.locator('.case-header-side .status-badge')).toContainText(
      'Ready for planning',
    );

    // -------------------------------------------------------------
    // Step 4: PLAN (Finalize assessment plan with evaluation methods)
    // -------------------------------------------------------------
    const planPanel = page.locator('.plan-panel');
    await expect(planPanel).toBeVisible();

    // Fill lead assessor
    const leadAssessorInput = page.getByPlaceholder('e.g. Dr. Ahmed Mansour');
    await leadAssessorInput.fill('Dr. Nadia Selim');

    // Click "Finalize plan"
    const finalizePlanBtn = page.getByRole('button', {
      name: /Finalize assessment plan|Finalize plan/i,
    });
    await expect(finalizePlanBtn).toBeVisible();
    await finalizePlanBtn.click();

    // Verify transition to PLANNING
    await expect(page.locator('.case-header-side .status-badge')).toContainText('Planning');

    // -------------------------------------------------------------
    // Step 5: EVENT (Schedule evaluation session)
    // -------------------------------------------------------------
    const eventsPanel = page.locator('.events-panel');
    await expect(eventsPanel).toBeVisible();

    // Fill date/time and room
    const startsAtInput = eventsPanel.locator('input[type="datetime-local"]');
    await startsAtInput.fill('2026-10-15T09:30');

    const locationInput = page.getByPlaceholder('e.g. Assessment Room 302 or Teams link');
    await locationInput.fill('Assessment Center Executive Suite B');

    // Click "Schedule event"
    const scheduleEventBtn = page.getByRole('button', { name: /Schedule (assessment )?event/i });
    await expect(scheduleEventBtn).toBeVisible();
    await scheduleEventBtn.click();

    // Verify transition to SCHEDULED and session listed
    await expect(page.locator('.case-header-side .status-badge')).toContainText('Scheduled');
    await expect(page.getByText('Scheduled sessions (1)')).toBeVisible();

    // -------------------------------------------------------------
    // Step 6: EVIDENCE (Record and submit assessor evidence)
    // -------------------------------------------------------------
    const evidencePanel = page.locator('.evidence-panel');
    await expect(evidencePanel).toBeVisible();

    const evidenceTextarea = evidencePanel.locator('textarea');
    await expect(evidenceTextarea).toBeVisible();
    await evidenceTextarea.fill(
      'Candidate exhibited superior strategic framing, concise leadership responses, and thorough risk mitigation across complex scenarios.',
    );

    // Click "Submit evidence"
    const submitEvidenceBtn = evidencePanel.getByRole('button', { name: /Submit assessor evidence/i });
    await expect(submitEvidenceBtn).toBeVisible();
    await submitEvidenceBtn.click();

    // Verify evidence is sealed and status transitions to IN_PROGRESS
    await expect(page.getByText('Evidence submitted & locked')).toBeVisible();
    await expect(page.locator('.case-header-side .status-badge')).toContainText('In progress');

    // -------------------------------------------------------------
    // Step 7: RESULT (Finalize overall assessment outcome)
    // -------------------------------------------------------------
    const resultPanel = page.locator('.result-panel');
    await expect(resultPanel).toBeVisible();

    const resultSummary = page.getByPlaceholder(
      'Consolidated observations and overall performance rationale…',
    );
    await resultSummary.fill(
      'Unanimous panel consensus: candidate exceeds competency standards for target role L5.',
    );

    // Click "Finalize result"
    const finalizeResultBtn = page.getByRole('button', { name: /Finalize result/i });
    await expect(finalizeResultBtn).toBeVisible();
    await finalizeResultBtn.click();

    // Verify transition to RESULT_FINALIZED
    await expect(page.locator('.case-header-side .status-badge')).toContainText('Result finalized');
    await expect(page.getByText('Final assessment result')).toBeVisible();

    // -------------------------------------------------------------
    // Step 8: RECOMMENDATION (Submit business recommendation)
    // -------------------------------------------------------------
    const decisionSection = page.locator('.decision-panel');
    await expect(decisionSection).toBeVisible();

    const rationaleInput = page.getByPlaceholder(
      'Detail the business justification and competencies demonstrated (minimum 20 characters)…',
    );
    await rationaleInput.fill(
      'Strongly recommended for immediate promotion to Lead Product Manager with verified scope readiness.',
    );

    // Click "Submit recommendation"
    const submitRecBtn = page.getByRole('button', { name: /Submit recommendation/i });
    await expect(submitRecBtn).toBeVisible();
    await submitRecBtn.click();

    // Verify transition to PENDING_APPROVAL and approval steps visible
    await expect(page.locator('.case-header-side .status-badge')).toContainText(
      'Pending approval',
    );
    await expect(page.getByText(/Sequential approval steps \(2\)/i)).toBeVisible();

    // -------------------------------------------------------------
    // Step 9: APPROVAL (Sequential multi-step approval decisions)
    // -------------------------------------------------------------
    // Step 1: HR Approver (first pending step card in sequence order)
    await expect(page.getByText('Step 1: HR Approver')).toBeVisible();
    const hrComment = page.getByPlaceholder('Provide context for approval, changes, or rejection…').nth(0);
    await hrComment.fill('HR talent governance criteria fully validated.');

    const approveBtn1 = page.getByRole('button', { name: /^Approve$/i }).nth(0);
    await expect(approveBtn1).toBeVisible();
    await approveBtn1.click();

    // Step 2: Business Approver (step 1 is decided by now, so its controls unmounted)
    await expect(page.getByText('Step 2: Business Approver')).toBeVisible();
    const businessComment = page
      .getByPlaceholder('Provide context for approval, changes, or rejection…')
      .first();
    await businessComment.fill('Business executive approval confirmed.');

    const approveBtn2 = page.getByRole('button', { name: /^Approve$/i }).first();
    await expect(approveBtn2).toBeVisible();
    await approveBtn2.click();

    // Verify transition to APPROVED
    await expect(page.locator('.case-header-side .status-badge')).toContainText('Approved');

    // -------------------------------------------------------------
    // Step 10: CLOSE (Development follow-up and formal closure)
    // -------------------------------------------------------------
    const devPanel = page.locator('.development-panel');
    await expect(devPanel).toBeVisible();

    // Add a development action item
    await page
      .getByPlaceholder('e.g. Cross-functional leadership project')
      .fill('Executive Mentorship');
    await page.getByPlaceholder('e.g. Direct Manager').fill('VP of Product');
    await page.getByRole('button', { name: /Update development/i }).click();
    await expect(page.getByText('Executive Mentorship')).toBeVisible();

    // Click "Close case"
    const closeBtn = page.getByRole('button', { name: /Close case/i });
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    // Confirm close
    await expect(
      page.getByText('Confirm case closure? This locks the case lifecycle permanently.'),
    ).toBeVisible();
    const confirmCloseBtn = page.getByRole('button', { name: /Confirm close/i });
    await expect(confirmCloseBtn).toBeVisible();
    await confirmCloseBtn.click();

    // Verify final CLOSED state
    await expect(page.locator('.case-header-side .status-badge')).toContainText('Closed');
  });
});
