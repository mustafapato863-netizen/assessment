import { useEffect, useMemo, useState } from 'react';
import './development.css';
import { formatCaseId } from '../lib/format-case-id';
import { STAGE_LABELS } from './assessments-logic';
import type {
  DevelopmentAction,
  DevelopmentActionStatus,
  DevelopmentPlan,
} from './development-logic';
import {
  ACTION_STATUSES,
  ACTION_DUE_SOON_DAYS,
  REASSESSMENT_DAYS,
  developmentKpis,
  planProgress,
  dueInfo,
  validateAction,
  formatDate,
  readSelected,
  writeSelected,
} from './development-logic';

/*
  شكل البيانات المتوقع لكل خطة في plans (عدّل أسماء الحقول حسب مشروعك):
  { id, caseId, employeeName, department, reason, targetRole, targetCompletion (ISO),
    reassessmentDate (ISO أو null), requestedAt, owner, archived: false, href: '#/assessments/123',
    actions: [{ id, title, owner, dueDate (ISO أو null), status: 'not_started'|'in_progress'|'completed', evidenceNote }] }

  الدوال اللي بتتمرر من برا (بتكلم الـ API بتاعك):
  onAddAction(planId, { title, owner, dueDate })
  onStatusChange(planId, actionId, status)
  onSaveEvidence(planId, actionId, note)
*/

const initials = (n: string) =>
  n
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

function AddActionForm({
  onSubmit,
}: {
  onSubmit: (data: { title: string; owner: string; dueDate: string | null }) => void;
}) {
  const [form, setForm] = useState({ title: '', owner: '', dueDate: '' });
  const [touched, setTouched] = useState(false);
  const { valid, errors } = validateAction(form);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    onSubmit({ title: form.title.trim(), owner: form.owner.trim(), dueDate: form.dueDate || null });
    setForm({ title: '', owner: '', dueDate: '' });
    setTouched(false);
  };

  return (
    <form className="dv-form" onSubmit={submit} noValidate>
      <strong>New action</strong>
      <div className="dv-form__grid">
        <label>
          <span className="dv-sr">Action title</span>
          <input
            value={form.title}
            onChange={set('title')}
            placeholder="Action title, e.g. Cross-functional project"
            aria-invalid={touched && !!errors.title}
          />
        </label>
        <label>
          <span className="dv-sr">Owner</span>
          <input
            value={form.owner}
            onChange={set('owner')}
            placeholder="Owner, e.g. Direct Manager"
            aria-invalid={touched && !!errors.owner}
          />
        </label>
        <label>
          <span className="dv-sr">Due date (optional)</span>
          <input type="date" value={form.dueDate} onChange={set('dueDate')} />
        </label>
        <button type="submit" className="dv-btn dv-btn--primary" disabled={!valid && touched}>
          Add action
        </button>
      </div>
      {touched && !valid && (
        <p className="dv-error" role="alert">
          {errors.title || errors.owner || errors.dueDate}
        </p>
      )}
      {!touched && (
        <p className="dv-sub">A title and an owner are required. The due date is optional.</p>
      )}
    </form>
  );
}

function ActionRow({
  action,
  planTargetCompletion,
  onStatusChange,
  onSaveEvidence,
}: {
  action: DevelopmentAction;
  planTargetCompletion: string | null;
  onStatusChange: (actionId: string, status: DevelopmentActionStatus) => void;
  onSaveEvidence: (actionId: string, note: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(action.evidenceNote || '');
  const due = dueInfo(action, new Date(), planTargetCompletion);

  return (
    <li className="dv-action">
      <div>
        <strong>{action.title}</strong>
        <span className="dv-sub">
          Owner: {action.owner} ·{' '}
          <button type="button" className="dv-link" onClick={() => setOpen(!open)}>
            {action.evidenceNote ? 'Edit evidence note' : 'Add evidence note'}
          </button>
        </span>
        {open && (
          <div className="dv-evidence">
            <label className="dv-sr" htmlFor={`ev-${action.id}`}>
              Evidence note
            </label>
            <textarea
              id={`ev-${action.id}`}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What was done, and where can it be verified?"
            />
            <button
              type="button"
              className="dv-btn dv-btn--ghost"
              onClick={() => {
                onSaveEvidence(action.id, note.trim());
                setOpen(false);
              }}
            >
              Save note
            </button>
          </div>
        )}
      </div>
      <span className={`dv-chip dv-chip--${due.tone}`}>{due.text}</span>
      <select
        className={`dv-select dv-select--${action.status}`}
        value={action.status}
        aria-label={`Status of ${action.title}`}
        onChange={(e) => onStatusChange(action.id, e.target.value as DevelopmentActionStatus)}
      >
        {ACTION_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </li>
  );
}

export interface DevelopmentViewProps {
  plans?: DevelopmentPlan[];
  onAddAction?: (
    planId: string,
    data: { title: string; owner: string; dueDate: string | null },
  ) => void;
  onStatusChange?: (planId: string, actionId: string, status: DevelopmentActionStatus) => void;
  onSaveEvidence?: (planId: string, actionId: string, note: string) => void;
}

export default function Development({
  plans = [],
  onAddAction,
  onStatusChange,
  onSaveEvidence,
}: DevelopmentViewProps) {
  const [selectedId, setSelectedId] = useState(readSelected());

  useEffect(() => {
    const sync = () => setSelectedId(readSelected());
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const active = useMemo(() => plans.filter((p) => !p.archived), [plans]);
  const kpis = useMemo(() => developmentKpis(plans), [plans]);
  const selected = active.find((p) => p.id === selectedId) || active[0] || null;
  const progress = planProgress(selected?.actions ?? []);

  return (
    <div className="dv">
      <header>
        <h1>Development</h1>
        <p>
          {kpis.activePlans} active {kpis.activePlans === 1 ? 'plan' : 'plans'} with {kpis.actions}{' '}
          actions.{' '}
          {kpis.reassessments
            ? `${kpis.reassessments} due for reassessment in the next ${REASSESSMENT_DAYS} days.`
            : `Nothing is due for reassessment in the next ${REASSESSMENT_DAYS} days.`}
        </p>
      </header>

      <section className="dv-kpis" aria-label="Summary">
        <div className="dv-kpi dv-kpi--on">
          <span>Active plans</span>
          <b>{kpis.activePlans}</b>
          <small>
            {active
              .map((p) => p.employeeName)
              .slice(0, 2)
              .join(', ') || 'None yet'}
          </small>
        </div>
        <div className="dv-kpi">
          <span>Actions completed</span>
          <b className="dv-good">
            {kpis.done} of {kpis.actions}
          </b>
          <small>
            {kpis.actions ? Math.round((kpis.done / kpis.actions) * 100) : 0}% of all actions
          </small>
        </div>
        <div className="dv-kpi">
          <span>Actions due soon</span>
          <b>{kpis.dueSoon}</b>
          <small>Within {ACTION_DUE_SOON_DAYS} days</small>
        </div>
        <div className="dv-kpi">
          <span>Reassessments due</span>
          <b>{kpis.reassessments}</b>
          <small>Within {REASSESSMENT_DAYS} days</small>
        </div>
      </section>

      {!selected ? (
        <p className="dv-empty">
          No development plans yet. Plans appear here once an assessment result creates one.
        </p>
      ) : (
        <div className="dv-grid">
          <section className="dv-card" aria-label="Development plan">
            <div className="dv-plan-head">
              <div className="dv-who">
                <span className="dv-avatar dv-avatar--lg" aria-hidden="true">
                  {initials(selected.employeeName)}
                </span>
                <div>
                  <strong>{selected.employeeName}</strong>
                  <span className="dv-sub">
                    {selected.department} · {STAGE_LABELS[selected.stage]} · Target role{' '}
                    {selected.targetRole} ·{' '}
                    <span title={selected.caseId}>{formatCaseId(selected.caseId)}</span>
                  </span>
                </div>
              </div>
              <a className="dv-link" href={selected.href}>
                Open case →
              </a>
            </div>

            <div className="dv-progress">
              <div className="dv-progress__top">
                <b>Growth plan progress</b>
                <b>
                  {progress.done} of {progress.total} completed
                </b>
              </div>
              <div
                className="dv-bar"
                role="progressbar"
                aria-valuenow={progress.percent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span style={{ width: `${progress.percent}%` }} />
              </div>
              <span className="dv-sub">
                Target completion {formatDate(selected.targetCompletion)}.{' '}
                {progress.complete
                  ? 'All actions are done. Review the plan or schedule the reassessment.'
                  : `${progress.total - progress.done} actions left.`}
              </span>
            </div>

            <h2>Development actions · {progress.total}</h2>
            <ul className="dv-actions">
              {selected.actions.map((a) => (
                <ActionRow
                  key={a.id}
                  action={a}
                  planTargetCompletion={selected.targetCompletion}
                  onStatusChange={(actionId, status) =>
                    onStatusChange?.(selected.id, actionId, status)
                  }
                  onSaveEvidence={(actionId, note) => onSaveEvidence?.(selected.id, actionId, note)}
                />
              ))}
            </ul>

            <AddActionForm onSubmit={(data) => onAddAction?.(selected.id, data)} />
          </section>

          <aside className="dv-side">
            <div className="dv-card">
              <div className="dv-card__head">
                <h2>Development plans</h2>
                <span className="dv-sub">{active.length} active</span>
              </div>
              <ul className="dv-plans">
                {active.map((p) => {
                  const pr = planProgress(p.actions);
                  const on = p.id === selected.id;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        className={`dv-plan${on ? ' is-on' : ''}`}
                        aria-pressed={on}
                        onClick={() => writeSelected(p.id)}
                      >
                        <span className="dv-avatar" aria-hidden="true">
                          {initials(p.employeeName)}
                        </span>
                        <span className="dv-plan__txt">
                          <strong>{p.employeeName}</strong>
                          <span className="dv-sub">
                            {p.department} · {p.reason}
                          </span>
                        </span>
                        <span
                          className={`dv-chip ${pr.complete ? 'dv-chip--done' : 'dv-chip--neutral'}`}
                        >
                          {pr.complete ? 'Plan complete' : `${pr.done}/${pr.total} done`}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className={`dv-note${kpis.reassessments ? ' dv-note--warn' : ''}`}>
              <strong>Reassessments</strong>
              <span>
                {kpis.reassessments
                  ? `${kpis.reassessments} plans are due within ${REASSESSMENT_DAYS} days.`
                  : `No plans are due for reassessment in the next ${REASSESSMENT_DAYS} days.`}
              </span>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
