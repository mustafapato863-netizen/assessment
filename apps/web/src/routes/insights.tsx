import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AssessmentCaseSummary } from '@assessflow/contracts';
import { ErrorBanner, LoadingRows } from '../components/ui';
import { api } from '../lib/api';
import { reasonLabels } from '../lib/labels';
import { queryKeys } from '../lib/query-keys';
import { mapAssessmentCase } from './assessment-case-adapter';
import { mapDevelopmentPlan, type DevelopmentPlanData } from './development-logic';
import { STAGE_LABELS } from '../shared/definitions';
import {
  applyFilters,
  byDepartment,
  byReason,
  byStage,
  byStatus,
  downloadCsv,
  filterOptions,
  insightsKpis,
  aggregatesToCsv,
  type InsightFilters,
} from './insights-logic';
import './insights.css';

const EMPTY_FILTERS: InsightFilters = { reason: '', dept: '', stage: '', status: '' };

function BarCard({
  title,
  meta,
  rows,
  highlightKey,
  selectedKey,
  onSelectKey,
  scrollable = false,
  children,
}: {
  title: string;
  meta: string;
  rows: ReturnType<typeof byStage>;
  highlightKey?: string | null;
  selectedKey?: string;
  onSelectKey?: (key: string) => void;
  scrollable?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className="in-card" aria-label={title}>
      <div className="in-card__head">
        <h2>{title}</h2>
        <span className="in-sub">{meta}</span>
      </div>
      <ul className={`in-bars${scrollable ? ' in-bars--scrollable' : ''}`}>
        {rows.map((row) => {
          const interactive = Boolean(onSelectKey) && row.count > 0;
          const isSelected = Boolean(selectedKey) && selectedKey === row.key;
          const content = (
            <>
              <span className="in-bar__label" title={row.label}>
                {row.label}
              </span>
              <span className="in-bar__track" aria-hidden="true">
                <i
                  className={row.key === highlightKey || isSelected ? 'is-hot' : ''}
                  style={{ width: `${row.barPercent}%` }}
                />
              </span>
              <b>{row.count}</b>
              <span className="in-bar__pct">{row.percent}%</span>
            </>
          );
          return (
            <li
              key={row.key}
              className={`in-bar${row.count === 0 ? ' is-zero' : ''}`}
              style={isSelected ? { fontWeight: 700, color: 'var(--primary)' } : undefined}
            >
              {interactive ? (
                <button
                  type="button"
                  onClick={() => onSelectKey?.(isSelected ? '' : row.key)}
                  title={isSelected ? `Clear ${row.label} filter` : `Filter by ${row.label}`}
                  style={{
                    display: 'contents',
                    textAlign: 'inherit',
                    color: 'inherit',
                    font: 'inherit',
                  }}
                >
                  {content}
                </button>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ul>
      {children}
    </section>
  );
}

function FilterSelect({
  label,
  value,
  options,
  allLabel,
  onChange,
  format = (option: string) => option,
}: {
  label: string;
  value: string;
  options: string[];
  allLabel: string;
  onChange: (value: string) => void;
  format?: (value: string) => string;
}) {
  return (
    <label className="in-select">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {format(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function InsightsPage() {
  const [filters, setFilters] = useState<InsightFilters>(EMPTY_FILTERS);

  const casesQuery = useQuery({
    queryKey: queryKeys.cases(),
    queryFn: () => api.cases(),
    staleTime: 60_000,
  });

  const devPlansQuery = useQuery({
    queryKey: queryKeys.developmentPlans(),
    queryFn: () => api.developmentPlans(),
    staleTime: 60_000,
  });

  const developmentCases = useMemo(
    () => (casesQuery.data ?? []).filter((item) => item.status === 'DEVELOPMENT_IN_PROGRESS'),
    [casesQuery.data],
  );

  const planByCaseId = useMemo(
    () => new Map((devPlansQuery.data ?? []).map((p) => [p.caseId, p])),
    [devPlansQuery.data],
  );

  const cases = useMemo(
    () => (casesQuery.data ?? []).map((item) => mapAssessmentCase(item as AssessmentCaseSummary)),
    [casesQuery.data],
  );

  const options = useMemo(() => filterOptions(cases), [cases]);
  const filtered = useMemo(() => applyFilters(cases, filters), [cases, filters]);
  const filteredIds = useMemo(() => new Set(filtered.map((item) => item.id)), [filtered]);

  const filteredDevelopmentPlans = useMemo(
    () =>
      developmentCases
        .filter((item) => filteredIds.has(item.id))
        .map((item) =>
          mapDevelopmentPlan(
            mapAssessmentCase(item as AssessmentCaseSummary),
            (planByCaseId.get(item.id) as DevelopmentPlanData | undefined) ?? null,
          ),
        ),
    [developmentCases, filteredIds, planByCaseId],
  );

  const developmentCount = useMemo(
    () => filteredDevelopmentPlans.filter((plan) => !plan.archived).length,
    [filteredDevelopmentPlans],
  );

  const kpis = useMemo(
    () => insightsKpis(filtered, { developmentCount }),
    [filtered, developmentCount],
  );
  const statusRows = useMemo(() => byStatus(filtered), [filtered]);
  const stageRows = useMemo(() => byStage(filtered), [filtered]);
  const reasonRows = useMemo(() => byReason(filtered, Object.values(reasonLabels)), [filtered]);
  const departmentRows = useMemo(() => byDepartment(filtered), [filtered]);
  const bottleneck = stageRows
    .filter((row) => row.key !== 'closed')
    .sort((a, b) => b.count - a.count)[0];
  const isFiltering = Object.values(filters).some(Boolean);
  const newCandidates = (casesQuery.data ?? []).filter(
    (item) => item.candidateType === 'NEW_CANDIDATE',
  );
  const filteredNewCandidates = filtered.filter((item) =>
    newCandidates.some((candidate) => candidate.caseCode === item.caseId),
  );
  const candidateSummary = {
    assessed: filteredNewCandidates.length,
    joined: filteredNewCandidates.filter((item) =>
      newCandidates.some(
        (candidate) => candidate.caseCode === item.caseId && candidate.hiringOutcome === 'JOINED',
      ),
    ).length,
    notHired: filteredNewCandidates.filter((item) =>
      newCandidates.some(
        (candidate) =>
          candidate.caseCode === item.caseId &&
          candidate.hiringOutcome === 'NOT_JOINED' &&
          candidate.hiringOutcomeReason === 'ASSESSMENT',
      ),
    ).length,
  };
  const hasCandidates = candidateSummary.assessed > 0;

  const setFilter = (key: keyof InsightFilters) => (value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));

  const exportAggregates = () => {
    const csv = aggregatesToCsv([
      { title: 'By status', rows: statusRows },
      { title: 'By reason', rows: reasonRows },
      { title: 'By stage', rows: stageRows },
      { title: 'By department', rows: departmentRows },
    ]);
    downloadCsv('assessflow-aggregates.csv', csv);
  };

  if (casesQuery.isLoading || devPlansQuery.isLoading) return <LoadingRows />;
  if (casesQuery.isError) {
    return (
      <ErrorBanner
        message="Insights data could not load."
        onRetry={() => void casesQuery.refetch()}
      />
    );
  }

  return (
    <div className="in">
      <header className="in-head">
        <div>
          <h1>Insights</h1>
          <p>
            {isFiltering
              ? `Showing ${filtered.length} of ${cases.length} cases.`
              : `Showing all ${cases.length} cases in this workspace.`}{' '}
            Filter or click any chart bar to compare reasons, stages, and departments.
          </p>
        </div>
        <button type="button" className="in-btn" onClick={exportAggregates}>
          Export aggregates (CSV)
        </button>
      </header>

      <section className="in-filters" aria-label="Filters">
        <FilterSelect
          label="Assessment reason"
          value={filters.reason ?? ''}
          onChange={setFilter('reason')}
          options={options.reasons}
          allLabel="All reasons"
        />
        <FilterSelect
          label="Department"
          value={filters.dept ?? ''}
          onChange={setFilter('dept')}
          options={options.departments}
          allLabel="All departments"
        />
        <FilterSelect
          label="Workflow stage"
          value={filters.stage ?? ''}
          onChange={setFilter('stage')}
          options={options.stages}
          allLabel="All stages"
          format={(stage) => STAGE_LABELS[stage as keyof typeof STAGE_LABELS] ?? stage}
        />
        <FilterSelect
          label="Case status"
          value={filters.status ?? ''}
          onChange={setFilter('status')}
          options={options.statuses}
          allLabel="All statuses"
        />
        {isFiltering && (
          <button type="button" className="in-clear" onClick={() => setFilters(EMPTY_FILTERS)}>
            Clear filters
          </button>
        )}
      </section>

      {filtered.length === 0 && (
        <p className="in-empty" role="status">
          No cases match these filters. Clear a filter to see more.
        </p>
      )}

      <section className="in-kpis" aria-label="Summary">
        <div className="in-kpi in-kpi--on">
          <span>Total cases</span>
          <b>{kpis.total}</b>
          <small>Assessed talent pool</small>
        </div>
        <div className="in-kpi">
          <span>Active in pipeline</span>
          <b>{kpis.active}</b>
          <small>Not closed yet</small>
        </div>
        <div className="in-kpi">
          <span>Pending decisions</span>
          <b>{kpis.pending}</b>
          <small>Pending statuses or in Decision stage</small>
        </div>
        <div className="in-kpi">
          <span>In development</span>
          <b>{kpis.inDevelopment}</b>
          <small>Active plans · Development page</small>
        </div>
      </section>

      <section className="in-strip" aria-label="Candidate pipeline">
        <b>Candidate pipeline</b>
        <span className="in-sub">
          Assessed <b>{candidateSummary.assessed}</b> · Joined <b>{candidateSummary.joined}</b> ·
          Not hired due to assessment <b>{candidateSummary.notHired}</b>
        </span>
        {!hasCandidates && <span className="in-sub">No external candidate cases yet</span>}
      </section>

      <div className="in-grid">
        <BarCard
          title="By status"
          meta={`${statusRows.length} statuses`}
          rows={statusRows}
          selectedKey={filters.status}
          onSelectKey={setFilter('status')}
        />
        <BarCard
          title="By stage"
          meta="Workflow order"
          rows={stageRows}
          highlightKey={bottleneck?.count ? bottleneck.key : null}
          selectedKey={filters.stage}
          onSelectKey={setFilter('stage')}
        />
        <BarCard
          title="By department"
          meta={`${departmentRows.length} departments`}
          rows={departmentRows}
          selectedKey={filters.dept}
          onSelectKey={setFilter('dept')}
          scrollable
        />
        <BarCard
          title="By reason"
          meta={`${reasonRows.filter((row) => row.count > 0).length} reasons with cases`}
          rows={reasonRows}
          selectedKey={filters.reason}
          onSelectKey={setFilter('reason')}
        >
          <p className="in-note">Reasons with no cases are shown at the bottom, in grey.</p>
        </BarCard>
      </div>

      <p className="in-sub in-export-note">
        Exports contain aggregate numbers only. Employee names, private notes and evidence are not
        included.
      </p>
    </div>
  );
}
