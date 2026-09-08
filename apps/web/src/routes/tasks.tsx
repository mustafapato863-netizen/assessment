import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Clock3,
  FileCheck,
  Filter,
  Inbox,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { api } from '../lib/api';
import { copy, type Copy } from '../lib/labels';
import { LoadingRows, PageHeading, PanelHeader, StatusBadge } from '../components/ui';

type TaskFilter = 'ALL' | 'URGENT' | 'APPROVALS' | 'EVALUATIONS';

export function TasksPage({
  t: propT,
  onOpenCase: propOnOpenCase,
}: {
  t?: Copy;
  onOpenCase?: (id: string) => void;
} = {}) {
  const t = propT ?? copy;
  const navigate = useNavigate();
  const onOpenCase = propOnOpenCase ?? ((id: string) => navigate(`/cases/${id}`));

  const [activeFilter, setActiveFilter] = useState<TaskFilter>('ALL');

  const { data, isLoading } = useQuery({ queryKey: ['overview'], queryFn: api.overview });
  const { data: cases } = useQuery({ queryKey: ['cases'], queryFn: () => api.cases() });

  const allTasks = useMemo(() => data?.tasks ?? [], [data]);

  // Derive metrics
  const urgentCount = useMemo(
    () =>
      allTasks.filter(
        (task) =>
          task.priority === 'HIGH' ||
          task.dueLabel.toLowerCase().includes('today') ||
          task.dueLabel.toLowerCase().includes('hour'),
      ).length,
    [allTasks],
  );

  const approvalCount = useMemo(
    () =>
      allTasks.filter(
        (task) =>
          task.title.toLowerCase().includes('approval') ||
          task.title.toLowerCase().includes('sign') ||
          task.title.toLowerCase().includes('decision'),
      ).length,
    [allTasks],
  );

  const evaluationCount = useMemo(
    () =>
      allTasks.filter(
        (task) =>
          task.title.toLowerCase().includes('evidence') ||
          task.title.toLowerCase().includes('evaluat') ||
          task.title.toLowerCase().includes('rubric') ||
          task.title.toLowerCase().includes('interview'),
      ).length,
    [allTasks],
  );

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return allTasks.filter((task) => {
      if (activeFilter === 'URGENT') {
        return (
          task.priority === 'HIGH' ||
          task.dueLabel.toLowerCase().includes('today') ||
          task.dueLabel.toLowerCase().includes('hour')
        );
      }
      if (activeFilter === 'APPROVALS') {
        return (
          task.title.toLowerCase().includes('approval') ||
          task.title.toLowerCase().includes('sign') ||
          task.title.toLowerCase().includes('decision')
        );
      }
      if (activeFilter === 'EVALUATIONS') {
        return (
          task.title.toLowerCase().includes('evidence') ||
          task.title.toLowerCase().includes('evaluat') ||
          task.title.toLowerCase().includes('rubric') ||
          task.title.toLowerCase().includes('interview')
        );
      }
      return true;
    });
  }, [allTasks, activeFilter]);

  return (
    <>
      <PageHeading
        eyebrow="EXECUTIVE WORKSPACE"
        title={t.tasks ?? 'My Decision Queue & Tasks'}
        subtitle="Priority actions requiring your direct review, assessment grading, or stage-gate endorsement."
      />

      {/* Decision KPI Ribbon */}
      <div className="tasks-metrics-ribbon">
        <div className="tasks-metric-card">
          <div className="tasks-metric-icon all">
            <Inbox size={18} />
          </div>
          <div>
            <span className="tasks-metric-label">Open Decisions</span>
            <div className="tasks-metric-value">{allTasks.length}</div>
          </div>
        </div>

        <div className="tasks-metric-card urgent">
          <div className="tasks-metric-icon urgent">
            <AlertTriangle size={18} />
          </div>
          <div>
            <span className="tasks-metric-label">Critical SLA (&lt; 24h)</span>
            <div className="tasks-metric-value" style={{ color: '#dc2626' }}>
              {urgentCount}
            </div>
          </div>
        </div>

        <div className="tasks-metric-card">
          <div className="tasks-metric-icon approvals">
            <FileCheck size={18} />
          </div>
          <div>
            <span className="tasks-metric-label">Committee Approvals</span>
            <div className="tasks-metric-value">{approvalCount}</div>
          </div>
        </div>

        <div className="tasks-metric-card">
          <div className="tasks-metric-icon evaluations">
            <UserCheck size={18} />
          </div>
          <div>
            <span className="tasks-metric-label">Evaluations & Rubrics</span>
            <div className="tasks-metric-value">{evaluationCount}</div>
          </div>
        </div>
      </div>

      <section className="panel">
        <PanelHeader
          icon={<Inbox size={17} />}
          title="Actionable Queue"
          action={<span className="soft-count">{filteredTasks.length} active tasks</span>}
        />

        {/* Task Filter Tabs */}
        <div
          className="cases-filter-tabs-bar"
          style={{
            padding: '8px 16px',
            borderBottom: '1px solid var(--color-border-subtle, #e2e8f0)',
          }}
        >
          <div className="cases-tabs-group" role="tablist" aria-label="Filter tasks">
            <button
              role="tab"
              aria-selected={activeFilter === 'ALL'}
              className={`cases-tab-btn ${activeFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setActiveFilter('ALL')}
            >
              All Actions <span className="tab-count-badge">{allTasks.length}</span>
            </button>
            <button
              role="tab"
              aria-selected={activeFilter === 'URGENT'}
              className={`cases-tab-btn ${activeFilter === 'URGENT' ? 'active' : ''}`}
              onClick={() => setActiveFilter('URGENT')}
            >
              Critical SLAs <span className="tab-count-badge">{urgentCount}</span>
            </button>
            <button
              role="tab"
              aria-selected={activeFilter === 'APPROVALS'}
              className={`cases-tab-btn ${activeFilter === 'APPROVALS' ? 'active' : ''}`}
              onClick={() => setActiveFilter('APPROVALS')}
            >
              Approvals <span className="tab-count-badge">{approvalCount}</span>
            </button>
            <button
              role="tab"
              aria-selected={activeFilter === 'EVALUATIONS'}
              className={`cases-tab-btn ${activeFilter === 'EVALUATIONS' ? 'active' : ''}`}
              onClick={() => setActiveFilter('EVALUATIONS')}
            >
              Evaluations <span className="tab-count-badge">{evaluationCount}</span>
            </button>
          </div>
        </div>

        {isLoading ? (
          <LoadingRows />
        ) : filteredTasks.length === 0 ? (
          <div className="empty-state" style={{ padding: '48px 16px', textAlign: 'center' }}>
            <CheckCircle2 size={24} style={{ color: '#16a34a', marginBottom: '8px' }} />
            <strong style={{ display: 'block', fontSize: '15px' }}>All caught up!</strong>
            <p
              style={{
                color: 'var(--color-text-muted, #64748b)',
                fontSize: '13px',
                margin: '4px 0 0',
              }}
            >
              No outstanding action items in this queue. Great job!
            </p>
          </div>
        ) : (
          <div className="task-list large-task-list">
            {filteredTasks.map((task) => {
              const match = cases?.find((item) => item.caseCode === task.caseCode);
              const isUrgent =
                task.priority === 'HIGH' ||
                task.dueLabel.toLowerCase().includes('today') ||
                task.dueLabel.toLowerCase().includes('hour');

              return (
                <div
                  className="task-row task-row-large task-card-interactive"
                  key={task.id}
                  onClick={() => match && onOpenCase(match.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      match && onOpenCase(match.id);
                    }
                  }}
                >
                  <div className={`task-icon ${task.priority.toLowerCase()}`}>
                    {isUrgent ? <AlertTriangle size={17} /> : <Clock3 size={17} />}
                  </div>
                  <div className="task-content">
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <strong style={{ fontSize: '14px' }}>{task.title}</strong>
                      {isUrgent && (
                        <span
                          className="status-badge"
                          style={{
                            background: '#fef2f2',
                            color: '#991b1b',
                            borderColor: '#fecaca',
                            fontSize: '11px',
                            padding: '1px 6px',
                          }}
                        >
                          Urgent SLA
                        </span>
                      )}
                    </div>
                    <span
                      style={{
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'center',
                        marginTop: '2px',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontWeight: 600,
                          color: 'var(--color-primary, #4f46e5)',
                        }}
                      >
                        {task.caseCode}
                      </span>
                      {match && (
                        <span>
                          · {match.employeeName} ({match.department})
                        </span>
                      )}
                      <span>· {task.dueLabel}</span>
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <StatusBadge
                      status={task.priority === 'HIGH' ? 'PENDING_ELIGIBILITY' : 'PENDING_APPROVAL'}
                    />
                    <button
                      className="primary-button"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        match && onOpenCase(match.id);
                      }}
                    >
                      Action Case
                      <ArrowUpRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
