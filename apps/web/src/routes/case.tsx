import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
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
  AssessmentCaseDetail,
  AttachmentSummary,
  CloseCaseInput,
  DecideApprovalInput,
  FinalizePlanInput,
  FinalizeResultInput,
  ReopenResultInput,
  ResultCode,
  ScheduleEventInput,
  ScheduleReassessmentInput,
  SubmitRecommendationInput,
  UpdateDevelopmentInput,
} from '@assessflow/contracts';
import { api, ApiRequestError } from '../lib/api';
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
import { AiCopilotCard } from '../features/case/ai-copilot-card';

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
  const decision = useMutation({
    mutationFn: (payload: {
      decision: 'ELIGIBLE' | 'NOT_ELIGIBLE';
      reason?: string;
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
  const override = useMutation({
    mutationFn: (reason: string) => api.requestOverride(caseId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      onToast('Override request sent for governance review.');
    },
  });
  const [activeStageTab, setActiveStageTab] = useState<'ALL' | string>('ALL');

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
      case 'SUBMITTED':
        return {
          title: 'Draft Assessment Request',
          subtitle: 'Complete details and submit for HR eligibility verification',
          buttonLabel: 'Review Draft',
          stageTarget: 'Request',
          sla: '3 days standard',
          urgent: false,
        };
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
      case 'PLANNING':
        return {
          title: 'Action Required: Finalize Assessment Plan',
          subtitle: 'Select evaluation methods, duration, and assign lead assessor',
          buttonLabel: 'Finalize Plan',
          stageTarget: 'Plan',
          sla: '4 days remaining',
          urgent: false,
        };
      case 'SCHEDULED':
        return {
          title: 'Action Required: Assessment Event Scheduling',
          subtitle: 'Confirm schedule and panel participation with candidate',
          buttonLabel: 'Schedule Event',
          stageTarget: 'Assessment',
          sla: '5 days remaining',
          urgent: false,
        };
      case 'IN_PROGRESS':
        return {
          title: 'Action Required: Evidence & Competency Rubrics',
          subtitle: 'Assessors must log qualitative notes and ratings',
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
      case 'REASSESSMENT_DUE':
        return {
          title: 'Active Growth & Milestone Tracking',
          subtitle: 'Track 30-60-90 day development actions and readiness outcomes',
          buttonLabel: 'View Milestones',
          stageTarget: 'Follow-up',
          sla: 'Active Cycle',
          urgent: false,
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
    const selectorMap: Record<string, string> = {
      Request: '.case-summary',
      Eligibility: '.decision-panel, .override-panel, .decision-summary-panel',
      Plan: '.plan-panel',
      Assessment: '.event-panel, .evidence-panel',
      Result: '.result-panel',
      Decision: '.recommendation-panel, .approval-panel',
      'Follow-up': '.development-panel, .close-panel',
    };
    const targetSelector = selectorMap[label];
    if (targetSelector) {
      setTimeout(() => {
        const el = document.querySelector(targetSelector);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          el.classList.add('panel-target-highlight');
          setTimeout(() => el.classList.remove('panel-target-highlight'), 1500);
        }
      }, 50);
    }
  };

  const handleJumpToActiveAction = () => {
    handleSelectStage(currentActionPrompt.stageTarget);
  };

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
  const activeIndex = [
    'REQUEST',
    'ELIGIBILITY',
    'PLANNING',
    'ASSESSMENT',
    'RESULT',
    'RECOMMENDATION',
    'APPROVAL',
    'FOLLOW_UP',
  ].indexOf(caseDetail.stage);

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
            {caseDetail.currentRole} <span className="muted-separator">→</span>{' '}
            {caseDetail.targetRole} · {caseDetail.targetLevel}
          </p>
        </div>
        <div className="case-header-side">
          <StatusBadge status={caseDetail.status} />
          <span className="owner-label">
            <UserRound size={14} />
            {caseDetail.owner}
          </span>
          <button className="icon-button" aria-label="More options">
            <MoreHorizontal size={18} />
          </button>
        </div>
      </section>

      {/* Executive Action Bar */}
      <div className="executive-action-bar panel">
        <div className="action-bar-left">
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
          <button type="button" className="action-cta-button" onClick={handleJumpToActiveAction}>
            <Sparkles size={15} />
            Jump to: {currentActionPrompt.stageTarget}
          </button>
        </div>
      </div>

      {/* Stepper with Interactive Stage Navigation */}
      <section className="stepper panel interactive" aria-label="Assessment progress">
        {['Request', 'Eligibility', 'Plan', 'Assessment', 'Result', 'Decision', 'Follow-up'].map(
          (label, index) => (
            <div
              className={`step interactive ${index < activeIndex ? 'complete' : index === activeIndex ? 'current' : ''} ${activeStageTab === label ? 'active-focus' : ''}`}
              key={label}
              onClick={() => handleSelectStage(label)}
              role="button"
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
      </section>

      {/* Stage Tab Selector */}
      <div className="stage-tab-bar" role="tablist" aria-label="Stage view selector">
        <button
          type="button"
          role="tab"
          aria-selected={activeStageTab === 'ALL'}
          className={`stage-tab-button ${activeStageTab === 'ALL' ? 'active' : ''}`}
          onClick={() => setActiveStageTab('ALL')}
        >
          <FileText size={14} />
          Complete Dossier (All Stages)
        </button>
        {['Request', 'Eligibility', 'Plan', 'Assessment', 'Result', 'Decision', 'Follow-up'].map(
          (st) => (
            <button
              key={st}
              type="button"
              role="tab"
              aria-selected={activeStageTab === st}
              className={`stage-tab-button ${activeStageTab === st ? 'active' : ''}`}
              onClick={() => handleSelectStage(st)}
            >
              {st}
            </button>
          ),
        )}
      </div>
      <div className="case-layout">
        <div className="case-main">
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
            </section>
          )}

          {isStageVisible('Eligibility') && caseDetail.status === 'PENDING_ELIGIBILITY' && (
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
                Confirm the policy criteria before this case can move to assessment planning. Every
                decision is recorded in the audit history.
              </p>
              <div className="criteria-table">
                {caseDetail.eligibility?.criteria.map((criterion) => (
                  <div className="criterion-row" key={criterion.code}>
                    <div>
                      <strong>{criterion.label}</strong>
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
                        <strong>{criterion.label}</strong>
                        <span>
                          {criterion.blocking ? 'Blocking criterion' : 'Non-blocking criterion'}
                        </span>
                      </div>
                      <span className={`criterion-result ${criterion.result.toLowerCase()}`}>
                        <Check size={14} />
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
              <EvidencePanel caseDetail={caseDetail} onToast={onToast} onRefresh={refreshCase} />
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
    enabled: isPastPlanning,
    retry: false,
  });

  const [selectedMethods, setSelectedMethods] = useState<string[]>(['CBI']);
  const [leadAssessor, setLeadAssessor] = useState('');

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
                      : 'Roleplay',
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

  const isVisible = caseDetail.status === 'PLANNING' || caseDetail.status === 'SCHEDULED';

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
        <div className="action-row" style={{ marginTop: '10px' }}>
          <button
            className="primary-button"
            disabled={scheduleEvent.isPending || !startsAt || (action ? !action.enabled : false)}
            onClick={() => {
              scheduleEvent.mutate({
                startsAt: new Date(startsAt).toISOString(),
                location: location.trim() || undefined,
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
}: {
  caseDetail: AssessmentCaseDetail;
  onToast: (msg: string) => void;
  onRefresh: () => void;
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
      <AiCopilotCard
        caseId={caseDetail.id}
        currentEvidenceText={Object.values(summaries).join(' ')}
        onApplySanitizedText={(cleanText) => {
          const firstEvent = events?.[0];
          if (firstEvent) {
            setSummaries((prev) => ({ ...prev, [firstEvent.id]: cleanText }));
            onToast('Sanitized wording applied to active evidence session.');
          }
        }}
      />
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

interface ResultData {
  resultCode?: ResultCode;
  evidenceSummary?: string;
  finalizedAt?: string;
  finalizedBy?: string;
  revision?: number;
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
  const isVisible = isInProgress || isFinalized;

  const { data: result } = useQuery({
    queryKey: ['result', caseDetail.id],
    queryFn: () => api.getResult<ResultData>(caseDetail.id),
    enabled: isFinalized,
    retry: false,
  });

  const [resultCode, setResultCode] = useState<ResultCode>('READY_NOW');
  const [evidenceSummary, setEvidenceSummary] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [showReopen, setShowReopen] = useState(false);

  const finalizeAction = getAvailableAction(caseDetail, 'FINALIZE_RESULT');
  const reopenAction = getAvailableAction(caseDetail, 'REOPEN_RESULT');

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

  if (!isVisible) return null;

  if (isFinalized) {
    return (
      <section className="panel result-panel">
        <PanelHeader
          icon={<FileCheck2 size={17} />}
          title="Final assessment result"
          action={<StatusBadge status={caseDetail.status} />}
        />
        <div className="summary-grid">
          <div className="info-item">
            <span>Result outcome</span>
            <strong>{result?.resultCode ?? 'READY_NOW'}</strong>
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
          {reopenResult.isError && <InlineError error={reopenResult.error} onRefresh={onRefresh} />}
        </div>
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
      <AiCopilotCard
        caseId={caseDetail.id}
        currentEvidenceText={evidenceSummary}
        onApplySynthesis={(synth) => {
          setResultCode(synth.suggestedOutcome);
          setEvidenceSummary(synth.executiveSummary);
          onToast('AI executive synthesis applied to result form.');
        }}
        onApplySanitizedText={(cleanText) => {
          setEvidenceSummary(cleanText);
          onToast('Sanitized wording applied to evidence summary.');
        }}
      />
      <div className="form-grid">
        <label className="field">
          <span>
            Result code <b>*</b>
          </span>
          <select
            value={resultCode}
            onChange={(e) => setResultCode(e.target.value as ResultCode)}
            disabled={finalizeResult.isPending}
          >
            <option value="READY_NOW">Ready now</option>
            <option value="READY_WITH_DEVELOPMENT">Ready with development</option>
            <option value="NOT_READY">Not ready</option>
            <option value="INCOMPLETE">Incomplete</option>
          </select>
        </label>
      </div>
      <label className="field" style={{ marginTop: '14px' }}>
        <span>Evidence summary</span>
        <textarea
          value={evidenceSummary}
          onChange={(e) => setEvidenceSummary(e.target.value)}
          placeholder="Consolidated observations and overall performance rationale…"
          rows={4}
          disabled={finalizeResult.isPending}
        />
      </label>
      <div className="action-row" style={{ marginTop: '16px' }}>
        <button
          className="primary-button"
          disabled={
            finalizeResult.isPending ||
            !resultCode ||
            (finalizeAction ? !finalizeAction.enabled : false)
          }
          onClick={() =>
            finalizeResult.mutate({
              resultCode,
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

  const [code, setCode] = useState('PROMOTE');
  const [rationale, setRationale] = useState('');
  const [requiresDevelopment, setRequiresDevelopment] = useState(false);
  const [requiresReassessment, setRequiresReassessment] = useState(false);
  const [decisionComments, setDecisionComments] = useState<Record<string, string>>({});

  const { data: steps } = useQuery({
    queryKey: ['approval-steps', caseDetail.id],
    queryFn: () => api.listApprovalSteps<ApprovalStepItem>(caseDetail.id),
    enabled: isVisible,
  });

  const recAction = getAvailableAction(caseDetail, 'SUBMIT_RECOMMENDATION');
  const approvalAction = getAvailableAction(caseDetail, 'DECIDE_APPROVAL');

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
                <option value="PROMOTE">Promote to target role</option>
                <option value="LATERAL_MOVE">Approve internal transfer</option>
                <option value="DEVELOPMENT_FOCUS">Development focus required</option>
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
                checked={requiresReassessment}
                onChange={(e) => setRequiresReassessment(e.target.checked)}
                disabled={submitRec.isPending}
              />
              <span>Requires reassessment</span>
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

      {steps && steps.length > 0 && (
        <div style={{ marginTop: showRecommendationForm ? '24px' : '0' }}>
          <span className="form-section-title" style={{ display: 'block', marginBottom: '12px' }}>
            Sequential approval steps ({steps.length})
          </span>
          <div style={{ display: 'grid', gap: '14px' }}>
            {steps.map((step) => {
              const isPending = step.decision === 'PENDING';
              const isCurrentApprover = isPending && caseDetail.status === 'PENDING_APPROVAL';
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
    caseDetail.status === 'APPROVED' || caseDetail.status === 'DEVELOPMENT_IN_PROGRESS';

  const { data: development } = useQuery({
    queryKey: ['development', caseDetail.id],
    queryFn: () => api.getDevelopment<DevelopmentData>(caseDetail.id),
    enabled: isVisible,
    retry: false,
  });

  const [title, setTitle] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [reassessReason, setReassessReason] = useState('');
  const [showReassess, setShowReassess] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const updateAction = getAvailableAction(caseDetail, 'UPDATE_DEVELOPMENT');
  const reassessAction = getAvailableAction(caseDetail, 'SCHEDULE_REASSESSMENT');
  const closeAction = getAvailableAction(caseDetail, 'CLOSE_CASE');

  const updateDev = useMutation({
    mutationFn: (input: UpdateDevelopmentInput) => api.updateDevelopment(caseDetail.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseDetail.id] });
      queryClient.invalidateQueries({ queryKey: ['development', caseDetail.id] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      setTitle('');
      setOwnerName('');
      onToast('Development plan updated.');
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

      <AiCopilotCard
        caseId={caseDetail.id}
        onApplyAction={(act) => {
          setTitle(act.title);
          setOwnerName(caseDetail.employeeName);
          onToast('SMART milestone applied to development action form.');
        }}
      />

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
              updateDev.isPending ||
              title.trim().length < 3 ||
              ownerName.trim().length < 2 ||
              (updateAction ? !updateAction.enabled : false)
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
            {updateDev.isPending ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />}
            {updateAction?.label ?? 'Update development'}
          </button>
        </div>
        {updateDev.isError && <InlineError error={updateDev.error} onRefresh={onRefresh} />}
      </div>

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
            <button
              className="secondary-button"
              disabled={reassessAction ? !reassessAction.enabled : false}
              onClick={() => setShowReassess(true)}
            >
              <RotateCcw size={16} />
              {reassessAction?.label ?? 'Schedule reassessment'}
            </button>
            <button
              className="danger-button"
              disabled={closeAction ? !closeAction.enabled : false}
              onClick={() => setShowCloseConfirm(true)}
            >
              <CheckCircle2 size={16} />
              {closeAction?.label ?? 'Close case'}
            </button>
          </div>
        )}
        {closeCase.isError && <InlineError error={closeCase.error} onRefresh={onRefresh} />}
      </div>
    </section>
  );
}
