import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  FileText,
  ListTodo,
  LoaderCircle,
  Plus,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { api } from '../lib/api';
import { copy, type Copy } from '../lib/labels';
import {
  CaseTable,
  ErrorBanner,
  InlineError,
  LoadingRows,
  PageHeading,
  PanelHeader,
} from '../components/ui';
import type {
  AssessmentCaseSummary,
  ScheduleReassessmentInput,
  UpdateDevelopmentInput,
} from '@assessflow/contracts';

export interface DevelopmentActionItem {
  id?: string;
  planId?: string;
  title: string;
  ownerName: string;
  dueDate?: string | null;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  evidenceNote?: string | null;
}

export interface DevelopmentPlanData {
  id?: string;
  caseId?: string;
  ownerName?: string;
  targetDate?: string | null;
  status?: string;
  actions?: DevelopmentActionItem[];
}

function ReassessmentPromptCard({
  caseItem,
  diffDays,
  targetDate,
  onOpenCase,
}: {
  caseItem: AssessmentCaseSummary;
  plan: DevelopmentPlanData;
  diffDays: number;
  targetDate: string;
  onOpenCase: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [linkedCase, setLinkedCase] = useState<{ id: string; caseCode: string } | null>(null);

  const scheduleReassessment = useMutation({
    mutationFn: (input: ScheduleReassessmentInput) => api.scheduleReassessment(caseItem.id, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['case', caseItem.id] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      setLinkedCase({ id: data.id, caseCode: data.caseCode });
      setReason('');
    },
  });

  const formattedDate = new Date(targetDate).toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      className="reassessment-prompt-card"
      role="region"
      aria-label={`Reassessment prompt for ${caseItem.caseCode}`}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle
            size={16}
            style={{ color: diffDays < 0 ? 'var(--danger)' : '#d97706', flexShrink: 0 }}
          />
          <strong>
            {caseItem.caseCode} · {caseItem.employeeName}
          </strong>
          <span className="soft-chip">{caseItem.department}</span>
        </div>
        <div className={`due-badge ${diffDays < 0 ? 'overdue' : 'urgent'}`}>
          <Clock3 size={12} />
          <span>
            {diffDays < 0
              ? `Target overdue (${Math.abs(diffDays)}d) · ${formattedDate}`
              : diffDays === 0
                ? `Target due today · ${formattedDate}`
                : `Target due in ${diffDays}d · ${formattedDate}`}
          </span>
        </div>
      </div>

      {linkedCase ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            paddingTop: '4px',
          }}
        >
          <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
          <span style={{ fontSize: '12px', fontWeight: 600 }}>Reassessment scheduled:</span>
          <button
            type="button"
            className="linked-case-chip"
            onClick={() => onOpenCase(linkedCase.id)}
            title={`Open reassessment case ${linkedCase.caseCode}`}
          >
            <ArrowUpRight size={13} />
            Case {linkedCase.caseCode}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--secondary)' }}>
            Target date has arrived or is approaching within 30 days. Provide a justification to
            schedule the reassessment cycle.
          </p>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '240px' }}>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for reassessment (minimum 10 characters)…"
                disabled={scheduleReassessment.isPending}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  fontSize: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: '#fff',
                }}
              />
              <small
                style={{
                  fontSize: '10px',
                  color: reason.trim().length < 10 ? 'var(--muted)' : 'var(--success)',
                  display: 'block',
                  marginTop: '3px',
                }}
              >
                {reason.trim().length} / 10 characters minimum
              </small>
            </div>
            <button
              type="button"
              className="primary-button"
              style={{ minHeight: '34px', fontSize: '12px' }}
              disabled={scheduleReassessment.isPending || reason.trim().length < 10}
              onClick={() =>
                scheduleReassessment.mutate({
                  reason: reason.trim(),
                  expectedVersion: caseItem.version,
                })
              }
            >
              {scheduleReassessment.isPending ? (
                <LoaderCircle className="spin" size={14} />
              ) : (
                <RotateCcw size={14} />
              )}
              Schedule reassessment
            </button>
          </div>
          {scheduleReassessment.isError && <InlineError error={scheduleReassessment.error} />}
        </div>
      )}
    </div>
  );
}

function PlanCard({
  caseItem,
  isSelected,
  onOpenCase,
}: {
  caseItem: AssessmentCaseSummary;
  isSelected: boolean;
  onOpenCase: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState('');
  const [newOwner, setNewOwner] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [editingNoteIdx, setEditingNoteIdx] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  const { data: plan, isLoading: isPlanLoading } = useQuery({
    queryKey: ['development', caseItem.id],
    queryFn: () => api.getDevelopment<DevelopmentPlanData>(caseItem.id).catch(() => null),
    staleTime: 30_000,
  });

  const updateDev = useMutation({
    mutationFn: (input: UpdateDevelopmentInput) => api.updateDevelopment(caseItem.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development', caseItem.id] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['case', caseItem.id] });
    },
  });

  const actions = useMemo(() => plan?.actions ?? [], [plan?.actions]);
  const total = actions.length;
  const completed = useMemo(
    () => actions.filter((a) => a.status === 'COMPLETED').length,
    [actions],
  );
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const now = Date.now();

  const handleStatusChange = (
    actionIndex: number,
    nextStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED',
  ) => {
    const updated = actions.map((a, i) => ({
      title: a.title,
      ownerName: a.ownerName,
      dueDate: a.dueDate ? new Date(a.dueDate).toISOString() : undefined,
      status:
        i === actionIndex
          ? nextStatus
          : ((a.status as 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED') ?? 'NOT_STARTED'),
      evidenceNote: a.evidenceNote || undefined,
    }));
    updateDev.mutate({
      actions: updated,
      targetDate: plan?.targetDate ? new Date(plan.targetDate).toISOString() : undefined,
      expectedVersion: caseItem.version,
    });
  };

  const handleSaveNote = (actionIndex: number) => {
    const updated = actions.map((a, i) => ({
      title: a.title,
      ownerName: a.ownerName,
      dueDate: a.dueDate ? new Date(a.dueDate).toISOString() : undefined,
      status: (a.status as 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED') ?? 'NOT_STARTED',
      evidenceNote: i === actionIndex ? noteDraft.trim() || undefined : a.evidenceNote || undefined,
    }));
    updateDev.mutate(
      {
        actions: updated,
        targetDate: plan?.targetDate ? new Date(plan.targetDate).toISOString() : undefined,
        expectedVersion: caseItem.version,
      },
      {
        onSuccess: () => setEditingNoteIdx(null),
      },
    );
  };

  const handleAddAction = () => {
    if (newTitle.trim().length < 3 || newOwner.trim().length < 2) return;
    const currentActions = actions.map((a) => ({
      title: a.title,
      ownerName: a.ownerName,
      dueDate: a.dueDate ? new Date(a.dueDate).toISOString() : undefined,
      status: (a.status as 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED') ?? 'NOT_STARTED',
      evidenceNote: a.evidenceNote || undefined,
    }));

    updateDev.mutate(
      {
        actions: [
          ...currentActions,
          {
            title: newTitle.trim(),
            ownerName: newOwner.trim(),
            dueDate: newDueDate ? new Date(newDueDate).toISOString() : undefined,
            status: 'NOT_STARTED',
          },
        ],
        targetDate: plan?.targetDate ? new Date(plan.targetDate).toISOString() : undefined,
        expectedVersion: caseItem.version,
      },
      {
        onSuccess: () => {
          setNewTitle('');
          setNewOwner('');
          setNewDueDate('');
        },
      },
    );
  };

  return (
    <section
      id={`case-plan-${caseItem.id}`}
      className={`panel ${isSelected ? 'plan-card-highlighted' : ''}`}
      style={{ marginBottom: '24px', padding: '18px' }}
      aria-label={`Development plan for ${caseItem.caseCode}`}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '14px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} style={{ color: 'var(--violet)' }} />
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
              {caseItem.caseCode} · {caseItem.employeeName}
            </h2>
            <span className="soft-chip">{caseItem.department}</span>
          </div>
          <span
            style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px', display: 'block' }}
          >
            Target role: <strong>{caseItem.targetRole}</strong> ({caseItem.targetLevel})
            {plan?.targetDate && (
              <>
                {' '}
                · Target completion:{' '}
                <strong>
                  {new Date(plan.targetDate).toLocaleDateString('en', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </strong>
              </>
            )}
          </span>
        </div>
        <button type="button" className="link-button" onClick={() => onOpenCase(caseItem.id)}>
          Open case
          <ArrowUpRight size={14} />
        </button>
      </div>

      {/* Progress Bar per Plan (completed/total) */}
      <div
        style={{
          marginBottom: '18px',
          background: '#f8fafc',
          padding: '12px 14px',
          borderRadius: '10px',
          border: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '6px',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--secondary)' }}>
            Growth plan progress
          </span>
          <strong style={{ fontSize: '12px', color: 'var(--text)' }}>
            {completed} of {total} completed ({pct}%)
          </strong>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Action items list */}
      <div style={{ marginBottom: '16px' }}>
        <span className="form-section-title" style={{ display: 'block', marginBottom: '8px' }}>
          Development actions ({total})
        </span>

        {isPlanLoading ? (
          <div className="skeleton-line" style={{ height: '48px', borderRadius: '8px' }} />
        ) : total === 0 ? (
          /* Empty state for actions */
          <div className="empty-state" style={{ minHeight: '120px', padding: '20px 12px' }}>
            <ListTodo size={20} style={{ color: 'var(--muted)' }} />
            <strong style={{ fontSize: '13px' }}>No development actions yet</strong>
            <span style={{ fontSize: '11px' }}>
              No action items defined for this growth plan. Add an action below to get started.
            </span>
          </div>
        ) : (
          <div className="criteria-table">
            {actions.map((act, idx) => {
              const dueTime = act.dueDate ? new Date(act.dueDate).getTime() : NaN;
              const hasValidDueDate = !isNaN(dueTime);
              const diffDays = hasValidDueDate ? Math.ceil((dueTime - now) / 86_400_000) : null;
              // Overdue highlight: >today (diffDays < 0) and not completed
              const isOverdue = diffDays !== null && diffDays < 0 && act.status !== 'COMPLETED';
              const formattedDueDate = hasValidDueDate
                ? new Date(act.dueDate!).toLocaleDateString('en', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : null;

              return (
                <div
                  className="criterion-row"
                  key={act.id ?? idx}
                  style={{ alignItems: 'flex-start' }}
                >
                  <div style={{ flex: 1, minWidth: 0, gap: '4px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <strong style={{ fontSize: '13px' }}>{act.title}</strong>
                      <span className="soft-chip" title="Owner">
                        {act.ownerName}
                      </span>
                      {formattedDueDate && (
                        <span className={isOverdue ? 'overdue-badge' : 'due-badge'}>
                          {isOverdue ? <AlertTriangle size={12} /> : <Clock3 size={12} />}
                          {isOverdue
                            ? `Overdue (${Math.abs(diffDays!)}d) · ${formattedDueDate}`
                            : `Due ${formattedDueDate}`}
                        </span>
                      )}
                    </div>

                    {/* Evidence note display */}
                    {act.evidenceNote && (
                      <div className="action-evidence-note">
                        <FileText
                          size={12}
                          style={{ flexShrink: 0, marginTop: '2px', color: 'var(--muted)' }}
                        />
                        <span>{act.evidenceNote}</span>
                      </div>
                    )}

                    {/* Edit or add evidence note */}
                    {editingNoteIdx === idx ? (
                      <div
                        style={{
                          display: 'flex',
                          gap: '6px',
                          marginTop: '6px',
                          alignItems: 'center',
                        }}
                      >
                        <input
                          type="text"
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                          placeholder="Add evidence or verification note…"
                          style={{
                            fontSize: '11px',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: '1px solid var(--border)',
                            flex: 1,
                            background: '#fff',
                          }}
                        />
                        <button
                          type="button"
                          className="secondary-button"
                          style={{ fontSize: '11px', padding: '2px 8px', minHeight: '24px' }}
                          onClick={() => handleSaveNote(idx)}
                          disabled={updateDev.isPending}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          style={{ fontSize: '11px', padding: '2px 8px', minHeight: '24px' }}
                          onClick={() => setEditingNoteIdx(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div>
                        <button
                          type="button"
                          className="link-button"
                          style={{ fontSize: '11px', padding: 0, marginTop: '2px' }}
                          onClick={() => {
                            setEditingNoteIdx(idx);
                            setNoteDraft(act.evidenceNote ?? '');
                          }}
                        >
                          {act.evidenceNote ? 'Edit note' : '+ Add evidence note'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Status selector */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flexShrink: 0,
                      marginTop: '2px',
                    }}
                  >
                    <select
                      className="status-select"
                      value={act.status ?? 'NOT_STARTED'}
                      onChange={(e) =>
                        handleStatusChange(
                          idx,
                          e.target.value as 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED',
                        )
                      }
                      disabled={updateDev.isPending}
                      aria-label={`Status for ${act.title}`}
                    >
                      <option value="NOT_STARTED">Not started</option>
                      <option value="IN_PROGRESS">In progress</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add development action form */}
      <div className="form-section">
        <span className="form-section-title">Add development action</span>
        <div className="form-grid">
          <label className="field">
            <span>
              Action title <b>*</b> (min 3 chars)
            </span>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Cross-functional leadership project"
              disabled={updateDev.isPending}
            />
          </label>
          <label className="field">
            <span>
              Action owner <b>*</b> (min 2 chars)
            </span>
            <input
              value={newOwner}
              onChange={(e) => setNewOwner(e.target.value)}
              placeholder="e.g. Direct Manager"
              disabled={updateDev.isPending}
            />
          </label>
          <label className="field">
            <span>Due date (optional)</span>
            <input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              disabled={updateDev.isPending}
            />
          </label>
        </div>
        <div className="action-row" style={{ marginTop: '10px' }}>
          <button
            type="button"
            className="primary-button"
            disabled={
              updateDev.isPending || newTitle.trim().length < 3 || newOwner.trim().length < 2
            }
            onClick={handleAddAction}
          >
            {updateDev.isPending ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />}
            Add action item
          </button>
        </div>
        {updateDev.isError && <InlineError error={updateDev.error} />}
      </div>
    </section>
  );
}

export function DevelopmentPage({
  t: propT,
  onOpenCase: propOnOpenCase,
}: {
  t?: Copy;
  onOpenCase?: (id: string) => void;
} = {}) {
  const t = propT ?? copy;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedCaseId = searchParams.get('caseId');
  const onOpenCase = propOnOpenCase ?? ((id: string) => navigate(`/cases/${id}`));

  const {
    data: cases,
    isLoading,
    isError,
  } = useQuery({ queryKey: ['cases'], queryFn: () => api.cases() });

  const devCases = useMemo(
    () => cases?.filter((item) => item.status === 'DEVELOPMENT_IN_PROGRESS') ?? [],
    [cases],
  );

  const devPlanQueries = useQueries({
    queries: devCases.map((c) => ({
      queryKey: ['development', c.id],
      queryFn: () => api.getDevelopment<DevelopmentPlanData>(c.id).catch(() => null),
      staleTime: 30_000,
    })),
  });

  const reassessmentPromptCases = useMemo(() => {
    const items: Array<{
      caseItem: AssessmentCaseSummary;
      plan: DevelopmentPlanData;
      diffDays: number;
      targetDate: string;
    }> = [];
    const now = Date.now();

    devCases.forEach((c, idx) => {
      const plan = devPlanQueries[idx]?.data;
      if (!plan?.targetDate) return;
      const targetTime = new Date(plan.targetDate).getTime();
      if (isNaN(targetTime)) return;
      const diffDays = Math.ceil((targetTime - now) / 86_400_000);
      if (diffDays <= 30) {
        items.push({
          caseItem: c,
          plan,
          diffDays,
          targetDate: plan.targetDate,
        });
      }
    });

    return items;
  }, [devCases, devPlanQueries]);

  useEffect(() => {
    if (selectedCaseId) {
      const el = document.getElementById(`case-plan-${selectedCaseId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [selectedCaseId]);

  return (
    <>
      <PageHeading
        eyebrow="TALENT GROWTH"
        title={t.development}
        subtitle="Active talent development plans and post-assessment growth roadmaps."
      />

      {isError && <ErrorBanner message="Development cases could not load." />}

      {isLoading ? (
        <LoadingRows />
      ) : devCases.length === 0 ? (
        <section className="panel cases-panel">
          <PanelHeader
            icon={<Sparkles size={17} />}
            title="Development in progress"
            action={<span className="soft-count">0 active</span>}
          />
          <div className="empty-state">
            <div className="empty-icon">
              <Sparkles size={21} />
            </div>
            <strong>No active development plans</strong>
            <span>
              There are currently no assessment cases in the development in progress stage.
            </span>
          </div>
        </section>
      ) : (
        <>
          {/* Reassessment Prompts Section */}
          <section
            className="panel reassessment-panel"
            aria-label="Reassessment prompts"
            style={{ marginBottom: '24px', padding: '18px' }}
          >
            <PanelHeader
              icon={<RotateCcw size={17} />}
              title="Reassessment prompts"
              action={
                <span className="soft-count">
                  {reassessmentPromptCases.length}{' '}
                  {reassessmentPromptCases.length === 1 ? 'case due' : 'cases due'} (&le;30d)
                </span>
              }
            />
            {reassessmentPromptCases.length === 0 ? (
              <div className="reassessment-clean-banner" role="status">
                <CheckCircle2 size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
                <span>
                  No reassessments due. All active development plans are within schedule (&gt;30
                  days).
                </span>
              </div>
            ) : (
              reassessmentPromptCases.map(({ caseItem, plan, diffDays, targetDate }) => (
                <ReassessmentPromptCard
                  key={caseItem.id}
                  caseItem={caseItem}
                  plan={plan}
                  diffDays={diffDays}
                  targetDate={targetDate}
                  onOpenCase={onOpenCase}
                />
              ))
            )}
          </section>

          {/* Active Development Plans */}
          {devCases.map((caseItem) => (
            <PlanCard
              key={caseItem.id}
              caseItem={caseItem}
              isSelected={selectedCaseId === caseItem.id}
              onOpenCase={onOpenCase}
            />
          ))}

          {/* Directory table */}
          <section className="panel cases-panel" style={{ marginTop: '24px' }}>
            <PanelHeader
              icon={<Sparkles size={17} />}
              title="Development cases directory"
              action={<span className="soft-count">{devCases.length} active</span>}
            />
            <CaseTable cases={devCases} onOpen={onOpenCase} />
          </section>
        </>
      )}
    </>
  );
}
