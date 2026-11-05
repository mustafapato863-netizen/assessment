import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import './employees.css';
import { api } from '../lib/api';
import { getActiveUser } from '../lib/auth';
import { ErrorBanner, LoadingRows } from '../components/ui';
import type { AssessmentCaseDetail } from '@assessflow/contracts';
import { formatCaseId } from './workQueue';
import { formatRequested, paginate, stageChip } from './assessments-logic';
import { mapAssessmentCase } from './assessment-case-adapter';
import {
  caseLabel,
  employeeStats,
  groupByEmployee,
  readSelected,
  searchEmployees,
  sortEmployees,
  writeSelected,
} from './employees-logic';

const PAGE_SIZE = 8;

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function EmployeesPage() {
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(readSelected);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [nameReason, setNameReason] = useState('');
  const queryClient = useQueryClient();
  const isAdmin = getActiveUser().role === 'SYS_ADMIN';

  const {
    data: rawCases,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['cases'],
    queryFn: () => api.cases(),
  });
  const cases = useMemo(() => (rawCases ?? []).map(mapAssessmentCase), [rawCases]);

  const nameMutation = useMutation({
    mutationFn: (input: { caseId: string; displayName: string; reason: string }) =>
      api.updateEmployeeName(input.caseId, {
        displayName: input.displayName,
        reason: input.reason,
      }),
    onSuccess: () => {
      setEditingName(false);
      setNameReason('');
      void queryClient.invalidateQueries({ queryKey: ['cases'] });
      void queryClient.invalidateQueries({ queryKey: ['case'] });
    },
  });

  useEffect(() => {
    const sync = () => {
      setSelectedId(readSelected());
      setPage(1);
      setEditingName(false);
    };
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const employees = useMemo(() => sortEmployees(groupByEmployee(cases)), [cases]);
  const stats = useMemo(() => employeeStats(employees), [employees]);
  const departments = useMemo(
    () => [...new Set(employees.map((employee) => employee.department))].sort(),
    [employees],
  );
  const filtered = useMemo(() => searchEmployees(employees, { q, dept }), [employees, q, dept]);
  const { items, page: current, pages } = paginate(filtered, page, PAGE_SIZE);
  const selected = employees.find((employee) => employee.id === selectedId) || filtered[0] || null;
  const selectedCaseDetails = useQueries({
    queries: (selected?.cases ?? []).map((item) => ({
      queryKey: ['case', item.id],
      queryFn: () => api.caseDetail(item.id),
    })),
  });

  const primaryCaseId = selected?.cases[0]?.id;

  return (
    <div className="em">
      {isError && <ErrorBanner message="Employee records could not load." />}
      <header className="page-heading">
        <div>
          <span className="eyebrow">TALENT SCOPE</span>
          <h1>Employees</h1>
          <p className="pipeline-note">
            {stats.people} people with {stats.cases} assessment cases. Select someone to see their
            history.
          </p>
        </div>
      </header>

      <section className="em-kpis" aria-label="Employee summary">
        <div className="em-kpi em-kpi--on">
          <span>Employees</span>
          <b>{stats.people}</b>
          <small>Talent profiles</small>
        </div>
        <div className="em-kpi">
          <span>Linked cases</span>
          <b>{stats.cases}</b>
          <small>Across all stages</small>
        </div>
        <div className="em-kpi">
          <span>With 2 or more cases</span>
          <b>{stats.multiCount}</b>
          <small>{stats.multiNames || 'None'}</small>
        </div>
        <div className="em-kpi em-kpi--private">
          <span>Privacy</span>
          <strong>Scope filtered</strong>
          <small>Assessor-private evidence is hidden</small>
        </div>
      </section>

      {isLoading ? (
        <LoadingRows />
      ) : (
        <div className="em-grid">
          <section className="em-card" aria-label="Employee directory">
            <div className="em-head">
              <h2>Employee directory</h2>
              <span className="em-sub">Most cases first</span>
            </div>

            <div className="em-tools">
              <input
                type="search"
                className="em-search"
                placeholder="Search employee, role, or department…"
                aria-label="Search employees"
                value={q}
                onChange={(event) => {
                  setQ(event.target.value);
                  setPage(1);
                }}
              />
              <select
                className="em-select"
                aria-label="Department"
                value={dept}
                onChange={(event) => {
                  setDept(event.target.value);
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

            <div className="em-row em-row--head" role="row">
              <span />
              <span>Employee</span>
              <span>Department</span>
              <span>Cases</span>
              <span>Latest stage</span>
              <span />
            </div>

            {items.length === 0 && (
              <p className="em-empty">No employees match. Clear the search to see everyone.</p>
            )}

            <ul className="em-list">
              {items.map((employee) => {
                const chip = stageChip(employee.latest);
                const isSelected = selected?.id === employee.id;
                return (
                  <li key={employee.id} className={`em-row${isSelected ? ' is-on' : ''}`}>
                    <span className="em-avatar" aria-hidden="true">
                      {initials(employee.name)}
                    </span>
                    <div className="em-cell">
                      <strong>{employee.name}</strong>
                      <span className="em-sub">{employee.position}</span>
                    </div>
                    <span data-label="Department">{employee.department}</span>
                    <span
                      data-label="Cases"
                      className={`em-chip ${employee.cases.length > 1 ? 'em-chip--indigo' : 'em-chip--gray'}`}
                    >
                      {caseLabel(employee.cases.length)}
                    </span>
                    <span
                      data-label="Latest stage"
                      className={`em-chip em-chip--${chip.tone}`}
                      title={chip.text}
                    >
                      {chip.text}
                    </span>
                    <button
                      type="button"
                      className="em-open"
                      aria-label={`View ${employee.name}`}
                      aria-pressed={isSelected}
                      onClick={() => writeSelected(employee.id)}
                    >
                      →
                    </button>
                  </li>
                );
              })}
            </ul>

            <footer className="em-foot">
              <span className="em-sub">
                Showing {items.length} of {filtered.length} people
              </span>
              <span className="em-pager">
                <button
                  type="button"
                  className="em-tab"
                  disabled={current <= 1}
                  onClick={() => setPage(current - 1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="em-tab em-tab--primary"
                  disabled={current >= pages}
                  onClick={() => setPage(current + 1)}
                >
                  Next
                </button>
              </span>
            </footer>
          </section>

          <aside className="em-card em-detail" aria-label="Employee history">
            {selected ? (
              <>
                <div className="em-who">
                  <span className="em-avatar em-avatar--lg" aria-hidden="true">
                    {initials(selected.name)}
                  </span>
                  <div>
                    <strong>{selected.name}</strong>
                    <span className="em-sub">
                      {selected.position} · {selected.department}
                    </span>
                  </div>
                </div>
                {isAdmin &&
                  primaryCaseId &&
                  (editingName ? (
                    <form
                      className="em-rename"
                      onSubmit={(event) => {
                        event.preventDefault();
                        nameMutation.mutate({
                          caseId: primaryCaseId,
                          displayName: nameDraft,
                          reason: nameReason,
                        });
                      }}
                    >
                      <label>
                        <small>Employee name</small>
                        <input
                          type="text"
                          value={nameDraft}
                          minLength={2}
                          maxLength={120}
                          required
                          onChange={(event) => setNameDraft(event.target.value)}
                        />
                      </label>
                      <label>
                        <small>Reason for the correction</small>
                        <input
                          type="text"
                          value={nameReason}
                          minLength={10}
                          maxLength={500}
                          required
                          placeholder="At least 10 characters"
                          onChange={(event) => setNameReason(event.target.value)}
                        />
                      </label>
                      {nameMutation.isError && (
                        <p className="em-rename__error" role="alert">
                          {nameMutation.error instanceof Error
                            ? nameMutation.error.message
                            : 'The name could not be saved.'}
                        </p>
                      )}
                      <div className="em-rename__actions">
                        <button
                          type="button"
                          className="em-tab"
                          onClick={() => setEditingName(false)}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="em-tab em-tab--primary"
                          disabled={nameMutation.isPending}
                        >
                          {nameMutation.isPending ? 'Saving…' : 'Save name'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      type="button"
                      className="em-tab em-rename__open"
                      onClick={() => {
                        setNameDraft(selected.name);
                        setNameReason('');
                        nameMutation.reset();
                        setEditingName(true);
                      }}
                    >
                      Correct name
                    </button>
                  ))}
                <h2>History · {caseLabel(selected.cases.length)}</h2>
                <ul className="em-tl">
                  {selected.cases.map((item, index) => {
                    const chip = stageChip(item);
                    const when = formatRequested(item.requestedAt);
                    const detail: AssessmentCaseDetail | undefined =
                      selectedCaseDetails[index]?.data;
                    const activity = [...(detail?.activity ?? [])].sort(
                      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
                    );
                    return (
                      <li key={item.id} className="em-case-detail">
                        <div className="em-tl__top">
                          <div>
                            <b title={item.caseId}>{formatCaseId(item.caseId)}</b>
                            <span className="em-sub em-case-reason">{item.reason}</span>
                          </div>
                          <span className={`em-chip em-chip--${chip.tone}`}>{chip.text}</span>
                        </div>
                        <div className="em-detail-grid">
                          <span>
                            <small>Requested</small>
                            <strong>
                              {when.date} · {when.ago}
                            </strong>
                          </span>
                          <span>
                            <small>Owner</small>
                            <strong>{detail?.owner ?? item.owner}</strong>
                          </span>
                          <span>
                            <small>Priority</small>
                            <strong>{detail?.priority ?? '—'}</strong>
                          </span>
                          <span>
                            <small>Candidate</small>
                            <strong>
                              {detail?.candidateType === 'NEW_CANDIDATE'
                                ? 'New candidate'
                                : 'Internal employee'}
                            </strong>
                          </span>
                          {detail?.candidateType === 'NEW_CANDIDATE' && (
                            <span>
                              <small>Hiring outcome</small>
                              <strong>{detail.hiringOutcome.replace(/_/g, ' ')}</strong>
                            </span>
                          )}
                          <span className="em-detail-grid__wide">
                            <small>Role change</small>
                            <strong>
                              {detail?.currentRole || '—'} → {detail?.targetRole || item.position}
                              {detail?.targetLevel ? ` · ${detail.targetLevel}` : ''}
                            </strong>
                          </span>
                        </div>

                        {detail?.justification && (
                          <div className="em-case-section">
                            <strong>Business justification</strong>
                            <p>{detail.justification}</p>
                          </div>
                        )}

                        {detail?.eligibility?.criteria.length ? (
                          <div className="em-case-section">
                            <strong>Eligibility review</strong>
                            <ul className="em-criteria-list">
                              {detail.eligibility.criteria.map((criterion) => (
                                <li key={criterion.code}>
                                  <span>{criterion.label}</span>
                                  <b
                                    className={`em-result em-result--${criterion.result.toLowerCase()}`}
                                  >
                                    {criterion.result.replace(/_/g, ' ')}
                                  </b>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        <div className="em-case-section">
                          <strong>Activity history</strong>
                          {selectedCaseDetails[index]?.isLoading ? (
                            <span className="em-sub">Loading case activity…</span>
                          ) : activity.length ? (
                            <ol className="em-activity-list">
                              {activity.map((event) => (
                                <li key={event.id}>
                                  <span
                                    className={`em-activity-dot em-activity-dot--${event.tone}`}
                                  />
                                  <div>
                                    <b>{event.action}</b>
                                    <span className="em-sub">
                                      {event.actor} · {new Date(event.timestamp).toLocaleString()}
                                    </span>
                                  </div>
                                </li>
                              ))}
                            </ol>
                          ) : (
                            <span className="em-sub">No activity recorded yet.</span>
                          )}
                        </div>

                        <div className="em-tl__bottom">
                          <span className="em-sub">Case {formatCaseId(item.caseId)}</span>
                          <a href={item.href}>Open full case →</a>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <p className="em-note">Private assessor evidence is not shown here.</p>
              </>
            ) : (
              <p className="em-empty">Pick an employee to see their history.</p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
