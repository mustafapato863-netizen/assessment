(() => {
  const stageContent = document.querySelector('#stageContent');
  const stageRail = document.querySelector('#stageRail');
  if (!stageContent || !stageRail) return;

  const stages = [
    { key: 'request', label: 'Request', title: 'Request assessment', description: 'Capture the employee, reason, and target role before checking eligibility.', rule: 'Request data must be complete', owner: 'Requester', next: 'Eligibility review', audit: 'assessment.requested' },
    { key: 'eligibility', label: 'Eligibility', title: 'Review eligibility', description: 'Confirm the policy gate before any assessment plan can be created.', rule: 'Eligibility must be confirmed or explicitly overridden', owner: 'HR/Talent', next: 'Assessment plan', audit: 'eligibility.confirmed' },
    { key: 'plan', label: 'Plan', title: 'Build assessment plan', description: 'Choose the method, assessor, and target event date for this case.', rule: 'Method, assessor, and event date are required', owner: 'HR/Talent + Manager', next: 'Evidence capture', audit: 'assessment.plan.created' },
    { key: 'evidence', label: 'Evidence', title: 'Capture assessor evidence', description: 'Collect structured observations and supporting material from the assessment.', rule: 'Required evidence must be submitted', owner: 'Assessor', next: 'Result finalization', audit: 'evidence.submitted' },
    { key: 'result', label: 'Result', title: 'Finalize assessment result', description: 'Record the human-judgment result. Numeric scoring is not required for this path.', rule: 'One explicit result is required; no score is required', owner: 'Assessor + HR', next: 'Recommendation', audit: 'result.finalized' },
    { key: 'recommendation', label: 'Recommendation', title: 'Submit recommendation', description: 'Separate the business recommendation from the assessment result.', rule: 'Recommendation and follow-up action must be documented', owner: 'Manager + HR', next: 'Approval', audit: 'recommendation.submitted' },
    { key: 'approval', label: 'Approval', title: 'Review and approve', description: 'The designated approver confirms, rejects, or requests changes to the recommendation.', rule: 'Approver can approve or request changes; history is preserved', owner: 'Designated approver', next: 'Closure', audit: 'recommendation.approved' },
    { key: 'closure', label: 'Closure', title: 'Close assessment', description: 'Complete the follow-up record and close the case with a durable audit trail.', rule: 'Approval and follow-up ownership must be complete', owner: 'HR/Talent', next: 'Linked reassessment', audit: 'assessment.closed' },
  ];

  const initialState = () => ({
    stage: 0,
    busy: false,
    closed: false,
    case: { employee: 'Anna Cooper', role: 'Software Engineer · L4', reason: 'Promotion' },
    eligibility: { verified: false },
    plan: { method: 'CBI', assessor: 'David Lee', date: '2026-08-20' },
    evidence: { submitted: false },
    result: { value: 'Ready with Development' },
    recommendation: { value: 'Development then reassess', action: '90-day leadership stretch assignment' },
    approval: { decision: null },
    events: [{ title: 'Simulation initialized', meta: 'Reference case created locally' }],
  });

  let state = initialState();
  let render = () => {};
  const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const icon = (name) => `<svg aria-hidden="true"><use href="assets/icons.svg#${name}"></use></svg>`;
  const byId = (id) => document.getElementById(id);

  const simToast = (message, tone = 'info') => {
    if (typeof toast === 'function') toast(message, tone);
  };

  const addEvent = (title, meta) => {
    state.events.push({ title, meta });
  };

  const runAction = (button, callback) => {
    if (state.busy || !button) return;
    state.busy = true;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.innerHTML = '<span class="sim-loading"><i aria-hidden="true"></i>Saving reference state...</span>';
    window.setTimeout(() => {
      callback();
      state.busy = false;
      render();
    }, 420);
  };

  const stageView = {
    request: () => `
      <div class="sim-content">
        <div><div class="sim-section-label">Case details</div><div class="sim-section-help">Use the same request structure that starts an assessment case in the product.</div></div>
        <div class="sim-form-grid">
          <div class="sim-field"><label for="simEmployee">Employee name</label><input id="simEmployee" value="${escapeHTML(state.case.employee)}"/></div>
          <div class="sim-field"><label for="simReason">Assessment reason</label><select id="simReason"><option ${state.case.reason === 'Promotion' ? 'selected' : ''}>Promotion</option><option ${state.case.reason === 'Internal Mobility' ? 'selected' : ''}>Internal Mobility</option><option ${state.case.reason === 'Role Realignment' ? 'selected' : ''}>Role Realignment</option></select></div>
          <div class="sim-field full"><label for="simRole">Target role and level</label><input id="simRole" value="${escapeHTML(state.case.role)}"/></div>
        </div>
        <div class="sim-callout"><span class="icon">${icon('assessment')}</span><div><strong>What happens next?</strong>The request is saved, then the case enters the required eligibility gate. No assessment planning is available before that check.</div></div>
        <div class="sim-actions"><span class="sim-action-note">Creates a draft case reference</span><button class="btn btn-primary" data-sim-action="request" type="button">Start eligibility review ${icon('arrow')}</button></div>
      </div>`,
    eligibility: () => `
      <div class="sim-content">
        <div><div class="sim-section-label">Policy gate</div><div class="sim-section-help">The result below is simulated from the approved workflow reference. A real system would evaluate authoritative employee and role data on the server.</div></div>
        <div class="sim-checklist">
          <div class="sim-check-row"><span class="check-icon">${icon('check')}</span><div><strong>Employee is active in the organization</strong><span>Employment status is available from the HRIS source.</span></div><span class="badge badge-success">Pass</span></div>
          <div class="sim-check-row"><span class="check-icon">${icon('check')}</span><div><strong>Target role has a valid level</strong><span>Role and level metadata are available for the assessment reason.</span></div><span class="badge badge-success">Pass</span></div>
          <div class="sim-check-row"><span class="check-icon">${icon('check')}</span><div><strong>Required review window is open</strong><span>No conflicting assessment is currently blocking this request.</span></div><span class="badge badge-success">Pass</span></div>
        </div>
        <div class="sim-callout"><span class="icon">${icon('help')}</span><div><strong>Override stays explicit</strong>If policy data fails in the real product, an authorized HR/Talent user must record an override reason. The UI must never silently bypass this gate.</div></div>
        <div class="sim-actions"><span class="sim-action-note">Three checks ready for confirmation</span><button class="btn btn-primary" data-sim-action="eligibility" type="button">Confirm eligibility ${icon('arrow')}</button></div>
      </div>`,
    plan: () => `
      <div class="sim-content">
        <div><div class="sim-section-label">Assessment configuration</div><div class="sim-section-help">Choose a supported method, assessor, and date. This reference keeps the catalog intentionally small for the MVP.</div></div>
        <div class="sim-form-grid">
          <div class="sim-field"><label for="simMethod">Assessment method</label><select id="simMethod"><option ${state.plan.method === 'CBI' ? 'selected' : ''}>CBI</option><option ${state.plan.method === 'Case Study / Work Sample' ? 'selected' : ''}>Case Study / Work Sample</option><option ${state.plan.method === 'Roleplay' ? 'selected' : ''}>Roleplay</option></select></div>
          <div class="sim-field"><label for="simAssessor">Lead assessor</label><select id="simAssessor"><option ${state.plan.assessor === 'David Lee' ? 'selected' : ''}>David Lee</option><option ${state.plan.assessor === 'Sarah Johnson' ? 'selected' : ''}>Sarah Johnson</option><option ${state.plan.assessor === 'Priya Patel' ? 'selected' : ''}>Priya Patel</option></select></div>
          <div class="sim-field"><label for="simDate">Target assessment date</label><input id="simDate" type="date" value="${escapeHTML(state.plan.date)}"/></div>
        </div>
        <div class="sim-callout"><span class="icon">${icon('calibration')}</span><div><strong>Plan is versioned</strong>Changes to methods, assessors, or events should be visible in the activity history and protected by concurrency checks.</div></div>
        <div class="sim-actions"><span class="sim-action-note">Eligibility confirmed</span><button class="btn btn-primary" data-sim-action="plan" type="button">Save assessment plan ${icon('arrow')}</button></div>
      </div>`,
    evidence: () => `
      <div class="sim-content">
        <div><div class="sim-section-label">Evidence capture</div><div class="sim-section-help">Show the assessor what is required without forcing a numeric score.</div></div>
        <div class="sim-checklist">
          <div class="sim-check-row"><span class="check-icon">${icon('check')}</span><div><strong>Behavioral evidence captured</strong><span>Clear example linked to the target role capability.</span></div><span class="badge badge-success">Ready</span></div>
          <div class="sim-check-row"><span class="check-icon">${icon('check')}</span><div><strong>Work sample reviewed</strong><span>Assessor note linked to the planned assessment method.</span></div><span class="badge badge-success">Ready</span></div>
          <div class="sim-check-row"><span class="check-icon">${icon('upload')}</span><div><strong>Supporting attachment</strong><span>Optional private evidence file, subject to scanning and access policy.</span></div><span class="badge badge-neutral">Optional</span></div>
        </div>
        <div class="sim-actions"><span class="sim-action-note">2 required evidence items ready</span><button class="btn btn-primary" data-sim-action="evidence" type="button">Submit evidence ${icon('arrow')}</button></div>
      </div>`,
    result: () => `
      <div class="sim-content">
        <div><div class="sim-section-label">Human-judgment result</div><div class="sim-section-help">Select one explicit result. Numeric scoring is intentionally not part of this MVP reference path.</div></div>
        <div class="sim-choice-grid" role="radiogroup" aria-label="Assessment result">
          ${[['Ready Now', 'Evidence supports immediate readiness.'], ['Ready with Development', 'Readiness depends on a defined development action.'], ['Not Ready', 'Evidence does not support readiness at this time.']].map(([value, description]) => `<label class="sim-choice ${state.result.value === value ? 'selected' : ''}"><input type="radio" name="simResult" value="${escapeHTML(value)}" ${state.result.value === value ? 'checked' : ''}/><strong>${escapeHTML(value)}</strong><span>${escapeHTML(description)}</span></label>`).join('')}
        </div>
        <div class="sim-callout"><span class="icon">${icon('check')}</span><div><strong>Result and recommendation stay separate</strong>The next stage records a business recommendation and does not overwrite the assessment result.</div></div>
        <div class="sim-actions"><span class="sim-action-note">Evidence submitted by David Lee</span><button class="btn btn-primary" data-sim-action="result" type="button">Finalize result ${icon('arrow')}</button></div>
      </div>`,
    recommendation: () => `
      <div class="sim-content">
        <div><div class="sim-section-label">Business recommendation</div><div class="sim-section-help">Document the action the business should take based on the result and organizational context.</div></div>
        <div class="sim-form-grid">
          <div class="sim-field full"><label for="simRecommendation">Recommendation</label><select id="simRecommendation"><option ${state.recommendation.value === 'Development then reassess' ? 'selected' : ''}>Development then reassess</option><option ${state.recommendation.value === 'Proceed with promotion' ? 'selected' : ''}>Proceed with promotion</option><option ${state.recommendation.value === 'Hold current role' ? 'selected' : ''}>Hold current role</option></select></div>
          <div class="sim-field full"><label for="simDevelopment">Development action</label><textarea id="simDevelopment">${escapeHTML(state.recommendation.action)}</textarea></div>
        </div>
        <div class="sim-callout"><span class="icon">${icon('task')}</span><div><strong>Make the follow-up actionable</strong>A recommendation should have an owner, target date, and reassessment path before approval.</div></div>
        <div class="sim-actions"><span class="sim-action-note">Result: ${escapeHTML(state.result.value)}</span><button class="btn btn-primary" data-sim-action="recommendation" type="button">Submit recommendation ${icon('arrow')}</button></div>
      </div>`,
    approval: () => `
      <div class="sim-content">
        <div><div class="sim-section-label">Approval route</div><div class="sim-section-help">Approval is a server-controlled decision. This reference shows the review context and both possible outcomes.</div></div>
        <div class="sim-approval">
          <div class="sim-approval-card approved"><strong>Assessment result</strong><span>${escapeHTML(state.result.value)}</span></div>
          <div class="sim-approval-card"><strong>Business recommendation</strong><span>${escapeHTML(state.recommendation.value)}</span></div>
          <div class="sim-approval-card"><strong>Approver</strong><span>Sarah Johnson &middot; HR Business Partner</span></div>
          <div class="sim-approval-card"><strong>Audit requirement</strong><span>Decision, comment, timestamp, and actor are recorded.</span></div>
        </div>
        <div class="sim-callout"><span class="icon">${icon('help')}</span><div><strong>Approval can request changes</strong>The rejection path returns the case to Recommendation without deleting the previous submission.</div></div>
        <div class="sim-actions"><button class="btn btn-secondary" data-sim-action="request-changes" type="button">Request changes</button><button class="btn btn-primary" data-sim-action="approve" type="button">Approve recommendation ${icon('check')}</button></div>
      </div>`,
    closure: () => state.closed ? `
      <div class="sim-complete"><div class="sim-complete-mark">${icon('check')}</div><h3>Assessment case closed</h3><p>The simulation completed the MVP path. In production, the closure event would lock the final record, retain the audit history, and schedule any approved follow-up.</p><button class="btn btn-secondary" id="restartSimulation" type="button">Run another reference case</button></div>
    ` : `
      <div class="sim-content">
        <div><div class="sim-section-label">Final follow-up</div><div class="sim-section-help">Close only after the approved recommendation and follow-up owner are confirmed.</div></div>
        <div class="sim-result-banner"><div><strong>Approved: ${escapeHTML(state.recommendation.value)}</strong><span>Follow-up owner: Sarah Johnson &middot; Review in 90 days</span></div><span class="sim-result-mark">${icon('check')}</span></div>
        <div class="sim-callout"><span class="icon">${icon('docs')}</span><div><strong>Closure is durable</strong>After closure, the case remains available for history and can start a linked reassessment later.</div></div>
        <div class="sim-actions"><span class="sim-action-note">All required approval steps are complete</span><button class="btn btn-primary" data-sim-action="close" type="button">Close assessment ${icon('check')}</button></div>
      </div>`,
  };

  const statusForStage = (index) => {
    if (state.closed || index < state.stage) return { className: 'done', label: 'Complete' };
    if (index === state.stage) return { className: 'active', label: 'In progress' };
    return { className: 'locked', label: 'Pending' };
  };

  const renderRail = () => {
    stageRail.replaceChildren();
    stages.forEach((stage, index) => {
      const status = statusForStage(index);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `sim-stage ${status.className}`;
      button.dataset.stage = String(index);
      button.disabled = !state.closed && index > state.stage;
      button.setAttribute('aria-current', index === state.stage && !state.closed ? 'step' : 'false');
      button.title = `${stage.label}: ${status.label}`;
      button.innerHTML = `<span class="sim-stage-index">${state.closed || index < state.stage ? icon('check') : index + 1}</span><span class="sim-stage-label">${stage.label}</span>`;
      button.addEventListener('click', () => {
        if (!button.disabled) { state.stage = index; render(); }
      });
      stageRail.appendChild(button);
    });
  };

  const renderSummary = () => {
    const currentLabel = state.closed ? 'Closed' : state.stage === 0 ? 'Draft' : stages[state.stage].label;
    const progress = state.closed ? 100 : Math.round((state.stage / stages.length) * 100);
    byId('caseEmployee').textContent = state.case.employee;
    byId('caseRole').textContent = state.case.role;
    byId('caseReason').textContent = state.case.reason;
    byId('caseStatus').textContent = currentLabel;
    byId('caseStatus').className = `badge ${state.closed ? 'badge-success' : state.stage > 5 ? 'badge-violet' : state.stage > 0 ? 'badge-info' : 'badge-neutral'}`;
    byId('progressLabel').textContent = `${progress}%`;
    byId('progressBar').style.width = `${progress}%`;
    byId('activityCount').textContent = `${state.events.length} event${state.events.length === 1 ? '' : 's'}`;
    byId('timeline').innerHTML = state.events.slice().reverse().map((event) => `<div class="sim-event"><strong>${escapeHTML(event.title)}</strong><span>${escapeHTML(event.meta)}</span></div>`).join('');
  };

  const renderInspector = () => {
    const stage = stages[state.stage];
    byId('contractRule').textContent = state.closed ? 'Closed record is immutable' : stage.rule;
    byId('contractHelp').textContent = state.closed ? 'A linked reassessment can be created without rewriting the historical case.' : 'The next state is available only after this contract is satisfied.';
    byId('contractOwner').textContent = state.closed ? 'HR/Talent + Operations' : stage.owner;
    byId('contractNext').textContent = state.closed ? 'Allowed next: Linked reassessment' : `Allowed next: ${stage.next}`;
    byId('contractAudit').textContent = state.closed ? 'assessment.closed' : stage.audit;
  };

  const renderStage = () => {
    const stage = stages[state.stage];
    const complete = state.closed;
    byId('stageKicker').textContent = complete ? 'Workflow complete' : `Stage ${state.stage + 1} of ${stages.length}`;
    byId('stageTitle').textContent = complete ? 'Assessment case closed' : stage.title;
    byId('stageDescription').textContent = complete ? 'The reference path is complete. Reset it to explore the workflow again.' : stage.description;
    const badge = byId('stageBadge');
    badge.textContent = complete ? 'Closed' : statusForStage(state.stage).label;
    badge.className = `badge ${complete ? 'badge-success' : state.stage === 0 ? 'badge-neutral' : 'badge-info'}`;
    stageContent.innerHTML = stageView[stage.key]();
    if (typeof setupIcons === 'function') setupIcons();
    bindStageEvents();
  };

  const bindStageEvents = () => {
    stageContent.querySelectorAll('[data-sim-action]').forEach((button) => button.addEventListener('click', () => handleAction(button.dataset.simAction, button)));
    stageContent.querySelectorAll('input[name="simResult"]').forEach((input) => input.addEventListener('change', () => {
      state.result.value = input.value;
      stageContent.querySelectorAll('.sim-choice').forEach((choice) => choice.classList.toggle('selected', choice.querySelector('input')?.checked));
    }));
    byId('restartSimulation')?.addEventListener('click', reset);
  };

  const handleAction = (action, button) => {
    if (action === 'request') {
      runAction(button, () => {
        state.case.employee = document.querySelector('#simEmployee').value.trim() || 'Unnamed employee';
        state.case.reason = document.querySelector('#simReason').value;
        state.case.role = document.querySelector('#simRole').value.trim() || 'Target role pending';
        state.stage = 1;
        addEvent('Assessment request submitted', `${state.case.reason} · ${state.case.employee}`);
        simToast('Eligibility review started', 'success');
      });
    }
    if (action === 'eligibility') runAction(button, () => { state.eligibility.verified = true; state.stage = 2; addEvent('Eligibility confirmed', 'All required policy checks passed'); simToast('Eligibility confirmed', 'success'); });
    if (action === 'plan') runAction(button, () => { state.plan.method = document.querySelector('#simMethod').value; state.plan.assessor = document.querySelector('#simAssessor').value; state.plan.date = document.querySelector('#simDate').value; state.stage = 3; addEvent('Assessment plan saved', `${state.plan.method} · ${state.plan.assessor}`); simToast('Assessment plan saved', 'success'); });
    if (action === 'evidence') runAction(button, () => { state.evidence.submitted = true; state.stage = 4; addEvent('Evidence submitted', 'Assessor evidence is ready for result review'); simToast('Evidence submitted', 'success'); });
    if (action === 'result') runAction(button, () => { state.result.value = document.querySelector('input[name="simResult"]:checked')?.value || state.result.value; state.stage = 5; addEvent('Assessment result finalized', state.result.value); simToast('Result finalized', 'success'); });
    if (action === 'recommendation') runAction(button, () => { state.recommendation.value = document.querySelector('#simRecommendation').value; state.recommendation.action = document.querySelector('#simDevelopment').value.trim() || 'Follow-up action pending'; state.stage = 6; addEvent('Recommendation submitted', state.recommendation.value); simToast('Recommendation submitted', 'success'); });
    if (action === 'approve') runAction(button, () => { state.approval.decision = 'Approved'; state.stage = 7; addEvent('Recommendation approved', 'Sarah Johnson · HR Business Partner'); simToast('Recommendation approved', 'success'); });
    if (action === 'request-changes') runAction(button, () => { state.approval.decision = 'Changes requested'; state.stage = 5; addEvent('Approval requested changes', 'Returned to recommendation'); simToast('Returned to recommendation', 'info'); });
    if (action === 'close') runAction(button, () => { state.closed = true; addEvent('Assessment case closed', 'Reference workflow completed'); simToast('Assessment case closed', 'success'); });
  };

  function reset() {
    state = initialState();
    render();
    simToast('Simulation reset');
  }

  byId('resetSimulation')?.addEventListener('click', reset);
  render = (() => {
    const paint = () => { renderRail(); renderSummary(); renderInspector(); renderStage(); };
    return paint;
  })();
  render();
})();
