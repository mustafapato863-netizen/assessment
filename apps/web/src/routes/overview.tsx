import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  History,
  ListTodo,
  Plus,
  RotateCcw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { api } from '../lib/api';
import { getSession, subscribeToAuth, type AppUser } from '../lib/auth';
import { copy, statusLabels, type Copy } from '../lib/labels';
import { getRemainingTime, sortPriorityActionCases } from './overview-utils';
import { ACTION_DUE_SOON_DAYS, daysUntil } from './development-logic';
import { DEFAULT_ADMINISTRATION_POLICY, exceedsSlaWindow } from './administration-logic';
import {
  CaseTable,
  CaseCodeDisplay,
  EmptyState,
  ErrorBanner,
  MetricCard,
  PageHeading,
  PanelHeader,
  SkeletonMetric,
} from '../components/ui';

interface DevelopmentPlanData {
  id?: string;
  caseId?: string;
  ownerName?: string;
  targetDate?: string | null;
  status?: string;
  actions?: Array<{
    id?: string;
    title: string;
    ownerName: string;
    dueDate?: string | null;
    status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
    evidenceNote?: string | null;
  }>;
}

const stageDisplayMap: Record<string, string> = {
  REQUEST: 'Request',
  ELIGIBILITY: 'Eligibility',
  PLANNING: 'Planning',
  ASSESSMENT: 'Assessment',
  RESULT: 'Result',
  RECOMMENDATION: 'Recommendation',
  APPROVAL: 'Approval',
  FOLLOW_UP: 'Follow-up',
  CLOSED: 'Closed',
};

const pipelineStageFilterMap: Record<string, string> = {
  Request: 'request',
  Eligibility: 'eligibility',
  Planning: 'planning',
  Assessment: 'assessment',
  Result: 'result',
  Decision: 'decision',
  'Follow-up': 'follow_up',
  Closed: 'closed',
};

const pipelineDisplayStageOrder: Record<string, number> = {
  Request: 0,
  Eligibility: 1,
  Planning: 2,
  Assessment: 3,
  Result: 4,
  Decision: 5,
  'Follow-up': 6,
  Closed: 7,
};

function parseDaysInStatus(item: { requestedAt?: string; ageLabel?: string }): number {
  if (item.ageLabel) {
    const dMatch = item.ageLabel.match(/(\d+(?:\.\d+)?)\s*d/i);
    if (dMatch && dMatch[1]) return parseFloat(dMatch[1]);
    const wMatch = item.ageLabel.match(/(\d+(?:\.\d+)?)\s*w/i);
    if (wMatch && wMatch[1]) return parseFloat(wMatch[1]) * 7;
    const mMatch = item.ageLabel.match(/(\d+(?:\.\d+)?)\s*m/i);
    if (mMatch && mMatch[1]) return parseFloat(mMatch[1]) * 30;
  }
  if (item.requestedAt) {
    const t = new Date(item.requestedAt).getTime();
    if (!isNaN(t)) {
      return Math.max(0, (Date.now() - t) / 86_400_000);
    }
  }
  return 0;
}

function getGreetingName(name: string): string {
  return name.split(' ')[0] ?? name;
}

export function OverviewPage({
  t: propT,
  onOpenCase: propOnOpenCase,
  onNew: propOnNew,
  onOpenDevelopment: propOnOpenDevelopment,
}: {
  t?: Copy;
  onOpenCase?: (id: string) => void;
  onNew?: () => void;
  onOpenDevelopment?: (caseId: string) => void;
} = {}) {
  const t = propT ?? copy;
  const navigate = useNavigate();
  const location = useLocation();

  const onOpenCase = propOnOpenCase ?? ((id: string) => navigate(`/cases/${id}`));
  const onNew =
    propOnNew ?? (() => navigate('/cases/new', { state: { backgroundLocation: location } }));

  const [activeUser, setActiveUser] = useState<AppUser | null>(getSession);
  const [showAllAttentionTasks, setShowAllAttentionTasks] = useState(false);

  useEffect(() => {
    return subscribeToAuth((u) => setActiveUser(u));
  }, []);

  const onOpenDevelopment =
    propOnOpenDevelopment ?? ((id: string) => navigate(`/development?caseId=${id}`));

  const {
    data,
    isLoading: overviewLoading,
    isError: overviewError,
    refetch: refetchOverview,
  } = useQuery({ queryKey: ['overview'], queryFn: api.overview });
  const {
    data: cases,
    isLoading: casesLoading,
    isError: casesError,
    refetch: refetchCases,
  } = useQuery({ queryKey: ['cases'], queryFn: () => api.cases() });

  const handleRetry = () => {
    refetchOverview();
    refetchCases();
  };

  const isLoading = overviewLoading || casesLoading;
  const isError = overviewError || casesError;
  const slaPolicy = useMemo(
    () => ({ slaWindows: data?.slaWindows ?? DEFAULT_ADMINISTRATION_POLICY.slaWindows }),
    [data?.slaWindows],
  );
  const maxPipelineCount = Math.max(1, ...(data?.pipeline.map((item) => item.value) ?? []));

  const openCases = useMemo(() => {
    return (cases ?? []).filter((c) => c.status !== 'CLOSED' && c.status !== 'CANCELLED');
  }, [cases]);

  const pendingActionCases = useMemo(() => {
    return openCases.flatMap((caseItem) => {
      const action = caseItem.availableActions?.find(
        (item) => item.enabled && item.code !== 'OPEN_CASE',
      );
      return action ? [{ ...caseItem, pendingAction: action }] : [];
    });
  }, [openCases]);

  const slaBreachCases = useMemo(() => {
    return openCases.filter((c) =>
      exceedsSlaWindow(c.stage, c.stageEnteredAt ?? c.requestedAt, slaPolicy),
    );
  }, [openCases, slaPolicy]);

  const bottleneck = useMemo(() => {
    if (!openCases.length) return null;
    const stageCounts: Record<string, number> = {};
    for (const c of openCases) {
      if (c.stage === 'CLOSED') continue;
      const pipelineStage =
        c.stage === 'RECOMMENDATION' || c.stage === 'APPROVAL'
          ? 'Decision'
          : (stageDisplayMap[c.stage] ?? c.stage);
      stageCounts[pipelineStage] = (stageCounts[pipelineStage] ?? 0) + 1;
    }
    const [maxStage, maxCount] = Object.entries(stageCounts).sort(
      ([stageA, countA], [stageB, countB]) =>
        countB - countA ||
        (pipelineDisplayStageOrder[stageA] ?? Number.MAX_SAFE_INTEGER) -
          (pipelineDisplayStageOrder[stageB] ?? Number.MAX_SAFE_INTEGER),
    )[0] ?? ['', 0];
    if (!maxStage || maxCount === 0) return null;
    return {
      stage: maxStage,
      count: maxCount,
    };
  }, [openCases]);

  const pendingDecisionCases = useMemo(
    () => pendingActionCases.filter((item) => item.pendingAction.code === 'DECIDE_APPROVAL'),
    [pendingActionCases],
  );
  const myDecisionsCount = pendingDecisionCases.length;

  const devInProgressCases = useMemo(() => {
    return (cases ?? []).filter((c) => c.status === 'DEVELOPMENT_IN_PROGRESS');
  }, [cases]);

  const devPlanQueries = useQueries({
    queries: devInProgressCases.map((c) => ({
      queryKey: ['development', c.id],
      queryFn: () => api.getDevelopment<DevelopmentPlanData>(c.id).catch(() => null),
      staleTime: 30_000,
    })),
  });

  const followUpActions = useMemo(() => {
    const items: Array<{
      caseId: string;
      caseCode: string;
      employeeName: string;
      actionTitle: string;
      ownerName: string;
      dueDate: string;
      diffDays: number;
      status: string;
    }> = [];

    const now = new Date();

    devInProgressCases.forEach((c, index) => {
      const plan = devPlanQueries[index]?.data;
      if (!plan?.actions) return;

      for (const act of plan.actions) {
        if (act.status === 'COMPLETED') continue;
        const effectiveDueDate = act.dueDate || plan.targetDate;
        if (!effectiveDueDate) continue;

        const diffDays = daysUntil(effectiveDueDate, now);
        if (diffDays !== null && diffDays <= ACTION_DUE_SOON_DAYS) {
          items.push({
            caseId: c.id,
            caseCode: c.caseCode,
            employeeName: c.employeeName,
            actionTitle: act.title,
            ownerName: act.ownerName,
            dueDate: effectiveDueDate,
            diffDays,
            status: act.status ?? 'NOT_STARTED',
          });
        }
      }
    });

    return items.sort((a, b) => a.diffDays - b.diffDays);
  }, [devInProgressCases, devPlanQueries]);

  const priorityActionCases = useMemo(() => {
    const orderedCases = pendingActionCases.map((c) => {
      let actionName = c.pendingAction.label;
      let slaText = 'On track';
      let actionStage = 'Case review';
      const days = parseDaysInStatus(c);
      let slaTargetDays = 14;

      switch (c.status) {
        case 'SUBMITTED':
        case 'PENDING_ELIGIBILITY':
          actionName = 'Review Eligibility';
          actionStage = 'Eligibility review';
          slaTargetDays = 3;
          break;
        case 'READY_FOR_PLANNING':
        case 'PLANNING':
          actionName = 'Finalize Plan';
          actionStage = 'Assessment plan';
          slaTargetDays = 5;
          break;
        case 'SCHEDULED':
          actionName = 'Schedule Event';
          actionStage = 'Assessment event';
          slaTargetDays = 7;
          break;
        case 'IN_PROGRESS':
          actionName = 'Submit Evidence';
          actionStage = 'Assessment';
          slaTargetDays = 4;
          break;
        case 'PENDING_RESULT':
          actionName = 'Finalize Result';
          actionStage = 'Assessment result';
          slaTargetDays = 3;
          break;
        case 'RESULT_FINALIZED':
        case 'PENDING_RECOMMENDATION':
          actionName = 'Submit Recommendation';
          actionStage = 'Recommendation';
          slaTargetDays = 5;
          break;
        case 'PENDING_APPROVAL':
          actionName = 'Decide Approval';
          actionStage = 'Decision';
          slaTargetDays = 2;
          break;
        case 'APPROVED':
        case 'DEVELOPMENT_IN_PROGRESS':
        case 'REASSESSMENT_DUE':
          actionName = 'Track Milestones';
          actionStage = 'Follow-up';
          slaText = 'Active Cycle';
          slaTargetDays = 14;
          break;
        default:
          actionName = 'View Case';
          slaText = 'Active';
      }

      const { daysRemaining, label: remainingLabel } = getRemainingTime(slaTargetDays, days);
      const slaBreachRisk = exceedsSlaWindow(
        c.stage,
        c.stageEnteredAt ?? c.requestedAt,
        slaPolicy,
      );
      const actionUrgent = slaBreachRisk;

      if (slaBreachRisk) {
        slaText = `SLA risk · ${days}d in case`;
      } else {
        slaText = remainingLabel;
      }

      return {
        ...c,
        actionName,
        actionStage,
        actionUrgent,
        slaText,
        slaBreachRisk,
        daysRemaining,
      };
    });
    const bottleneckStage = Object.entries(
      openCases.reduce<Record<string, number>>((counts, caseItem) => {
        counts[caseItem.stage] = (counts[caseItem.stage] ?? 0) + 1;
        return counts;
      }, {}),
    ).sort((a, b) => b[1] - a[1])[0]?.[0];

    return sortPriorityActionCases(
      orderedCases.map((caseItem) => ({
        ...caseItem,
        whyNextLabel: caseItem.slaBreachRisk
          ? 'SLA risk'
          : caseItem.daysRemaining === 0
            ? 'Due today'
            : caseItem.daysRemaining === 1
              ? 'Due in 1d'
              : caseItem.stage === bottleneckStage
                ? 'Bottleneck stage'
                : `Due in ${caseItem.daysRemaining}d`,
      })),
    );
  }, [openCases, pendingActionCases, slaPolicy]);
  const priorityQueueCases = priorityActionCases.slice(0, 6);

  const dynamicSubtitle = useMemo(() => {
    switch (activeUser?.role) {
      case 'ASSESSOR':
        return 'Candidate evaluations, behavioral rubrics, and scorecard milestones awaiting your scoring.';
      case 'APPROVER':
        return 'Executive review dashboard: cross-department calibration cases awaiting promotion sign-off.';
      case 'DEV_LEAD':
        return 'Talent growth tracking: 30-60-90 day development plans and post-assessment coaching.';
      case 'SYS_ADMIN':
        return 'Monitor assessment activity, approvals, and cases that need your attention.';
      default:
        return t.subtitle;
    }
  }, [activeUser?.role, t.subtitle]);
  const canCreateRequest = ['SYS_ADMIN', 'HR_ADMIN', 'DEV_LEAD', 'ASSESSOR'].includes(
    activeUser?.role ?? '',
  );

  return (
    <div className="overview-page">
      <PageHeading
        eyebrow="ASSESSMENT WORKSPACE"
        title={`Welcome, ${getGreetingName(activeUser?.name ?? 'User')}`}
        subtitle={`${pendingActionCases.length} cases need action · Bottleneck: ${bottleneck ? `${bottleneck.stage} (${bottleneck.count} open)` : 'None'} · ${dynamicSubtitle}`}
        action={
          canCreateRequest ? (
            <button className="primary-button" onClick={onNew}>
              <Plus size={17} />
              {t.newRequest}
            </button>
          ) : undefined
        }
      />

      {isError && (
        <ErrorBanner
          message="The overview could not load. Check that the API is running, then retry."
          onRetry={handleRetry}
        />
      )}
      {overviewError && (
        <section
          className="panel empty-state-panel api-unreachable-panel"
          role="region"
          aria-label="API service unreachable"
        >
          <div className="empty-state" style={{ padding: '44px 20px' }}>
            <div
              className="empty-icon"
              style={{ color: 'var(--danger)', background: 'var(--danger-bg)' }}
            >
              <ShieldAlert size={28} />
            </div>
            <strong>API service unreachable</strong>
            <span>
              Unable to connect to the AssessFlow backend service. Verify that the API server is
              running and reachable.
            </span>
            <button
              type="button"
              className="primary-button"
              onClick={handleRetry}
              style={{ marginTop: '8px' }}
            >
              <RotateCcw size={15} />
              Retry connection
            </button>
          </div>
        </section>
      )}
      <section className="metric-grid" aria-label="Assessment metrics">
        {isLoading
          ? [1, 2, 3, 4].map((key) => <SkeletonMetric key={key} />)
          : [
              {
                label: 'Total cases',
                value: cases?.length ?? 0,
                context: 'Across the workflow',
                trend: 'All cases',
                tone: 'neutral',
              },
              {
                label: 'Awaiting your action',
                value: pendingActionCases.length,
                context: 'Cases with next steps',
                trend: 'Action needed',
                tone: 'warning',
              },
              {
                label: 'My decisions pending',
                value: myDecisionsCount,
                context: `From ${pendingActionCases.length} action cases`,
                trend: 'Decision actions',
                tone: 'positive',
              },
              {
                label: 'At SLA risk',
                value: slaBreachCases.length,
                context: 'Past its configured review window',
                trend: slaBreachCases.length > 0 ? 'Needs attention' : 'Clear',
                tone: slaBreachCases.length > 0 ? 'danger' : 'positive',
              },
            ].map((metric) => <MetricCard key={metric.label} metric={metric} />)}
      </section>

      <section className="panel pipeline-panel">
        <div className="pipeline-heading">
          <h2>{t.pipeline}</h2>
          <span>Select a stage to filter Assessments</span>
        </div>
        <div className="pipeline-list">
          {data?.pipeline.map((item) => (
            <a
              href={`#/assessments?stage=${encodeURIComponent(pipelineStageFilterMap[item.label] ?? item.label)}`}
              className={`pipeline-row pipeline-row-button ${item.label === bottleneck?.stage ? 'bottleneck' : ''}`}
              key={item.label}
              aria-label={`${item.label}: ${item.value} cases`}
            >
              <div className="pipeline-label">
                <span>{item.label === 'Follow-up' ? 'Follow‑up' : item.label}</span>
                {item.label === bottleneck?.stage && (
                  <small className="pipeline-bottleneck-badge">Bottleneck</small>
                )}
                <b>{item.value}</b>
              </div>
              <div className="pipeline-bar">
                <i
                  className={item.label === 'Closed' ? 'closed' : ''}
                  style={{
                    width: `${(item.value / maxPipelineCount) * 100}%`,
                  }}
                />
              </div>
            </a>
          ))}
        </div>
      </section>
      <div className="overview-work-grid">
        {/* Priority Action Queue */}
        {priorityQueueCases.length > 0 && (
          <section className="panel action-queue-section" aria-label="Priority action queue">
            <div className="action-queue-header">
              <h3>
                <Sparkles size={16} style={{ color: 'var(--indigo)' }} />
                Priority Action Queue
              </h3>
              <span className="action-queue-description">
                Showing the top {priorityQueueCases.length} of {pendingActionCases.length} action
                cases · sorted by SLA risk, then days left
              </span>
            </div>
            {(() => {
              const [nextAction, ...upNext] = priorityQueueCases;
              if (!nextAction) return null;

              const initials = (name: string) =>
                name
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join('')
                  .toUpperCase();

              return (
                <>
                  <div
                    className={`action-queue-featured ${nextAction.actionUrgent ? 'urgent' : ''}`}
                  >
                    <div className="action-queue-featured-content">
                      <span className="action-queue-eyebrow">
                        Next action · {nextAction.actionStage}
                      </span>
                      <h4>{nextAction.employeeName}</h4>
                      <div className="action-queue-featured-meta">
                        <CaseCodeDisplay caseCode={nextAction.caseCode} /> · {nextAction.department}
                      </div>
                      <div className="action-queue-featured-role">
                        {nextAction.currentRole || 'Current role not specified'}{' '}
                        <span className="muted-separator">→</span> {nextAction.targetRole}
                        {nextAction.targetLevel ? ` · ${nextAction.targetLevel}` : ''}
                      </div>
                      <div className="action-queue-featured-tags">
                        <span className="soft-chip">{nextAction.whyNextLabel}</span>
                        {nextAction.slaText !== 'Due today' && (
                          <span className="action-queue-sla">
                            <Clock3 size={12} /> {nextAction.slaText}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="action-queue-featured-btn"
                      aria-label={`${nextAction.actionName} for ${nextAction.employeeName} (${nextAction.caseCode})`}
                      onClick={() => onOpenCase(nextAction.id)}
                    >
                      {nextAction.actionName}
                      <ArrowUpRight size={14} />
                    </button>
                  </div>
                  {upNext.length > 0 && (
                    <>
                      <div className="action-queue-up-next">
                        Up next · {upNext.length} other cases
                      </div>
                      <div
                        className="action-queue-list"
                        role="list"
                        aria-label="Other cases awaiting action"
                      >
                        {upNext.map((item) => (
                          <div
                            key={item.id}
                            className={`action-queue-list-row ${item.actionUrgent ? 'urgent' : ''}`}
                            role="listitem"
                          >
                            <span className="action-queue-avatar" aria-hidden="true">
                              {initials(item.employeeName)}
                            </span>
                            <div className="action-queue-list-person-copy">
                              <div className="action-queue-list-name">{item.employeeName}</div>
                              <div className="action-queue-list-meta">
                                <CaseCodeDisplay caseCode={item.caseCode} /> · {item.department}
                              </div>
                            </div>
                            <div className="action-queue-list-stage">
                              <span
                                title={`${item.actionStage} · ${statusLabels[item.status] ?? item.status}`}
                              >
                                {item.actionStage} · {statusLabels[item.status] ?? item.status}
                              </span>
                            </div>
                            <div className="action-queue-list-reason">
                              <span className="soft-chip">{item.whyNextLabel}</span>
                            </div>
                            <button
                              type="button"
                              className="action-queue-btn"
                              aria-label={`${item.actionName} for ${item.employeeName} (${item.caseCode})`}
                              onClick={() => onOpenCase(item.id)}
                            >
                              {item.actionName}
                              <ArrowUpRight size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              );
            })()}
          </section>
        )}

        <section className="panel task-panel">
          <PanelHeader
            icon={<ListTodo size={17} />}
            title={t.attention}
            action={
              pendingActionCases.length > 5 ? (
                <button
                  type="button"
                  className="link-button"
                  aria-expanded={showAllAttentionTasks}
                  onClick={() => setShowAllAttentionTasks((current) => !current)}
                >
                  {showAllAttentionTasks ? 'Show less' : `View all (${pendingActionCases.length})`}
                  <ArrowUpRight size={14} />
                </button>
              ) : undefined
            }
          />

          {isLoading ? (
            <div
              className="skeleton-line"
              style={{ height: '64px', borderRadius: '10px', marginBottom: '14px' }}
            />
          ) : (
            <div className="attention-summary-list" aria-label="Attention summary">
              <button
                type="button"
                className="attention-summary-card decisions"
                onClick={() => navigate('/cases?stage=DECISION')}
              >
                <span className="attention-summary-copy">
                  <span>Decisions waiting on you</span>
                  <small>From {pendingActionCases.length} action cases</small>
                </span>
                <strong>{myDecisionsCount}</strong>
              </button>
              <button
                type="button"
                className="attention-summary-card bottleneck"
                onClick={() =>
                  navigate(
                    `/cases?stage=${encodeURIComponent(pipelineStageFilterMap[bottleneck?.stage ?? ''] ?? bottleneck?.stage ?? '')}`,
                  )
                }
              >
                <span>
                  {bottleneck ? `${bottleneck.stage} stage bottleneck` : 'Stage bottleneck'}
                </span>
                <strong>{bottleneck?.count ?? 0}</strong>
              </button>
              <button
                type="button"
                className={`attention-summary-card ${slaBreachCases.length > 0 ? 'risk' : 'sla'}`}
                onClick={() =>
                  slaBreachCases[0] ? onOpenCase(slaBreachCases[0].id) : navigate('/cases')
                }
                title="Cases that have passed their configured review SLA window"
              >
                <span>Cases past their review SLA window</span>
                <strong>{slaBreachCases.length}</strong>
              </button>
            </div>
          )}

          <div className="task-list">
            {casesLoading ? (
              <div
                className="skeleton-line"
                style={{ height: '64px', borderRadius: '10px', margin: '12px' }}
              />
            ) : casesError || !cases ? (
              <div className="empty-state" style={{ padding: '24px 12px' }}>
                <AlertTriangle size={20} style={{ color: 'var(--warning)' }} />
                <strong>Pending actions could not be loaded</strong>
                <span>Retry to refresh the case list and action queue.</span>
              </div>
            ) : pendingActionCases.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 size={17} />}
                title="No pending actions"
                description="Your queue is clear. No open workflow actions need attention."
              />
            ) : (
              priorityActionCases
                .slice(0, showAllAttentionTasks ? priorityActionCases.length : 5)
                .map((caseItem) => (
                  <button
                    className="task-row"
                    key={caseItem.id}
                    onClick={() => onOpenCase(caseItem.id)}
                    title={`Open ${caseItem.caseCode}`}
                  >
                    <div className={`priority-dot ${caseItem.slaBreachRisk ? 'high' : ''}`} />
                    <div className="task-content">
                      <strong>
                        {caseItem.actionName} · {caseItem.employeeName}
                      </strong>
                      <span>
                        <CaseCodeDisplay caseCode={caseItem.caseCode} /> ·{' '}
                        {stageDisplayMap[caseItem.stage] ?? caseItem.stage} · {caseItem.owner}
                      </span>
                    </div>
                    <ArrowUpRight size={16} />
                  </button>
                ))
            )}
          </div>
        </section>
        <section className="panel growth-followups-panel" aria-label="Growth follow-ups">
          <PanelHeader
            icon={<Sparkles size={17} />}
            title="Growth follow-ups"
            action={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="soft-count">
                  {followUpActions.length} {followUpActions.length === 1 ? 'action' : 'actions'} due
                  (&le;{ACTION_DUE_SOON_DAYS}d)
                </span>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => navigate('/development')}
                >
                  View all development
                  <ArrowUpRight size={14} />
                </button>
              </div>
            }
          />
          <div className="growth-followups-list">
            {followUpActions.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 size={17} />}
                title="No upcoming growth follow-ups"
                description={`All development actions are on track. No items due within the next ${ACTION_DUE_SOON_DAYS} days.`}
              />
            ) : (
              followUpActions.map((item) => (
                <button
                  key={`${item.caseId}-${item.actionTitle}`}
                  type="button"
                  className="growth-followup-row"
                  onClick={() => onOpenDevelopment(item.caseId)}
                  title={`Open development view for ${item.caseCode}`}
                >
                  <div
                    className={`due-badge ${
                      item.diffDays < 0 ? 'overdue' : item.diffDays <= 3 ? 'urgent' : ''
                    }`}
                  >
                    <Clock3 size={12} />
                    <span>
                      {item.diffDays < 0
                        ? `${Math.abs(item.diffDays)}d overdue`
                        : item.diffDays === 0
                          ? 'Due today'
                          : item.diffDays === 1
                            ? 'Due tomorrow'
                            : `${item.diffDays}d left`}
                    </span>
                  </div>
                  <div className="followup-content">
                    <strong>{item.actionTitle}</strong>
                    <span>
                      <CaseCodeDisplay caseCode={item.caseCode} /> · {item.employeeName}
                    </span>
                  </div>
                  <span className="soft-chip">{item.ownerName}</span>
                  <span className="soft-chip">
                    {item.status === 'IN_PROGRESS' ? 'In progress' : 'Not started'}
                  </span>
                  <ArrowUpRight
                    size={15}
                    style={{ color: 'var(--muted)', marginLeft: 'auto', flexShrink: 0 }}
                  />
                </button>
              ))
            )}
          </div>
        </section>
      </div>
      <section className="panel recent-panel">
        <PanelHeader
          icon={<History size={17} />}
          title={t.recent}
          action={
            <button className="link-button" onClick={() => onOpenCase(cases?.[0]?.id ?? '')}>
              {t.viewAll}
              <ArrowUpRight size={14} />
            </button>
          }
        />
        <CaseTable cases={cases ?? []} onOpen={onOpenCase} />
      </section>
    </div>
  );
}
