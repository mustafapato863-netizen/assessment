import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleDashed,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  FileCheck2,
  FileText,
  History,
  ListTodo,
  LoaderCircle,
  LockKeyhole,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
  UserRound,
  X,
  XCircle,
} from 'lucide-react';
import type {
  AdminReopenStageInput,
  AssessmentCaseDetail,
  AttachmentSummary,
  AssessorRecommendationCode,
  CloseCaseInput,
  DecideApprovalInput,
  FinalizePlanInput,
  FinalizeResultInput,
  ReopenResultInput,
  ResultCode,
  ScorecardConfig,
  ScorecardIssueSummary,
  ScorecardKnockoutCheck,
  ScorecardRatings,
  ScorecardDimension,
  ScheduleEventInput,
  ScheduleReassessmentInput,
  SubmitRecommendationInput,
  UpdateDevelopmentInput,
} from '@assessflow/contracts';
import {
  calculateScorecard,
  assessorRecommendationCodes,
  SCORECARD_QUICK_FRACTIONS,
  isValidQuestionScore,
  scorecardWeightProblems,
  SCORECARD_READY_NOW_THRESHOLD,
  SCORECARD_READY_WITH_DEVELOPMENT_THRESHOLD,
  scorecardRatingKey,
} from '@assessflow/contracts';
import { api, ApiRequestError, type AssessorAccountOption } from '../lib/api';
import { reasonLabels, type Copy } from '../lib/labels';
import {
  ErrorBanner,
  InfoItem,
  InlineError,
  PanelHeader,
  RailItem,
  StatusBadge,
} from '../components/ui';
import { useToast } from '../hooks/use-toast';
import { getActiveUser } from '../lib/auth';

export function CasePage({
  caseId: propCaseId,
  t: _propT,
  onBack: propOnBack,
  onToast: propOnToast,
}: {
  caseId?: string;
  t?: Copy;
  onBack?: () => void;
  onToast?: (message: string) => void;
} = {}) {
  const { id: paramCaseId } = useParams<{ id: string }>();
  const caseId = propCaseId ?? paramCaseId ?? '';
  const navigate = useNavigate();
  const onBack = propOnBack ?? (() => navigate('/cases'));
  const { showToast } = useToast();
  const onToast = propOnToast ?? showToast;
  const queryClient = useQueryClient();
  const {
    data: caseDetail,
    isLoading,
    isError,
    error,
  } = useQuery({ queryKey: ['case', caseId], queryFn: () => api.caseDetail(caseId) });
  const refreshCase = () => {
    queryClient.invalidateQueries({ queryKey: ['case', caseId] });
  };
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [auditDrawerOpen, setAuditDrawerOpen] = useState(false);
  const viewAuditTriggerRef = useRef<HTMLButtonElement | null>(null);

  const sortedActivity = useMemo(() => {
    if (!caseDetail?.activity) return [];
    return [...caseDetail.activity].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [caseDetail?.activity]);

  const [decisionReason, setDecisionReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [eligibilityCriteriaMet, setEligibilityCriteriaMet] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setEligibilityCriteriaMet({});
  }, [caseDetail?.id]);
  const decision = useMutation({
    mutationFn: (payload: {
      decision: 'ELIGIBLE' | 'NOT_ELIGIBLE';
      reason?: string;
      criteria?: Array<{ code: string; result: 'MET' | 'NOT_CHECKED' }>;
      expectedVersion: number;
    }) => api.decideEligibility(caseId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      setShowReject(false);
      setDecisionReason('');
      onToast('Eligibility decision saved and the next task was created.');
    },
  });
  const submitDraft = useMutation({
    mutationFn: () => {
      if (!caseDetail) throw new Error('The assessment request is still loading.');
      return api.submitCase(caseId, caseDetail.version);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      void queryClient.invalidateQueries({ queryKey: ['overview'] });
      void queryClient.invalidateQueries({ queryKey: ['cases'] });
      onToast('Assessment request submitted for eligibility review.');
    },
  });
  const override = useMutation({
    mutationFn: (reason: string) => api.requestOverride(caseId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      onToast('Override request sent for governance review.');
    },
  });
  const [activeStageTab, setActiveStageTab] = useState<'ALL' | string>('ALL');
  const [stageScrollRequest, setStageScrollRequest] = useState(0);
  const [stageToReopen, setStageToReopen] = useState<AdminReopenStageInput['stage'] | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  const reopenStage = useMutation({
    mutationFn: (input: AdminReopenStageInput) => api.reopenCompletedStage(caseId, input),
    onSuccess: (updated) => {
      queryClient.setQueryData(['case', caseId], updated);
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      setActiveStageTab(stageTabLabel(updated.adminEditStage));
      setStageToReopen(null);
      setReopenReason('');
      onToast('Stage reopened for Admin editing. Later stages will be resumed afterward.');
    },
  });

  const currentActionPrompt = useMemo(() => {
    if (!caseDetail) {
      return {
        title: 'Loading Case…',
        subtitle: 'Preparing the latest policy and activity context',
        buttonLabel: 'View Active Stage',
        stageTarget: 'Request',
        sla: 'Loading',
        urgent: false,
      };
    }
    switch (caseDetail.status) {
      case 'DRAFT':
        return {
          title: 'Draft Assessment Request',
          subtitle: 'Complete details and submit for HR eligibility verification',
          buttonLabel: 'Review Draft',
          stageTarget: 'Request',
          sla: '3 days standard',
          urgent: false,
        };
      case 'SUBMITTED':
      case 'PENDING_ELIGIBILITY':
        return {
          title: 'Action Required: Eligibility Review',
          subtitle: 'Verify policy criteria and prerequisites before planning',
          buttonLabel: 'Decide Eligibility',
          stageTarget: 'Eligibility',
          sla: '2 days remaining',
          urgent: true,
        };
      case 'NOT_ELIGIBLE':
        return {
          title: 'Governance Exception Required',
          subtitle: 'Case blocked by policy criteria; HR governance override required',
          buttonLabel: 'Request Override',
          stageTarget: 'Eligibility',
          sla: 'SLA Paused',
          urgent: true,
        };
      case 'READY_FOR_PLANNING':
        return {
          title: 'Action Required: Finalize Assessment Plan',
          subtitle: 'Select evaluation methods, duration, and assign lead assessor',
          buttonLabel: 'Finalize Plan',
          stageTarget: 'Plan',
          sla: '4 days remaining',
          urgent: false,
        };
      // The plan is finalized in PLANNING; the next step is scheduling sessions.
      case 'PLANNING':
        return {
          title: 'Action Required: Schedule Assessment Session',
          subtitle: 'Plan is finalized. Book the session and assign the assessors',
          buttonLabel: 'Schedule Event',
          stageTarget: 'Assessment',
          sla: '5 days remaining',
          urgent: false,
        };
      case 'SCHEDULED':
        return {
          title: 'Action Required: Record Evidence & Scorecards',
          subtitle: 'Session is scheduled. Assessors enter evidence and score each criterion',
          buttonLabel: 'Submit Evidence',
          stageTarget: 'Assessment',
          sla: '5 days remaining',
          urgent: false,
        };
      case 'IN_PROGRESS':
        return {
          title: 'Action Required: Complete Scorecards',
          subtitle: 'Collect every assessor scorecard, then finalize the result',
          buttonLabel: 'Submit Evidence',
          stageTarget: 'Assessment',
          sla: '3 days remaining',
          urgent: true,
        };
      case 'PENDING_RESULT':
        return {
          title: 'Action Required: Finalize Evaluation Scorecard',
          subtitle: 'Lead assessor synthesizes scores and sets readiness recommendation',
          buttonLabel: 'Finalize Scorecard',
          stageTarget: 'Result',
          sla: '3 days remaining',
          urgent: true,
        };
      case 'RESULT_FINALIZED':
      case 'PENDING_RECOMMENDATION':
        return {
          title: 'Action Required: Promotion Recommendation',
          subtitle: 'Formulate the business justification and promotion proposal',
          buttonLabel: 'Submit Recommendation',
          stageTarget: 'Decision',
          sla: '4 days remaining',
          urgent: false,
        };
      case 'PENDING_APPROVAL':
        return {
          title: 'Action Required: Governance Sign-off',
          subtitle: 'Awaiting dual-control HR and Business sponsor approvals',
          buttonLabel: 'Decide Approval',
          stageTarget: 'Decision',
          sla: '2 days remaining (Priority)',
          urgent: true,
        };
      case 'APPROVED':
      case 'DEVELOPMENT_IN_PROGRESS':
        return {
          title: 'Active Growth & Milestone Tracking',
          subtitle: 'Track 30-60-90 day development actions and readiness outcomes',
          buttonLabel: 'View Milestones',
          stageTarget: 'Follow-up',
          sla: 'Active Cycle',
          urgent: false,
        };
      case 'REASSESSMENT_DUE':
        return {
          title: 'Action Required: Reassessment Due',
          subtitle: 'Review the follow-up outcome and schedule the next assessment cycle',
          buttonLabel: 'Schedule Reassessment',
          stageTarget: 'Follow-up',
          sla: 'Due now',
          urgent: true,
        };
      case 'CLOSED':
        return {
          title: 'Assessment Process Closed',
          subtitle: 'Archived with complete immutable audit trail and evidence seal',
          buttonLabel: 'View Summary',
          stageTarget: 'Follow-up',
          sla: 'Sealed',
          urgent: false,
        };
      default:
        return {
          title: 'Assessment In Progress',
          subtitle: 'View stage details and evaluation artifacts',
          buttonLabel: 'View Active Stage',
          stageTarget: 'Overview',
          sla: 'On Track',
          urgent: false,
        };
    }
  }, [caseDetail]);

  const handleSelectStage = (label: string) => {
    setActiveStageTab(label);
    setStageScrollRequest((request) => request + 1);
  };

  useEffect(() => {
    const selectorMap: Record<string, string> = {
      Request: '.case-summary',
      Eligibility: '.decision-panel, .override-panel, .decision-summary-panel',
      Plan: '.plan-panel',
      Assessment: '.event-panel, .evidence-panel',
      Result: '.result-panel',
      Decision: '.recommendation-panel, .approval-panel',
      'Follow-up': '.development-panel, .close-panel',
    };
    const targetSelector = selectorMap[activeStageTab];
    if (targetSelector) {
      let attempts = 0;
      let frame = 0;
      const findAndScroll = () => {
        const el = document.querySelector(targetSelector);
        if (!el && attempts < 10) {
          attempts += 1;
          frame = requestAnimationFrame(findAndScroll);
          return;
        }
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          el.classList.add('panel-target-highlight');
          setTimeout(() => el.classList.remove('panel-target-highlight'), 1500);
        }
      };
      frame = requestAnimationFrame(findAndScroll);
      return () => cancelAnimationFrame(frame);
    }
  }, [activeStageTab, stageScrollRequest]);

  const handleJumpToActiveAction = () => {
    handleSelectStage(currentActionPrompt.stageTarget);
  };

  const canSubmitDraft = ['SYS_ADMIN', 'HR_ADMIN', 'DEV_LEAD', 'ASSESSOR'].includes(
    getActiveUser().role,
  );
  const isAdmin = getActiveUser().role === 'SYS_ADMIN';
  const completedStages = caseDetail ? completedStagesBefore(caseDetail.status) : [];
  const adminReadOnly = Boolean(caseDetail?.adminEditStage) && !isAdmin;

  const isStageVisible = (stage: string) => {
    if (activeStageTab === 'ALL') return true;
    return activeStageTab === stage;
  };

  if (isLoading)
    return (
      <>
        <button className="back-button" onClick={onBack}>
          <ArrowLeft size={16} />
          Back to cases
        </button>
        <div className="case-loading">
          <div className="loader-ring" />
          <strong>Loading case workspace</strong>
          <span>Preparing the latest policy and activity context.</span>
        </div>
      </>
    );
  if (isError || !caseDetail)
    return (
      <>
        <button className="back-button" onClick={onBack}>
          <ArrowLeft size={16} />
          Back to cases
        </button>
        <ErrorBanner message={(error as Error)?.message ?? 'Case could not load.'} />
      </>
    );
  const activeIndex = (() => {
    switch (caseDetail.status) {
      case 'DRAFT':
        return 0;
      case 'SUBMITTED':
      case 'PENDING_ELIGIBILITY':
      case 'NOT_ELIGIBLE':
        return 1;
      case 'READY_FOR_PLANNING':
        return 2;
      // Plan finalized: the next work happens in Assessment.
      case 'PLANNING':
      case 'SCHEDULED':
      case 'IN_PROGRESS':
        return 3;
      case 'PENDING_RESULT':
        return 4;
      // Result finalized: the next work is the recommendation (Decision).
      case 'RESULT_FINALIZED':
      case 'PENDING_RECOMMENDATION':
      case 'PENDING_APPROVAL':
        return 5;
      case 'APPROVED':
      case 'DEVELOPMENT_IN_PROGRESS':
      case 'REASSESSMENT_DUE':
        return 6;
      case 'CLOSED':
        return 7;
      default:
        return Math.max(
          0,
          [
            'REQUEST',
            'ELIGIBILITY',
            'PLANNING',
            'ASSESSMENT',
            'RESULT',
            'RECOMMENDATION',
            'FOLLOW_UP',
            'CLOSED',
          ].indexOf(caseDetail.stage),
        );
    }
  })();

  return (
    <>
      <button className="back-button" onClick={onBack}>
        <ArrowLeft size={16} />
        Back to cases
      </button>
      <section className="case-header panel">
        <div>
          <div className="case-code">
            {caseDetail.caseCode} <span>·</span> {reasonLabels[caseDetail.assessmentReason]}
          </div>
          <h1>{caseDetail.employeeName}</h1>
          <p>
            {caseDetail.candidateType === 'NEW_CANDIDATE'
              ? 'New candidate'
              : caseDetail.currentRole}{' '}
            <span className="muted-separator">→</span> {caseDetail.targetRole} ·{' '}
            {caseDetail.targetLevel}
          </p>
          {caseDetail.candidateType === 'NEW_CANDIDATE' && caseDetail.candidateEmail && (
            <small style={{ color: 'var(--secondary)' }}>{caseDetail.candidateEmail}</small>
          )}
        </div>
        <div className="case-header-side">
          <StatusBadge status={caseDetail.status} />
          {caseDetail.candidateType === 'NEW_CANDIDATE' && (
            <span className="soft-chip">New candidate</span>
          )}
          <span className="owner-label">
            <UserRound size={14} />
            {caseDetail.owner}
          </span>
          <button className="icon-button" aria-label="More options">
            <MoreHorizontal size={18} />
          </button>
        </div>
      </section>

      {/* Stepper with Interactive Stage Navigation */}
      <section
        className="stepper panel interactive stepper-with-head"
        aria-label="Assessment progress"
      >
        <div className="stepper-head">
          <span className="stepper-head-label">Workflow Progress & Stage Filter</span>
          <button
            type="button"
            aria-pressed={activeStageTab === 'ALL'}
            className={`stage-tab-button ${activeStageTab === 'ALL' ? 'active' : ''}`}
            onClick={() => setActiveStageTab('ALL')}
          >
            <FileText size={14} />
            Complete Dossier (All Stages)
          </button>
        </div>
        <div className="stepper-track">
          {['Request', 'Eligibility', 'Plan', 'Assessment', 'Result', 'Decision', 'Follow-up'].map(
            (label, index) => (
              <div
                className={`step interactive ${index < activeIndex ? 'complete' : index === activeIndex ? 'current' : ''} ${activeStageTab === label ? 'active-focus' : ''}`}
                key={label}
                onClick={() => handleSelectStage(label)}
                role="button"
                aria-pressed={activeStageTab === label}
                tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSelectStage(label)}
                title={`View ${label} stage details`}
              >
                <div className="step-marker">
                  {index < activeIndex ? <Check size={14} /> : index + 1}
                </div>
                <span>{label}</span>
                {index < 6 && <i />}
              </div>
            ),
          )}
        </div>
      </section>

      {/* Executive Action Bar */}
      <div className="executive-action-bar panel">
        <div className="action-bar-left">
          <span className="action-banner-icon" aria-hidden="true">
            <CalendarDays size={17} />
          </span>

          <div className={`action-urgency-badge ${currentActionPrompt.urgent ? 'urgent' : ''}`}>
            <span className="pulse-dot" />
            {currentActionPrompt.urgent ? 'Action Required' : 'Stage Status'}
          </div>
          <div className="action-description">
            <span className="action-title">{currentActionPrompt.title}</span>
            <span className="action-subtitle">
              {currentActionPrompt.subtitle} · SLA:{' '}
              <strong style={{ color: currentActionPrompt.urgent ? '#dc2626' : '#4f46e5' }}>
                {currentActionPrompt.sla}
              </strong>
            </span>
          </div>
        </div>
        <div className="action-bar-right">
          {caseDetail.status === 'DRAFT' && canSubmitDraft && (
            <button
              type="button"
              className="primary-button"
              disabled={submitDraft.isPending}
              onClick={() => submitDraft.mutate()}
            >
              {submitDraft.isPending ? (
                <LoaderCircle className="spin" size={15} />
              ) : (
                <Send size={15} />
              )}
              {submitDraft.isPending ? 'Submitting…' : 'Submit request'}
            </button>
          )}
          <button type="button" className="action-cta-button" onClick={handleJumpToActiveAction}>
            <Sparkles size={15} />
            Jump to: {currentActionPrompt.stageTarget}
          </button>
        </div>
      </div>
      {submitDraft.isError && <ErrorBanner message={submitDraft.error.message} />}

      <div className="case-layout">
        <div className={`case-main ${adminReadOnly ? 'admin-reopened-readonly' : ''}`}>
          {caseDetail.adminEditStage && (
            <div className={`admin-edit-banner ${adminReadOnly ? 'read-only' : ''}`}>
              {adminReadOnly
                ? 'This completed stage is reopened for Admin editing. You have read-only access.'
                : `Admin edit mode: ${stageTabLabel(caseDetail.adminEditStage)}. Previous stages remain in the audit history.`}
            </div>
          )}
          {isAdmin && !caseDetail.adminEditStage && completedStages.length > 0 && (
            <section className="panel admin-reopen-panel">
              <PanelHeader
                icon={<RotateCcw size={17} />}
                title="Reopen a completed stage"
                action={<span className="status-badge">Admin only</span>}
              />
              <p className="panel-intro">
                Reopening a stage preserves its history and sends the case back through later
                stages. A reason is required and recorded in the audit trail.
              </p>
              <div className="admin-reopen-actions">
                {completedStages.map((stage) => (
                  <button
                    key={stage}
                    type="button"
                    className={`secondary-button ${stageToReopen === stage ? 'active' : ''}`}
                    disabled={reopenStage.isPending}
                    aria-pressed={stageToReopen === stage}
                    onClick={() => {
                      setStageToReopen(stage);
                      setReopenReason('');
                      reopenStage.reset();
                    }}
                  >
                    <RotateCcw size={15} />
                    Reopen {stageTabLabel(stage)}
                  </button>
                ))}
              </div>
              {stageToReopen && (
                <div className="admin-reopen-editor">
                  <label htmlFor="admin-reopen-reason">
                    Reason for reopening {stageTabLabel(stageToReopen)}
                  </label>
                  <textarea
                    id="admin-reopen-reason"
                    value={reopenReason}
                    onChange={(event) => setReopenReason(event.target.value)}
                    placeholder="Explain why this completed stage needs to be reopened."
                    maxLength={2000}
                    minLength={10}
                    required
                    disabled={reopenStage.isPending}
                  />
                  <div className="admin-reopen-footer">
                    <span className={reopenReason.trim().length < 10 ? 'needs-reason' : ''}>
                      {reopenReason.trim().length}/10 minimum characters
                    </span>
                    <div className="admin-reopen-controls">
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={reopenStage.isPending}
                        onClick={() => {
                          setStageToReopen(null);
                          setReopenReason('');
                          reopenStage.reset();
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="primary-button"
                        disabled={reopenStage.isPending || reopenReason.trim().length < 10}
                        onClick={() => {
                          reopenStage.mutate({
                            stage: stageToReopen,
                            reason: reopenReason.trim(),
                            expectedVersion: caseDetail.version,
                          });
                        }}
                      >
                        {reopenStage.isPending
                          ? 'Reopening…'
                          : `Reopen ${stageTabLabel(stageToReopen)}`}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {reopenStage.isError && <InlineError error={reopenStage.error} />}
            </section>
          )}
          {isStageVisible('Request') && (
            <section className="panel case-summary">
              <PanelHeader
                icon={<FileCheck2 size={17} />}
                title="Case overview"
                action={
                  <span className="privacy-label">
                    <LockKeyhole size={14} />
                    Policy-protected
                  </span>
                }
              />
              <div className="summary-grid">
                <InfoItem
                  label="Employee"
                  value={caseDetail.employeeName}
                  icon={<UserRound size={15} />}
                />
                <InfoItem
                  label="Department"
                  value={caseDetail.department}
                  icon={<Building2 size={15} />}
                />
                <InfoItem
                  label="Assessment reason"
                  value={reasonLabels[caseDetail.assessmentReason] ?? 'Assessment'}
                  icon={<Sparkles size={15} />}
                />
                <InfoItem
                  label="Target role"
                  value={`${caseDetail.targetRole} · ${caseDetail.targetLevel}`}
                  icon={<ArrowUpRight size={15} />}
                />
              </div>
              <div className="justification">
                <span>Business justification</span>
                <p>{caseDetail.justification}</p>
              </div>
              {isAdmin && caseDetail.adminEditStage === 'REQUEST' && (
                <AdminRequestEditor
                  caseDetail={caseDetail}
                  onSaved={(updated) => {
                    queryClient.setQueryData(['case', caseId], updated);
                    queryClient.invalidateQueries({ queryKey: ['overview'] });
                    onToast('Request changes saved and recorded in the audit history.');
                  }}
                />
              )}
            </section>
          )}

          {isStageVisible('Eligibility') &&
            ['SUBMITTED', 'PENDING_ELIGIBILITY'].includes(caseDetail.status) && (
              <section className="panel decision-panel">
                <PanelHeader
                  icon={<ShieldCheck size={17} />}
                  title="Eligibility review"
                  action={
                    <span className="policy-chip">
                      Policy {caseDetail.eligibility?.policyVersion}
                    </span>
                  }
                />
                <p className="panel-intro">
                  Confirm the policy criteria before this case can move to assessment planning.
                  Every decision is recorded in the audit history.
                </p>
                <div className="criteria-table">
                  {caseDetail.eligibility?.criteria.map((criterion) => (
                    <div className="criterion-row" key={criterion.code}>
                      <div>
                        <strong>{eligibilityCriterionLabel(criterion.label)}</strong>
                        <span>Optional check</span>
                      </div>
                      <label className="eligibility-criterion-toggle">
                        <input
                          type="checkbox"
                          checked={eligibilityCriteriaMet[criterion.code] ?? false}
                          onChange={(event) =>
                            setEligibilityCriteriaMet((current) => ({
                              ...current,
                              [criterion.code]: event.target.checked,
                            }))
                          }
                          aria-label={`Mark ${eligibilityCriterionLabel(criterion.label)} as met`}
                        />
                        <span
                          className={`criterion-result ${eligibilityCriteriaMet[criterion.code] ? 'met' : 'not_checked'}`}
                        >
                          {eligibilityCriteriaMet[criterion.code] ? (
                            <Check size={14} />
                          ) : (
                            <CircleDashed size={14} />
                          )}
                          {eligibilityCriteriaMet[criterion.code] ? 'MET' : 'NOT CHECKED'}
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
                <div className="decision-actions">
                  {showReject && (
                    <div className="reason-field">
                      <label htmlFor="eligibility-reason">Decision reason</label>
                      <textarea
                        id="eligibility-reason"
                        value={decisionReason}
                        onChange={(event) => setDecisionReason(event.target.value)}
                        placeholder="Explain the blocking policy reason…"
                      />
                    </div>
                  )}
                  <div className="action-row">
                    <button
                      className="secondary-button"
                      onClick={() => setShowReject((value) => !value)}
                    >
                      <XCircle size={16} />
                      {showReject ? 'Cancel' : 'Mark not eligible'}
                    </button>
                    {showReject ? (
                      <button
                        className="danger-button"
                        disabled={decision.isPending || !decisionReason.trim()}
                        onClick={() =>
                          decision.mutate({
                            decision: 'NOT_ELIGIBLE',
                            reason: decisionReason,
                            criteria: (caseDetail.eligibility?.criteria ?? []).map((criterion) => ({
                              code: criterion.code,
                              result: eligibilityCriteriaMet[criterion.code]
                                ? 'MET'
                                : 'NOT_CHECKED',
                            })),
                            expectedVersion: caseDetail.version,
                          })
                        }
                      >
                        {decision.isPending ? (
                          <LoaderCircle className="spin" size={16} />
                        ) : (
                          <ShieldAlert size={16} />
                        )}
                        Confirm decision
                      </button>
                    ) : (
                      <button
                        className="primary-button"
                        disabled={decision.isPending}
                        onClick={() =>
                          decision.mutate({
                            decision: 'ELIGIBLE',
                            criteria: (caseDetail.eligibility?.criteria ?? []).map((criterion) => ({
                              code: criterion.code,
                              result: eligibilityCriteriaMet[criterion.code]
                                ? 'MET'
                                : 'NOT_CHECKED',
                            })),
                            expectedVersion: caseDetail.version,
                          })
                        }
                      >
                        {decision.isPending ? (
                          <LoaderCircle className="spin" size={16} />
                        ) : (
                          <CheckCircle2 size={16} />
                        )}
                        Mark eligible
                      </button>
                    )}
                  </div>
                </div>
                {decision.isError && <InlineError error={decision.error} />}
              </section>
            )}

          {isStageVisible('Eligibility') && caseDetail.status === 'NOT_ELIGIBLE' && (
            <section className="panel override-panel">
              <PanelHeader
                icon={<ShieldAlert size={17} />}
                title="Eligibility exception"
                action={<span className="status-badge danger">Governance required</span>}
              />
              <p className="panel-intro">
                This case is blocked by the eligibility policy. A separate governance decision is
                required before planning can continue.
              </p>
              <div className="restricted-callout">
                <LockKeyhole size={18} />
                <div>
                  <strong>Override requires a reason and audit trail</strong>
                  <span>Only authorized HR governance users can approve an exception.</span>
                </div>
              </div>
              <button
                className="secondary-button"
                disabled={override.isPending}
                onClick={() =>
                  override.mutate('Business-critical role need; HR governance review requested.')
                }
              >
                {override.isPending ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <RotateCcw size={16} />
                )}
                Request override review
              </button>
              {override.isError && <InlineError error={override.error} />}
            </section>
          )}

          {isStageVisible('Eligibility') &&
            caseDetail.status !== 'PENDING_ELIGIBILITY' &&
            caseDetail.status !== 'NOT_ELIGIBLE' &&
            caseDetail.eligibility && (
              <section className="panel decision-summary-panel">
                <PanelHeader
                  icon={<ShieldCheck size={17} />}
                  title="Eligibility verification"
                  action={<span className="status-badge success">Verified Eligible</span>}
                />
                <p className="panel-intro">
                  Policy criteria verified. Assessment planning is unlocked.
                </p>
                <div className="criteria-table">
                  {caseDetail.eligibility.criteria.map((criterion) => (
                    <div className="criterion-row" key={criterion.code}>
                      <div>
                        <strong>{eligibilityCriterionLabel(criterion.label)}</strong>
                        <span>
                          {criterion.blocking ? 'Blocking criterion' : 'Non-blocking criterion'}
                        </span>
                      </div>
                      <span className={`criterion-result ${criterion.result.toLowerCase()}`}>
                        {criterion.result === 'MET' ? (
                          <Check size={14} />
                        ) : (
                          <CircleDashed size={14} />
                        )}
                        {criterion.result.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

          {isStageVisible('Plan') && (
            <PlanPanel caseDetail={caseDetail} onToast={onToast} onRefresh={refreshCase} />
          )}
          {isStageVisible('Assessment') && (
            <>
              <EventsPanel caseDetail={caseDetail} onToast={onToast} onRefresh={refreshCase} />
              <EvidencePanel
                caseDetail={caseDetail}
                onToast={onToast}
                onRefresh={refreshCase}
                onGoToStage={handleSelectStage}
              />
            </>
          )}
          {isStageVisible('Result') && (
            <ResultPanel caseDetail={caseDetail} onToast={onToast} onRefresh={refreshCase} />
          )}
          {isStageVisible('Decision') && (
            <DecisionPanel caseDetail={caseDetail} onToast={onToast} onRefresh={refreshCase} />
          )}
          {isStageVisible('Follow-up') && (
            <DevelopmentPanel caseDetail={caseDetail} onToast={onToast} onRefresh={refreshCase} />
          )}
        </div>
        <aside className="case-rail">
          <section className="panel">
            <PanelHeader icon={<ListTodo size={17} />} title="Case context" />
            <div className="rail-list">
              <RailItem label="Current owner" value={caseDetail.owner} />
              <RailItem label="Requested" value="18 Aug 2026" />
              <RailItem
                label="Priority"
                value={caseDetail.priority}
                tone={caseDetail.priority === 'HIGH' ? 'danger' : undefined}
              />
              <RailItem label="Version" value={`v${caseDetail.version}`} />
            </div>
          </section>
          <section className="panel activity-panel">
            <PanelHeader
              icon={<History size={17} />}
              title="Activity"
              action={
                <button
                  ref={viewAuditTriggerRef}
                  className="link-button"
                  onClick={() => setAuditDrawerOpen(true)}
                >
                  View audit
                </button>
              }
            />
            <div className={`activity-list ${showFullHistory ? 'timeline-scroll' : ''}`}>
              {(showFullHistory ? sortedActivity : sortedActivity.slice(0, 5)).map((event) => (
                <div className="activity-item" key={event.id}>
                  <div className={`activity-dot ${event.tone}`} />
                  <div>
                    <strong>{event.action}</strong>
                    <span>
                      {event.actor} ·{' '}
                      {new Date(event.timestamp).toLocaleDateString('en', {
                        month: 'short',
                        day: 'numeric',
                      })}{' '}
                      {new Date(event.timestamp).toLocaleTimeString('en', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {sortedActivity.length > 5 && (
              <div style={{ marginTop: '12px', textAlign: 'center' }}>
                <button className="link-button" onClick={() => setShowFullHistory((prev) => !prev)}>
                  {showFullHistory ? 'Show less' : `View full history (${sortedActivity.length})`}
                </button>
              </div>
            )}
          </section>
        </aside>
      </div>
      <ActivityDrawer
        isOpen={auditDrawerOpen}
        onClose={() => setAuditDrawerOpen(false)}
        triggerRef={viewAuditTriggerRef}
        activity={sortedActivity}
        caseCode={caseDetail.caseCode}
      />
    </>
  );
}

function AdminRequestEditor({
  caseDetail,
  onSaved,
}: {
  caseDetail: AssessmentCaseDetail;
  onSaved: (updated: AssessmentCaseDetail) => void;
}) {
  const [targetRole, setTargetRole] = useState(caseDetail.targetRole);
  const [targetLevel, setTargetLevel] = useState(caseDetail.targetLevel);
  const [justification, setJustification] = useState(caseDetail.justification);
  const [reason, setReason] = useState('');
  const mutation = useMutation({
    mutationFn: () =>
      api.updateReopenedRequest(caseDetail.id, {
        targetRole,
        targetLevel,
        justification,
        reason,
        expectedVersion: caseDetail.version,
      }),
    onSuccess: onSaved,
  });

  return (
    <div className="admin-request-editor">
      <strong>Edit request details</strong>
      <label className="field">
        <span>Target role</span>
        <input value={targetRole} onChange={(event) => setTargetRole(event.target.value)} />
      </label>
      <label className="field">
        <span>Target level</span>
        <input value={targetLevel} onChange={(event) => setTargetLevel(event.target.value)} />
      </label>
      <label className="field">
        <span>Business justification</span>
        <textarea
          value={justification}
          onChange={(event) => setJustification(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Edit reason (minimum 10 characters)</span>
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} />
      </label>
      <div className="action-row">
        <button
          className="primary-button"
          disabled={
            mutation.isPending || reason.trim().length < 10 || justification.trim().length < 20
          }
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <CheckCircle2 size={16} />
          )}
          Save request edits
        </button>
      </div>
      {mutation.isError && <InlineError error={mutation.error} />}
    </div>
  );
}

function ActivityDrawer({
  isOpen,
  onClose,
  triggerRef,
  activity,
  caseCode,
}: {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  activity: AssessmentCaseDetail['activity'];
  caseCode: string;
}) {
  const drawerRef = useRef<HTMLElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previousFocus = triggerRef.current ?? (document.activeElement as HTMLElement | null);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'Tab') {
        const drawer = drawerRef.current;
        if (!drawer) return;
        const focusable = drawer.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;

        if (event.shiftKey) {
          if (document.activeElement === first) {
            event.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    const timer = setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 10);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
      previousFocus?.focus();
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  return (
    <div
      className="drawer-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <aside
        ref={drawerRef}
        className="request-drawer activity-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-drawer-title"
      >
        <div className="drawer-header">
          <div>
            <span className="eyebrow">AUDIT TRAIL</span>
            <h2 id="activity-drawer-title">Activity history</h2>
            <p>
              {caseCode} · {activity.length} recorded events
            </p>
          </div>
          <button
            ref={closeBtnRef}
            className="icon-button"
            onClick={onClose}
            aria-label="Close activity history"
          >
            <X size={19} />
          </button>
        </div>
        <div className="activity-drawer-body">
          <div
            className="activity-list timeline-scroll"
            style={{ maxHeight: 'calc(100vh - 160px)' }}
          >
            {activity.map((event) => (
              <div className="activity-item" key={event.id}>
                <div className={`activity-dot ${event.tone}`} />
                <div>
                  <strong>{event.action}</strong>
                  <span>
                    {event.actor} ·{' '}
                    {new Date(event.timestamp).toLocaleDateString('en', {
                      month: 'short',
                      day: 'numeric',
                    })}{' '}
                    {new Date(event.timestamp).toLocaleTimeString('en', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function getAvailableAction(caseDetail: AssessmentCaseDetail, code: string) {
  return caseDetail.availableActions.find((action) => action.code === code);
}

function eligibilityCriterionLabel(label: string) {
  return label === 'Active PIP or disciplinary action'
    ? 'No active PIP or disciplinary action'
    : label;
}

function stageTabLabel(stage?: AssessmentCaseDetail['adminEditStage']) {
  if (stage === 'RECOMMENDATION' || stage === 'APPROVAL') return 'Decision';
  if (stage === 'FOLLOW_UP') return 'Follow-up';
  if (stage === 'PLANNING') return 'Plan';
  if (!stage) return 'Stage';
  return `${stage.charAt(0)}${stage.slice(1).toLowerCase()}`;
}

function completedStagesBefore(
  status: AssessmentCaseDetail['status'],
): AdminReopenStageInput['stage'][] {
  const stages: AdminReopenStageInput['stage'][] = [];
  if (status !== 'DRAFT') stages.push('REQUEST');
  if (!['DRAFT', 'SUBMITTED', 'PENDING_ELIGIBILITY'].includes(status)) stages.push('ELIGIBILITY');
  if (
    !['DRAFT', 'SUBMITTED', 'PENDING_ELIGIBILITY', 'NOT_ELIGIBLE', 'READY_FOR_PLANNING'].includes(
      status,
    )
  )
    stages.push('PLANNING');
  if (
    [
      'PENDING_RESULT',
      'RESULT_FINALIZED',
      'PENDING_RECOMMENDATION',
      'PENDING_APPROVAL',
      'APPROVED',
      'DEVELOPMENT_IN_PROGRESS',
      'REASSESSMENT_DUE',
      'CLOSED',
    ].includes(status)
  )
    stages.push('ASSESSMENT');
  if (
    [
      'RESULT_FINALIZED',
      'PENDING_RECOMMENDATION',
      'PENDING_APPROVAL',
      'APPROVED',
      'DEVELOPMENT_IN_PROGRESS',
      'REASSESSMENT_DUE',
      'CLOSED',
    ].includes(status)
  )
    stages.push('RESULT');
  if (
    [
      'PENDING_APPROVAL',
      'APPROVED',
      'DEVELOPMENT_IN_PROGRESS',
      'REASSESSMENT_DUE',
      'CLOSED',
    ].includes(status)
  )
    stages.push('RECOMMENDATION');
  if (['REASSESSMENT_DUE', 'CLOSED'].includes(status)) stages.push('FOLLOW_UP');
  return stages;
}

const pastPlanningStatuses = [
  'PLANNING',
  'SCHEDULED',
  'IN_PROGRESS',
  'PENDING_RESULT',
  'RESULT_FINALIZED',
  'PENDING_RECOMMENDATION',
  'PENDING_APPROVAL',
  'APPROVED',
  'DEVELOPMENT_IN_PROGRESS',
  'REASSESSMENT_DUE',
  'CLOSED',
];

interface PlanData {
  leadAssessor?: string | null;
  complexityBand?: string | null;
  methods?: Array<{
    methodCode: string;
    methodLabel?: string;
    required?: boolean;
    durationMin?: number | null;
  }>;
}

function PlanPanel({
  caseDetail,
  onToast,
  onRefresh,
}: {
  caseDetail: AssessmentCaseDetail;
  onToast: (msg: string) => void;
  onRefresh: () => void;
}) {
  const queryClient = useQueryClient();
  const isPastPlanning = pastPlanningStatuses.includes(caseDetail.status);
  const isReady = caseDetail.status === 'READY_FOR_PLANNING';

  const { data: plan } = useQuery({
    queryKey: ['plan', caseDetail.id],
    queryFn: () => api.getPlan<PlanData>(caseDetail.id),
    enabled: isPastPlanning || caseDetail.adminEditStage === 'PLANNING',
    retry: false,
  });

  const [selectedMethods, setSelectedMethods] = useState<string[]>(['CBI']);
  const [leadAssessor, setLeadAssessor] = useState('');
  useEffect(() => {
    if (!plan) return;
    if (plan.methods?.length) setSelectedMethods(plan.methods.map((method) => method.methodCode));
    setLeadAssessor(plan.leadAssessor ?? '');
  }, [plan]);

  const action = getAvailableAction(caseDetail, 'FINALIZE_PLAN');

  const finalizePlan = useMutation({
    mutationFn: (input: FinalizePlanInput) => api.finalizePlan(caseDetail.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseDetail.id] });
      queryClient.invalidateQueries({ queryKey: ['plan', caseDetail.id] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      onToast('Assessment plan finalized.');
    },
  });

  if (!isReady && !(isPastPlanning && plan)) {
    return null;
  }

  if (isPastPlanning && plan) {
    return (
      <section className="panel plan-panel">
        <PanelHeader
          icon={<ClipboardCheck size={17} />}
          title="Assessment plan"
          action={<span className="status-badge success">Plan finalized</span>}
        />
        <div className="criteria-table">
          {plan.methods?.map((method) => (
            <div className="criterion-row" key={method.methodCode}>
              <div>
                <strong>{method.methodLabel || method.methodCode}</strong>
                <span>
                  {method.required !== false ? 'Required evaluation method' : 'Optional method'}
                </span>
              </div>
              <span className="criterion-result met">
                <Check size={14} />
                Configured
              </span>
            </div>
          ))}
        </div>
        {plan.leadAssessor && (
          <div style={{ marginTop: '13px', fontSize: '12px', color: 'var(--secondary)' }}>
            Lead assessor: <strong>{plan.leadAssessor}</strong>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="panel plan-panel">
      <PanelHeader
        icon={<ClipboardCheck size={17} />}
        title="Assessment plan"
        action={<StatusBadge status={caseDetail.status} />}
      />
      <p className="panel-intro">
        Select evaluation methods and assign a lead assessor to finalize the plan for this case.
      </p>
      <div className="form-section">
        <span className="form-section-title">Evaluation methods</span>
        <div style={{ display: 'grid', gap: '8px' }}>
          {[
            { code: 'CBI', label: 'CBI (Competency-Based Interview)' },
            { code: 'CASE_STUDY', label: 'Case Study-Work Sample' },
            { code: 'ROLEPLAY', label: 'Roleplay' },
            { code: 'ASSESSMENT_CENTER', label: 'Assessment Center' },
          ].map((m) => (
            <label
              key={m.code}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              <input
                type="checkbox"
                checked={selectedMethods.includes(m.code)}
                disabled={finalizePlan.isPending}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedMethods((prev) => [...prev, m.code]);
                  } else {
                    setSelectedMethods((prev) => prev.filter((c) => c !== m.code));
                  }
                }}
              />
              <span>{m.label}</span>
            </label>
          ))}
        </div>
      </div>
      <label className="field" style={{ marginTop: '14px' }}>
        <span>Lead assessor</span>
        <input
          value={leadAssessor}
          onChange={(e) => setLeadAssessor(e.target.value)}
          placeholder="e.g. Dr. Ahmed Mansour"
          disabled={finalizePlan.isPending}
        />
      </label>
      <div className="action-row" style={{ marginTop: '16px' }}>
        <button
          className="primary-button"
          disabled={
            finalizePlan.isPending ||
            selectedMethods.length === 0 ||
            (action ? !action.enabled : false)
          }
          onClick={() => {
            finalizePlan.mutate({
              methods: selectedMethods.map((code) => ({
                methodCode: code,
                methodLabel:
                  code === 'CBI'
                    ? 'CBI'
                    : code === 'CASE_STUDY'
                      ? 'Case Study-Work Sample'
                      : code === 'ROLEPLAY'
                        ? 'Roleplay'
                        : 'Assessment Center',
                required: true,
              })),
              leadAssessor: leadAssessor.trim() || undefined,
              expectedVersion: caseDetail.version,
            });
          }}
        >
          {finalizePlan.isPending ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <CheckCircle2 size={16} />
          )}
          {action?.label ?? 'Finalize plan'}
        </button>
      </div>
      {finalizePlan.isError && <InlineError error={finalizePlan.error} onRefresh={onRefresh} />}
    </section>
  );
}

interface EventItem {
  id: string;
  status: string;
  startsAt?: string;
  location?: string;
  assessors?: Array<{ userId?: string; displayName?: string; role?: string }>;
}

function EventsPanel({
  caseDetail,
  onToast,
  onRefresh,
}: {
  caseDetail: AssessmentCaseDetail;
  onToast: (msg: string) => void;
  onRefresh: () => void;
}) {
  const queryClient = useQueryClient();
  const [startsAt, setStartsAt] = useState('');
  const [location, setLocation] = useState('');
  const [assessorIds, setAssessorIds] = useState<string[]>([]);
  const [manualAssessors, setManualAssessors] = useState<AssessorAccountOption[]>([]);
  const [manualAssessorName, setManualAssessorName] = useState('');
  const [manualAssessorEmail, setManualAssessorEmail] = useState('');

  const isVisible = caseDetail.status === 'PLANNING' || caseDetail.status === 'SCHEDULED';
  const canAssignAssessors = ['SYS_ADMIN', 'HR_ADMIN', 'ASSESSOR'].includes(getActiveUser().role);

  const assessorOptionsQuery = useQuery({
    queryKey: ['assessor-options'],
    queryFn: api.assessorAccounts,
    enabled: isVisible && canAssignAssessors,
  });
  const assessorOptions = assessorOptionsQuery.data ?? [];
  const allAssessorOptions = [...assessorOptions, ...manualAssessors];

  const { data: events } = useQuery({
    queryKey: ['events', caseDetail.id],
    queryFn: () => api.listEvents<EventItem>(caseDetail.id),
    enabled: isVisible,
  });

  const action = getAvailableAction(caseDetail, 'SCHEDULE_EVENT');

  const scheduleEvent = useMutation({
    mutationFn: (input: ScheduleEventInput) => api.scheduleEvent(caseDetail.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseDetail.id] });
      queryClient.invalidateQueries({ queryKey: ['events', caseDetail.id] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      setStartsAt('');
      setLocation('');
      setAssessorIds([]);
      setManualAssessors([]);
      setManualAssessorName('');
      setManualAssessorEmail('');
      onToast('Assessment event scheduled.');
    },
  });

  if (!isVisible) return null;

  return (
    <section className="panel events-panel">
      <PanelHeader
        icon={<CalendarDays size={17} />}
        title="Assessment events"
        action={<StatusBadge status={caseDetail.status} />}
      />
      <p className="panel-intro">
        Schedule evaluation sessions and track assessor assignments for this candidate.
      </p>
      <div className="form-section">
        <span className="form-section-title">Schedule session</span>
        <div className="form-grid">
          <label className="field">
            <span>
              Start date and time <b>*</b>
            </span>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              disabled={scheduleEvent.isPending}
            />
          </label>
          <label className="field">
            <span>Location / room</span>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Assessment Room 302 or Teams link"
              disabled={scheduleEvent.isPending}
            />
          </label>
        </div>
        {canAssignAssessors && (
          <fieldset className="assessor-picker">
            <legend>
              Assign assessors <b>*</b>
            </legend>
            {assessorOptionsQuery.isError && (
              <p className="assessor-picker-empty">
                Saved assessor accounts could not be loaded. You can still add names manually.
              </p>
            )}
            {assessorOptionsQuery.isLoading ? (
              <p className="assessor-picker-empty">Loading active assessor accounts…</p>
            ) : assessorOptions.length || manualAssessors.length ? (
              <div className="assessor-picker-options">
                {allAssessorOptions.map((assessor) => (
                  <label key={assessor.id} className="assessor-picker-option">
                    <input
                      type="checkbox"
                      checked={assessorIds.includes(assessor.id)}
                      onChange={(event) =>
                        setAssessorIds((selected) =>
                          event.target.checked
                            ? [...selected, assessor.id]
                            : selected.filter((id) => id !== assessor.id),
                        )
                      }
                      disabled={scheduleEvent.isPending}
                    />
                    <span>
                      <strong>{assessor.displayName}</strong>
                      <small>{assessor.email}</small>
                    </span>
                    {manualAssessors.some((item) => item.id === assessor.id) && (
                      <small className="assessor-picker-manual">Manual</small>
                    )}
                  </label>
                ))}
              </div>
            ) : !assessorOptionsQuery.isError ? (
              <p className="assessor-picker-empty">
                No saved assessor accounts yet. Add people below for this session.
              </p>
            ) : null}
            <div className="assessor-manual-form">
              <label className="field">
                <span>Person name</span>
                <input
                  value={manualAssessorName}
                  onChange={(event) => setManualAssessorName(event.target.value)}
                  placeholder="e.g. Ahmed Mohamed"
                  disabled={scheduleEvent.isPending}
                />
              </label>
              <label className="field">
                <span>Company email</span>
                <input
                  type="email"
                  value={manualAssessorEmail}
                  onChange={(event) => setManualAssessorEmail(event.target.value)}
                  placeholder="name@saudigerman.com"
                  disabled={scheduleEvent.isPending}
                />
              </label>
              <button
                className="secondary-button"
                type="button"
                disabled={
                  scheduleEvent.isPending ||
                  manualAssessorName.trim().length < 2 ||
                  !/^[^\s@]+@saudigerman\.com$/i.test(manualAssessorEmail.trim()) ||
                  allAssessorOptions.length >= 20 ||
                  allAssessorOptions.some(
                    (assessor) =>
                      assessor.email.toLowerCase() === manualAssessorEmail.trim().toLowerCase(),
                  )
                }
                onClick={() => {
                  const email = manualAssessorEmail.trim().toLowerCase();
                  const addedAssessor: AssessorAccountOption = {
                    id: email,
                    displayName: manualAssessorName.trim(),
                    email,
                    roles: ['Assessor'],
                  };
                  setManualAssessors((current) => [...current, addedAssessor]);
                  setAssessorIds((current) => [...current, addedAssessor.id]);
                  setManualAssessorName('');
                  setManualAssessorEmail('');
                }}
              >
                <Plus size={15} /> Add person
              </button>
            </div>
            <p className="assessor-picker-note">
              Manual names are saved with this session. To sign in and submit scores, each person
              needs an active AssessFlow Assessor account using the same email.
            </p>
          </fieldset>
        )}
        <div className="action-row" style={{ marginTop: '10px' }}>
          <button
            className="primary-button"
            disabled={
              scheduleEvent.isPending ||
              !startsAt ||
              (canAssignAssessors && assessorIds.length === 0) ||
              (action ? !action.enabled : false)
            }
            onClick={() => {
              scheduleEvent.mutate({
                startsAt: new Date(startsAt).toISOString(),
                location: location.trim() || undefined,
                assessors: assessorIds.map((id) => {
                  const assessor = allAssessorOptions.find((option) => option.id === id)!;
                  return { userId: assessor.id, displayName: assessor.displayName };
                }),
                expectedVersion: caseDetail.version,
              });
            }}
          >
            {scheduleEvent.isPending ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <CalendarDays size={16} />
            )}
            {action?.label ?? 'Schedule event'}
          </button>
        </div>
        {scheduleEvent.isError && <InlineError error={scheduleEvent.error} onRefresh={onRefresh} />}
      </div>
      <div style={{ marginTop: '20px' }}>
        <span className="form-section-title" style={{ display: 'block', marginBottom: '10px' }}>
          Scheduled sessions ({events?.length ?? 0})
        </span>
        {events && events.length > 0 ? (
          <div className="criteria-table">
            {events.map((ev) => (
              <div className="criterion-row" key={ev.id}>
                <div>
                  <strong>
                    {ev.startsAt
                      ? new Date(ev.startsAt).toLocaleString('en', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })
                      : 'Date TBD'}
                  </strong>
                  <span>
                    {ev.location || 'Location TBD'} · {ev.assessors?.length ?? 0} assessor
                    {(ev.assessors?.length ?? 0) === 1 ? '' : 's'}
                  </span>
                </div>
                <StatusBadge status={ev.status} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>No sessions scheduled yet.</div>
        )}
      </div>
    </section>
  );
}

function EvidencePanel({
  caseDetail,
  onToast,
  onRefresh,
  onGoToStage,
}: {
  caseDetail: AssessmentCaseDetail;
  onToast: (msg: string) => void;
  onRefresh: () => void;
  onGoToStage?: (stage: string) => void;
}) {
  const queryClient = useQueryClient();
  const isVisible = caseDetail.status === 'SCHEDULED' || caseDetail.status === 'IN_PROGRESS';

  const [attachments, setAttachments] = useState<AttachmentSummary[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`assessflow:attachments:${caseDetail.id}`);
      if (stored) {
        setAttachments(JSON.parse(stored));
      }
    } catch {
      // Ignore local storage error
    }

    const checkDemoAttachments = async () => {
      try {
        const cleanDemo = await api.getAttachment('att-demo-clean').catch(() => null);
        const pendingDemo = await api.getAttachment('att-demo-pending').catch(() => null);
        const demos: AttachmentSummary[] = [];
        if (cleanDemo && cleanDemo.caseId === caseDetail.id) demos.push(cleanDemo);
        if (pendingDemo && pendingDemo.caseId === caseDetail.id) demos.push(pendingDemo);

        if (demos.length > 0) {
          setAttachments((prev) => {
            const map = new Map<string, AttachmentSummary>();
            demos.forEach((d) => map.set(d.id, d));
            prev.forEach((p) => map.set(p.id, p));
            return Array.from(map.values());
          });
        }
      } catch {
        // demo check is best-effort
      }
    };
    checkDemoAttachments();
  }, [caseDetail.id]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';

    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
      setUploadError('File size exceeds 10MB maximum limit. Please select a smaller file.');
      return;
    }

    const lastDot = file.name.lastIndexOf('.');
    const ext = lastDot !== -1 ? file.name.slice(lastDot).toLowerCase() : '';
    const allowed = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
    if (!allowed.includes(ext)) {
      setUploadError(
        'Unsupported file format. Please upload a .pdf, .doc, .docx, .jpg, or .png file.',
      );
      return;
    }

    setUploadError(null);
    setPreviewError(null);
    setIsUploading(true);

    const mimeMap: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
    };
    const contentType = mimeMap[ext] || file.type || 'application/pdf';

    try {
      const created = await api.createAttachment({
        caseId: caseDetail.id,
        fileName: file.name,
        contentType,
        sizeBytes: file.size,
        classification: 'EVIDENCE',
      });

      setAttachments((prev) => {
        const next = [created, ...prev.filter((item) => item.id !== created.id)];
        try {
          localStorage.setItem(`assessflow:attachments:${caseDetail.id}`, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
      onToast(`Attachment "${file.name}" registered for security scanning.`);
    } catch (err) {
      setUploadError((err as Error).message || 'Failed to upload and register attachment.');
    } finally {
      setIsUploading(false);
    }
  };

  const handlePreviewAttachment = async (attachmentId: string) => {
    setPreviewError(null);
    try {
      const preview = await api.previewAttachment(attachmentId);
      if (preview.previewUrl) {
        window.open(preview.previewUrl, '_blank', 'noopener,noreferrer');
        onToast(`Opening clean preview for ${preview.fileName}.`);
      }
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'SCAN_NOT_CLEAN') {
        const msg = `Scan not clean: Attachment cannot be accessed because scanStatus is '${err.scanStatus || 'PENDING'}'.`;
        setPreviewError(msg);
        onToast(msg);
      } else {
        const msg = (err as Error).message || 'Could not open document preview.';
        setPreviewError(msg);
        onToast(msg);
      }
    }
  };

  const handleRefreshAttachment = async (attachmentId: string) => {
    try {
      const updated = await api.getAttachment(attachmentId);
      setAttachments((prev) => {
        const next = prev.map((item) => (item.id === updated.id ? updated : item));
        try {
          localStorage.setItem(`assessflow:attachments:${caseDetail.id}`, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
      onToast(`Scan status updated: ${updated.scanStatus}.`);
    } catch {
      onToast('Could not refresh scan status.');
    }
  };

  const { data: events } = useQuery({
    queryKey: ['events', caseDetail.id],
    queryFn: () => api.listEvents<EventItem>(caseDetail.id),
    enabled: isVisible,
  });

  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [submittedEvents, setSubmittedEvents] = useState<Record<string, boolean>>({});

  const action = getAvailableAction(caseDetail, 'SUBMIT_EVIDENCE');

  const saveDraft = useMutation({
    mutationFn: ({ eventId, summary }: { eventId: string; summary: string }) =>
      api.saveEvidenceDraft(eventId, { summary, expectedVersion: caseDetail.version }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseDetail.id] });
      queryClient.invalidateQueries({ queryKey: ['events', caseDetail.id] });
      onToast('Evidence draft saved.');
    },
  });

  const submitEvidence = useMutation({
    mutationFn: ({ eventId, summary }: { eventId: string; summary: string }) =>
      api.submitEvidence(eventId, { summary, expectedVersion: caseDetail.version }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['case', caseDetail.id] });
      queryClient.invalidateQueries({ queryKey: ['events', caseDetail.id] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      setSubmittedEvents((prev) => ({ ...prev, [variables.eventId]: true }));
      onToast('Assessor evidence submitted.');
    },
  });

  if (!isVisible) return null;

  return (
    <section className="panel evidence-panel">
      <PanelHeader
        icon={<FileText size={17} />}
        title="Assessor evidence"
        action={<StatusBadge status={caseDetail.status} />}
      />
      <p className="panel-intro">
        Record detailed behavioral evidence for each scheduled evaluation session. Minimum 20
        characters required.
      </p>
      {events && events.length > 0 ? (
        <div style={{ display: 'grid', gap: '20px' }}>
          {events.map((ev) => {
            const isSubmitted = submittedEvents[ev.id];
            const summary = summaries[ev.id] ?? '';
            const isPending =
              (saveDraft.isPending && saveDraft.variables?.eventId === ev.id) ||
              (submitEvidence.isPending && submitEvidence.variables?.eventId === ev.id);

            return (
              <div
                key={ev.id}
                style={{
                  padding: '14px',
                  border: '1px solid var(--border)',
                  borderRadius: '11px',
                  background: isSubmitted ? 'var(--surface-subtle)' : '#fff',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '10px',
                  }}
                >
                  <strong>
                    Session:{' '}
                    {ev.startsAt
                      ? new Date(ev.startsAt).toLocaleString('en', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })
                      : ev.id}
                  </strong>
                  <StatusBadge status={isSubmitted ? 'COMPLETED' : ev.status} />
                </div>
                {isSubmitted ? (
                  <>
                    <div className="restricted-callout">
                      <LockKeyhole size={16} />
                      <div>
                        <strong>Evidence submitted & locked</strong>
                        <span>
                          This evidence record is sealed and read-only for audit integrity.
                        </span>
                      </div>
                    </div>
                    <label className="field">
                      <span>Submitted summary</span>
                      <textarea value={summary} readOnly rows={3} disabled />
                    </label>
                  </>
                ) : (
                  <>
                    <label className="field">
                      <span>
                        Evidence summary <b>*</b> (min 20 chars)
                      </span>
                      <textarea
                        value={summary}
                        onChange={(e) =>
                          setSummaries((prev) => ({ ...prev, [ev.id]: e.target.value }))
                        }
                        placeholder="Detail the candidate's observed competencies, behaviors, and situational responses…"
                        rows={4}
                        disabled={isPending}
                      />
                      <small
                        style={{
                          color: summary.trim().length < 20 ? 'var(--muted)' : 'var(--success)',
                          fontSize: '10px',
                          display: 'block',
                          marginTop: '4px',
                        }}
                      >
                        {summary.trim().length} / 20 characters minimum
                      </small>
                    </label>
                    <div className="action-row" style={{ marginTop: '12px' }}>
                      <button
                        className="secondary-button"
                        disabled={isPending || summary.trim().length < 20}
                        onClick={() => saveDraft.mutate({ eventId: ev.id, summary })}
                      >
                        {saveDraft.isPending && saveDraft.variables?.eventId === ev.id ? (
                          <LoaderCircle className="spin" size={16} />
                        ) : (
                          <FileText size={16} />
                        )}
                        Save draft
                      </button>
                      <button
                        className="primary-button"
                        disabled={
                          isPending ||
                          summary.trim().length < 20 ||
                          (action ? !action.enabled : false)
                        }
                        onClick={() => submitEvidence.mutate({ eventId: ev.id, summary })}
                      >
                        {submitEvidence.isPending && submitEvidence.variables?.eventId === ev.id ? (
                          <LoaderCircle className="spin" size={16} />
                        ) : (
                          <CheckCircle2 size={16} />
                        )}
                        {action?.label ?? 'Submit evidence'}
                      </button>
                    </div>
                  </>
                )}
                {saveDraft.isError && saveDraft.variables?.eventId === ev.id && (
                  <InlineError error={saveDraft.error} onRefresh={onRefresh} />
                )}
                {submitEvidence.isError && submitEvidence.variables?.eventId === ev.id && (
                  <InlineError error={submitEvidence.error} onRefresh={onRefresh} />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
          No assessment events scheduled yet. Schedule an event first before recording evidence.
        </div>
      )}

      <AssessorScorecard
        caseId={caseDetail.id}
        onToast={onToast}
        onRefresh={onRefresh}
        onGoToResult={onGoToStage ? () => onGoToStage('Result') : undefined}
      />

      {/* Evidence Attachments with Anti-Malware Scan Gate */}
      <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
            marginBottom: '10px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <strong style={{ fontSize: '13px' }}>Evidence attachments & scan gate</strong>
              <span className="soft-count">{attachments.length} files</span>
            </div>
            <p style={{ margin: '3px 0 0', color: 'var(--muted)', fontSize: '11px' }}>
              Upload evaluation evidence documents (.pdf, .doc, .docx, .jpg, .png up to 10MB) for
              automated anti-malware security screening.
            </p>
          </div>
          <label
            className="secondary-button"
            style={{ cursor: isUploading ? 'not-allowed' : 'pointer' }}
          >
            {isUploading ? <LoaderCircle size={15} className="spin" /> : <Upload size={15} />}
            Upload document
            <input
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.png"
              style={{ display: 'none' }}
              disabled={isUploading}
              onChange={handleFileChange}
            />
          </label>
        </div>

        {uploadError && (
          <div className="restricted-callout" style={{ marginTop: '10px' }} role="alert">
            <AlertTriangle size={15} />
            <div>
              <strong>Attachment validation notice</strong>
              <span>{uploadError}</span>
            </div>
          </div>
        )}

        {previewError && (
          <div className="restricted-callout" style={{ marginTop: '10px' }} role="alert">
            <AlertTriangle size={15} />
            <div>
              <strong>Document scan policy warning</strong>
              <span>{previewError}</span>
            </div>
          </div>
        )}

        {attachments.length > 0 ? (
          <div className="attachment-list">
            {attachments.map((att) => (
              <div key={att.id} className="attachment-item">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <FileText size={18} style={{ color: 'var(--indigo)', flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <strong
                      style={{
                        fontSize: '12px',
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {att.fileName}
                    </strong>
                    <span style={{ fontSize: '10px', color: 'var(--muted)' }}>
                      {(att.sizeBytes / 1024).toFixed(0)} KB · {att.classification}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  <StatusBadge status={att.scanStatus} />
                  {att.scanStatus === 'CLEAN' ? (
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => handlePreviewAttachment(att.id)}
                      title="Preview clean attachment"
                    >
                      <ExternalLink size={14} />
                      Preview
                    </button>
                  ) : (
                    <span
                      className="scan-pending-note"
                      style={{
                        color: 'var(--muted)',
                        fontSize: '11px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Clock3 size={12} />
                      Scan pending
                    </span>
                  )}
                  <button
                    type="button"
                    className="row-action"
                    onClick={() => handleRefreshAttachment(att.id)}
                    title="Refresh scan status"
                    aria-label="Refresh scan status"
                  >
                    <RotateCcw size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--muted)', fontSize: '11px', marginTop: '10px' }}>
            No evidence attachments registered yet. Supported formats: .pdf, .doc, .docx, .jpg, .png
            (up to 10MB).
          </div>
        )}
      </div>
    </section>
  );
}

interface ScorecardResponse {
  config: ScorecardConfig;
  mySubmission: {
    ratings: ScorecardRatings;
    submittedAt: string | null;
    assessorName: string;
  } | null;
  assignedAssessorCount: number;
  canReviseSubmission: boolean;
  submissions: Array<{ assessorName: string; submitted: boolean; submittedAt: string | null }>;
  aggregate: {
    completeCount: number;
    resultCode: ResultCode;
    technical?: number;
    behavioral?: number;
    overall?: number;
    knockout: boolean;
    technicalWeight: number;
    behavioralWeight: number;
    technicalIssues: ScorecardIssueSummary[];
    behavioralIssues: ScorecardIssueSummary[];
    knockoutChecks: ScorecardKnockoutCheck[];
  };
  canEditWeights: boolean;
}

function resultCodeLabel(code: ResultCode) {
  return {
    READY_NOW: 'Ready now',
    READY_WITH_DEVELOPMENT: 'Ready with development',
    NOT_READY: 'Not ready',
    INCOMPLETE: 'Incomplete',
  }[code];
}

function formatScore(value: number) {
  return String(Math.round(value * 100) / 100);
}

function formatCategoryScore(value: number) {
  return value.toFixed(2);
}

function AssessorScorecard({
  caseId,
  onToast,
  onRefresh,
  onGoToResult,
}: {
  caseId: string;
  onToast: (msg: string) => void;
  onRefresh: () => void;
  /** Shown after submitting: moves the case view to the Result stage. */
  onGoToResult?: () => void;
}) {
  const queryClient = useQueryClient();
  const queryKey = ['scorecard', caseId];
  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => api.scorecard<ScorecardResponse>(caseId),
  });
  const [config, setConfig] = useState<ScorecardConfig | null>(null);
  const [ratings, setRatings] = useState<ScorecardRatings>({});
  const [dirtyConfig, setDirtyConfig] = useState(false);
  const [activeScorecardTab, setActiveScorecardTab] = useState<'technical' | 'behavioral'>(
    'technical',
  );
  const [expandedComments, setExpandedComments] = useState<Set<string>>(() => new Set());
  const [openIssues, setOpenIssues] = useState<Set<string>>(
    () => new Set(['technical-0', 'behavioral-0']),
  );
  const [editStructure, setEditStructure] = useState(false);
  const [numericDrafts, setNumericDrafts] = useState<
    Record<string, { value: string; valid: boolean }>
  >({});

  useEffect(() => {
    if (data && !dirtyConfig) setConfig(data.config);
  }, [data?.config, dirtyConfig]);
  // Reload scores only when the saved copy on the server changes. Editing or saving
  // scorecard settings must never wipe the scores being entered.
  useEffect(() => {
    if (data) setRatings(data.mySubmission?.ratings ?? {});
  }, [data?.mySubmission]);

  const saveConfig = useMutation({
    mutationFn: (next: ScorecardConfig) => api.updateScorecardConfig(caseId, next),
    onSuccess: (result) => {
      setDirtyConfig(false);
      queryClient.setQueryData<ScorecardResponse>(queryKey, (current) =>
        current
          ? { ...current, config: result.config, canEditWeights: result.canEditWeights }
          : current,
      );
      onToast('Scorecard settings saved.');
    },
  });
  const saveRatings = useMutation({
    mutationFn: async ({ submit }: { submit: boolean }) => {
      if (dirtyConfig && config) await saveConfig.mutateAsync(config);
      return api.saveScorecard(caseId, ratings, submit);
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey });
      if (variables.submit) {
        queryClient.invalidateQueries({ queryKey: ['case', caseId] });
        queryClient.invalidateQueries({ queryKey: ['overview'] });
        queryClient.invalidateQueries({ queryKey: ['cases'] });
      }
      onToast(variables.submit ? 'Scorecard submitted and locked.' : 'Scorecard draft saved.');
    },
  });
  const reviseSubmittedScores = useMutation({
    mutationFn: (reason: string) => api.reviseScorecard(caseId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      onToast('Scorecard reopened as a draft. The previous submission is in the audit history.');
    },
  });

  if (isLoading)
    return (
      <section className="panel">
        <p>Loading assessment scorecard…</p>
      </section>
    );
  if (error || !data || !config)
    return (
      <section className="panel">
        <PanelHeader icon={<ClipboardCheck size={17} />} title="Assessment scorecard" />
        {error ? (
          <InlineError error={error} onRefresh={onRefresh} />
        ) : (
          <p>Scorecard unavailable.</p>
        )}
      </section>
    );

  const locked = Boolean(data.mySubmission?.submittedAt);
  const preview = calculateScorecard(config, [{ ratings, submitted: true }]);
  const activeCategoryLabel =
    activeScorecardTab === 'technical'
      ? (config.technicalLabel ?? 'TECHNICAL')
      : (config.behavioralLabel ?? 'BEHAVIORAL');
  const activeCategoryScore =
    activeScorecardTab === 'technical' ? preview.technical : preview.behavioral;
  const allDimensions = [...config.technical, ...config.behavioral];
  const totalQuestionCount = allDimensions.reduce(
    (total, dimension) => total + dimension.criteria.length,
    0,
  );
  const completedQuestionCount = allDimensions.reduce(
    (total, dimension) =>
      total +
      dimension.criteria.filter((criterion) => {
        const score = ratings[scorecardRatingKey(dimension, criterion)]?.score;
        return isValidQuestionScore(score, criterion.weight);
      }).length,
    0,
  );
  // Knockout is a flag the assessor sets on a question; it does not depend on the score.
  const knockoutFlags = allDimensions.flatMap((dimension) =>
    dimension.criteria.filter(
      (criterion) => ratings[scorecardRatingKey(dimension, criterion)]?.knockout === true,
    ),
  );
  const knockoutTriggered = knockoutFlags.length > 0;
  const weightProblems = scorecardWeightProblems(config);
  const activeSectionWeightTotal = config[activeScorecardTab].reduce(
    (total, dimension) => total + dimension.weight,
    0,
  );
  const sectionSplitTotal = config.technicalWeight + config.behavioralWeight;
  const hasInvalidNumericDraft = Object.values(numericDrafts).some((draft) => !draft.valid);
  const setNumericDraft = (
    key: string,
    rawValue: string,
    min: number,
    max: number,
    allowEmpty: boolean,
    onValidValue: (value: number | undefined) => void,
  ) => {
    const parsed = /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(rawValue) ? Number(rawValue) : undefined;
    const empty = rawValue === '';
    const valid = empty ? allowEmpty : parsed !== undefined && parsed >= min && parsed <= max;
    setNumericDrafts((current) => ({ ...current, [key]: { value: rawValue, valid } }));
    if (valid) onValidValue(empty ? undefined : parsed);
  };
  const clearNumericDraft = (key: string) =>
    setNumericDrafts((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  const numericInputValue = (key: string, value: number | undefined) =>
    numericDrafts[key]?.value ?? (value === undefined ? '' : String(value));
  const setWeight = (section: 'technical' | 'behavioral', groupIndex: number, value: number) => {
    setConfig((current) => {
      if (!current) return current;
      const groups = [...current[section]];
      groups[groupIndex] = { ...groups[groupIndex]!, weight: value };
      return { ...current, [section]: groups };
    });
    setDirtyConfig(true);
  };
  const setDimensionName = (
    section: 'technical' | 'behavioral',
    groupIndex: number,
    name: string,
  ) => {
    setConfig((current) => {
      if (!current) return current;
      const groups = [...current[section]];
      groups[groupIndex] = { ...groups[groupIndex]!, name };
      return { ...current, [section]: groups };
    });
    setDirtyConfig(true);
  };
  const setSectionLabel = (field: 'technicalLabel' | 'behavioralLabel', label: string) => {
    setConfig((current) => (current ? { ...current, [field]: label } : current));
    setDirtyConfig(true);
  };
  const setCriterionWeight = (
    section: 'technical' | 'behavioral',
    groupIndex: number,
    ratingKey: string,
    value: number,
  ) => {
    setConfig((current) => {
      if (!current) return current;
      const groups = [...current[section]];
      groups[groupIndex] = {
        ...groups[groupIndex]!,
        criteria: groups[groupIndex]!.criteria.map((criterion) =>
          scorecardRatingKey(groups[groupIndex]!, criterion) === ratingKey
            ? { ...criterion, weight: value }
            : criterion,
        ),
      };
      return { ...current, [section]: groups };
    });
    setDirtyConfig(true);
  };
  const setCriterionText = (
    section: 'technical' | 'behavioral',
    groupIndex: number,
    ratingKey: string,
    field: 'name' | 'standard',
    value: string,
  ) => {
    setConfig((current) => {
      if (!current) return current;
      const groups = [...current[section]];
      const group = groups[groupIndex]!;
      groups[groupIndex] = {
        ...group,
        criteria: group.criteria.map((criterion) =>
          scorecardRatingKey(group, criterion) === ratingKey
            ? { ...criterion, [field]: value }
            : criterion,
        ),
      };
      return { ...current, [section]: groups };
    });
    setDirtyConfig(true);
  };
  const addCriterion = (section: 'technical' | 'behavioral', groupIndex: number) => {
    setConfig((current) => {
      if (!current) return current;
      const groups = [...current[section]];
      const group = groups[groupIndex]!;
      const ratingKey = `${group.code}:custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      let sequence = group.criteria.length + 1;
      while (group.criteria.some((criterion) => criterion.code === `N${sequence}`)) sequence += 1;
      groups[groupIndex] = {
        ...group,
        criteria: [
          ...group.criteria,
          {
            code: `N${sequence}`,
            ratingKey,
            name: 'New criterion',
            standard: 'Describe the expected behavior or evidence for this criterion.',
            weight: 1,
          },
        ],
      };
      return { ...current, [section]: groups };
    });
    setDirtyConfig(true);
  };
  const removeCriterion = (
    section: 'technical' | 'behavioral',
    groupIndex: number,
    ratingKey: string,
  ) => {
    const group = config[section][groupIndex]!;
    if (group.criteria.length <= 1) return;
    setConfig((current) => {
      if (!current) return current;
      const groups = [...current[section]];
      const currentGroup = groups[groupIndex]!;
      groups[groupIndex] = {
        ...currentGroup,
        criteria: currentGroup.criteria.filter(
          (criterion) => scorecardRatingKey(currentGroup, criterion) !== ratingKey,
        ),
      };
      return { ...current, [section]: groups };
    });
    setRatings((current) => {
      const next = { ...current };
      delete next[ratingKey];
      return next;
    });
    setDirtyConfig(true);
  };
  const setRating = (code: string, field: 'score' | 'evidence', value: string) =>
    setRatings((current) => ({
      ...current,
      [code]: {
        ...current[code],
        [field]: field === 'score' ? (value ? Number(value) : undefined) : value,
      },
    }));
  const setScore = (code: string, score: number | undefined) =>
    setRatings((current) => ({
      ...current,
      [code]: {
        ...current[code],
        score: score === undefined ? undefined : Math.round(score * 100) / 100,
      },
    }));
  const toggleKnockout = (code: string) =>
    setRatings((current) => ({
      ...current,
      [code]: { ...current[code], knockout: !current[code]?.knockout },
    }));
  const toggleComment = (ratingKey: string) =>
    setExpandedComments((current) => {
      const next = new Set(current);
      if (next.has(ratingKey)) next.delete(ratingKey);
      else next.add(ratingKey);
      return next;
    });

  const toggleIssue = (key: string) =>
    setOpenIssues((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  // ---- Scorecard v2 view: mirrors the approved "Scorecard redesign" mockup ----
  const issueStats = (dimension: ScorecardDimension) => {
    let target = 0;
    let actual = 0;
    let answered = 0;
    for (const criterion of dimension.criteria) {
      const value = ratings[scorecardRatingKey(dimension, criterion)]?.score;
      target += criterion.weight;
      if (isValidQuestionScore(value, criterion.weight)) {
        actual += value;
        answered += 1;
      }
    }
    return {
      target,
      actual,
      answered,
      pct: target ? actual / target : 0,
      complete: answered === dimension.criteria.length,
    };
  };
  const sectionStats = (section: 'technical' | 'behavioral') => {
    let weighted = 0;
    let totalWeight = 0;
    let answered = 0;
    let total = 0;
    let complete = true;
    for (const dimension of config[section]) {
      const stats = issueStats(dimension);
      answered += stats.answered;
      total += dimension.criteria.length;
      if (!stats.complete) complete = false;
      // Every issue counts with its full weight; unanswered questions count as 0 points,
      // so the score reflects only what has actually been earned so far.
      weighted += stats.pct * 5 * dimension.weight;
      totalWeight += dimension.weight;
    }
    return {
      score: answered && totalWeight ? weighted / totalWeight : undefined,
      answered,
      total,
      complete,
    };
  };
  const technicalStats = sectionStats('technical');
  const behavioralStats = sectionStats('behavioral');
  const runningOverall =
    (technicalStats.answered || behavioralStats.answered) && sectionSplitTotal > 0
      ? ((technicalStats.score ?? 0) * config.technicalWeight +
          (behavioralStats.score ?? 0) * config.behavioralWeight) /
        sectionSplitTotal
      : undefined;
  const runningResult: ResultCode | null = knockoutTriggered
    ? 'NOT_READY'
    : runningOverall === undefined
      ? null
      : runningOverall >= SCORECARD_READY_NOW_THRESHOLD
        ? 'READY_NOW'
        : runningOverall >= SCORECARD_READY_WITH_DEVELOPMENT_THRESHOLD
          ? 'READY_WITH_DEVELOPMENT'
          : 'NOT_READY';
  const sectionStatus = (stats: ReturnType<typeof sectionStats>) =>
    stats.complete
      ? 'Complete'
      : stats.answered
        ? `Provisional · ${stats.answered} of ${stats.total} scored`
        : 'Not started';
  const bandTone = (pct: number, answered: number) =>
    !answered ? 'none' : pct >= 0.8 ? 'good' : pct >= 0.6 ? 'mid' : 'low';
  const formatPoints = (value: number) => String(Math.round(value * 100) / 100);
  // Quick-pick buttons are shares of the question weight. With weight 1 they read 0 ¼ ½ ¾ 1;
  // with weight 3 they read 0 · 0.75 · 1.5 · 2.25 · 3. Any other value goes in the points box.
  const quickPickLabel = (fraction: number, weight: number) =>
    weight === 1
      ? fraction === 0.25
        ? '¼'
        : fraction === 0.5
          ? '½'
          : fraction === 0.75
            ? '¾'
            : String(fraction)
      : formatPoints(fraction * weight);
  const canEditStructure = data.canEditWeights && !locked;
  const sectionLabel = (section: 'technical' | 'behavioral') =>
    section === 'technical'
      ? (config.technicalLabel ?? 'Technical')
      : (config.behavioralLabel ?? 'Behavioral');
  const footerMessage =
    dirtyConfig && weightProblems.length
      ? { tone: 'error', text: weightProblems.join(' ') }
      : dirtyConfig
        ? {
            tone: 'muted',
            text: 'Scorecard settings changed. They are saved together with your scores when you save a draft or submit.',
          }
        : locked
          ? { tone: 'muted', text: 'Your scores are submitted and locked.' }
          : completedQuestionCount === totalQuestionCount
            ? { tone: 'ok', text: 'All questions scored and weights balanced. Ready to submit.' }
            : {
                tone: 'muted',
                text: `${completedQuestionCount} of ${totalQuestionCount} questions scored. Save a draft anytime; submit when every question has a score.`,
              };

  const issueCards = (section: 'technical' | 'behavioral') =>
    config[section].map((dimension, index) => {
      const stats = issueStats(dimension);
      const issueKey = `${section}-${index}`;
      const open = openIssues.has(issueKey);
      const tone = bandTone(stats.pct, stats.answered);
      const hasKnockoutFlag = dimension.criteria.some(
        (criterion) => ratings[scorecardRatingKey(dimension, criterion)]?.knockout,
      );
      return (
        <div key={issueKey} className="sc2-issue">
          <div className="sc2-issue-head">
            <button
              type="button"
              className="sc2-issue-toggle"
              aria-expanded={open}
              onClick={() => toggleIssue(issueKey)}
            >
              <span className="sc2-code-badge" aria-hidden="true">
                {dimension.code}
              </span>
              <span className="sc2-issue-title">
                <span className="sc2-issue-name">{dimension.name}</span>
                <span className="sc2-issue-meta">
                  {dimension.criteria.length} questions · {stats.answered} scored
                  {hasKnockoutFlag ? ' · knockout flagged' : ''}
                </span>
              </span>
            </button>
            <label className="sc2-weight-field">
              Weight
              <input
                className="sc2-input"
                type="number"
                inputMode="numeric"
                min="0"
                max="100"
                step="1"
                aria-label={`${dimension.name} weight in percent`}
                value={numericInputValue(`dimension-weight:${section}:${index}`, dimension.weight)}
                disabled={!canEditStructure}
                onChange={(event) =>
                  setNumericDraft(
                    `dimension-weight:${section}:${index}`,
                    event.target.value,
                    0,
                    100,
                    false,
                    (value) => {
                      if (value !== undefined) setWeight(section, index, value);
                    },
                  )
                }
                onBlur={() => clearNumericDraft(`dimension-weight:${section}:${index}`)}
              />
              <span>%</span>
            </label>
            <div className="sc2-issue-progress">
              <div
                className="sc2-bar"
                role="progressbar"
                aria-label={`${dimension.name} progress`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(stats.pct * 100)}
              >
                <span
                  className={`sc2-bar-fill tone-${tone}`}
                  style={{ width: `${Math.round(stats.pct * 100)}%` }}
                />
              </div>
              <span className="sc2-issue-total">
                <span className={`sc2-num sc2-issue-total-main tone-text-${tone}`}>
                  {formatScore(stats.actual)} / {formatScore(stats.target)}
                </span>
                <span className="sc2-num sc2-issue-total-sub">
                  {Math.round(stats.pct * 100)}% ·{' '}
                  {stats.answered ? formatCategoryScore(stats.pct * 5) : '—'}/5
                </span>
              </span>
            </div>
          </div>

          {open && (
            <div className="sc2-issue-body">
              {editStructure && canEditStructure && (
                <label className="sc2-edit-row">
                  Issue name
                  <input
                    className="sc2-text-input"
                    value={dimension.name}
                    onChange={(event) => setDimensionName(section, index, event.target.value)}
                  />
                </label>
              )}
              <div className="sc2-grid sc2-col-head">
                <span>QUESTION</span>
                <span>POINTS (0 TO Q. WEIGHT)</span>
                <span className="sc2-right">Q. WEIGHT</span>
              </div>
              {dimension.criteria.map((criterion) => {
                const ratingKey = scorecardRatingKey(dimension, criterion);
                const rating = ratings[ratingKey];
                const noteOpen = expandedComments.has(ratingKey);
                return (
                  <div key={ratingKey} className="sc2-question">
                    <div className="sc2-grid sc2-question-row">
                      <div className="sc2-question-text">
                        <span className="sc2-question-heading">
                          <span className="sc2-num sc2-question-code">{criterion.code}</span>
                          {editStructure && canEditStructure ? (
                            <input
                              className="sc2-text-input"
                              aria-label={`${criterion.code} question name`}
                              value={criterion.name}
                              onChange={(event) =>
                                setCriterionText(
                                  section,
                                  index,
                                  ratingKey,
                                  'name',
                                  event.target.value,
                                )
                              }
                            />
                          ) : (
                            <span className="sc2-question-name">{criterion.name}</span>
                          )}
                          {rating?.knockout && <span className="sc2-ko-badge">KNOCKOUT</span>}
                          {editStructure && canEditStructure && (
                            <button
                              type="button"
                              className="sc2-icon-button"
                              aria-label={`Remove ${criterion.name}`}
                              disabled={dimension.criteria.length <= 1}
                              onClick={() => removeCriterion(section, index, ratingKey)}
                            >
                              <X size={14} />
                            </button>
                          )}
                        </span>
                        {editStructure && canEditStructure ? (
                          <textarea
                            className="sc2-note"
                            aria-label={`${criterion.name} standard`}
                            rows={2}
                            value={criterion.standard}
                            onChange={(event) =>
                              setCriterionText(
                                section,
                                index,
                                ratingKey,
                                'standard',
                                event.target.value,
                              )
                            }
                          />
                        ) : (
                          <span className="sc2-question-std">{criterion.standard}</span>
                        )}
                        <span className="sc2-question-actions">
                          <button
                            type="button"
                            className={`sc2-ko-toggle${rating?.knockout ? ' active' : ''}`}
                            aria-pressed={Boolean(rating?.knockout)}
                            disabled={locked}
                            onClick={() => toggleKnockout(ratingKey)}
                          >
                            {rating?.knockout ? 'Knockout flagged' : 'Flag knockout'}
                          </button>
                          <button
                            type="button"
                            className="sc2-link"
                            aria-expanded={noteOpen}
                            onClick={() => toggleComment(ratingKey)}
                          >
                            {noteOpen
                              ? 'Hide evidence note'
                              : rating?.evidence?.trim()
                                ? 'Evidence note saved · edit'
                                : '+ Evidence note'}
                          </button>
                        </span>
                      </div>
                      <div className="sc2-points">
                        <div
                          className="sc2-seg-group"
                          role="group"
                          aria-label={`${criterion.name} quick score`}
                        >
                          {SCORECARD_QUICK_FRACTIONS.map((fraction) => {
                            const points = Math.round(fraction * criterion.weight * 100) / 100;
                            return (
                              <button
                                key={fraction}
                                type="button"
                                className="sc2-seg"
                                aria-pressed={rating?.score === points}
                                aria-label={`${criterion.name}: ${formatPoints(points)} of ${formatPoints(criterion.weight)}`}
                                disabled={locked}
                                onClick={() => {
                                  clearNumericDraft(`points:${ratingKey}`);
                                  setScore(ratingKey, points);
                                }}
                              >
                                {quickPickLabel(fraction, criterion.weight)}
                              </button>
                            );
                          })}
                        </div>
                        <span className="sc2-points-entry">
                          <input
                            className={`sc2-input sc2-points-input${
                              numericDrafts[`points:${ratingKey}`]?.valid === false
                                ? ' invalid'
                                : ''
                            }`}
                            type="text"
                            inputMode="decimal"
                            placeholder="—"
                            aria-label={`${criterion.name} points earned (0 to ${formatPoints(criterion.weight)})`}
                            value={numericInputValue(`points:${ratingKey}`, rating?.score)}
                            disabled={locked}
                            onChange={(event) =>
                              setNumericDraft(
                                `points:${ratingKey}`,
                                event.target.value,
                                0,
                                criterion.weight,
                                true,
                                (value) => setScore(ratingKey, value),
                              )
                            }
                            onBlur={() => {
                              if (numericDrafts[`points:${ratingKey}`]?.valid !== false)
                                clearNumericDraft(`points:${ratingKey}`);
                            }}
                          />
                          <span className="sc2-points-max">/ {formatPoints(criterion.weight)}</span>
                        </span>
                      </div>
                      <div className="sc2-right">
                        <input
                          className="sc2-input"
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.5"
                          aria-label={`${criterion.name} question weight`}
                          value={numericInputValue(
                            `criterion-weight:${ratingKey}`,
                            criterion.weight,
                          )}
                          disabled={!canEditStructure}
                          onChange={(event) =>
                            setNumericDraft(
                              `criterion-weight:${ratingKey}`,
                              event.target.value,
                              0,
                              1000,
                              false,
                              (value) => {
                                if (value !== undefined)
                                  setCriterionWeight(section, index, ratingKey, value);
                              },
                            )
                          }
                          onBlur={() => clearNumericDraft(`criterion-weight:${ratingKey}`)}
                        />
                      </div>
                    </div>
                    {noteOpen && (
                      <textarea
                        className="sc2-note"
                        aria-label={`${criterion.name} evidence note`}
                        placeholder="Evidence observed in the session for this question"
                        value={rating?.evidence ?? ''}
                        disabled={locked}
                        onChange={(event) => setRating(ratingKey, 'evidence', event.target.value)}
                      />
                    )}
                  </div>
                );
              })}
              {editStructure && canEditStructure && (
                <div className="sc2-add-row">
                  <button
                    type="button"
                    className="sc2-link"
                    onClick={() => addCriterion(section, index)}
                  >
                    + Add question
                  </button>
                </div>
              )}
              <div className="sc2-issue-foot">
                <span>
                  Target = sum of question weights (
                  <span className="sc2-num">{formatScore(stats.target)}</span>). Actual = Σ points
                  entered (<span className="sc2-num">{formatScore(stats.actual)}</span>).
                </span>
                <span className="sc2-num sc2-strong">
                  Issue score {stats.answered ? formatCategoryScore(stats.pct * 5) : '—'} / 5
                </span>
              </div>
            </div>
          )}
        </div>
      );
    });

  return (
    <section className="sc2" style={{ marginTop: '22px' }}>
      <div className="sc2-header">
        <div className="sc2-header-text">
          <span className="sc2-kicker">ASSESSOR SCORECARD</span>
          <h2 className="sc2-title">Assessment scorecard</h2>
          <span className="sc2-sub">
            Enter the points earned on each question (0 up to its weight). An issue&apos;s target is
            the sum of its question weights; its actual is the sum of your points. Unscored
            questions count as 0.
          </span>
        </div>
        <div className="sc2-header-side">
          {canEditStructure && (
            <button
              type="button"
              className="sc2-link"
              aria-pressed={editStructure}
              onClick={() => setEditStructure((value) => !value)}
            >
              {editStructure ? 'Done editing questions' : 'Edit questions'}
            </button>
          )}
          <span className="sc2-num sc2-sub">
            {completedQuestionCount} / {totalQuestionCount} questions scored
          </span>
        </div>
      </div>

      <div className="sc2-summary">
        {(['technical', 'behavioral'] as const).map((section) => {
          const stats = section === 'technical' ? technicalStats : behavioralStats;
          return (
            <div key={section} className="sc2-card">
              <span className="sc2-card-label">
                {sectionLabel(section).toUpperCase()} · {config[`${section}Weight`]}%
              </span>
              <span className="sc2-num sc2-card-value">
                {stats.score === undefined ? '—' : formatCategoryScore(stats.score)}
                <span className="sc2-card-unit"> / 5</span>
              </span>
              <span className="sc2-card-note">{sectionStatus(stats)}</span>
            </div>
          );
        })}
        <div className="sc2-card sc2-card-dark">
          <span className="sc2-card-label">OVERALL</span>
          <span className="sc2-num sc2-card-value">
            {runningOverall === undefined ? '—' : formatCategoryScore(runningOverall)}
            <span className="sc2-card-unit"> / 5</span>
          </span>
          <span className={`sc2-result-chip result-${runningResult ?? 'none'}`}>
            {runningResult
              ? resultCodeLabel(runningResult)
              : 'Score both sections to see the result'}
          </span>
        </div>
        <div className="sc2-card">
          <span className="sc2-card-label">KNOCKOUT</span>
          <span className={`sc2-ko-status ${knockoutTriggered ? 'triggered' : 'clear'}`}>
            {knockoutTriggered ? 'Triggered' : 'Clear'}
          </span>
          <span className="sc2-card-note">
            {knockoutTriggered
              ? `Flagged on ${knockoutFlags.map((criterion) => criterion.code).join(', ')}. Result is Not ready.`
              : 'Flag a knockout on any question to force Not ready.'}
          </span>
        </div>
      </div>

      <div className="sc2-split">
        <span className="sc2-strong">Section split</span>
        {(['technicalWeight', 'behavioralWeight'] as const).map((field) => (
          <label key={field} className="sc2-weight-field">
            {field === 'technicalWeight' ? sectionLabel('technical') : sectionLabel('behavioral')}
            <input
              className="sc2-input"
              type="number"
              inputMode="numeric"
              min="0"
              max="100"
              step="1"
              value={numericInputValue(`section-weight:${field}`, config[field])}
              disabled={!canEditStructure}
              onChange={(event) =>
                setNumericDraft(
                  `section-weight:${field}`,
                  event.target.value,
                  0,
                  100,
                  false,
                  (value) => {
                    if (value !== undefined) {
                      setConfig({ ...config, [field]: value });
                      setDirtyConfig(true);
                    }
                  },
                )
              }
              onBlur={() => clearNumericDraft(`section-weight:${field}`)}
            />
            <span>%</span>
          </label>
        ))}
        <span className={`sc2-pill ${sectionSplitTotal === 100 ? 'ok' : 'error'}`}>
          {sectionSplitTotal === 100
            ? 'Total 100% ✓'
            : `Total ${sectionSplitTotal}% · must be 100%`}
        </span>
      </div>

      <div className="sc2-tabbar">
        <div role="tablist" aria-label="Scorecard section" className="sc2-tabs">
          {(['technical', 'behavioral'] as const).map((section) => (
            <button
              key={section}
              type="button"
              role="tab"
              className="sc2-tab"
              aria-selected={activeScorecardTab === section}
              onClick={() => setActiveScorecardTab(section)}
            >
              {sectionLabel(section)}
              <span className="sc2-num sc2-tab-count">{config[section].length} issues</span>
            </button>
          ))}
        </div>
        <div className="sc2-budget">
          <span>Issue weights</span>
          <span className="sc2-budget-bar">
            <span
              className={`sc2-bar-fill tone-${
                activeSectionWeightTotal === 100
                  ? 'good'
                  : activeSectionWeightTotal > 100
                    ? 'low'
                    : 'mid'
              }`}
              style={{ width: `${Math.min(activeSectionWeightTotal, 100)}%` }}
            />
          </span>
          <span
            className={`sc2-num sc2-strong tone-text-${
              activeSectionWeightTotal === 100
                ? 'good'
                : activeSectionWeightTotal > 100
                  ? 'low'
                  : 'mid'
            }`}
          >
            {activeSectionWeightTotal === 100
              ? '100% of 100%'
              : activeSectionWeightTotal > 100
                ? `${activeSectionWeightTotal}% · over by ${activeSectionWeightTotal - 100}%`
                : `${activeSectionWeightTotal}% · ${100 - activeSectionWeightTotal}% unassigned`}
          </span>
        </div>
      </div>

      {editStructure && canEditStructure && (
        <label className="sc2-edit-row">
          Section name
          <input
            className="sc2-text-input"
            value={sectionLabel(activeScorecardTab)}
            onChange={(event) =>
              setSectionLabel(
                activeScorecardTab === 'technical' ? 'technicalLabel' : 'behavioralLabel',
                event.target.value,
              )
            }
          />
        </label>
      )}

      <div className="sc2-issues" role="tabpanel">
        {issueCards(activeScorecardTab)}
      </div>

      {data.submissions.length > 0 && (
        <p className="sc2-sub">
          {data.submissions.filter((submission) => submission.submitted).length} assessor
          scorecard(s) submitted. The final result averages all completed scorecards.
        </p>
      )}

      <div className="sc2-footer">
        <span className={`sc2-footer-msg tone-${footerMessage.tone}`} role="status">
          {footerMessage.text}
        </span>
        <div className="sc2-footer-actions">
          {locked && data.canReviseSubmission && (
            <button
              type="button"
              className="sc2-btn sc2-btn-secondary"
              disabled={reviseSubmittedScores.isPending}
              onClick={() => {
                const reason = window.prompt(
                  'Why are you editing this submitted scorecard? This reason will be saved in the audit history.',
                );
                if (reason?.trim()) reviseSubmittedScores.mutate(reason.trim());
              }}
            >
              {reviseSubmittedScores.isPending ? 'Reopening…' : 'Edit submitted scores'}
            </button>
          )}
          {canEditStructure && dirtyConfig && (
            <button
              type="button"
              className="sc2-btn sc2-btn-secondary"
              disabled={hasInvalidNumericDraft || weightProblems.length > 0 || saveConfig.isPending}
              onClick={() => saveConfig.mutate(config)}
            >
              {saveConfig.isPending ? 'Saving…' : 'Save scorecard settings'}
            </button>
          )}
          <button
            type="button"
            className="sc2-btn sc2-btn-secondary"
            disabled={
              locked ||
              (dirtyConfig && weightProblems.length > 0) ||
              hasInvalidNumericDraft ||
              saveConfig.isPending ||
              saveRatings.isPending
            }
            onClick={() => saveRatings.mutate({ submit: false })}
          >
            {saveRatings.isPending && !saveRatings.variables?.submit ? 'Saving…' : 'Save draft'}
          </button>
          <button
            type="button"
            className="sc2-btn sc2-btn-primary"
            disabled={
              locked ||
              (dirtyConfig && weightProblems.length > 0) ||
              hasInvalidNumericDraft ||
              saveConfig.isPending ||
              completedQuestionCount < totalQuestionCount ||
              saveRatings.isPending
            }
            title={
              completedQuestionCount < totalQuestionCount
                ? `${totalQuestionCount - completedQuestionCount} question(s) still need points.`
                : undefined
            }
            onClick={() => saveRatings.mutate({ submit: true })}
          >
            {saveRatings.isPending && saveRatings.variables?.submit
              ? 'Submitting…'
              : 'Submit scores'}
          </button>
        </div>
      </div>

      {locked && onGoToResult && (
        <div className="sc2-next">
          <div className="sc2-next-text">
            <strong>Scores submitted</strong>
            <span>Next step: review the calculated result and finalize it.</span>
          </div>
          <button type="button" className="sc2-btn sc2-btn-primary" onClick={onGoToResult}>
            Go to Result
            <ArrowRight size={16} />
          </button>
        </div>
      )}

      {locked && (
        <div className="restricted-callout" style={{ marginTop: '12px' }}>
          <LockKeyhole size={16} />
          <div>
            <strong>Scores submitted and locked</strong>
            <span>
              {data.canReviseSubmission
                ? 'To make a correction, choose “Edit submitted scores” and enter a reason. The earlier submission will remain in the audit history.'
                : 'This result has moved past assessment. Reopen the result first, then revise the submitted scores with a reason.'}
            </span>
          </div>
        </div>
      )}
      {saveConfig.isError && <InlineError error={saveConfig.error} onRefresh={onRefresh} />}
      {saveRatings.isError && <InlineError error={saveRatings.error} onRefresh={onRefresh} />}
      {reviseSubmittedScores.isError && (
        <InlineError error={reviseSubmittedScores.error} onRefresh={onRefresh} />
      )}
    </section>
  );
}

interface ResultData {
  resultCode?: ResultCode;
  evidenceSummary?: string;
  scorecardSummary?: {
    completeCount: number;
    technical?: number;
    behavioral?: number;
    overall?: number;
    knockout: boolean;
    technicalWeight?: number;
    behavioralWeight?: number;
    technicalIssues?: ScorecardIssueSummary[];
    behavioralIssues?: ScorecardIssueSummary[];
    knockoutChecks?: ScorecardKnockoutCheck[];
    assessorRecommendation?: string;
  };
  finalizedAt?: string;
  finalizedBy?: string;
  revision?: number;
}

interface AssessmentSummaryData {
  completeCount: number;
  technical?: number;
  behavioral?: number;
  overall?: number;
  knockout: boolean;
  technicalWeight: number;
  behavioralWeight: number;
  technicalIssues: ScorecardIssueSummary[];
  behavioralIssues: ScorecardIssueSummary[];
  knockoutChecks: ScorecardKnockoutCheck[];
}

function recommendationLabel(summary: AssessmentSummaryData) {
  if (!summary.completeCount || summary.overall === undefined) return 'Complete scoring';
  if (summary.knockout) return 'Not appointable — knockout';
  if (summary.overall >= SCORECARD_READY_NOW_THRESHOLD) return 'Strong — appointable';
  if (summary.overall >= SCORECARD_READY_WITH_DEVELOPMENT_THRESHOLD)
    return 'Appointable with development plan';
  return 'Not appointable at Stage 3';
}

const assessorRecommendationLabels: Record<AssessorRecommendationCode, string> = {
  READY_FOR_PROMOTION: 'Ready for promotion',
  ACTING_FOR_3_MONTHS: 'Acting as for 3 Months',
  FIT_FOR_CURRENT_POSITION: 'Fit for current Position',
  UNFIT_FOR_CURRENT_POSITION: 'Unfit for current position',
  NOT_READY_FOR_PROMOTION: 'Not Ready for promotion',
  DOWNGRADE: 'Downgrade',
  REPLACEMENT: 'Replacement',
};

function defaultAssessorRecommendation(summary: AssessmentSummaryData): string | undefined {
  if (!summary.completeCount || summary.overall === undefined) return undefined;
  if (summary.knockout || summary.overall < SCORECARD_READY_WITH_DEVELOPMENT_THRESHOLD)
    return 'Not appointable';
  if (summary.overall < SCORECARD_READY_NOW_THRESHOLD) return 'Appointable with development';
  return 'Strong';
}

function assessorRecommendationText(value?: string) {
  if (!value) return undefined;
  return Object.hasOwn(assessorRecommendationLabels, value)
    ? assessorRecommendationLabels[value as AssessorRecommendationCode]
    : value;
}

function summaryDate(value?: string | null) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not recorded'
    : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(
        date,
      );
}

const RECOMMENDATION_OPTIONS = [
  { label: 'Strong', band: '4.00 – 5.00' },
  { label: 'Appointable with development', band: '3.00 – 3.99' },
  { label: 'Not appointable', band: 'below 3.00 · or any knockout' },
] as const;

function formatIssuePoints(value: number) {
  return String(Math.round(value * 100) / 100);
}

function summaryResultCode(summary: AssessmentSummaryData): ResultCode {
  if (!summary.completeCount || summary.overall === undefined) return 'INCOMPLETE';
  if (summary.knockout) return 'NOT_READY';
  if (summary.overall >= SCORECARD_READY_NOW_THRESHOLD) return 'READY_NOW';
  if (summary.overall >= SCORECARD_READY_WITH_DEVELOPMENT_THRESHOLD)
    return 'READY_WITH_DEVELOPMENT';
  return 'NOT_READY';
}

function issueTone(pct: number) {
  return pct >= 0.999 ? 'full' : pct >= 0.8 ? 'good' : pct >= 0.6 ? 'mid' : 'low';
}

// ---- Assessment summary: mirrors the approved "Result summary redesign" mockup ----
function AssessmentSummary({
  caseDetail,
  summary,
  assessors,
  finalizedAt,
  finalizedBy,
  recommendationCode,
  editable = false,
  onRecommendationChange,
}: {
  caseDetail: AssessmentCaseDetail;
  summary: AssessmentSummaryData;
  assessors: Array<{ assessorName: string; submitted: boolean; submittedAt: string | null }>;
  finalizedAt?: string;
  finalizedBy?: string;
  recommendationCode?: string;
  editable?: boolean;
  onRecommendationChange?: (value: string) => void;
}) {
  const totalDimensionWeight = summary.technicalWeight + summary.behavioralWeight || 1;
  const submitted = assessors.filter((assessor) => assessor.submitted);
  const submittedNames = submitted.map((assessor) => assessor.assessorName).join(', ');
  const latestSubmission = submitted
    .filter((assessor) => assessor.submittedAt)
    .map((assessor) => assessor.submittedAt!)
    .sort((a, b) => b.localeCompare(a))[0];
  const resultCode = summaryResultCode(summary);
  const contribution = (score: number | undefined, weight: number) =>
    score === undefined ? undefined : (score * weight) / totalDimensionWeight;
  const technicalContribution = contribution(summary.technical, summary.technicalWeight);
  const behavioralContribution = contribution(summary.behavioral, summary.behavioralWeight);
  const pctOf = (value: number | undefined) =>
    `${Math.max(0, Math.min(100, ((value ?? 0) / 5) * 100)).toFixed(1)}%`;
  const recommendationText =
    assessorRecommendationText(recommendationCode) ?? defaultAssessorRecommendation(summary) ?? '';
  const suggested = defaultAssessorRecommendation(summary);
  const isPreset = RECOMMENDATION_OPTIONS.some((option) => option.label === recommendationText);

  const sectionCard = (
    label: string,
    weight: number,
    score: number | undefined,
    contributes: number | undefined,
  ) => (
    <div className="rs-card">
      <span className="rs-kicker">
        {label} · {Math.round((weight / totalDimensionWeight) * 100)}%
      </span>
      <div className="rs-big">
        <span className="rs-num rs-big-value">
          {score === undefined ? '—' : formatCategoryScore(score)}
        </span>
        <span className="rs-num rs-big-max">/ 5</span>
      </div>
      <div className="rs-track">
        <div className={`rs-fill ${issueTone((score ?? 0) / 5)}`} style={{ width: pctOf(score) }} />
      </div>
      <span className="rs-muted">
        Contributes{' '}
        <span className="rs-num rs-strong">
          {contributes === undefined ? '—' : formatCategoryScore(contributes)}
        </span>
      </span>
    </div>
  );

  const issueTable = (
    title: string,
    prefix: string,
    score: number | undefined,
    issues: ScorecardIssueSummary[],
  ) => {
    const issueWeightTotal = issues.reduce((total, issue) => total + issue.weight, 0);
    return (
      <div className="rs-table">
        <div className="rs-table-head">
          <span className="rs-table-title">{title}</span>
          <span className="rs-num rs-strong">
            {score === undefined ? '—' : formatCategoryScore(score)} / 5
          </span>
        </div>
        {issues.length ? (
          <>
            <div className="rs-row rs-row-head">
              <span>ISSUE</span>
              <span className="rs-right">ACT/TGT</span>
              <span />
              <span className="rs-right">SCORE</span>
              <span className="rs-right">WT</span>
            </div>
            {issues.map((issue, index) => {
              const pct = issue.target ? issue.actual / issue.target : 0;
              const tone = issueTone(pct);
              return (
                <div key={issue.code} className="rs-row">
                  <span className="rs-issue">
                    <span className="rs-code rs-num">
                      {prefix}
                      {index + 1}
                    </span>
                    <span className="rs-issue-name" title={issue.name}>
                      {issue.name}
                    </span>
                  </span>
                  <span className="rs-num rs-right">
                    {formatIssuePoints(issue.actual)} / {formatIssuePoints(issue.target)}
                  </span>
                  <span className="rs-track">
                    <span
                      className={`rs-fill ${tone}`}
                      style={{ width: `${Math.min(100, pct * 100).toFixed(1)}%` }}
                    />
                  </span>
                  <span className={`rs-num rs-right rs-score ${tone === 'full' ? '' : 'short'}`}>
                    {formatCategoryScore(issue.score)}
                  </span>
                  <span className="rs-num rs-right rs-muted">
                    {issueWeightTotal ? Math.round((issue.weight / issueWeightTotal) * 100) : 0}%
                  </span>
                </div>
              );
            })}
          </>
        ) : (
          <p className="rs-muted rs-pad">Issue scores appear after a scorecard is submitted.</p>
        )}
      </div>
    );
  };

  return (
    <section className="rs">
      <div className="rs-strip">
        <div className="rs-meta">
          <span className="rs-kicker">CANDIDATE</span>
          <strong>{caseDetail.employeeName}</strong>
        </div>
        <div className="rs-meta">
          <span className="rs-kicker">ROLE · DEPARTMENT</span>
          <strong>
            {caseDetail.targetRole} · {caseDetail.department}
          </strong>
        </div>
        <div className="rs-meta">
          <span className="rs-kicker">ASSESSOR(S)</span>
          <strong>
            {submittedNames || 'Pending score submission'}
            {assessors.length > 0 && (
              <span className="rs-muted rs-normal">
                {' '}
                · {submitted.length} of {assessors.length} submitted
              </span>
            )}
          </strong>
        </div>
        <div className="rs-meta">
          <span className="rs-kicker">ASSESSMENT DATE</span>
          <strong>{summaryDate(latestSubmission ?? caseDetail.requestedAt)}</strong>
        </div>
        <div className="rs-meta">
          <span className="rs-kicker">PANEL DECISION</span>
          <strong className={finalizedAt ? '' : 'rs-warn'}>{summaryDate(finalizedAt)}</strong>
        </div>
      </div>

      <div className="rs-hero">
        <div className="rs-overall">
          <span className="rs-kicker rs-on-dark">OVERALL WEIGHTED SCORE</span>
          <div className="rs-big">
            <span className="rs-num rs-overall-value">
              {summary.overall === undefined ? '—' : formatCategoryScore(summary.overall)}
            </span>
            <span className="rs-num rs-overall-max">/ 5</span>
            <span className={`rs-pill ${resultCode.toLowerCase()}`}>
              {resultCodeLabel(resultCode)}
            </span>
          </div>
          <div className="rs-scale">
            <div className="rs-scale-fill" style={{ width: pctOf(summary.overall) }} />
            <span className="rs-scale-mark" style={{ left: '60%' }} />
            <span className="rs-scale-mark" style={{ left: '80%' }} />
          </div>
          <div className="rs-scale-labels rs-num">
            <span style={{ left: 0 }}>0</span>
            <span style={{ left: '60%', transform: 'translateX(-50%)' }}>3 · with development</span>
            <span style={{ left: '80%', transform: 'translateX(-10%)' }}>4 · ready now</span>
          </div>
          {technicalContribution !== undefined && behavioralContribution !== undefined && (
            <span className="rs-num rs-equation">
              {formatCategoryScore(technicalContribution)} technical +{' '}
              {formatCategoryScore(behavioralContribution)} behavioral ={' '}
              {formatCategoryScore(technicalContribution + behavioralContribution)}
            </span>
          )}
        </div>
        {sectionCard(
          'TECHNICAL',
          summary.technicalWeight,
          summary.technical,
          technicalContribution,
        )}
        {sectionCard(
          'BEHAVIORAL',
          summary.behavioralWeight,
          summary.behavioral,
          behavioralContribution,
        )}
        <div className="rs-card">
          <span className="rs-kicker">KNOCKOUT</span>
          {summary.knockout ? (
            <>
              <span className="rs-ko triggered">Triggered</span>
              {summary.knockoutChecks
                .filter((check) => check.triggered)
                .map((check) => (
                  <span key={`${check.issueName}-${check.code}`} className="rs-muted">
                    {check.issueName} · {check.name} — flagged by {check.actual ?? 0}
                  </span>
                ))}
            </>
          ) : (
            <>
              <span className="rs-ko clear">Clear</span>
              <span className="rs-muted">No knockout flagged by any assessor.</span>
            </>
          )}
        </div>
      </div>

      <div className="rs-tables">
        {issueTable('Technical issues', 'T', summary.technical, summary.technicalIssues)}
        {issueTable('Behavioral issues', 'B', summary.behavioral, summary.behavioralIssues)}
      </div>

      <div className="rs-panel">
        <div className="rs-panel-head">
          <span className="rs-panel-title">Recommendation</span>
          <span className="rs-muted">
            Pre-selected from the score. A knockout always forces Not appointable.
          </span>
        </div>
        {editable && onRecommendationChange ? (
          <>
            <div className="rs-recos">
              {RECOMMENDATION_OPTIONS.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  className="rs-reco"
                  aria-pressed={recommendationText === option.label}
                  onClick={() => onRecommendationChange(option.label)}
                >
                  <span className="rs-reco-top">
                    <span className="rs-reco-label">{option.label}</span>
                    {suggested === option.label && <span className="rs-tag">From score</span>}
                  </span>
                  <span className="rs-num rs-muted">{option.band}</span>
                </button>
              ))}
            </div>
            <label className="rs-field">
              Recommendation wording (optional)
              <input
                type="text"
                value={isPreset ? '' : recommendationText}
                placeholder="e.g. Strong – ready for the target role now"
                onChange={(event) => onRecommendationChange(event.target.value || suggested || '')}
              />
            </label>
          </>
        ) : (
          <strong className="rs-reco-readonly">
            {assessorRecommendationText(recommendationCode) ?? recommendationLabel(summary)}
          </strong>
        )}
        <div className="rs-people">
          <div className="rs-meta">
            <span className="rs-kicker">LEAD ASSESSOR</span>
            <strong>{submittedNames || 'Pending'}</strong>
          </div>
          <div className="rs-meta">
            <span className="rs-kicker">PANEL CHAIR · FINALIZED BY</span>
            <strong className={finalizedBy ? '' : 'rs-warn'}>
              {finalizedBy ?? 'Pending panel decision'}
            </strong>
          </div>
        </div>
      </div>
    </section>
  );
}

function ResultPanel({
  caseDetail,
  onToast,
  onRefresh,
}: {
  caseDetail: AssessmentCaseDetail;
  onToast: (msg: string) => void;
  onRefresh: () => void;
}) {
  const queryClient = useQueryClient();
  const isFinalized = caseDetail.status === 'RESULT_FINALIZED';
  const isInProgress = caseDetail.status === 'IN_PROGRESS';
  const isPendingResult = caseDetail.status === 'PENDING_RESULT';
  const isVisible = isInProgress || isPendingResult || isFinalized;

  const { data: result } = useQuery({
    queryKey: ['result', caseDetail.id],
    queryFn: () => api.getResult<ResultData>(caseDetail.id),
    enabled: isFinalized,
    retry: false,
  });
  const { data: scorecard } = useQuery({
    queryKey: ['scorecard', caseDetail.id],
    queryFn: () => api.scorecard<ScorecardResponse>(caseDetail.id),
    enabled: isVisible,
    retry: false,
  });
  const summaryData: AssessmentSummaryData | undefined =
    scorecard?.aggregate ??
    (result?.scorecardSummary
      ? {
          completeCount: result.scorecardSummary.completeCount,
          technical: result.scorecardSummary.technical,
          behavioral: result.scorecardSummary.behavioral,
          overall: result.scorecardSummary.overall,
          knockout: result.scorecardSummary.knockout,
          technicalWeight:
            result.scorecardSummary.technicalWeight ?? scorecard?.config.technicalWeight ?? 50,
          behavioralWeight:
            result.scorecardSummary.behavioralWeight ?? scorecard?.config.behavioralWeight ?? 50,
          technicalIssues: result.scorecardSummary.technicalIssues ?? [],
          behavioralIssues: result.scorecardSummary.behavioralIssues ?? [],
          knockoutChecks: result.scorecardSummary.knockoutChecks ?? [],
        }
      : undefined);
  const automaticResultCode = scorecard?.aggregate.completeCount
    ? scorecard.aggregate.resultCode
    : 'INCOMPLETE';

  const [evidenceSummary, setEvidenceSummary] = useState('');
  const [assessorRecommendation, setAssessorRecommendation] = useState<string | undefined>();
  const [reopenReason, setReopenReason] = useState('');
  const [showReopen, setShowReopen] = useState(false);

  const finalizeAction = getAvailableAction(caseDetail, 'FINALIZE_RESULT');
  const reopenAction = getAvailableAction(caseDetail, 'REOPEN_RESULT');
  const canEditAssessorRecommendation = ['ASSESSOR', 'HR_ADMIN', 'SYS_ADMIN'].includes(
    getActiveUser().role,
  );
  const canReopenFinalResult = getActiveUser().role === 'SYS_ADMIN';

  const finalizeResult = useMutation({
    mutationFn: (input: FinalizeResultInput) => api.finalizeResult(caseDetail.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseDetail.id] });
      queryClient.invalidateQueries({ queryKey: ['result', caseDetail.id] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      onToast('Assessment result finalized.');
    },
  });

  const reopenResult = useMutation({
    mutationFn: (input: ReopenResultInput) => api.reopenResult(caseDetail.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseDetail.id] });
      queryClient.invalidateQueries({ queryKey: ['result', caseDetail.id] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      setShowReopen(false);
      setReopenReason('');
      onToast('Assessment result reopened for review.');
    },
  });

  const updateRecommendation = useMutation({
    mutationFn: ({ code, reason }: { code: string; reason: string }) =>
      api.updateAssessorRecommendation(caseDetail.id, {
        code,
        reason,
        expectedVersion: caseDetail.version,
      }),
    onSuccess: ({ code }) => {
      setAssessorRecommendation(code);
      queryClient.invalidateQueries({ queryKey: ['case', caseDetail.id] });
      queryClient.invalidateQueries({ queryKey: ['result', caseDetail.id] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      onToast('Assessor recommendation updated and recorded in audit history.');
    },
  });

  if (!isVisible) return null;

  if (isFinalized) {
    return (
      <section className="panel result-panel">
        <PanelHeader
          icon={<FileCheck2 size={17} />}
          title="Final assessment result"
          action={<StatusBadge status={caseDetail.status} />}
        />
        {summaryData && (
          <AssessmentSummary
            caseDetail={caseDetail}
            summary={summaryData}
            assessors={scorecard?.submissions ?? []}
            finalizedAt={result?.finalizedAt}
            finalizedBy={result?.finalizedBy}
            recommendationCode={
              assessorRecommendation ??
              result?.scorecardSummary?.assessorRecommendation ??
              defaultAssessorRecommendation(summaryData)
            }
            editable={canEditAssessorRecommendation}
            onRecommendationChange={
              canEditAssessorRecommendation ? setAssessorRecommendation : undefined
            }
          />
        )}
        {canEditAssessorRecommendation && summaryData && (
          <div className="action-row" style={{ marginTop: '12px' }}>
            <button
              className="secondary-button"
              disabled={
                updateRecommendation.isPending ||
                !assessorRecommendation ||
                assessorRecommendation ===
                  (result?.scorecardSummary?.assessorRecommendation ??
                    defaultAssessorRecommendation(summaryData))
              }
              onClick={() => {
                const reason = window.prompt(
                  'Why are you changing the assessor recommendation? This will be saved in the audit history.',
                );
                if (reason?.trim().length && reason.trim().length >= 3 && assessorRecommendation) {
                  updateRecommendation.mutate({
                    code: assessorRecommendation,
                    reason: reason.trim(),
                  });
                }
              }}
            >
              {updateRecommendation.isPending ? 'Saving…' : 'Save recommendation change'}
            </button>
            {updateRecommendation.isError && (
              <InlineError error={updateRecommendation.error} onRefresh={onRefresh} />
            )}
          </div>
        )}
        <div className="summary-grid" style={{ marginTop: '14px' }}>
          <div className="info-item">
            <span>Official result</span>
            <strong>{resultCodeLabel(result?.resultCode ?? 'INCOMPLETE')}</strong>
          </div>
          <div className="info-item">
            <span>Finalized by</span>
            <strong>{result?.finalizedBy ?? 'Panel Lead'}</strong>
          </div>
        </div>
        {result?.evidenceSummary && (
          <div className="justification" style={{ marginTop: '14px' }}>
            <span>Evidence summary</span>
            <p>{result.evidenceSummary}</p>
          </div>
        )}
        {canReopenFinalResult && (
          <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #f1f5f9' }}>
            {showReopen ? (
              <div className="reason-field">
                <label htmlFor="reopen-reason">
                  Reopen reason <b>*</b> (min 10 chars)
                </label>
                <textarea
                  id="reopen-reason"
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="Explain why this finalized result is being reopened for review…"
                  rows={3}
                  disabled={reopenResult.isPending}
                />
                <small
                  style={{
                    color: reopenReason.trim().length < 10 ? 'var(--muted)' : 'var(--success)',
                    fontSize: '10px',
                    display: 'block',
                    marginTop: '4px',
                  }}
                >
                  {reopenReason.trim().length} / 10 characters minimum
                </small>
                <div className="action-row" style={{ marginTop: '10px' }}>
                  <button
                    className="secondary-button"
                    onClick={() => setShowReopen(false)}
                    disabled={reopenResult.isPending}
                  >
                    Cancel
                  </button>
                  <button
                    className="danger-button"
                    disabled={
                      reopenResult.isPending ||
                      reopenReason.trim().length < 10 ||
                      (reopenAction ? !reopenAction.enabled : false)
                    }
                    onClick={() =>
                      reopenResult.mutate({
                        reason: reopenReason.trim(),
                        expectedVersion: caseDetail.version,
                      })
                    }
                  >
                    {reopenResult.isPending ? (
                      <LoaderCircle className="spin" size={16} />
                    ) : (
                      <RotateCcw size={16} />
                    )}
                    Confirm reopen
                  </button>
                </div>
              </div>
            ) : (
              <div className="action-row">
                <button
                  className="secondary-button"
                  disabled={reopenAction ? !reopenAction.enabled : false}
                  onClick={() => setShowReopen(true)}
                >
                  <RotateCcw size={16} />
                  {reopenAction?.label ?? 'Reopen result'}
                </button>
              </div>
            )}
            {reopenResult.isError && (
              <InlineError error={reopenResult.error} onRefresh={onRefresh} />
            )}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="panel result-panel">
      <PanelHeader
        icon={<FileCheck2 size={17} />}
        title="Finalize assessment result"
        action={<StatusBadge status={caseDetail.status} />}
      />
      <p className="panel-intro">
        Synthesize evidence across sessions and record the official evaluation outcome.
      </p>
      {isPendingResult && (
        <AssessorScorecard caseId={caseDetail.id} onToast={onToast} onRefresh={onRefresh} />
      )}
      {summaryData && (
        <AssessmentSummary
          caseDetail={caseDetail}
          summary={summaryData}
          assessors={scorecard?.submissions ?? []}
          recommendationCode={
            assessorRecommendation ??
            (summaryData ? defaultAssessorRecommendation(summaryData) : undefined)
          }
          editable={canEditAssessorRecommendation}
          onRecommendationChange={
            canEditAssessorRecommendation ? setAssessorRecommendation : undefined
          }
        />
      )}
      <div className="rs-panel rs-evidence">
        <label className="rs-field">
          <span className="rs-field-head">
            <span>Evidence summary</span>
            <span className="rs-num rs-muted rs-normal">{evidenceSummary.length} / 4000</span>
          </span>
          <textarea
            value={evidenceSummary}
            maxLength={4000}
            onChange={(e) => setEvidenceSummary(e.target.value)}
            placeholder="Consolidated observations and overall performance rationale…"
            rows={5}
            disabled={finalizeResult.isPending}
          />
        </label>
      </div>
      <div className="rs-footer">
        <div className="rs-checks">
          {[
            {
              ok: Boolean(scorecard?.aggregate.completeCount),
              label: scorecard?.aggregate.completeCount
                ? 'Scorecard submitted'
                : 'Waiting for a submitted scorecard',
            },
            {
              ok: Boolean(
                assessorRecommendation ??
                (summaryData ? defaultAssessorRecommendation(summaryData) : undefined),
              ),
              label: 'Recommendation selected',
            },
            {
              ok: evidenceSummary.trim().length > 0,
              label: evidenceSummary.trim()
                ? 'Evidence summary added'
                : 'Evidence summary (recommended)',
            },
          ].map((check) => (
            <span key={check.label} className={`rs-check ${check.ok ? 'ok' : 'todo'}`}>
              {check.ok ? <Check size={16} /> : <CircleDashed size={16} />}
              {check.label}
            </span>
          ))}
        </div>
        <button
          className="primary-button"
          disabled={
            finalizeResult.isPending ||
            !scorecard?.aggregate.completeCount ||
            (finalizeAction ? !finalizeAction.enabled : false)
          }
          onClick={() =>
            finalizeResult.mutate({
              resultCode: automaticResultCode,
              assessorRecommendation:
                assessorRecommendation ??
                (summaryData ? defaultAssessorRecommendation(summaryData) : undefined),
              evidenceSummary: evidenceSummary.trim() || undefined,
              expectedVersion: caseDetail.version,
            })
          }
        >
          {finalizeResult.isPending ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <CheckCircle2 size={16} />
          )}
          {finalizeAction?.label ?? 'Finalize result'}
        </button>
      </div>
      {finalizeResult.isError && <InlineError error={finalizeResult.error} onRefresh={onRefresh} />}
    </section>
  );
}

interface ApprovalStepItem {
  id: string;
  sequence: number;
  role: string;
  approverName?: string | null;
  decision: 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED';
  comment?: string | null;
  decidedAt?: string | null;
}

function DecisionPanel({
  caseDetail,
  onToast,
  onRefresh,
}: {
  caseDetail: AssessmentCaseDetail;
  onToast: (msg: string) => void;
  onRefresh: () => void;
}) {
  const queryClient = useQueryClient();
  const isVisible =
    caseDetail.status === 'RESULT_FINALIZED' ||
    caseDetail.status === 'PENDING_RECOMMENDATION' ||
    caseDetail.status === 'PENDING_APPROVAL';

  const showRecommendationForm =
    caseDetail.status === 'RESULT_FINALIZED' || caseDetail.status === 'PENDING_RECOMMENDATION';

  const [code, setCode] = useState('READY_FOR_PROMOTION');
  const [rationale, setRationale] = useState('');
  const [requiresDevelopment, setRequiresDevelopment] = useState(false);
  const [requiresManagerActionPlan, setRequiresManagerActionPlan] = useState(false);
  const [requiresReassessment, setRequiresReassessment] = useState(false);
  const [decisionComments, setDecisionComments] = useState<Record<string, string>>({});

  const {
    data: steps,
    isLoading: approvalStepsLoading,
    isError: approvalStepsError,
    error: approvalStepsErrorValue,
    refetch: refetchApprovalSteps,
  } = useQuery({
    queryKey: ['approval-steps', caseDetail.id],
    queryFn: () => api.listApprovalSteps<ApprovalStepItem>(caseDetail.id),
    enabled: isVisible,
  });

  const recAction = getAvailableAction(caseDetail, 'SUBMIT_RECOMMENDATION');
  const approvalAction = getAvailableAction(caseDetail, 'DECIDE_APPROVAL');
  const activeApprovalStepId = steps?.find((step) => step.decision === 'PENDING')?.id;

  const submitRec = useMutation({
    mutationFn: (input: SubmitRecommendationInput) =>
      api.submitRecommendation(caseDetail.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseDetail.id] });
      queryClient.invalidateQueries({ queryKey: ['approval-steps', caseDetail.id] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      onToast('Recommendation submitted for approval.');
    },
  });

  const decideStep = useMutation({
    mutationFn: ({ stepId, input }: { stepId: string; input: DecideApprovalInput }) =>
      api.decideApprovalStep(stepId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseDetail.id] });
      queryClient.invalidateQueries({ queryKey: ['approval-steps', caseDetail.id] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      onToast('Approval decision recorded.');
    },
  });

  if (!isVisible) return null;

  return (
    <section className="panel decision-panel">
      <PanelHeader
        icon={<ShieldCheck size={17} />}
        title="Decision & approvals"
        action={<StatusBadge status={caseDetail.status} />}
      />
      {showRecommendationForm && (
        <div>
          <p className="panel-intro">
            Submit an official business recommendation based on the finalized evaluation result.
          </p>
          <div className="form-grid">
            <label className="field">
              <span>
                Recommendation code <b>*</b>
              </span>
              <select
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={submitRec.isPending}
              >
                <option value="READY_FOR_PROMOTION">Ready for promotion</option>
                <option value="ACTING_FOR_3_MONTHS">Acting as for 3 Months</option>
                <option value="FIT_FOR_CURRENT_POSITION">Fit for current Position</option>
                <option value="UNFIT_FOR_CURRENT_POSITION">Unfit for current position</option>
                <option value="NOT_READY_FOR_PROMOTION">Not Ready for promotion</option>
                <option value="DOWNGRADE">Downgrade</option>
                <option value="REPLACEMENT">Replacement</option>
              </select>
            </label>
          </div>
          <label className="field" style={{ marginTop: '14px' }}>
            <span>
              Rationale <b>*</b> (min 20 chars)
            </span>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Detail the business justification and competencies demonstrated (minimum 20 characters)…"
              rows={4}
              disabled={submitRec.isPending}
            />
            <small
              style={{
                color: rationale.trim().length < 20 ? 'var(--muted)' : 'var(--success)',
                fontSize: '10px',
                display: 'block',
                marginTop: '4px',
              }}
            >
              {rationale.trim().length} / 20 characters minimum
            </small>
          </label>
          <div style={{ display: 'flex', gap: '20px', marginTop: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <input
                type="checkbox"
                checked={requiresDevelopment}
                onChange={(e) => setRequiresDevelopment(e.target.checked)}
                disabled={submitRec.isPending}
              />
              <span>Requires development plan</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <input
                type="checkbox"
                checked={requiresManagerActionPlan}
                onChange={(e) => setRequiresManagerActionPlan(e.target.checked)}
                disabled={submitRec.isPending}
              />
              <span>Requires Action plan (Manager)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <input
                type="checkbox"
                checked={requiresReassessment}
                onChange={(e) => setRequiresReassessment(e.target.checked)}
                disabled={submitRec.isPending}
              />
              <span>Requires Reassessment (3 Months)</span>
            </label>
          </div>
          <div className="action-row" style={{ marginTop: '16px' }}>
            <button
              className="primary-button"
              disabled={
                submitRec.isPending ||
                !code ||
                rationale.trim().length < 20 ||
                (recAction ? !recAction.enabled : false)
              }
              onClick={() =>
                submitRec.mutate({
                  code,
                  rationale: rationale.trim(),
                  requiresDevelopment,
                  requiresManagerActionPlan,
                  requiresReassessment,
                  expectedVersion: caseDetail.version,
                })
              }
            >
              {submitRec.isPending ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Send size={16} />
              )}
              {recAction?.label ?? 'Submit recommendation'}
            </button>
          </div>
          {submitRec.isError && <InlineError error={submitRec.error} onRefresh={onRefresh} />}
        </div>
      )}

      {approvalStepsLoading && (
        <p className="panel-intro" style={{ marginTop: '14px' }}>
          Loading approval steps…
        </p>
      )}
      {approvalStepsError && (
        <InlineError
          error={approvalStepsErrorValue}
          onRefresh={() => void refetchApprovalSteps()}
        />
      )}
      {!approvalStepsLoading && !approvalStepsError && steps?.length === 0 && (
        <div className="empty-state" style={{ marginTop: '14px', padding: '20px' }}>
          No approval steps are configured for this case yet. Refresh the case or ask an
          administrator to restore the approval route.
        </div>
      )}

      {steps && steps.length > 0 && (
        <div style={{ marginTop: showRecommendationForm ? '24px' : '0' }}>
          <span className="form-section-title" style={{ display: 'block', marginBottom: '12px' }}>
            Sequential approval steps ({steps.length})
          </span>
          <div style={{ display: 'grid', gap: '14px' }}>
            {steps.map((step) => {
              const isPending = step.decision === 'PENDING';
              const isCurrentApprover =
                isPending &&
                step.id === activeApprovalStepId &&
                caseDetail.status === 'PENDING_APPROVAL';
              const comment = decisionComments[step.id] ?? '';
              const isMutating = decideStep.isPending && decideStep.variables?.stepId === step.id;

              return (
                <div
                  key={step.id}
                  style={{
                    padding: '14px',
                    border: '1px solid var(--border)',
                    borderRadius: '11px',
                    background: isCurrentApprover ? 'var(--brand-soft)' : '#fff',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '8px',
                    }}
                  >
                    <div>
                      <strong>
                        Step {step.sequence}:{' '}
                        {step.role.charAt(0) + step.role.slice(1).toLowerCase()} Approver
                      </strong>
                      {step.approverName && (
                        <span style={{ display: 'block', fontSize: '11px', color: 'var(--muted)' }}>
                          Decided by {step.approverName}
                        </span>
                      )}
                    </div>
                    <StatusBadge status={step.decision} />
                  </div>
                  {step.comment && (
                    <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--secondary)' }}>
                      Note: {step.comment}
                    </p>
                  )}
                  {isCurrentApprover && (
                    <div style={{ marginTop: '12px' }}>
                      <label className="field">
                        <span>Decision comment (required for changes or rejection)</span>
                        <input
                          value={comment}
                          onChange={(e) =>
                            setDecisionComments((prev) => ({ ...prev, [step.id]: e.target.value }))
                          }
                          placeholder="Provide context for approval, changes, or rejection…"
                          disabled={isMutating}
                        />
                      </label>
                      <div className="action-row" style={{ marginTop: '10px' }}>
                        <button
                          className="danger-button"
                          disabled={
                            isMutating ||
                            !comment.trim() ||
                            (approvalAction ? !approvalAction.enabled : false)
                          }
                          onClick={() =>
                            decideStep.mutate({
                              stepId: step.id,
                              input: {
                                decision: 'REJECTED',
                                comment: comment.trim(),
                                expectedVersion: caseDetail.version,
                              },
                            })
                          }
                        >
                          <XCircle size={16} />
                          Reject
                        </button>
                        <button
                          className="secondary-button"
                          disabled={
                            isMutating ||
                            !comment.trim() ||
                            (approvalAction ? !approvalAction.enabled : false)
                          }
                          onClick={() =>
                            decideStep.mutate({
                              stepId: step.id,
                              input: {
                                decision: 'CHANGES_REQUESTED',
                                comment: comment.trim(),
                                expectedVersion: caseDetail.version,
                              },
                            })
                          }
                        >
                          Request changes
                        </button>
                        <button
                          className="primary-button"
                          disabled={
                            isMutating || (approvalAction ? !approvalAction.enabled : false)
                          }
                          onClick={() =>
                            decideStep.mutate({
                              stepId: step.id,
                              input: {
                                decision: 'APPROVED',
                                comment: comment.trim() || undefined,
                                expectedVersion: caseDetail.version,
                              },
                            })
                          }
                        >
                          {isMutating ? (
                            <LoaderCircle className="spin" size={16} />
                          ) : (
                            <CheckCircle2 size={16} />
                          )}
                          Approve
                        </button>
                      </div>
                    </div>
                  )}
                  {isPending && !isCurrentApprover && caseDetail.status === 'PENDING_APPROVAL' && (
                    <p style={{ margin: '10px 0 0', color: 'var(--muted)', fontSize: '11px' }}>
                      Waiting for the previous approval step.
                    </p>
                  )}
                  {decideStep.isError && decideStep.variables?.stepId === step.id && (
                    <InlineError error={decideStep.error} onRefresh={onRefresh} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

interface DevelopmentData {
  id?: string;
  ownerName?: string;
  actionPlan?: string | null;
  learningManagementSystem?: string | null;
  targetDate?: string;
  status?: string;
  actions?: Array<{
    id?: string;
    title: string;
    ownerName: string;
    status?: string;
    dueDate?: string;
  }>;
}

function DevelopmentPanel({
  caseDetail,
  onToast,
  onRefresh,
}: {
  caseDetail: AssessmentCaseDetail;
  onToast: (msg: string) => void;
  onRefresh: () => void;
}) {
  const queryClient = useQueryClient();
  const isVisible =
    caseDetail.status === 'APPROVED' ||
    caseDetail.status === 'DEVELOPMENT_IN_PROGRESS' ||
    caseDetail.status === 'REASSESSMENT_DUE' ||
    caseDetail.status === 'CLOSED';

  const { data: development } = useQuery({
    queryKey: ['development', caseDetail.id],
    queryFn: () => api.getDevelopment<DevelopmentData>(caseDetail.id),
    enabled: isVisible,
    retry: false,
  });

  const [title, setTitle] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [actionPlanText, setActionPlanText] = useState('');
  const [lmsText, setLmsText] = useState('');
  const [hiringOutcome, setHiringOutcome] = useState<'PENDING' | 'JOINED' | 'NOT_JOINED'>(
    caseDetail.hiringOutcome ?? 'PENDING',
  );
  const [hiringOutcomeReason, setHiringOutcomeReason] = useState<string>(
    caseDetail.hiringOutcomeReason ?? '',
  );
  const notesLoaded = useRef(false);
  const [reassessReason, setReassessReason] = useState('');
  const [showReassess, setShowReassess] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const updateAction = getAvailableAction(caseDetail, 'UPDATE_DEVELOPMENT');
  const reassessAction = getAvailableAction(caseDetail, 'SCHEDULE_REASSESSMENT');
  const closeAction = getAvailableAction(caseDetail, 'CLOSE_CASE');
  const canUpdateDevelopment = Boolean(updateAction?.enabled);

  useEffect(() => {
    if (development && !notesLoaded.current) {
      setActionPlanText(development.actionPlan ?? '');
      setLmsText(development.learningManagementSystem ?? '');
      notesLoaded.current = true;
    }
  }, [development]);

  const updateDev = useMutation({
    mutationFn: (input: UpdateDevelopmentInput) => api.updateDevelopment(caseDetail.id, input),
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ['case', caseDetail.id] });
      queryClient.invalidateQueries({ queryKey: ['development', caseDetail.id] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      if (input.actions) {
        setTitle('');
        setOwnerName('');
      }
      onToast(
        input.hiringOutcome ? 'Candidate hiring outcome saved.' : 'Development plan updated.',
      );
    },
  });

  const scheduleReassessment = useMutation({
    mutationFn: (input: ScheduleReassessmentInput) =>
      api.scheduleReassessment(caseDetail.id, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['case', caseDetail.id] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      setReassessReason('');
      setShowReassess(false);
      onToast(`Reassessment scheduled: case ${data.caseCode ?? ''}`);
    },
  });

  const closeCase = useMutation({
    mutationFn: (input: CloseCaseInput) => api.closeCase(caseDetail.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseDetail.id] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      setShowCloseConfirm(false);
      onToast('Case has been closed.');
    },
  });

  if (!isVisible) return null;

  return (
    <section className="panel development-panel">
      <PanelHeader
        icon={<Sparkles size={17} />}
        title="Development & follow-up"
        action={<StatusBadge status={caseDetail.status} />}
      />
      <p className="panel-intro">
        Track developmental actions, schedule reassessments, or close the case once follow-up is
        owned.
      </p>

      <div className="form-section">
        <span className="form-section-title">Follow-up plans</span>
        <div className="form-grid">
          <label className="field">
            <span>Action plan</span>
            <textarea
              value={actionPlanText}
              onChange={(event) => setActionPlanText(event.target.value)}
              placeholder="Write the agreed action plan…"
              rows={4}
              disabled={!canUpdateDevelopment || updateDev.isPending}
            />
          </label>
          <label className="field">
            <span>Learning management system (LMS)</span>
            <textarea
              value={lmsText}
              onChange={(event) => setLmsText(event.target.value)}
              placeholder="Write the LMS courses or learning activities…"
              rows={4}
              disabled={!canUpdateDevelopment || updateDev.isPending}
            />
          </label>
        </div>
        <div className="action-row" style={{ marginTop: '10px' }}>
          <button
            className="secondary-button"
            disabled={!canUpdateDevelopment || updateDev.isPending}
            onClick={() =>
              updateDev.mutate({
                actionPlan: actionPlanText,
                learningManagementSystem: lmsText,
                expectedVersion: caseDetail.version,
              })
            }
          >
            {updateDev.isPending ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <Check size={16} />
            )}
            Save follow-up plans
          </button>
        </div>
        {updateDev.isError && <InlineError error={updateDev.error} onRefresh={onRefresh} />}
      </div>

      {caseDetail.candidateType === 'NEW_CANDIDATE' && (
        <div className="form-section candidate-outcome-panel">
          <span className="form-section-title">Candidate hiring outcome</span>
          <p className="panel-intro">
            Record whether this assessed candidate joined. This keeps the assessment result separate
            from the hiring decision.
          </p>
          <div className="form-grid">
            <label className="field">
              <span>Hiring outcome</span>
              <select
                value={hiringOutcome}
                onChange={(event) => setHiringOutcome(event.target.value as typeof hiringOutcome)}
                disabled={!canUpdateDevelopment || updateDev.isPending}
              >
                <option value="PENDING">Pending decision</option>
                <option value="JOINED">Joined the organization</option>
                <option value="NOT_JOINED">Did not join</option>
              </select>
            </label>
            {hiringOutcome === 'NOT_JOINED' && (
              <label className="field">
                <span>
                  Reason for not joining <b>*</b>
                </span>
                <select
                  value={hiringOutcomeReason}
                  onChange={(event) => setHiringOutcomeReason(event.target.value)}
                  disabled={!canUpdateDevelopment || updateDev.isPending}
                >
                  <option value="">Choose a reason</option>
                  <option value="ASSESSMENT">Assessment result</option>
                  <option value="OFFER_DECLINED">Candidate declined the offer</option>
                  <option value="ROLE_CANCELLED">Role was cancelled</option>
                  <option value="OTHER">Other reason</option>
                </select>
              </label>
            )}
          </div>
          <div className="action-row" style={{ marginTop: '10px' }}>
            <button
              className="secondary-button"
              disabled={
                !canUpdateDevelopment ||
                updateDev.isPending ||
                (hiringOutcome === 'NOT_JOINED' && !hiringOutcomeReason)
              }
              onClick={() =>
                updateDev.mutate({
                  hiringOutcome,
                  hiringOutcomeReason:
                    hiringOutcome === 'NOT_JOINED'
                      ? (hiringOutcomeReason as
                          'ASSESSMENT' | 'OFFER_DECLINED' | 'ROLE_CANCELLED' | 'OTHER')
                      : null,
                  expectedVersion: caseDetail.version,
                })
              }
            >
              {updateDev.isPending ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Check size={16} />
              )}
              Save hiring outcome
            </button>
          </div>
        </div>
      )}

      {development?.actions && development.actions.length > 0 && (
        <div style={{ marginBottom: '18px' }}>
          <span className="form-section-title" style={{ display: 'block', marginBottom: '8px' }}>
            Current action items ({development.actions.length})
          </span>
          <div className="criteria-table">
            {development.actions.map((act, idx) => (
              <div className="criterion-row" key={act.id ?? idx}>
                <div>
                  <strong>{act.title}</strong>
                  <span>Owner: {act.ownerName}</span>
                </div>
                <span className="soft-chip">{act.status ?? 'NOT_STARTED'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {canUpdateDevelopment && (
        <div className="form-section">
          <span className="form-section-title">Add development action</span>
          <div className="form-grid">
            <label className="field">
              <span>
                Action title <b>*</b> (min 3 chars)
              </span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Cross-functional leadership project"
                disabled={updateDev.isPending}
              />
            </label>
            <label className="field">
              <span>
                Action owner <b>*</b> (min 2 chars)
              </span>
              <input
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="e.g. Direct Manager"
                disabled={updateDev.isPending}
              />
            </label>
          </div>
          <div className="action-row" style={{ marginTop: '10px' }}>
            <button
              className="primary-button"
              disabled={
                updateDev.isPending || title.trim().length < 3 || ownerName.trim().length < 2
              }
              onClick={() => {
                const currentActions =
                  development?.actions?.map((a) => ({
                    title: a.title,
                    ownerName: a.ownerName,
                    status:
                      (a.status as 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED') ?? 'NOT_STARTED',
                  })) ?? [];
                updateDev.mutate({
                  actions: [
                    ...currentActions,
                    {
                      title: title.trim(),
                      ownerName: ownerName.trim(),
                      status: 'NOT_STARTED',
                    },
                  ],
                  expectedVersion: caseDetail.version,
                });
              }}
            >
              {updateDev.isPending ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Plus size={16} />
              )}
              {updateAction?.label ?? 'Update development'}
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid #f1f5f9' }}>
        <span className="form-section-title" style={{ display: 'block', marginBottom: '10px' }}>
          Lifecycle management
        </span>
        {showReassess ? (
          <div className="reason-field">
            <label htmlFor="reassess-reason">
              Reassessment reason <b>*</b> (min 10 chars)
            </label>
            <textarea
              id="reassess-reason"
              value={reassessReason}
              onChange={(e) => setReassessReason(e.target.value)}
              placeholder="Specify the reason for reassessment (minimum 10 characters)…"
              rows={3}
              disabled={scheduleReassessment.isPending}
            />
            <small
              style={{
                color: reassessReason.trim().length < 10 ? 'var(--muted)' : 'var(--success)',
                fontSize: '10px',
                display: 'block',
                marginTop: '4px',
              }}
            >
              {reassessReason.trim().length} / 10 characters minimum
            </small>
            <div className="action-row" style={{ marginTop: '10px' }}>
              <button
                className="secondary-button"
                onClick={() => setShowReassess(false)}
                disabled={scheduleReassessment.isPending}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                disabled={
                  scheduleReassessment.isPending ||
                  reassessReason.trim().length < 10 ||
                  (reassessAction ? !reassessAction.enabled : false)
                }
                onClick={() =>
                  scheduleReassessment.mutate({
                    reason: reassessReason.trim(),
                    expectedVersion: caseDetail.version,
                  })
                }
              >
                {scheduleReassessment.isPending ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <RotateCcw size={16} />
                )}
                Confirm reassessment
              </button>
            </div>
            {scheduleReassessment.isError && (
              <InlineError error={scheduleReassessment.error} onRefresh={onRefresh} />
            )}
          </div>
        ) : showCloseConfirm ? (
          <div
            style={{
              padding: '14px',
              background: 'var(--danger-bg)',
              border: '1px solid #fecaca',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <span style={{ fontSize: '12px', color: 'var(--danger)', fontWeight: 600 }}>
              Confirm case closure? This locks the case lifecycle permanently.
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="secondary-button"
                onClick={() => setShowCloseConfirm(false)}
                disabled={closeCase.isPending}
              >
                Cancel
              </button>
              <button
                className="danger-button"
                disabled={closeCase.isPending || (closeAction ? !closeAction.enabled : false)}
                onClick={() =>
                  closeCase.mutate({
                    expectedVersion: caseDetail.version,
                  })
                }
              >
                {closeCase.isPending ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                Confirm close
              </button>
            </div>
          </div>
        ) : (
          <div className="action-row">
            {reassessAction?.enabled && (
              <button className="secondary-button" onClick={() => setShowReassess(true)}>
                <RotateCcw size={16} />
                {reassessAction?.label ?? 'Schedule reassessment'}
              </button>
            )}
            {closeAction?.enabled && (
              <button className="danger-button" onClick={() => setShowCloseConfirm(true)}>
                <CheckCircle2 size={16} />
                {closeAction?.label ?? 'Close case'}
              </button>
            )}
          </div>
        )}
        {closeCase.isError && <InlineError error={closeCase.error} onRefresh={onRefresh} />}
      </div>
    </section>
  );
}
