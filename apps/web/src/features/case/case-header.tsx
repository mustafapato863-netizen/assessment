import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Copy,
  FileText,
  History,
  LoaderCircle,
  MoreHorizontal,
  RotateCcw,
  Send,
  Sparkles,
  UserRound,
} from 'lucide-react';
import type { AdminReopenStageInput, AssessmentCaseDetail } from '@assessflow/contracts';
import { api } from '../../lib/api';
import { hasBackendRole, getSession } from '../../lib/auth';
import { reasonLabels } from '../../lib/labels';
import { queryKeys } from '../../lib/query-keys';
import { ErrorBanner, InlineError, PanelHeader, StatusBadge } from '../../components/ui';
import { PromptDialog } from '../../components/dialogs';
import { completedStagesBefore, computeElapsedStageLabel, stageTabLabel } from './case-utils';

export function CaseHeaderAndStepper({
  caseDetail,
  activeStageTab,
  onSelectStageTab,
  onSelectStage,
  onBack,
  onToast,
}: {
  caseDetail: AssessmentCaseDetail;
  activeStageTab: string;
  onSelectStageTab: (tab: string) => void;
  onSelectStage: (stage: string) => void;
  onBack: () => void;
  onToast: (msg: string) => void;
}) {
  const queryClient = useQueryClient();
  const user = getSession();
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const [reopenStageTarget, setReopenStageTarget] = useState<AdminReopenStageInput['stage'] | null>(
    null,
  );

  useEffect(() => {
    if (!moreMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [moreMenuOpen]);

  const submitDraft = useMutation({
    mutationFn: () => api.submitCase(caseDetail.id, caseDetail.version),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.caseDetail(caseDetail.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.overview() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cases() });
      onToast('Assessment request submitted for eligibility review.');
    },
  });

  const reopenStage = useMutation({
    mutationFn: (input: AdminReopenStageInput) => api.reopenCompletedStage(caseDetail.id, input),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.caseDetail(caseDetail.id), updated);
      void queryClient.invalidateQueries({ queryKey: queryKeys.overview() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cases() });
      onSelectStageTab(stageTabLabel(updated.adminEditStage));
      setReopenStageTarget(null);
      onToast('Stage reopened for Admin editing. Later stages will be resumed afterward.');
    },
  });

  const canSubmitDraft = hasBackendRole(user, ['Requester', 'Assessor', 'Admin']);
  const isAdmin = hasBackendRole(user, ['Admin']);
  const completedStages = completedStagesBefore(caseDetail.status);
  const adminReadOnly = Boolean(caseDetail.adminEditStage) && !isAdmin;

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
      case 'PLANNING':
      case 'SCHEDULED':
      case 'IN_PROGRESS':
        return 3;
      case 'PENDING_RESULT':
        return 4;
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

  const actionPrompt = (() => {
    const sla = computeElapsedStageLabel(
      caseDetail.requestedAt,
      caseDetail.stageEnteredAt,
      caseDetail.status,
    );
    switch (caseDetail.status) {
      case 'DRAFT':
        return {
          title: 'Draft Assessment Request',
          subtitle: 'Complete details and submit for eligibility verification',
          stageTarget: 'Request',
          sla,
          urgent: false,
        };
      case 'SUBMITTED':
      case 'PENDING_ELIGIBILITY':
        return {
          title: 'Action Required: Eligibility Review',
          subtitle: 'Verify policy criteria and prerequisites before planning',
          stageTarget: 'Eligibility',
          sla,
          urgent: true,
        };
      case 'NOT_ELIGIBLE':
        return {
          title: 'Governance Exception Required',
          subtitle: 'Case blocked by policy criteria; governance override required',
          stageTarget: 'Eligibility',
          sla,
          urgent: true,
        };
      case 'READY_FOR_PLANNING':
        return {
          title: 'Action Required: Finalize Assessment Plan',
          subtitle: 'Select evaluation methods and assign a lead assessor',
          stageTarget: 'Plan',
          sla,
          urgent: false,
        };
      case 'PLANNING':
        return {
          title: 'Action Required: Schedule Assessment Session',
          subtitle: 'Plan finalized; book session and assign assessors',
          stageTarget: 'Assessment',
          sla,
          urgent: false,
        };
      case 'SCHEDULED':
      case 'IN_PROGRESS':
        return {
          title: 'Action Required: Evidence & Scorecards',
          subtitle: 'Record session evidence, upload documents, and score competencies',
          stageTarget: 'Assessment',
          sla,
          urgent: caseDetail.status === 'IN_PROGRESS',
        };
      case 'PENDING_RESULT':
        return {
          title: 'Action Required: Finalize Evaluation Result',
          subtitle: 'Synthesize scores and set official readiness outcome',
          stageTarget: 'Result',
          sla,
          urgent: true,
        };
      case 'RESULT_FINALIZED':
      case 'PENDING_RECOMMENDATION':
        return {
          title: 'Action Required: Promotion Recommendation',
          subtitle: 'Formulate business recommendation and governance proposal',
          stageTarget: 'Decision',
          sla,
          urgent: false,
        };
      case 'PENDING_APPROVAL':
        return {
          title: 'Action Required: Governance Sign-off',
          subtitle: 'Awaiting sequential HR and Business approver sign-offs',
          stageTarget: 'Decision',
          sla,
          urgent: true,
        };
      case 'APPROVED':
      case 'DEVELOPMENT_IN_PROGRESS':
        return {
          title: 'Active Growth & Milestone Tracking',
          subtitle: 'Track development action plans and post-assessment milestones',
          stageTarget: 'Follow-up',
          sla,
          urgent: false,
        };
      case 'REASSESSMENT_DUE':
        return {
          title: 'Action Required: Reassessment Due',
          subtitle: 'Schedule linked follow-up assessment cycle',
          stageTarget: 'Follow-up',
          sla,
          urgent: true,
        };
      case 'CLOSED':
        return {
          title: 'Assessment Process Closed',
          subtitle: 'Archived with complete immutable audit trail',
          stageTarget: 'Follow-up',
          sla,
          urgent: false,
        };
      default:
        return {
          title: 'Assessment Workflow Active',
          subtitle: 'Review stage history and artifacts below',
          stageTarget: 'Request',
          sla,
          urgent: false,
        };
    }
  })();

  const copyCaseCode = async () => {
    setMoreMenuOpen(false);
    try {
      await navigator.clipboard?.writeText(caseDetail.caseCode);
      onToast(`Copied case code ${caseDetail.caseCode}`);
    } catch {
      onToast('Clipboard access unavailable.');
    }
  };

  return (
    <>
      <button type="button" className="back-button" onClick={onBack}>
        <ArrowLeft size={16} />
        Back to cases
      </button>

      <section className="case-header panel">
        <div>
          <div className="case-code">
            {caseDetail.caseCode} <span>·</span>{' '}
            {reasonLabels[caseDetail.assessmentReason] ?? caseDetail.assessmentReason}
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

          <div ref={moreMenuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              className="icon-button"
              aria-label="More options"
              aria-expanded={moreMenuOpen}
              onClick={() => setMoreMenuOpen((v) => !v)}
            >
              <MoreHorizontal size={18} />
            </button>
            {moreMenuOpen && (
              <div className="user-dropdown-menu panel" role="menu" style={{ right: 0 }}>
                <button
                  type="button"
                  role="menuitem"
                  className="user-dropdown-item"
                  onClick={() => void copyCaseCode()}
                >
                  <Copy size={15} />
                  Copy Case Number
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="user-dropdown-item"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    onSelectStageTab('ALL');
                  }}
                >
                  <FileText size={15} />
                  Expand All Stages
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="user-dropdown-item"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    document
                      .querySelector('.activity-panel')
                      ?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  <History size={15} />
                  Jump to Audit Timeline
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

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
            onClick={() => onSelectStageTab('ALL')}
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
                onClick={() => onSelectStage(label)}
                role="button"
                aria-pressed={activeStageTab === label}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectStage(label);
                  }
                }}
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

      <div className="executive-action-bar panel">
        <div className="action-bar-left">
          <span className="action-banner-icon" aria-hidden="true">
            <CalendarDays size={17} />
          </span>

          <div className={`action-urgency-badge ${actionPrompt.urgent ? 'urgent' : ''}`}>
            <span className="pulse-dot" />
            {actionPrompt.urgent ? 'Action Required' : 'Stage Status'}
          </div>
          <div className="action-description">
            <span className="action-title">{actionPrompt.title}</span>
            <span className="action-subtitle">
              {actionPrompt.subtitle} · Timeline:{' '}
              <strong style={{ color: actionPrompt.urgent ? 'var(--danger)' : 'var(--primary)' }}>
                {actionPrompt.sla}
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
          <button
            type="button"
            className="action-cta-button"
            onClick={() => onSelectStage(actionPrompt.stageTarget)}
          >
            <Sparkles size={15} />
            Jump to: {actionPrompt.stageTarget}
          </button>
        </div>
      </div>

      {submitDraft.isError && <ErrorBanner message={submitDraft.error.message} />}

      {caseDetail.adminEditStage && (
        <div className={`admin-edit-banner ${adminReadOnly ? 'read-only' : ''}`}>
          {adminReadOnly
            ? 'This completed stage is reopened for Admin editing. You have read-only access.'
            : `Admin edit mode: ${stageTabLabel(caseDetail.adminEditStage)}. Previous stages remain in the audit history.`}
        </div>
      )}

      {isAdmin && !caseDetail.adminEditStage && completedStages.length > 0 && (
        <section className="panel admin-reopen-panel" style={{ marginBottom: 16 }}>
          <PanelHeader
            icon={<RotateCcw size={17} />}
            title="Reopen a completed stage"
            action={<span className="status-badge">Admin only</span>}
          />
          <p className="panel-intro">
            Reopening a stage preserves its history and returns the case for Admin edits. A written
            reason is recorded in the audit ledger.
          </p>
          <div className="admin-reopen-actions">
            {completedStages.map((stage) => (
              <button
                key={stage}
                type="button"
                className="secondary-button"
                disabled={reopenStage.isPending}
                onClick={() => setReopenStageTarget(stage)}
              >
                <RotateCcw size={15} />
                Reopen {stageTabLabel(stage)}
              </button>
            ))}
          </div>
          {reopenStage.isError && <InlineError error={reopenStage.error} />}
        </section>
      )}

      <PromptDialog
        isOpen={Boolean(reopenStageTarget)}
        title={`Reopen ${stageTabLabel(reopenStageTarget ?? undefined)} stage`}
        description="Reopening a completed stage records an immutable governance audit entry and places the case in Admin edit mode."
        label="Governance reason"
        placeholder="Explain why this completed stage needs to be reopened…"
        minLength={10}
        confirmLabel="Confirm reopen"
        busy={reopenStage.isPending}
        onCancel={() => setReopenStageTarget(null)}
        onConfirm={async (reason) => {
          if (!reopenStageTarget) return;
          await reopenStage.mutateAsync({
            stage: reopenStageTarget,
            reason,
            expectedVersion: caseDetail.version,
          });
        }}
      />
    </>
  );
}
