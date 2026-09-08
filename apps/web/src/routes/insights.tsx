import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Building2,
  Download,
  Layers,
  LockKeyhole,
  RotateCcw,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import { api } from '../lib/api';
import { copy, reasonLabels, statusLabels, statusTone, type Copy } from '../lib/labels';
import {
  ErrorBanner,
  MetricCard,
  PageHeading,
  PanelHeader,
  SkeletonMetric,
} from '../components/ui';
import { useToast } from '../hooks/use-toast';

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

const allStages = [
  'REQUEST',
  'ELIGIBILITY',
  'PLANNING',
  'ASSESSMENT',
  'RESULT',
  'RECOMMENDATION',
  'APPROVAL',
  'FOLLOW_UP',
  'CLOSED',
] as const;

export function InsightsPage({ t: propT }: { t?: Copy } = {}) {
  const t = propT ?? copy;
  const { showToast } = useToast();

  const [reasonFilter, setReasonFilter] = useState<string>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const { isLoading: overviewLoading, isError: overviewError } = useQuery({
    queryKey: ['overview'],
    queryFn: api.overview,
  });
  const {
    data: cases,
    isLoading: casesLoading,
    isError: casesError,
  } = useQuery({ queryKey: ['cases'], queryFn: () => api.cases() });

  const isLoading = overviewLoading || casesLoading;
  const isError = overviewError || casesError;
  const canExport = !casesLoading && !casesError && Array.isArray(cases);

  const totalCases = cases?.length ?? 0;

  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    for (const item of cases ?? []) {
      if (item.department?.trim()) set.add(item.department.trim());
    }
    return Array.from(set).sort();
  }, [cases]);

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    for (const item of cases ?? []) {
      if (item.status) set.add(item.status);
    }
    return Array.from(set).sort();
  }, [cases]);

  const filteredCases = useMemo(() => {
    if (!cases) return [];
    return cases.filter((item) => {
      if (reasonFilter !== 'ALL' && item.assessmentReason !== reasonFilter) return false;
      if (departmentFilter !== 'ALL' && item.department !== departmentFilter) return false;
      if (stageFilter !== 'ALL' && item.stage !== stageFilter) return false;
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      return true;
    });
  }, [cases, reasonFilter, departmentFilter, stageFilter, statusFilter]);

  const hasActiveFilters =
    reasonFilter !== 'ALL' ||
    departmentFilter !== 'ALL' ||
    stageFilter !== 'ALL' ||
    statusFilter !== 'ALL';

  const handleResetFilters = () => {
    setReasonFilter('ALL');
    setDepartmentFilter('ALL');
    setStageFilter('ALL');
    setStatusFilter('ALL');
  };

  const totalFiltered = filteredCases.length;

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of filteredCases) {
      counts[item.status] = (counts[item.status] ?? 0) + 1;
    }
    return counts;
  }, [filteredCases]);

  const reasonCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of filteredCases) {
      counts[item.assessmentReason] = (counts[item.assessmentReason] ?? 0) + 1;
    }
    return counts;
  }, [filteredCases]);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of filteredCases) {
      counts[item.stage] = (counts[item.stage] ?? 0) + 1;
    }
    return counts;
  }, [filteredCases]);

  const departmentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of filteredCases) {
      counts[item.department] = (counts[item.department] ?? 0) + 1;
    }
    return counts;
  }, [filteredCases]);

  const inDevCount = statusCounts['DEVELOPMENT_IN_PROGRESS'] ?? 0;
  const pendingCount = useMemo(
    () => filteredCases.filter((c) => c.status.startsWith('PENDING')).length,
    [filteredCases],
  );
  const activePipelineCount = useMemo(
    () => filteredCases.filter((c) => c.status !== 'CLOSED' && c.status !== 'CANCELLED').length,
    [filteredCases],
  );

  const handleExportCsv = () => {
    if (!cases || filteredCases.length === 0) return;

    const lines: string[] = [
      '# AssessFlow Analytics & Reporting Export (Read-Only Aggregates)',
      `# Generated: ${new Date().toISOString()}`,
      `# Filter Criteria: Reason=${reasonFilter}; Department=${departmentFilter}; Stage=${stageFilter}; Status=${statusFilter}`,
      `# Total Filtered Cases: ${totalFiltered}`,
      '',
      '# AGGREGATE BREAKDOWN BY STATUS',
      'Dimension,Category,Count,Percentage',
      ...Object.entries(statusCounts).map(([st, cnt]) => {
        const pct = totalFiltered > 0 ? Math.round((cnt / totalFiltered) * 100) : 0;
        return `Status,"${statusLabels[st] ?? st}",${cnt},${pct}%`;
      }),
      '',
      '# AGGREGATE BREAKDOWN BY REASON',
      'Dimension,Category,Count,Percentage',
      ...Object.entries(reasonLabels).map(([code, label]) => {
        const cnt = reasonCounts[code] ?? 0;
        const pct = totalFiltered > 0 ? Math.round((cnt / totalFiltered) * 100) : 0;
        return `Reason,"${label}",${cnt},${pct}%`;
      }),
      '',
      '# AGGREGATE BREAKDOWN BY STAGE',
      'Dimension,Category,Count,Percentage',
      ...Object.entries(stageCounts).map(([stg, cnt]) => {
        const pct = totalFiltered > 0 ? Math.round((cnt / totalFiltered) * 100) : 0;
        return `Stage,"${stageDisplayMap[stg] ?? stg}",${cnt},${pct}%`;
      }),
      '',
      '# AGGREGATE BREAKDOWN BY DEPARTMENT',
      'Dimension,Category,Count,Percentage',
      ...Object.entries(departmentCounts).map(([dept, cnt]) => {
        const pct = totalFiltered > 0 ? Math.round((cnt / totalFiltered) * 100) : 0;
        return `Department,"${dept}",${cnt},${pct}%`;
      }),
      '',
      '# FILTERED CASE SUMMARY RECORDS (READ-ONLY METADATA - NO EVIDENCE TEXT)',
      'Case Code,Department,Assessment Reason,Stage,Status,Owner,Requested Date,Age',
      ...filteredCases.map((c) => {
        const dateStr = c.requestedAt ? new Date(c.requestedAt).toISOString().slice(0, 10) : '';
        return `${c.caseCode},"${c.department.replace(/"/g, '""')}","${(reasonLabels[c.assessmentReason] ?? c.assessmentReason).replace(/"/g, '""')}",${c.stage},"${(statusLabels[c.status] ?? c.status).replace(/"/g, '""')}","${c.owner.replace(/"/g, '""')}",${dateStr},"${c.ageLabel}"`;
      }),
    ];

    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `assessflow-insights-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Analytics & reporting aggregates exported as CSV.');
  };

  return (
    <>
      <PageHeading
        eyebrow="ANALYTICS & REPORTING"
        title={t.insights}
        subtitle="Read-only aggregate metrics, stage distributions, and assessment reasons across active cycles."
        action={
          canExport ? (
            <button
              type="button"
              className="secondary-button"
              onClick={handleExportCsv}
              disabled={filteredCases.length === 0}
              title="Download client-side CSV of filtered read-only aggregates"
            >
              <Download size={15} />
              Export aggregates (CSV)
            </button>
          ) : undefined
        }
      />
      {isError && <ErrorBanner message="Insights data could not load." />}

      <section className="panel builder-panel" aria-label="Reports builder">
        <PanelHeader
          icon={<BarChart3 size={17} />}
          title="Reports builder"
          action={
            hasActiveFilters ? (
              <button
                type="button"
                className="link-button"
                onClick={handleResetFilters}
                style={{ fontSize: '11px' }}
              >
                <RotateCcw size={12} />
                Reset filters
              </button>
            ) : undefined
          }
        />
        <div className="builder-grid">
          <label className="field">
            <span>Assessment reason</span>
            <select
              value={reasonFilter}
              onChange={(event) => setReasonFilter(event.target.value)}
              disabled={isLoading}
            >
              <option value="ALL">All reasons</option>
              <option value="PROMOTION">Promotion</option>
              <option value="INTERNAL_MOBILITY">Internal mobility</option>
              <option value="ROLE_REALIGNMENT">Role realignment</option>
            </select>
          </label>
          <label className="field">
            <span>Department</span>
            <select
              value={departmentFilter}
              onChange={(event) => setDepartmentFilter(event.target.value)}
              disabled={isLoading}
            >
              <option value="ALL">All departments</option>
              {departmentOptions.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Workflow stage</span>
            <select
              value={stageFilter}
              onChange={(event) => setStageFilter(event.target.value)}
              disabled={isLoading}
            >
              <option value="ALL">All stages</option>
              {allStages.map((stg) => (
                <option key={stg} value={stg}>
                  {stageDisplayMap[stg] ?? stg}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Case status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              disabled={isLoading}
            >
              <option value="ALL">All statuses</option>
              {statusOptions.map((st) => (
                <option key={st} value={st}>
                  {statusLabels[st] ?? st}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="builder-toolbar">
          <span style={{ fontSize: '12px', color: 'var(--secondary)' }}>
            {hasActiveFilters ? (
              <>
                Showing <b>{totalFiltered}</b> of <b>{totalCases}</b> cases matching filters
              </>
            ) : (
              <>
                Showing all <b>{totalCases}</b> cases across active cycles
              </>
            )}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {hasActiveFilters && (
              <button
                type="button"
                className="secondary-button"
                onClick={handleResetFilters}
                style={{ minHeight: '34px', padding: '0 12px', fontSize: '11px' }}
              >
                <RotateCcw size={13} />
                Reset filters
              </button>
            )}
            {canExport && (
              <button
                type="button"
                className="secondary-button"
                onClick={handleExportCsv}
                disabled={filteredCases.length === 0}
                style={{ minHeight: '34px', padding: '0 12px', fontSize: '11px' }}
              >
                <Download size={13} />
                Download CSV
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="metric-grid" aria-label="Assessment aggregate metrics">
        {isLoading ? (
          [1, 2, 3, 4].map((key) => <SkeletonMetric key={key} />)
        ) : (
          <>
            <MetricCard
              metric={{
                label: 'Total cases',
                value: totalFiltered,
                context: hasActiveFilters ? 'Matching filtered criteria' : 'Assessed talent pool',
                trend: `${totalFiltered} total`,
                tone: 'positive',
              }}
            />
            <MetricCard
              metric={{
                label: 'Active in pipeline',
                value: activePipelineCount,
                context: 'In-flight assessments',
                trend: 'Active cycle',
                tone: 'positive',
              }}
            />
            <MetricCard
              metric={{
                label: 'Pending decisions',
                value: pendingCount,
                context: 'Eligibility & approval gates',
                trend: 'Action needed',
                tone: 'warning',
              }}
            />
            <MetricCard
              metric={{
                label: 'In development',
                value: inDevCount,
                context: 'Capability growth phase',
                trend: 'Post-assessment',
                tone: 'teal',
              }}
            />
          </>
        )}
      </section>

      {totalFiltered === 0 && !isLoading ? (
        <section
          className="panel"
          style={{ padding: '40px 24px', textAlign: 'center', marginBottom: '20px' }}
        >
          <div className="empty-state">
            <div className="empty-icon">
              <Search size={21} />
            </div>
            <strong>No matching cases found</strong>
            <span>
              No assessment cases match your active filter selections. Try adjusting or clearing
              your dimension filters.
            </span>
            <button
              type="button"
              className="secondary-button"
              onClick={handleResetFilters}
              style={{ marginTop: '14px', alignSelf: 'center' }}
            >
              <RotateCcw size={13} />
              Reset all filters
            </button>
          </div>
        </section>
      ) : (
        <>
          <div className="content-grid dashboard-grid">
            <section className="panel pipeline-panel">
              <PanelHeader
                icon={<BarChart3 size={17} />}
                title="Counts by status"
                action={
                  <span className="soft-count">{Object.keys(statusCounts).length} statuses</span>
                }
              />
              <div className="pipeline-list">
                {Object.keys(statusCounts).length === 0 ? (
                  <div className="empty-state">
                    <span>No status data available</span>
                  </div>
                ) : (
                  Object.entries(statusCounts).map(([status, count]) => {
                    const pct = totalFiltered > 0 ? Math.round((count / totalFiltered) * 100) : 0;
                    const tone =
                      statusTone(status) === 'success'
                        ? 'teal'
                        : statusTone(status) === 'warning'
                          ? 'warning'
                          : 'violet';
                    return (
                      <div className="pipeline-row" key={status}>
                        <div className="pipeline-label">
                          <span>{statusLabels[status] ?? status}</span>
                          <b>
                            {count} ({pct}%)
                          </b>
                        </div>
                        <div className="pipeline-bar">
                          <i className={tone} style={{ width: `${Math.max(pct, 6)}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
            <section className="panel pipeline-panel">
              <PanelHeader
                icon={<Users size={17} />}
                title="Counts by reason"
                action={
                  <span className="soft-count">{Object.keys(reasonLabels).length} reasons</span>
                }
              />
              <div className="pipeline-list">
                {Object.entries(reasonLabels).map(([reasonKey, reasonLabel]) => {
                  const count = reasonCounts[reasonKey] ?? 0;
                  const pct = totalFiltered > 0 ? Math.round((count / totalFiltered) * 100) : 0;
                  return (
                    <div className="pipeline-row" key={reasonKey}>
                      <div className="pipeline-label">
                        <span>{reasonLabel}</span>
                        <b>
                          {count} ({pct}%)
                        </b>
                      </div>
                      <div className="pipeline-bar">
                        <i style={{ width: `${Math.max(pct, 6)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="content-grid dashboard-grid">
            <section className="panel pipeline-panel">
              <PanelHeader
                icon={<Layers size={17} />}
                title="Counts by stage"
                action={
                  <span className="soft-count">{Object.keys(stageCounts).length} stages</span>
                }
              />
              <div className="pipeline-list">
                {Object.keys(stageCounts).length === 0 ? (
                  <div className="empty-state">
                    <span>No stage data available</span>
                  </div>
                ) : (
                  Object.entries(stageCounts).map(([stage, count]) => {
                    const pct = totalFiltered > 0 ? Math.round((count / totalFiltered) * 100) : 0;
                    return (
                      <div className="pipeline-row" key={stage}>
                        <div className="pipeline-label">
                          <span>{stageDisplayMap[stage] ?? stage}</span>
                          <b>
                            {count} ({pct}%)
                          </b>
                        </div>
                        <div className="pipeline-bar">
                          <i className="indigo" style={{ width: `${Math.max(pct, 6)}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
            <section className="panel pipeline-panel">
              <PanelHeader
                icon={<Building2 size={17} />}
                title="Counts by department"
                action={
                  <span className="soft-count">
                    {Object.keys(departmentCounts).length} departments
                  </span>
                }
              />
              <div className="pipeline-list">
                {Object.keys(departmentCounts).length === 0 ? (
                  <div className="empty-state">
                    <span>No department data available</span>
                  </div>
                ) : (
                  Object.entries(departmentCounts).map(([dept, count]) => {
                    const pct = totalFiltered > 0 ? Math.round((count / totalFiltered) * 100) : 0;
                    return (
                      <div className="pipeline-row" key={dept}>
                        <div className="pipeline-label">
                          <span>{dept}</span>
                          <b>
                            {count} ({pct}%)
                          </b>
                        </div>
                        <div className="pipeline-bar">
                          <i className="teal" style={{ width: `${Math.max(pct, 6)}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        </>
      )}

      <div className="pipeline-note" role="note" style={{ marginTop: '20px' }}>
        {canExport ? <Sparkles size={15} /> : <LockKeyhole size={15} />}
        <span>
          {canExport
            ? 'Export generates client-side read-only aggregate metrics under organizational talent governance policies. Confidential evidence records and employee notes are excluded.'
            : 'Export is restricted until assessment workspace query succeeds. In-app view adheres to organizational talent governance policies.'}
        </span>
      </div>
    </>
  );
}
