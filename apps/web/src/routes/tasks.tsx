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
import { CaseCodeDisplay, LoadingRows, PageHeading, PanelHeader, StatusBadge } from '../components/ui';
import { sortPriorityActionCases } from './overview-utils';

type TaskFilter = 'ALL' | 'URGENT' | 'APPROVALS' | 'EVALUATIONS';
type QueueTask = {
  title: string;
  caseCode: string;
  dueLabel: string;
  dueAt?: string | null;
  taskType?: string;
  priority: 'HIGH' | 'NORMAL' | 'LOW';
};

const DAY_MS = 86_400_000;

function getDueTime(task: QueueTask): number | null {
  if (!task.dueAt) return null;
  const dueTime = Date.parse(task.dueAt);
  return Number.isFinite(dueTime) ? dueTime : null;
}

function isUrgentTask(task: QueueTask, now = Date.now()) {
  const dueTime = getDueTime(task);
  return dueTime !== null && dueTime > now && dueTime - now <= DAY_MS;
}

function getTaskDueDetails(tasks: QueueTask[], now = Date.now()) {
  const dueTimes = tasks.map(getDueTime).filter((value): value is number => value !== null);
  const earliestDueTime = dueTimes.length ? Math.min(...dueTimes) : null;
  if (earliestDueTime === null) return { label: 'No due date', overdue: false, urgent: false };

  if (earliestDueTime <= now) {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(earliestDueTime);
    dueDate.setHours(0, 0, 0, 0);
    const daysOverdue = Math.max(1, Math.floor((today.getTime() - dueDate.getTime()) / DAY_MS));
    return { label: `Overdue · ${daysOverdue}d`, overdue: true, urgent: false };
  }

  if (earliestDueTime - now <= DAY_MS) {
    return { label: 'Due within 24h', overdue: false, urgent: true };
  }

  const dueTask = tasks.find((task) => getDueTime(task) === earliestDueTime);
  return { label: dueTask?.dueLabel ?? 'Scheduled', overdue: false, urgent: false };
}

function getTaskActionLabel(task: QueueTask): string {
  const type = task.taskType?.toUpperCase() ?? '';
  if (type.includes('EVENT_SCHEDULING')) return 'Schedule Event';
  if (type.includes('REASSESSMENT')) return 'Schedule Reassessment';
  if (type.includes('PLAN')) return 'Finalize Plan';
  if (type.includes('ELIGIBILITY')) return 'Review Eligibility';
  if (type.includes('RECOMMENDATION')) return 'Submit Recommendation';
  if (type.includes('RESULT')) return 'Finalize Result';
  if (type.includes('APPROVAL') || type.includes('DECIDE')) return 'Review Approval';
  if (type.includes('ASSESSMENT')) return 'Submit Evidence';
  if (type.includes('DEVELOPMENT')) return 'Update Follow-up';

  const title = task.title.toLowerCase();
  if (title.includes('event')) return 'Schedule Event';
  if (title.includes('reassessment')) return 'Schedule Reassessment';
  if (title.includes('plan')) return 'Finalize Plan';
  if (title.includes('eligibility')) return 'Review Eligibility';
  if (title.includes('recommendation')) return 'Submit Recommendation';
  if (title.includes('result')) return 'Finalize Result';
  if (title.includes('approval') || title.includes('decision')) return 'Review Approval';
  if (title.includes('assessment')) return 'Complete Assessment';
  return 'Review Case';
}

function getTaskDescription(task: QueueTask, employeeName: string): string {
  const employeeSuffix = ` for ${employeeName}`;
  const title = task.title.toLowerCase().endsWith(employeeSuffix.toLowerCase())
    ? task.title.slice(0, -employeeSuffix.length).trim()
    : task.title.trim();
  return title ? `${title.charAt(0).toUpperCase()}${title.slice(1)}` : 'Review case';
}

function taskMatchesFilter(task: QueueTask, filter: TaskFilter) {
  if (filter === 'ALL') return true;
  if (filter === 'URGENT') return isUrgentTask(task);
  const title = task.title.toLowerCase();
  if (filter === 'APPROVALS') {
    return title.includes('approval') || title.includes('sign') || title.includes('decision');
  }
  return (
    title.includes('evidence') ||
    title.includes('evaluat') ||
    title.includes('rubric') ||
    title.includes('interview')
  );
}

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

  const { data, isLoading: tasksLoading } = useQuery({ queryKey: ['overview'], queryFn: api.overview });
  const { data: cases, isLoading: casesLoading } = useQuery({
    queryKey: ['cases'],
    queryFn: () => api.cases(),
  });
  const isLoading = tasksLoading || casesLoading;

  const allTasks = useMemo(() => data?.tasks ?? [], [data]);

  // Derive metrics
  const caseIdsByCode = useMemo(
    () => new Map((cases ?? []).map((item) => [item.caseCode, item.id])),
    [cases],
  );
  const casesForFilter = useMemo(() => {
    const casesFor = (filter: TaskFilter) => {
      const caseIds = new Set(
        allTasks
          .filter((task) => taskMatchesFilter(task, filter))
          .map((task) => caseIdsByCode.get(task.caseCode))
          .filter((id): id is string => Boolean(id)),
      );
      return (cases ?? []).filter((item) => caseIds.has(item.id));
    };
    return {
      ALL: casesFor('ALL'),
      URGENT: casesFor('URGENT'),
      APPROVALS: casesFor('APPROVALS'),
      EVALUATIONS: casesFor('EVALUATIONS'),
    };
  }, [allTasks, cases, caseIdsByCode]);
  const urgentCount = casesForFilter.URGENT.length;
  const approvalCount = casesForFilter.APPROVALS.length;
  const evaluationCount = casesForFilter.EVALUATIONS.length;

  const filteredTasks = useMemo(() => {
    return allTasks.filter((task) => taskMatchesFilter(task, activeFilter));
  }, [allTasks, activeFilter]);
  const filteredCases = casesForFilter[activeFilter];

  return (
    <>
      <PageHeading
        eyebrow="ASSESSMENT WORKSPACE"
        title={t.tasks ?? 'My Decision Queue & Tasks'}
        subtitle="Review open actions by urgency, approval, or evaluation; select a case to continue its workflow."
      />

      {/* Decision KPI Ribbon */}
      <div className="tasks-metrics-ribbon">
        <button
          type="button"
          className={`tasks-metric-card ${activeFilter === 'ALL' ? 'selected' : ''}`}
          aria-pressed={activeFilter === 'ALL'}
          aria-controls="actionable-queue"
          onClick={() => setActiveFilter('ALL')}
        >
          <div className="tasks-metric-icon all">
            <Inbox size={18} />
          </div>
          <div>
            <span className="tasks-metric-label">Cases with Open Actions</span>
            <div className="tasks-metric-value">{casesForFilter.ALL.length}</div>
          </div>
        </button>

        <button
          type="button"
          className={`tasks-metric-card urgent ${activeFilter === 'URGENT' ? 'selected' : ''}`}
          aria-pressed={activeFilter === 'URGENT'}
          aria-controls="actionable-queue"
          onClick={() => setActiveFilter('URGENT')}
        >
          <div className="tasks-metric-icon urgent">
            <AlertTriangle size={18} />
          </div>
          <div>
            <span className="tasks-metric-label">Due within 24h</span>
            <div className="tasks-metric-value" style={{ color: '#dc2626' }}>
              {urgentCount}
            </div>
          </div>
        </button>

        <button
          type="button"
          className={`tasks-metric-card ${activeFilter === 'APPROVALS' ? 'selected' : ''}`}
          aria-pressed={activeFilter === 'APPROVALS'}
          aria-controls="actionable-queue"
          onClick={() => setActiveFilter('APPROVALS')}
        >
          <div className="tasks-metric-icon approvals">
            <FileCheck size={18} />
          </div>
          <div>
            <span className="tasks-metric-label">Committee Approvals</span>
            <div className="tasks-metric-value">{approvalCount}</div>
          </div>
        </button>

        <button
          type="button"
          className={`tasks-metric-card ${activeFilter === 'EVALUATIONS' ? 'selected' : ''}`}
          aria-pressed={activeFilter === 'EVALUATIONS'}
          aria-controls="actionable-queue"
          onClick={() => setActiveFilter('EVALUATIONS')}
        >
          <div className="tasks-metric-icon evaluations">
            <UserCheck size={18} />
          </div>
          <div>
            <span className="tasks-metric-label">Evaluations & Rubrics</span>
            <div className="tasks-metric-value">{evaluationCount}</div>
          </div>
        </button>
      </div>

      <section className="panel" id="actionable-queue">
        <PanelHeader
          icon={<Inbox size={17} />}
          title="Cases in Actionable Queue"
          action={<span className="soft-count">{filteredCases.length} cases · {filteredTasks.length} open tasks</span>}
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
              All Cases <span className="tab-count-badge">{casesForFilter.ALL.length}</span>
            </button>
            <button
              role="tab"
              aria-selected={activeFilter === 'URGENT'}
              className={`cases-tab-btn ${activeFilter === 'URGENT' ? 'active' : ''}`}
              onClick={() => setActiveFilter('URGENT')}
            >
              Due within 24h <span className="tab-count-badge">{urgentCount}</span>
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
        ) : filteredCases.length === 0 ? (
          <div className="empty-state" style={{ padding: '48px 16px', textAlign: 'center' }}>
            <CheckCircle2 size={24} style={{ color: '#16a34a', marginBottom: '8px' }} />
            <strong style={{ display: 'block', fontSize: '15px' }}>No cases in this queue</strong>
            <p
              style={{
                color: 'var(--color-text-muted, #64748b)',
                fontSize: '13px',
                margin: '4px 0 0',
              }}
            >
              No linked cases match this action filter.
            </p>
          </div>
        ) : (
          <div className="task-list large-task-list">
            {sortPriorityActionCases(
              filteredCases.map((caseItem) => {
                const caseTasks = filteredTasks.filter((task) => task.caseCode === caseItem.caseCode);
                const dueDetails = getTaskDueDetails(caseTasks);
                const dueTimes = caseTasks.map(getDueTime).filter((value): value is number => value !== null);
                const earliestDueTime = dueTimes.length ? Math.min(...dueTimes) : null;
                return {
                  caseItem,
                  caseTasks,
                  dueDetails,
                  slaBreachRisk: dueDetails.overdue || dueDetails.urgent,
                  daysRemaining: earliestDueTime === null
                    ? Number.MAX_SAFE_INTEGER
                    : (earliestDueTime - Date.now()) / DAY_MS,
                  stage: caseItem.stage,
                  requestedAt: caseItem.requestedAt,
                };
              }),
            ).map(({ caseItem, caseTasks, dueDetails }) => {
              const urgencyTask = caseTasks.some(isUrgentTask);
              const isUrgent = dueDetails.overdue || urgencyTask;
              const taskAction = caseTasks.map(getTaskActionLabel).find((label) => label !== 'Review Case')
                ?? getTaskActionLabel({ title: '', caseCode: caseItem.caseCode, dueLabel: 'No due date', priority: 'NORMAL' });
              const taskDescriptions = [...new Set(caseTasks.map((task) => getTaskDescription(task, caseItem.employeeName)))];
              return (
                <div
                  className="task-row task-row-large task-card-interactive"
                  key={caseItem.id}
                  onClick={() => onOpenCase(caseItem.id)}
                >
                  <div className={`task-icon ${isUrgent ? 'high' : 'normal'}`}>
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
                      <strong style={{ fontSize: '14px' }}>
                        <button type="button" className="task-row-open">
                          {caseItem.employeeName}
                        </button>
                      </strong>
                      <span style={{ color: 'var(--secondary)', fontSize: '12px' }}>
                        {caseItem.targetRole}
                      </span>
                      {(dueDetails.overdue || urgencyTask) && (
                        <span
                          className="status-badge"
                          style={{
                            background: dueDetails.overdue ? '#fef2f2' : '#fff7ed',
                            color: dueDetails.overdue ? '#991b1b' : '#9a3412',
                            borderColor: dueDetails.overdue ? '#fecaca' : '#fed7aa',
                          }}
                        >
                          {dueDetails.label}
                        </span>
                      )}
                    </div>
                    <span className="tasks-case-metadata">
                      <CaseCodeDisplay caseCode={caseItem.caseCode} />
                      <span>· {caseItem.department}</span>
                      <span>· {caseItem.stage}</span>
                      {!dueDetails.overdue && <span>· {dueDetails.label}</span>}
                    </span>
                    <small style={{ color: 'var(--secondary)', display: 'block', marginTop: '4px' }}>
                      {taskDescriptions.join(' · ')}
                    </small>
                  </div>

                  <div className="tasks-row-actions">
                    <div className="tasks-row-status">
                      <StatusBadge status={caseItem.status} />
                    </div>
                    <button
                      className="primary-button tasks-row-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenCase(caseItem.id);
                      }}
                    >
                      {taskAction}
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
