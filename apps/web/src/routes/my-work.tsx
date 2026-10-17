import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { ErrorBanner, LoadingRows, PageHeading } from '../components/ui';
import { mapWorkItems } from './my-work-data';
import {
  countByStage,
  daysOverdue,
  formatCaseId,
  getKpis,
  getStatusChip,
  sortWorkItems,
  type WorkItem,
} from './workQueue';
import './my-work.css';

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function KpiCard({
  label,
  value,
  hint,
  tone = 'default',
  onClick,
  active,
}: {
  label: string;
  value: number;
  hint: string;
  tone?: string;
  onClick: () => void;
  active: boolean;
}) {
  return (
    <button
      type="button"
      className={`mw-kpi mw-kpi--${tone}${active ? ' is-active' : ''}`}
      onClick={onClick}
    >
      <span className="mw-kpi__label">{label}</span>
      <span className="mw-kpi__value">{value}</span>
      <span className="mw-kpi__hint">{hint}</span>
    </button>
  );
}

function CaseId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard access may be unavailable in some browser contexts.
    }
  };
  return (
    <button
      type="button"
      className="mw-caseid"
      title={id}
      onClick={copy}
      aria-label={`Copy case ID ${id}`}
    >
      {copied ? 'Copied' : formatCaseId(id)}
    </button>
  );
}

function MyWork({ items = [], now = new Date() }: { items?: WorkItem[]; now?: Date }) {
  const [filter, setFilter] = useState<'all' | 'overdue' | 'approval' | 'evaluation'>('all');

  const sorted = useMemo(() => sortWorkItems(items, now), [items, now]);
  const kpis = useMemo(() => getKpis(items, now), [items, now]);
  const stages = useMemo(() => countByStage(items), [items]);

  const visible = sorted.filter((item) => {
    if (filter === 'overdue') return (daysOverdue(item.dueDate, now) ?? -1) > 0;
    if (filter === 'approval') return item.type === 'approval';
    if (filter === 'evaluation') return item.type === 'evaluation';
    return true;
  });

  const first = sorted[0];
  const firstLate = first ? daysOverdue(first.dueDate, now) : null;
  const tabs: Array<['all' | 'overdue' | 'approval' | 'evaluation', string, number]> = [
    ['all', 'All', items.length],
    ['overdue', 'Overdue', kpis.overdue],
    ['approval', 'Approvals', kpis.approvals],
    ['evaluation', 'Evaluations', kpis.evaluations],
  ];

  return (
    <div className="mw">
      <header className="mw-head">
        <div>
          <h1>My work</h1>
          <p>
            {kpis.openCases} cases need you.
            {kpis.overdue > 0 ? ` ${kpis.overdue} are overdue, so start there.` : ' Nothing is overdue.'}
          </p>
        </div>
        <a className="mw-btn mw-btn--primary" href="#/cases/new">New assessment</a>
      </header>

      <section className="mw-kpis" aria-label="Summary">
        <KpiCard label="Open cases" value={kpis.openCases} hint={`${kpis.tasks} tasks in total`} active={filter === 'all'} onClick={() => setFilter('all')} />
        <KpiCard label="Overdue" value={kpis.overdue} hint="Past their due date" tone="warn" active={filter === 'overdue'} onClick={() => setFilter('overdue')} />
        <KpiCard label="Committee approvals" value={kpis.approvals} hint={kpis.approvals ? 'Waiting for you' : 'Nothing waiting'} active={filter === 'approval'} onClick={() => setFilter('approval')} />
        <KpiCard label="Evaluations" value={kpis.evaluations} hint={kpis.evaluations ? 'Waiting for you' : 'Nothing waiting'} active={filter === 'evaluation'} onClick={() => setFilter('evaluation')} />
      </section>

      <div className="mw-grid">
        <section className="mw-card" aria-label="Actionable queue">
          <div className="mw-card__head">
            <h2>Actionable queue</h2>
            <span className="mw-muted">Overdue first, then nearest due date</span>
          </div>

          <div className="mw-tabs" role="tablist" aria-label="Filter work items">
            {tabs.map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={filter === key}
                className={`mw-tab${filter === key ? ' is-on' : ''}`}
                onClick={() => setFilter(key)}
              >
                {label} {count}
              </button>
            ))}
          </div>

          {visible.length === 0 && <p className="mw-empty">Nothing here. Pick another filter.</p>}

          <ul className="mw-list">
            {visible.map((item) => {
              const chip = getStatusChip(item, now);
              return (
                <li key={item.id} className={`mw-row${chip.tone === 'overdue' ? ' is-overdue' : ''}`}>
                  <span className="mw-avatar" aria-hidden="true">{initials(item.name)}</span>
                  <div className="mw-who">
                    <strong>{item.name}</strong>
                    <span className="mw-muted">
                      {item.department} · {item.stage} · <CaseId id={item.caseId} />
                    </span>
                  </div>
                  <span className={`mw-chip mw-chip--${chip.tone}`}>{chip.text}</span>
                  <a className="mw-btn mw-btn--ghost" href={item.action.href} aria-label={`${item.action.label} for ${item.name}`}>
                    {item.action.label} →
                  </a>
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="mw-side">
          {first && (
            <div className="mw-start">
              <span className="mw-start__eyebrow">Start here</span>
              <strong>{first.name}</strong>
              <span>
                {first.stage} stage
                {firstLate !== null && firstLate > 0 ? ` · overdue by ${firstLate} days` : ''}
              </span>
              <a className="mw-btn mw-btn--light" href={first.action.href}>{first.action.label} →</a>
            </div>
          )}

          <div className="mw-card mw-card--pad">
            <h2>By stage</h2>
            <ul className="mw-stages">
              {Object.entries(stages).map(([stage, count]) => (
                <li key={stage}><span>{stage}</span><b>{count}</b></li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function MyWorkPage() {
  const overview = useQuery({ queryKey: ['overview'], queryFn: api.overview });
  const cases = useQuery({ queryKey: ['cases'], queryFn: () => api.cases() });
  const items = useMemo(
    () => mapWorkItems(overview.data?.tasks ?? [], cases.data ?? []),
    [overview.data?.tasks, cases.data],
  );

  if (overview.isError || cases.isError) {
    return (
      <>
        <PageHeading
          eyebrow="ASSESSMENT WORKSPACE"
          title="My work"
          subtitle="Review your open actions and continue each case from its next step."
        />
        <ErrorBanner
          message="My work could not be loaded. Check the connection and try again."
          onRetry={() => { void overview.refetch(); void cases.refetch(); }}
        />
      </>
    );
  }

  if (overview.isLoading || cases.isLoading) {
    return (
      <>
        <PageHeading
          eyebrow="ASSESSMENT WORKSPACE"
          title="My work"
          subtitle="Review your open actions and continue each case from its next step."
        />
        <LoadingRows />
      </>
    );
  }

  return <MyWork items={items} />;
}
