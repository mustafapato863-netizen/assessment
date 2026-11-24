import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  FileCheck2,
  LockKeyhole,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { api } from '../lib/api';
import { getSession, hasBackendRole } from '../lib/auth';
import { reasonLabels, type Copy } from '../lib/labels';
import { queryKeys } from '../lib/query-keys';
import { ErrorBanner, InfoItem, PanelHeader } from '../components/ui';
import { useToast } from '../hooks/use-toast';
import { CaseHeaderAndStepper } from '../features/case/case-header';
import { AdminRequestEditor } from '../features/case/admin-request-editor';
import { EligibilityPanel } from '../features/case/eligibility-panel';
import { EventsPanel, PlanPanel } from '../features/case/plan-events-panel';
import { EvidencePanel } from '../features/case/evidence-attachments-panel';
import { ResultPanel } from '../features/case/result-panel';
import { DecisionPanel } from '../features/case/decision-panel';
import { DevelopmentPanel } from '../features/case/development-close-panel';
import { CaseRail } from '../features/case/activity-drawer';
import { STAGE_SELECTOR_MAP } from '../features/case/case-utils';

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
  const onBack = propOnBack ?? (() => navigate('/assessments'));
  const { showToast } = useToast();
  const onToast = propOnToast ?? showToast;
  const queryClient = useQueryClient();
  const user = getSession();

  const {
    data: caseDetail,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: queryKeys.caseDetail(caseId),
    queryFn: () => api.caseDetail(caseId),
    enabled: Boolean(caseId),
  });

  const [activeStageTab, setActiveStageTab] = useState<'ALL' | string>('ALL');
  const [stageScrollRequest, setStageScrollRequest] = useState(0);

  useEffect(() => {
    setActiveStageTab('ALL');
    setStageScrollRequest(0);
  }, [caseId]);

  useEffect(() => {
    const targetSelector = STAGE_SELECTOR_MAP[activeStageTab];
    if (!targetSelector) return;
    let attempts = 0;
    let frame = 0;
    let highlightTimer = 0;

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
        highlightTimer = window.setTimeout(() => {
          el.classList.remove('panel-target-highlight');
        }, 1500);
      }
    };

    frame = requestAnimationFrame(findAndScroll);
    return () => {
      cancelAnimationFrame(frame);
      if (highlightTimer) window.clearTimeout(highlightTimer);
    };
  }, [activeStageTab, stageScrollRequest]);

  const refreshCase = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.caseDetail(caseId) });
  };

  const handleSelectStage = (label: string) => {
    setActiveStageTab(label);
    setStageScrollRequest((n) => n + 1);
  };

  if (isLoading) {
    return (
      <>
        <button type="button" className="back-button" onClick={onBack}>
          <ArrowLeft size={16} />
          Back to cases
        </button>
        <div className="case-loading" role="status" aria-live="polite">
          <div className="loader-ring" />
          <strong>Loading case workspace</strong>
          <span>Preparing the latest policy and activity context.</span>
        </div>
      </>
    );
  }

  if (isError || !caseDetail) {
    return (
      <>
        <button type="button" className="back-button" onClick={onBack}>
          <ArrowLeft size={16} />
          Back to cases
        </button>
        <ErrorBanner
          message={(error as Error)?.message ?? 'Case could not load.'}
          onRetry={refreshCase}
        />
      </>
    );
  }

  const isAdmin = hasBackendRole(user, ['Admin']);
  const adminReadOnly = Boolean(caseDetail.adminEditStage) && !isAdmin;
  const isStageVisible = (stage: string) => activeStageTab === 'ALL' || activeStageTab === stage;

  return (
    <div key={caseDetail.id}>
      <CaseHeaderAndStepper
        caseDetail={caseDetail}
        activeStageTab={activeStageTab}
        onSelectStageTab={setActiveStageTab}
        onSelectStage={handleSelectStage}
        onBack={onBack}
        onToast={onToast}
      />

      <div className="case-layout">
        <div className={`case-main ${adminReadOnly ? 'admin-reopened-readonly' : ''}`}>
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
                    queryClient.setQueryData(queryKeys.caseDetail(caseDetail.id), updated);
                    void queryClient.invalidateQueries({ queryKey: queryKeys.overview() });
                    onToast('Request changes saved and recorded in the audit history.');
                  }}
                />
              )}
            </section>
          )}

          {isStageVisible('Eligibility') && (
            <EligibilityPanel caseDetail={caseDetail} onToast={onToast} onRefresh={refreshCase} />
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

        <CaseRail caseDetail={caseDetail} />
      </div>
    </div>
  );
}
