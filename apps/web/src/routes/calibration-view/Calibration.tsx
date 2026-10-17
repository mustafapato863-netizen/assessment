import { useEffect, useMemo, useState } from 'react';
import './calibration.css';
import {
  READINESS,
  readinessMeta,
  normalizeReadiness,
  formatLevel,
  BOX_GRID,
  POTENTIAL_LABELS,
  PERFORMANCE_LABELS,
  boxOf,
  sortCandidates,
  matches,
  byReadiness,
  readinessCounts,
  boxStats,
  departmentBenchmark,
  departments,
  readState,
  writeState,
  paginate,
  candidatesToCsv,
  downloadCsv,
} from './calibrationLogic';
import type {
  CalibrationCandidate,
  CalibrationState,
  DepartmentBenchmarkRow,
  ReadinessKey,
} from './calibrationLogic';

/*
  شكل البيانات المتوقع لكل مرشح في candidates (عدّل أسماء الحقول حسب مشروعك):
  { id, name, department, currentLevel (3 أو "L3"), targetLevel (6 أو "L6"), currentRole, targetRole,
    readiness: 'ready_now' | 'with_development' | 'not_ready' | 'pending_evaluation' (أي قيمة تانية = pending),
    box: 1..9   (أو بدله: performance + potential = 'low' | 'medium' | 'high'),
    href: '#/assessments/123' }
  props: candidates, title (اسم دورة الـ calibration)
*/

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

function ReadinessChip({ value }: { value: string | null | undefined }) {
  const m = readinessMeta(normalizeReadiness(value));
  return (
    <span className="cb-chip" style={{ background: m.bg, color: m.fg }}>
      {m.label}
    </span>
  );
}

function levelMove(candidate: CalibrationCandidate) {
  const from = formatLevel(candidate.currentLevel);
  const to = formatLevel(candidate.targetLevel);
  return from && to ? `${from} → ${to}` : from || to || '';
}

function CandidateRow({ c }: { c: CalibrationCandidate }) {
  return (
    <li className="cb-cand">
      <span className="cb-avatar" aria-hidden="true">
        {initials(c.name)}
      </span>
      <div className="cb-cand__txt">
        {c.href ? (
          <a href={c.href} className="cb-cand__name" title={`${c.name} · ${c.targetRole || ''}`}>
            {c.name}
          </a>
        ) : (
          <span className="cb-cand__name" title={c.targetRole || ''}>
            {c.name}
          </span>
        )}
        <div className="cb-cand__meta">
          <ReadinessChip value={c.readiness} />
          <span className="cb-sub" title={[c.department, c.targetRole].filter(Boolean).join(' · ')}>
            {[levelMove(c), c.department].filter(Boolean).join(' · ')}
          </span>
        </div>
      </div>
    </li>
  );
}

function Legend() {
  return (
    <div className="cb-legend">
      {READINESS.map((r) => (
        <span key={r.key}>
          <i style={{ background: r.color }} />
          {r.label}
        </span>
      ))}
    </div>
  );
}

function DepartmentCard({ rows, selected }: { rows: DepartmentBenchmarkRow[]; selected: string }) {
  const [all, setAll] = useState(false);
  return (
    <section className="cb-card cb-pad" aria-label="Readiness by department">
      <div className="cb-head">
        <h2>Readiness by department</h2>
        <Legend />
      </div>
      <p className="cb-note">
        Rate is ready now as a share of candidates. Groups under 3 people show their size (n).
      </p>
      <div className="cb-dr cb-dr--head">
        <span>Department</span>
        <span>Candidates</span>
        <span>Distribution</span>
        <span>Ready rate</span>
      </div>
      <div
        className={`cb-departments-list${all ? ' is-expanded' : ''}`}
        role="region"
        aria-label="Department readiness details"
      >
        {rows.map((r) => (
          <div key={r.department} className={`cb-dr${selected === r.department ? ' is-on' : ''}`}>
            <span className="cb-dr__name">{r.department}</span>
            <span>{r.total}</span>
            <span
              className="cb-bar"
              role="img"
              aria-label={`${r.ready_now} ready now, ${r.with_development} with development, ${r.not_ready} not ready, ${r.pending_evaluation} pending evaluation`}
            >
              {READINESS.map(
                (m) =>
                  r[m.key] > 0 && (
                    <i
                      key={m.key}
                      style={{ width: `${(r[m.key] / r.total) * 100}%`, background: m.color }}
                    />
                  ),
              )}
            </span>
            <b>
              {r.rate}%{r.small && <span className="cb-sub"> (n={r.total})</span>}
            </b>
          </div>
        ))}
      </div>
      {rows.length > 8 && (
        <button type="button" className="cb-link" onClick={() => setAll(!all)}>
          {all ? 'Show fewer' : `Show all ${rows.length} departments →`}
        </button>
      )}
    </section>
  );
}

export default function Calibration({
  candidates = [],
  title = 'Talent calibration',
  axesNote,
}: {
  candidates?: CalibrationCandidate[];
  title?: string;
  axesNote?: string;
}) {
  const [state, setState] = useState<CalibrationState>(() => readState());
  const [expanded, setExpanded] = useState(false);
  const [showUnplaced, setShowUnplaced] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const sync = () => {
      setState(readState());
      setPage(1);
    };
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  // replace=true للبحث والقسم (من غير ما نملا تاريخ المتصفح)
  const update = (
    patch: Partial<CalibrationState>,
    { replace = false }: { replace?: boolean } = {},
  ) => {
    const next = { ...state, ...patch };
    setState(next);
    setPage(1);
    setExpanded(false);
    setShowUnplaced(false);
    writeState(next, { replace });
  };

  const depts = useMemo(() => departments(candidates), [candidates]);
  const qOnly = useMemo(
    () => candidates.filter((c) => matches(c, { q: state.q })),
    [candidates, state.q],
  );
  const base = useMemo(
    () => qOnly.filter((c) => matches(c, { dept: state.dept })),
    [qOnly, state.dept],
  );
  const unplacedCandidates = useMemo(
    () => base.filter((candidate) => boxOf(candidate) === null),
    [base],
  );
  const counts = useMemo(() => readinessCounts(base), [base]);
  const shown = useMemo(() => byReadiness(base, state.status), [base, state.status]);
  const stats = useMemo(() => boxStats(shown), [shown]);
  const bench = useMemo(() => departmentBenchmark(qOnly), [qOnly]);
  const table = useMemo(() => paginate(sortCandidates(shown), page, 10), [shown, page]);

  // الـ box المختار: اللي في الـ URL، وإلا أكبر box فيه مرشحين
  const defaultBox = useMemo(() => {
    const all = Object.values(stats.boxes);
    return all.sort((a, b) => b.count - a.count)[0]?.box || 5;
  }, [stats]);
  const boxNo = state.box && stats.boxes[state.box] ? state.box : defaultBox;
  const sel = stats.boxes[boxNo] ?? stats.boxes[5]!;
  const listed = expanded ? sel.candidates : sel.candidates.slice(0, 8);

  const toggleStatus = (key: ReadinessKey) => update({ status: state.status === key ? '' : key });
  const toggleUnplaced = () => {
    if (showUnplaced) {
      setShowUnplaced(false);
      return;
    }
    update({ status: '', view: 'matrix' });
    setShowUnplaced(true);
  };
  const readyNow = counts.find((readiness) => readiness.key === 'ready_now')?.count ?? 0;
  const filtering = Boolean(state.q || state.dept || state.status);

  return (
    <div className="cb">
      <header className="cb-top">
        <div>
          <h1>Calibration</h1>
          <p>
            {title}. {base.length} candidates, {readyNow} ready now.
          </p>
          {axesNote ? <p className="cb-empty__hint">{axesNote}</p> : null}
        </div>
        <div className="cb-actions">
          <div className="cb-toggle" role="group" aria-label="View">
            <button
              type="button"
              aria-pressed={state.view === 'matrix'}
              className={state.view === 'matrix' ? 'is-on' : ''}
              onClick={() => update({ view: 'matrix' })}
            >
              Matrix
            </button>
            <button
              type="button"
              aria-pressed={state.view === 'table'}
              className={state.view === 'table' ? 'is-on' : ''}
              onClick={() => update({ view: 'table' })}
            >
              Table
            </button>
          </div>
          <button
            type="button"
            className="cb-btn"
            onClick={() =>
              downloadCsv('calibration-cohort.csv', candidatesToCsv(sortCandidates(shown)))
            }
          >
            Export CSV
          </button>
        </div>
      </header>

      <section className="cb-kpis" aria-label="Readiness summary">
        {counts.map((r) => (
          <button
            key={r.key}
            type="button"
            className={`cb-kpi${state.status === r.key ? ' is-on' : ''}`}
            aria-pressed={state.status === r.key}
            onClick={() => toggleStatus(r.key)}
          >
            <span className="cb-kpi__label">
              <i style={{ background: r.color }} />
              {r.label}
            </span>
            <b>{r.count}</b>
            <small>{r.percent}% of the cohort</small>
          </button>
        ))}
      </section>

      <section className="cb-card cb-filters" aria-label="Filters">
        <input
          type="search"
          className="cb-input"
          placeholder="Search candidate, role, or ID…"
          aria-label="Search candidates"
          value={state.q}
          onChange={(e) => update({ q: e.target.value }, { replace: true })}
        />
        <select
          className="cb-input cb-select"
          aria-label="Department"
          value={state.dept}
          onChange={(e) => update({ dept: e.target.value }, { replace: true })}
        >
          <option value="">All departments</option>
          {depts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <div className="cb-chips">
          <button
            type="button"
            className={`cb-tab${!state.status ? ' is-on' : ''}`}
            onClick={() => update({ status: '' })}
          >
            All {base.length}
          </button>
          {counts.map((r) => (
            <button
              key={r.key}
              type="button"
              className={`cb-tab${state.status === r.key ? ' is-on' : ''}`}
              onClick={() => toggleStatus(r.key)}
            >
              {r.label} {r.count}
            </button>
          ))}
        </div>
        <span className="cb-sub">
          Showing {shown.length} of {candidates.length} candidates
        </span>
        {filtering && (
          <button
            type="button"
            className="cb-link"
            onClick={() => update({ q: '', dept: '', status: '', box: 0 })}
          >
            Clear filters
          </button>
        )}
      </section>

      {shown.length === 0 && (
        <p className="cb-empty" role="status">
          No candidates match these filters. Clear a filter to see more.
        </p>
      )}
      {unplacedCandidates.length > 0 && (
        <button
          type="button"
          className={`cb-empty cb-empty--info${showUnplaced ? ' is-open' : ''}`}
          aria-expanded={showUnplaced}
          onClick={toggleUnplaced}
        >
          <span>
            <strong>{unplacedCandidates.length} not yet placed</strong>
            <span className="cb-empty__hint">
              No finalized result with a complete scorecard yet (pending, reopened, or result
              entered without a scorecard).
            </span>
          </span>
          <strong>{showUnplaced ? 'Hide cases ↑' : 'View cases →'}</strong>
        </button>
      )}

      {state.view === 'matrix' ? (
        <section className="cb-split">
          <div className="cb-card cb-pad" aria-label="9-box heatmap">
            <div className="cb-head">
              <div>
                <h2>9-box heatmap</h2>
                <p className="cb-note">
                  Darker means more people. Select a box to see who is in it.
                </p>
              </div>
            </div>
            <div className="cb-grid">
              {BOX_GRID.map((row, i) => (
                <div className="cb-row" key={i}>
                  <div className="cb-axis cb-axis--v">{POTENTIAL_LABELS[i] ?? ''}</div>
                  {row.map((n) => {
                    const b = stats.boxes[n]!;
                    const on = n === boxNo;
                    return (
                      <button
                        key={n}
                        type="button"
                        className={`cb-cell${on ? ' is-on' : ''}`}
                        aria-pressed={on}
                        aria-label={`Box ${n}, ${b.name}: ${b.count} candidates, ${b.percent}%`}
                        style={{
                          background: `rgba(67,56,202,${(0.06 + (b.count / stats.maxCount) * 0.4).toFixed(2)})`,
                        }}
                        onClick={() => update({ box: n })}
                      >
                        <span className="cb-cell__top">
                          <span className="cb-cell__no">Box {n}</span>
                          {on && <span className="cb-cell__selected">Selected</span>}
                        </span>
                        <b className="cb-cell__name">{b.name}</b>
                        <span className="cb-cell__count">{b.count}</span>
                        <span className="cb-cell__pct">{b.percent}% of shown</span>
                      </button>
                    );
                  })}
                </div>
              ))}
              <div className="cb-row cb-row--foot">
                <span />
                {PERFORMANCE_LABELS.map((l) => (
                  <div key={l} className="cb-axis">
                    {l}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {showUnplaced ? (
            <aside className="cb-card cb-pad" aria-label="Unevaluated candidates">
              <div className="cb-note">Not placed in a box</div>
              <div className="cb-head">
                <h2>Unevaluated cases</h2>
                <b>{unplacedCandidates.length} candidates</b>
              </div>
              <p className="cb-note">
                Complete the assessment result to place these cases in the 9-box matrix.
              </p>
              <ul className="cb-list cb-list--scroll">
                {sortCandidates(unplacedCandidates).map((c) => (
                  <CandidateRow key={c.id} c={c} />
                ))}
              </ul>
            </aside>
          ) : (
            <aside className="cb-card cb-pad" aria-label={`Box ${boxNo} candidates`}>
              <div className="cb-note">
                Box {boxNo} · {PERFORMANCE_LABELS[(boxNo - 1) % 3] ?? ''},{' '}
                {(POTENTIAL_LABELS[2 - Math.floor((boxNo - 1) / 3)] ?? '').toLowerCase()}
              </div>
              <div className="cb-head">
                <h2>{sel.name}</h2>
                <b>
                  {sel.count} {sel.count === 1 ? 'candidate' : 'candidates'}
                </b>
              </div>
              <p className="cb-note">{sel.desc}</p>
              {sel.count === 0 ? (
                <p className="cb-note">Nobody is in this box with the current filters.</p>
              ) : (
                <ul className="cb-list">
                  {listed.map((c) => (
                    <CandidateRow key={c.id} c={c} />
                  ))}
                </ul>
              )}
              <div className="cb-panel-foot">
                {sel.count > 8 && (
                  <button type="button" className="cb-link" onClick={() => setExpanded(!expanded)}>
                    {expanded ? 'Show fewer' : `Show all ${sel.count} →`}
                  </button>
                )}
                {sel.count > 0 && (
                  <button
                    type="button"
                    className="cb-link"
                    onClick={() =>
                      downloadCsv(`calibration-box-${boxNo}.csv`, candidatesToCsv(sel.candidates))
                    }
                  >
                    Export this box
                  </button>
                )}
              </div>
            </aside>
          )}
        </section>
      ) : (
        <section className="cb-card cb-table" aria-label="Candidates table">
          <div className="cb-pad cb-head">
            <h2>Candidates</h2>
            <span className="cb-sub">Ready now first, then by development need</span>
          </div>
          <div className="cb-tr cb-tr--head" role="row">
            <span />
            <span>Candidate</span>
            <span>Department</span>
            <span>Level move</span>
            <span>Box</span>
            <span>Readiness</span>
          </div>
          <ul className="cb-list cb-list--flush">
            {table.items.map((c) => (
              <li key={c.id} className="cb-tr">
                <span className="cb-avatar" aria-hidden="true">
                  {initials(c.name)}
                </span>
                <div className="cb-cell-txt">
                  {c.href ? (
                    <a href={c.href} className="cb-cand__name">
                      {c.name}
                    </a>
                  ) : (
                    <span className="cb-cand__name">{c.name}</span>
                  )}
                  <span className="cb-sub">{c.targetRole}</span>
                </div>
                <span>{c.department}</span>
                <span>{levelMove(c)}</span>
                <span className="cb-sub cb-bold">{boxOf(c) ? `Box ${boxOf(c)}` : 'Unplaced'}</span>
                <ReadinessChip value={c.readiness} />
              </li>
            ))}
          </ul>
          <footer className="cb-foot">
            <span className="cb-sub">
              Showing {table.items.length} of {shown.length} candidates
            </span>
            <span className="cb-pager">
              <button
                type="button"
                className="cb-tab"
                disabled={table.page <= 1}
                onClick={() => setPage(table.page - 1)}
              >
                Previous
              </button>
              <button
                type="button"
                className="cb-tab is-on"
                disabled={table.page >= table.pages}
                onClick={() => setPage(table.page + 1)}
              >
                Next
              </button>
            </span>
          </footer>
        </section>
      )}

      <DepartmentCard rows={bench} selected={state.dept} />
    </div>
  );
}
