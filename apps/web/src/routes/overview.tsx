import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  History,
  ListTodo,
  MoreHorizontal,
  Plus,
  RotateCcw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { api } from '../lib/api';
import { getSession, subscribeToAuth, type AppUser } from '../lib/auth';
import { copy, statusLabels, type Copy } from '../lib/labels';
import {
  CaseTable,
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

function parseDaysInStatus(item: { requestedAt?: string; ageLabel?: string }): number {
  if (item.ageLabel) {
    const dMatch = item.ageLabel.match(/(\d+)\s*d/i);
    if (dMatch && dMatch[1]) return parseInt(dMatch[1], 10);
    const wMatch = item.ageLabel.match(/(\d+)\s*w/i);
    if (wMatch && wMatch[1]) return parseInt(wMatch[1], 10) * 7;
    const mMatch = item.ageLabel.match(/(\d+)\s*m/i);
    if (mMatch && mMatch[1]) return parseInt(mMatch[1], 10) * 30;
  }
  if (item.requestedAt) {
    const t = new Date(item.requestedAt).getTime();
    if (!isNaN(t)) {
      return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
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

  const openCases = useMemo(() => {
    return (cases ?? []).filter((c) => c.status !== 'CLOSED' && c.status !== 'CANCELLED');
  }, [cases]);

  const slaBreachCases = useMemo(() => {
    return openCases.filter((c) => parseDaysInStatus(c) > 14);
  }, [openCases]);

  const bottleneck = useMemo(() => {
    if (!openCases.length) return null;
    const stageCounts: Record<string, number> = {};
    for (const c of openCases) {
      stageCounts[c.stage] = (stageCounts[c.stage] ?? 0) + 1;
    }
    let maxStage = '';
    let maxCount = 0;
    for (const [stage, count] of Object.entries(stageCounts)) {
      if (count > maxCount) {
        maxCount = count;
        maxStage = stage;
      }
    }
    if (!maxStage || maxCount === 0) return null;
    return {
      stage: stageDisplayMap[maxStage] ?? maxStage,
      count: maxCount,
    };
  }, [openCases]);

  const myDecisionsCount = useMemo(() => {
    if (cases && cases.length > 0) {
      const decisionCases = cases.filter((c) => {
        const isDecisionStatus = [
          'PENDING_ELIGIBILITY',
          'PENDING_APPROVAL',
          'PENDING_RECOMMENDATION',
          'PENDING_RESULT',
        ].includes(c.status);
        const hasDecisionAction = c.availableActions?.some((a) =>
          [
            'DECIDE_ELIGIBILITY',
            'DECIDE_APPROVAL',
            'SUBMIT_RECOMMENDATION',
            'FINALIZE_RESULT',
          ].includes(a.code),
        );
        return isDecisionStatus || hasDecisionAction;
      });
      return decisionCases.length;
    }
    return data?.tasks?.length ?? 0;
  }, [cases, data]);

  const devInProgressCases = useMemo(() => {
    return (cases ?? []).filter((c) => c.status === 'DEVELOPMENT_IN_PROGRESS').slice(0, 20);
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

    const now = Date.now();

    devInProgressCases.forEach((c, index) => {
      const plan = devPlanQueries[index]?.data;
      if (!plan?.actions) return;

      for (const act of plan.actions) {
        if (act.status === 'COMPLETED') continue;
        const effectiveDueDate = act.dueDate || plan.targetDate;
        if (!effectiveDueDate) continue;

        const dueTime = new Date(effectiveDueDate).getTime();
        if (isNaN(dueTime)) continue;

        const diffDays = Math.ceil((dueTime - now) / 86_400_000);
        if (diffDays <= 14) {
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
    return openCases.slice(0, 6).map((c) => {
      let actionName = 'Review Case';
      let actionUrgent = false;
      let slaText = 'On track';
      const days = parseDaysInStatus(c);

      switch (c.status) {
        case 'PENDING_ELIGIBILITY':
          actionName = 'Review Eligibility';
          actionUrgent = true;
          slaText = `${Math.max(1, 3 - days)}d left`;
          break;
        case 'READY_FOR_PLANNING':
        case 'PLANNING':
          actionName = 'Finalize Plan';
          actionUrgent = false;
          slaText = `${Math.max(1, 5 - days)}d left`;
          break;
        case 'SCHEDULED':
          actionName = 'Schedule Event';
          actionUrgent = false;
          slaText = `${Math.max(1, 7 - days)}d left`;
          break;
        case 'IN_PROGRESS':
          actionName = 'Submit Evidence';
          actionUrgent = true;
          slaText = `${Math.max(1, 4 - days)}d left`;
          break;
        case 'PENDING_RESULT':
          actionName = 'Finalize Result';
          actionUrgent = true;
          slaText = `${Math.max(1, 3 - days)}d left`;
          break;
        case 'RESULT_FINALIZED':
        case 'PENDING_RECOMMENDATION':
          actionName = 'Submit Recommendation';
          actionUrgent = false;
          slaText = `${Math.max(1, 5 - days)}d left`;
          break;
        case 'PENDING_APPROVAL':
          actionName = 'Decide Approval';
          actionUrgent = true;
          slaText = `${Math.max(1, 2 - days)}d left (Urgent)`;
          break;
        case 'APPROVED':
        case 'DEVELOPMENT_IN_PROGRESS':
        case 'REASSESSMENT_DUE':
          actionName = 'Track Milestones';
          actionUrgent = false;
          slaText = 'Active Cycle';
          break;
        default:
          actionName = 'View Case';
          actionUrgent = false;
          slaText = 'Active';
      }

      if (days > 14) {
        actionUrgent = true;
        slaText = `SLA Breach (~${days}d)`;
      }

      return {
        ...c,
        actionName,
        actionUrgent,
        slaText,
      };
    });
  }, [openCases]);

  const dynamicSubtitle = useMemo(() => {
    switch (activeUser?.role) {
      case 'ASSESSOR':
        return 'Candidate evaluations, behavioral rubrics, and scorecard milestones awaiting your scoring.';
      case 'APPROVER':
        return 'Executive review dashboard: cross-department calibration cases awaiting promotion sign-off.';
      case 'DEV_LEAD':
        return 'Talent growth tracking: 30-60-90 day development plans and post-assessment coaching.';
      case 'SYS_ADMIN':
        return 'Governance & Security: PostgreSQL 18 live telemetry, transactional outbox status, and audit logs.';
      default:
        return t.subtitle;
    }
  }, [activeUser?.role, t.subtitle]);

  return (
    <>
      <PageHeading
        eyebrow="ASSESSMENT WORKSPACE"
        title={`Welcome, ${getGreetingName(activeUser?.name ?? 'User')}`}
        subtitle={dynamicSubtitle}
        action={
          <button className="primary-button" onClick={onNew}>
            <Plus size={17} />
            {t.newRequest}
          </button>
        }
      />

      {/* Signed-in user context banner */}
      {activeUser && (
        <div className="persona-context-banner" role="status">
          <div className="persona-context-left">
            <div
              className={`avatar ${activeUser.avatarColor}`}
              style={{ width: '32px', height: '32px', fontSize: '12px' }}
            >
              {activeUser.avatarInitials}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong>{activeUser.name}</strong>
                <span className="persona-role-chip">{activeUser.roleTitle}</span>
              </div>
              <small style={{ color: 'var(--secondary)', fontSize: '11px' }}>
                {activeUser.department}
              </small>
            </div>
          </div>
        </div>
      )}
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
          : data?.metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
      </section>

      {/* Priority Action Queue */}
      {priorityActionCases.length > 0 && (
        <section className="panel action-queue-section" aria-label="Priority action queue">
          <div className="action-queue-header">
            <h3>
              <Sparkles size={16} style={{ color: 'var(--indigo)' }} />
              Priority Action Queue
              <span className="policy-chip" style={{ fontSize: '11px', fontWeight: 700 }}>
                {priorityActionCases.length} awaiting action
              </span>
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
              Direct access to cases requiring review or governance decisions
            </span>
          </div>
          <div className="action-queue-grid">
            {priorityActionCases.map((item) => (
              <div
                key={item.id}
                className={`action-queue-card ${item.actionUrgent ? 'urgent' : ''}`}
              >
                <div>
                  <div className="action-queue-card-top">
                    <span className="action-queue-card-meta">
                      {item.caseCode} · {item.department}
                    </span>
                    <span
                      className={`status-badge ${item.actionUrgent ? 'danger' : 'neutral'}`}
                      style={{ fontSize: '10px' }}
                    >
                      {statusLabels[item.status] ?? item.status}
                    </span>
                  </div>
                  <div className="action-queue-candidate">{item.employeeName}</div>
                  <div className="action-queue-role">
                    {item.currentRole} <span className="muted-separator">→</span> {item.targetRole}{' '}
                    ({item.targetLevel})
                  </div>
                </div>
                <div className="action-queue-card-footer">
                  <span className={`action-queue-sla ${item.actionUrgent ? 'at-risk' : ''}`}>
                    <Clock3 size={12} />
                    {item.slaText}
                  </span>
                  <button
                    type="button"
                    className="action-queue-btn"
                    onClick={() => onOpenCase(item.id)}
                  >
                    {item.actionName}
                    <ArrowUpRight size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="content-grid dashboard-grid">
        <section className="panel task-panel">
          <PanelHeader
            icon={<ListTodo size={17} />}
            title={t.attention}
            action={
              <button className="link-button" onClick={() => onOpenCase(cases?.[0]?.id ?? '')}>
                {t.viewAll}
                <ArrowUpRight size={14} />
              </button>
            }
          />

          {isLoading ? (
            <div
              className="skeleton-line"
              style={{ height: '64px', borderRadius: '10px', marginBottom: '14px' }}
            />
          ) : (
            <div className="risk-hub" aria-label="Risk and attention overview">
              <div className="risk-hub-header">
                <div className="risk-stat-item">
                  <AlertTriangle size={14} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                  <span>
                    Bottleneck stage:{' '}
                    <strong>
                      {bottleneck
                        ? `${bottleneck.stage} (${bottleneck.count} open)`
                        : 'No bottleneck'}
                    </strong>
                  </span>
                </div>
                <div className="risk-stat-item">
                  <ListTodo size={14} style={{ color: 'var(--indigo)', flexShrink: 0 }} />
                  <span>
                    My decisions:{' '}
                    <strong>
                      {myDecisionsCount}{' '}
                      {myDecisionsCount === 1 ? 'action pending' : 'actions pending'}
                    </strong>
                  </span>
                </div>
              </div>
              <div className="risk-hub-header">
                <span className="risk-stat-item" style={{ fontSize: '11px' }}>
                  <Clock3 size={13} style={{ color: 'var(--secondary)' }} />
                  SLA breach risk (&gt;14d in status, estimated):
                </span>
                {slaBreachCases.length === 0 ? (
                  <div className="sla-clean-note">
                    <CheckCircle2 size={13} />
                    <span>0 cases at risk (all &le;14d est.)</span>
                  </div>
                ) : (
                  <div className="sla-chip-list">
                    {slaBreachCases.map((item) => {
                      const days = parseDaysInStatus(item);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className="sla-chip"
                          onClick={() => onOpenCase(item.id)}
                          title={`Open ${item.caseCode} (${item.employeeName}) - estimated ~${days} days in status`}
                        >
                          <AlertTriangle size={12} />
                          <b>{item.caseCode}</b>
                          <span>{statusLabels[item.status] ?? item.status}</span>
                          <small>~{days}d est.</small>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="task-list">
            {data?.tasks && data.tasks.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 12px' }}>
                <CheckCircle2 size={20} style={{ color: 'var(--success)' }} />
                <strong>No pending tasks</strong>
                <span>Your queue is clear. No urgent action items currently assigned.</span>
              </div>
            ) : (
              data?.tasks.map((task) => (
                <button
                  className="task-row"
                  key={task.id}
                  onClick={() => {
                    const match = cases?.find((item) => item.caseCode === task.caseCode);
                    if (match) onOpenCase(match.id);
                  }}
                >
                  <div className={`priority-dot ${task.priority.toLowerCase()}`} />
                  <div className="task-content">
                    <strong>{task.title}</strong>
                    <span>
                      {task.caseCode} · {task.dueLabel}
                    </span>
                  </div>
                  <MoreHorizontal size={17} />
                </button>
              ))
            )}
          </div>
        </section>
        <section className="panel pipeline-panel">
          <PanelHeader
            icon={<BarChart3 size={17} />}
            title={t.pipeline}
            action={
              <button className="filter-button">
                <CalendarDays size={14} />
                FY26 <ChevronDown size={14} />
              </button>
            }
          />
          <div className="pipeline-list">
            {data?.pipeline.map((item) => (
              <div className="pipeline-row" key={item.label}>
                <div className="pipeline-label">
                  <span>{item.label}</span>
                  <b>{item.value}</b>
                </div>
                <div className="pipeline-bar">
                  <i className={item.tone} style={{ width: `${Math.max(item.value * 26, 12)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="pipeline-note">
            <Sparkles size={15} />
            <span>Eligibility is the next decision gate for your current queue.</span>
          </div>
        </section>
      </div>
      <section className="panel growth-followups-panel" aria-label="Growth follow-ups">
        <PanelHeader
          icon={<Sparkles size={17} />}
          title="Growth follow-ups"
          action={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="soft-count">
                {followUpActions.length} {followUpActions.length === 1 ? 'action' : 'actions'} due
                (&le;14d)
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
            <div className="empty-state" style={{ padding: '24px 12px' }}>
              <CheckCircle2 size={20} style={{ color: 'var(--success)' }} />
              <strong>No upcoming growth follow-ups</strong>
              <span>
                All development actions are on track. No items due within the next 14 days.
              </span>
            </div>
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
                    {item.caseCode} · {item.employeeName}
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
    </>
  );
}
