import { useEffect, useMemo, useState } from 'react';
import './assessments.css';
import { formatCaseId } from './workQueue';
import {
  TABS,
  STAGE_LABELS,
  readFilters,
  writeFilters,
  filterCases,
  tabCounts,
  stageChip,
  formatRequested,
  paginate,
  type AssessmentFilters,
  type AssessmentListCase,
} from './assessments-logic';

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export default function Assessments({
  cases = [],
  onExport,
  onNew,
}: {
  cases?: AssessmentListCase[];
  onExport?: (cases: AssessmentListCase[]) => void;
  onNew?: () => void;
}) {
  const [filters, setFilters] = useState<AssessmentFilters>(() => readFilters());
  const [page, setPage] = useState(1);

  useEffect(() => {
    const sync = () => {
      setFilters(readFilters());
      setPage(1);
    };
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const update = (patch: Partial<AssessmentFilters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    writeFilters(next);
  };

  const counts = useMemo(() => tabCounts(cases), [cases]);
  const departments = useMemo(
    () => [...new Set(cases.map((item) => item.department).filter(Boolean))].sort(),
    [cases],
  );
  const filtered = useMemo(() => filterCases(cases, filters), [cases, filters]);
  const { items, page: current, pages } = paginate(filtered, page);
  const active = counts.in_assessment;
  const closed = counts.completed;

  return (
    <div className="as">
      <header className="as-head">
        <div>
          <h1>Assessment cases</h1>
          <p>
            {cases.length} cases in the pipeline. {active} are in assessment right now.
          </p>
        </div>
        <div className="as-actions">
          <button
            type="button"
            className="as-btn as-btn--outline"
            onClick={() => onExport?.(filtered)}
          >
            Export CSV
          </button>
          {onNew && (
            <button type="button" className="as-btn as-btn--primary" onClick={onNew}>
              New assessment
            </button>
          )}
        </div>
      </header>

      <section className="as-kpis" aria-label="Assessment summary">
        <div className="as-kpi as-kpi--on">
          <span>Total pipeline</span>
          <b>{cases.length}</b>
          <small>All cases across stages</small>
        </div>
        <div className="as-kpi">
          <span>In active assessment</span>
          <b>{active}</b>
          <small>Assessment and planning</small>
        </div>
        <div className="as-kpi">
          <span>Pending committee</span>
          <b>{counts.pending_approval}</b>
          <small>{counts.pending_approval ? 'Waiting for approval' : 'Nothing waiting'}</small>
        </div>
        <div className="as-kpi">
          <span>Ratified and closed</span>
          <b className="as-good">{closed}</b>
          <small>Completed cases</small>
        </div>
      </section>

      <section className="as-card" aria-label="Assessment cases list">
        <div className="as-tabs" role="tablist" aria-label="Filter by assessment group">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={filters.tab === tab.key && !filters.stage}
              className={`as-tab${filters.tab === tab.key && !filters.stage ? ' is-on' : ''}`}
              onClick={() => {
                update({ tab: tab.key, stage: '' });
                setPage(1);
              }}
            >
              {tab.label} {counts[tab.key]}
            </button>
          ))}
        </div>

        {filters.stage && (
          <div className="as-filterbar" role="status">
            <span className="as-filterchip">
              Stage: {STAGE_LABELS[filters.stage] || filters.stage}
              <button
                type="button"
                aria-label="Clear stage filter"
                onClick={() => update({ stage: '' })}
              >
                ×
              </button>
            </span>
          </div>
        )}

        <div className="as-tools">
          <input
            className="as-search"
            type="search"
            placeholder="Search case, employee, department…"
            aria-label="Search cases"
            value={filters.q}
            onChange={(event) => {
              update({ q: event.target.value });
              setPage(1);
            }}
          />
          <select
            className="as-select"
            aria-label="Department"
            value={filters.dept}
            onChange={(event) => {
              update({ dept: event.target.value });
              setPage(1);
            }}
          >
            <option value="">All departments</option>
            {departments.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>
        </div>

        <div className="as-row as-row--head" role="row">
          <span />
          <span>Employee</span>
          <span>Reason</span>
          <span>Stage</span>
          <span>Owner</span>
          <span>Requested</span>
          <span />
        </div>

        {items.length === 0 && (
          <p className="as-empty">No cases match these filters. Clear a filter to see more.</p>
        )}

        <ul className="as-list">
          {items.map((item) => {
            const chip = stageChip(item);
            const when = formatRequested(item.requestedAt);
            return (
              <li key={item.id} className="as-row">
                <span className="as-avatar" aria-hidden="true">
                  {initials(item.employeeName)}
                </span>
                <div className="as-cell">
                  <strong>{item.employeeName}</strong>
                  <span className="as-sub">
                    {item.department} · <span title={item.caseId}>{formatCaseId(item.caseId)}</span>
                  </span>
                </div>
                <div className="as-cell">
                  <span>{item.reason}</span>
                  <span className="as-sub">{item.position}</span>
                </div>
                <span className={`as-chip as-chip--${chip.tone}`} title={chip.text}>
                  {chip.text}
                </span>
                <span>{item.owner}</span>
                <div className="as-cell">
                  <strong className="as-date">{when.date}</strong>
                  <span className="as-sub">{when.ago}</span>
                </div>
                <a className="as-open" href={item.href} aria-label={`Open case ${item.employeeName}`}>
                  →
                </a>
              </li>
            );
          })}
        </ul>

        <footer className="as-foot">
          <span className="as-sub">
            Showing {items.length} of {filtered.length} cases
          </span>
          <span className="as-pager">
            <button
              type="button"
              className="as-tab"
              disabled={current <= 1}
              onClick={() => setPage(current - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className="as-tab as-tab--primary"
              disabled={current >= pages}
              onClick={() => setPage(current + 1)}
            >
              Next
            </button>
          </span>
        </footer>
      </section>
    </div>
  );
}
