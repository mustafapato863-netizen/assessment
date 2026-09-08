import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  HelpCircle,
  Layers,
  LayoutGrid,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Table as TableIcon,
  TrendingUp,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import type { CalibrationCandidate, CalibrationMatrixResponse } from '@assessflow/contracts';
import { api } from '../lib/api';
import { copy, type Copy } from '../lib/labels';
import { PanelHeader } from '../components/ui';
import { useToast } from '../hooks/use-toast';

// Department color palette for candidate avatars
const DEPT_COLORS: Record<string, string> = {
  Engineering: '#0084ce',
  Product: '#7c3aed',
  People: '#059669',
  Clinical: '#00a3e0',
  Operations: '#d97706',
  Default: '#475569',
};

// Strategic Talent Tiers for 9-Box
interface BoxConfig {
  icon: typeof Star;
  tierClass: 'tier-top' | 'tier-core' | 'tier-watch' | 'tier-risk';
  categoryTitle: string;
  recommendation: string;
}

const BOX_CONFIGS: Record<number, BoxConfig> = {
  9: {
    icon: Star,
    tierClass: 'tier-top',
    categoryTitle: 'Top Talent / Future Leader',
    recommendation:
      'Immediate candidate for promotion, executive sponsorship, and retention incentive.',
  },
  8: {
    icon: TrendingUp,
    tierClass: 'tier-top',
    categoryTitle: 'High Potential / Growth Leader',
    recommendation: 'Expand leadership scope, assign strategic cross-functional initiative.',
  },
  7: {
    icon: Sparkles,
    tierClass: 'tier-core',
    categoryTitle: 'Diamond in the Rough / Enigma',
    recommendation: 'Identify root cause of performance bottleneck; pair with senior mentor.',
  },
  6: {
    icon: Award,
    tierClass: 'tier-top',
    categoryTitle: 'High Professional / Solid Driver',
    recommendation:
      'Stretch into higher complexity tasks; test for broader organizational leadership.',
  },
  5: {
    icon: ShieldCheck,
    tierClass: 'tier-core',
    categoryTitle: 'Core Contributor / Critical Backbone',
    recommendation: 'Keep motivated, recognize contribution, provide targeted skill development.',
  },
  4: {
    icon: HelpCircle,
    tierClass: 'tier-watch',
    categoryTitle: 'Inconsistent Performer / Dilemma',
    recommendation: 'Clarify role expectations, set 90-day performance milestones.',
  },
  3: {
    icon: CheckCircle2,
    tierClass: 'tier-core',
    categoryTitle: 'Solid Professional / Workhorse',
    recommendation:
      'Deep technical expert; invest in specialization rather than general management.',
  },
  2: {
    icon: Clock,
    tierClass: 'tier-watch',
    categoryTitle: 'Effective / Realign Role',
    recommendation: 'Assess role-fit vs skill gaps; consider alternative departmental assignment.',
  },
  1: {
    icon: ShieldAlert,
    tierClass: 'tier-risk',
    categoryTitle: 'Underperformer / Action Required',
    recommendation: 'Initiate formal Performance Improvement Plan (PIP) or transition planning.',
  },
};

export function CalibrationPage({ t: propT }: { t?: Copy } = {}) {
  const t = propT ?? copy;
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedReadiness, setSelectedReadiness] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'matrix' | 'table'>('matrix');

  const { data: matrix, isLoading } = useQuery<CalibrationMatrixResponse>({
    queryKey: ['calibration-matrix', selectedDept],
    queryFn: () => api.getCalibrationMatrix(selectedDept === 'ALL' ? undefined : selectedDept),
  });

  // Flat list of all candidates across the 9-box grid
  const allCandidates = useMemo(() => {
    if (!matrix?.grid) return [];
    return matrix.grid.flatMap((cell) =>
      cell.candidates.map((cand) => ({
        ...cand,
        cellLabel: cell.label,
        cellDescription: cell.description,
      })),
    );
  }, [matrix]);

  // Filtered candidates based on search & readiness
  const filteredCandidates = useMemo(() => {
    return allCandidates.filter((cand) => {
      const matchesSearch =
        !searchQuery.trim() ||
        cand.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cand.currentRole.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cand.targetRole.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cand.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cand.caseCode.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesReadiness =
        selectedReadiness === 'ALL' ||
        (selectedReadiness === 'READY_NOW' && cand.resultCode === 'READY_NOW') ||
        (selectedReadiness === 'WITH_DEV' && cand.resultCode === 'READY_WITH_DEVELOPMENT') ||
        (selectedReadiness === 'NOT_READY' && cand.resultCode === 'NOT_READY');

      return matchesSearch && matchesReadiness;
    });
  }, [allCandidates, searchQuery, selectedReadiness]);

  // Selected candidate object for slide-over drawer
  const activeCandidate = useMemo(() => {
    if (!selectedCandidateId) return null;
    return (
      allCandidates.find((c) => c.id === selectedCandidateId || c.caseId === selectedCandidateId) ??
      null
    );
  }, [allCandidates, selectedCandidateId]);

  const handleExportCohort = () => {
    if (!allCandidates.length) {
      showToast('No cohort data available to export.');
      return;
    }
    const headers = [
      'Case ID',
      'Case Code',
      'Candidate Name',
      'Department',
      'Current Level',
      'Target Level',
      'Target Role',
      'Box Number',
      'Box Label',
      'Performance Band',
      'Potential Band',
      'Readiness Status',
    ];
    const rows = filteredCandidates.map((c) => [
      c.caseId,
      c.caseCode,
      `"${c.displayName.replace(/"/g, '""')}"`,
      `"${c.department.replace(/"/g, '""')}"`,
      c.currentLevel,
      c.targetLevel,
      `"${c.targetRole.replace(/"/g, '""')}"`,
      c.boxIndex,
      `"${c.boxLabel.replace(/"/g, '""')}"`,
      c.performanceBand,
      c.potentialBand,
      `"${c.readinessLabel.replace(/"/g, '""')}"`,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `assessflow_calibration_${selectedDept.toLowerCase()}_cohort_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(
      `Talent calibration cohort (${filteredCandidates.length} candidates) exported as CSV.`,
    );
  };

  const departments = ['ALL', 'Product', 'Engineering', 'People'];

  return (
    <div className="calibration-workspace" role="region" aria-label="Talent Calibration Workspace">
      {/* Top Header Card */}
      <div className="panel">
        <PanelHeader
          icon={<Sparkles size={18} />}
          title={t.calibration ?? 'Talent Calibration & 9-Box Matrix'}
          action={
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {/* View Toggle */}
              <div
                style={{
                  display: 'inline-flex',
                  background: 'var(--surface-subtle)',
                  borderRadius: '8px',
                  padding: '3px',
                  border: '1px solid var(--border)',
                }}
              >
                <button
                  type="button"
                  className={`chip-button ${viewMode === 'matrix' ? 'active' : ''}`}
                  onClick={() => setViewMode('matrix')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: 'none',
                    background: viewMode === 'matrix' ? '#0084ce' : 'transparent',
                    color: viewMode === 'matrix' ? '#ffffff' : 'var(--muted)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <LayoutGrid size={14} /> Matrix
                </button>
                <button
                  type="button"
                  className={`chip-button ${viewMode === 'table' ? 'active' : ''}`}
                  onClick={() => setViewMode('table')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: 'none',
                    background: viewMode === 'table' ? '#0084ce' : 'transparent',
                    color: viewMode === 'table' ? '#ffffff' : 'var(--muted)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <TableIcon size={14} /> Table
                </button>
              </div>

              <button
                className="secondary-button"
                style={{ padding: '6px 12px', fontSize: '12.5px', fontWeight: 600 }}
                onClick={handleExportCohort}
              >
                <Download size={14} />
                Export CSV
              </button>
            </div>
          }
        />

        {/* Cohort Description & Breadcrumb */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
            {matrix?.cohortName ?? 'Hospital Talent Calibration & Executive Succession Cohort'}
          </h3>
          <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: 'var(--muted)' }}>
            Calibrate competency ratings, potential indicators, and committee readiness decisions
            across departments.
          </p>
        </div>

        {/* Metric Ribbon */}
        <div style={{ padding: '16px 18px' }}>
          <div className="calibration-kpi-grid">
            <div className="calibration-kpi-card ready-now">
              <div className="calibration-kpi-accent" />
              <span className="calibration-kpi-label">
                <UserCheck size={14} style={{ color: '#15803d' }} /> Ready Now
              </span>
              <div className="calibration-kpi-value" style={{ color: '#15803d' }}>
                {matrix?.distributionSummary?.readyNowCount ?? 0}
              </div>
              <span className="calibration-kpi-sub">
                Immediate leadership & promotion ready (
                {matrix?.totalCandidates
                  ? Math.round(
                      ((matrix.distributionSummary?.readyNowCount ?? 0) / matrix.totalCandidates) *
                        100,
                    )
                  : 0}
                %)
              </span>
            </div>

            <div className="calibration-kpi-card with-dev">
              <div className="calibration-kpi-accent" />
              <span className="calibration-kpi-label">
                <Clock size={14} style={{ color: '#d97706' }} /> With Development
              </span>
              <div className="calibration-kpi-value" style={{ color: '#d97706' }}>
                {matrix?.distributionSummary?.readyWithDevelopmentCount ?? 0}
              </div>
              <span className="calibration-kpi-sub">
                Targeted 3–6 mo action plan (
                {matrix?.totalCandidates
                  ? Math.round(
                      ((matrix.distributionSummary?.readyWithDevelopmentCount ?? 0) /
                        matrix.totalCandidates) *
                        100,
                    )
                  : 0}
                %)
              </span>
            </div>

            <div className="calibration-kpi-card not-ready">
              <div className="calibration-kpi-accent" />
              <span className="calibration-kpi-label">
                <UserX size={14} style={{ color: '#dc2626' }} /> Not Ready
              </span>
              <div className="calibration-kpi-value" style={{ color: '#dc2626' }}>
                {matrix?.distributionSummary?.notReadyCount ?? 0}
              </div>
              <span className="calibration-kpi-sub">
                Maintain in current role & band (
                {matrix?.totalCandidates
                  ? Math.round(
                      ((matrix.distributionSummary?.notReadyCount ?? 0) / matrix.totalCandidates) *
                        100,
                    )
                  : 0}
                %)
              </span>
            </div>

            <div className="calibration-kpi-card total-cohort">
              <div className="calibration-kpi-accent" />
              <span className="calibration-kpi-label">
                <Layers size={14} style={{ color: '#0084ce' }} /> Total Cohort
              </span>
              <div className="calibration-kpi-value" style={{ color: '#0f172a' }}>
                {matrix?.totalCandidates ?? 0}
              </div>
              <span className="calibration-kpi-sub">Evaluated candidates under review</span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Controls & Filter Toolbar */}
      <div className="calibration-toolbar">
        <div className="calibration-toolbar-left">
          {/* Search Box */}
          <div className="calibration-search-wrap">
            <Search size={15} className="calibration-search-icon" />
            <input
              type="text"
              className="calibration-search-input"
              placeholder="Search candidate, role, or ID…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  padding: '2px',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Department Chips */}
          <div className="calibration-chips">
            <Filter size={14} style={{ margin: '0 4px', color: 'var(--muted)' }} />
            {departments.map((dept) => (
              <button
                key={dept}
                type="button"
                className={`calibration-chip ${selectedDept === dept ? 'active' : ''}`}
                onClick={() => setSelectedDept(dept)}
              >
                {dept === 'ALL' ? 'All Departments' : dept}
              </button>
            ))}
          </div>

          {/* Readiness Quick Filter */}
          <div className="calibration-chips">
            {[
              { id: 'ALL', label: 'All Status' },
              { id: 'READY_NOW', label: 'Ready Now' },
              { id: 'WITH_DEV', label: 'With Dev' },
              { id: 'NOT_READY', label: 'Not Ready' },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                className={`calibration-chip ${selectedReadiness === st.id ? 'active' : ''}`}
                onClick={() => setSelectedReadiness(st.id)}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Match Count Badge */}
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>
          Showing <strong>{filteredCandidates.length}</strong> of {allCandidates.length} candidates
        </div>
      </div>

      {/* Main 9-Box Matrix View */}
      {viewMode === 'matrix' ? (
        <div className="calibration-matrix-container">
          <div className="calibration-matrix-header">
            <div className="calibration-matrix-title-group">
              <Layers size={18} style={{ color: '#0084ce' }} />
              <div>
                <h4 className="calibration-matrix-title">9-Box Strategic Talent Matrix</h4>
                <p className="calibration-matrix-sub">
                  Standard 3×3 Talent Calibration with Potential and Performance Axes
                </p>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div style={{ padding: '64px', textAlign: 'center', color: 'var(--muted)' }}>
              Loading talent calibration grid…
            </div>
          ) : (
            <div className="calibration-grid-with-axes">
              {/* Vertical Axis (Potential) */}
              <div className="calibration-axis-vertical" aria-hidden="true">
                <span className="calibration-axis-label-v">▲ High Potential</span>
                <span className="calibration-axis-label-v">Medium Potential</span>
                <span className="calibration-axis-label-v">Low Potential ▼</span>
              </div>

              {/* 3x3 Grid Matrix */}
              <div className="calibration-matrix-3x3">
                {/* Standard 9-Box order:
                    Row 1 (High Potential): Box 7 (Low Perf), Box 8 (Med Perf), Box 9 (High Perf)
                    Row 2 (Med Potential):  Box 4 (Low Perf), Box 5 (Med Perf), Box 6 (High Perf)
                    Row 3 (Low Potential):  Box 1 (Low Perf), Box 2 (Med Perf), Box 3 (High Perf)
                */}
                {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((boxIdx) => {
                  const cell = matrix?.grid?.find((g) => g.boxIndex === boxIdx);
                  if (!cell) return null;

                  const config = BOX_CONFIGS[boxIdx] || {
                    icon: Layers,
                    tierClass: 'tier-core' as const,
                    categoryTitle: cell.label,
                    recommendation: 'Evaluate performance trajectory.',
                  };
                  const BoxIcon = config.icon;

                  // Filter candidates inside this cell based on search & readiness
                  const cellCandidates = cell.candidates.filter((cand) =>
                    filteredCandidates.some((fc) => fc.id === cand.id),
                  );

                  return (
                    <div key={boxIdx} className={`calibration-cell ${config.tierClass}`}>
                      {/* Cell Header */}
                      <div className="calibration-cell-header">
                        <div>
                          <span className="calibration-box-tag">BOX {cell.boxIndex}</span>
                          <div className="calibration-box-name">
                            <BoxIcon size={14} style={{ color: '#0084ce' }} />
                            <span>{cell.label}</span>
                          </div>
                        </div>
                        <span className="calibration-count-badge">
                          {cellCandidates.length}
                          <small style={{ marginLeft: '3px', opacity: 0.7 }}>
                            (
                            {matrix?.totalCandidates
                              ? Math.round((cellCandidates.length / matrix.totalCandidates) * 100)
                              : 0}
                            %)
                          </small>
                        </span>
                      </div>

                      {/* Cell Description */}
                      <p className="calibration-cell-desc">{cell.description}</p>

                      {/* Candidate Scroll Area */}
                      <div className="calibration-candidates-list">
                        {cellCandidates.length === 0 ? (
                          <div
                            style={{
                              padding: '24px 8px',
                              textAlign: 'center',
                              fontSize: '11.5px',
                              color: 'var(--muted)',
                              fontStyle: 'italic',
                            }}
                          >
                            No matching candidates in Box {boxIdx}
                          </div>
                        ) : (
                          cellCandidates.map((cand) => {
                            const deptColor = DEPT_COLORS[cand.department] || DEPT_COLORS.Default;
                            const isSelected =
                              selectedCandidateId === cand.id ||
                              selectedCandidateId === cand.caseId;

                            return (
                              <div
                                key={cand.id}
                                className={`calibration-cand-card ${isSelected ? 'selected' : ''}`}
                                onClick={() => setSelectedCandidateId(cand.id)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) =>
                                  (e.key === 'Enter' || e.key === ' ') &&
                                  setSelectedCandidateId(cand.id)
                                }
                                aria-label={`Candidate: ${cand.displayName}, ${cand.currentLevel} to ${cand.targetLevel}`}
                              >
                                <div className="calibration-cand-top">
                                  <div className="calibration-cand-info">
                                    <div
                                      className="calibration-cand-avatar"
                                      style={{ backgroundColor: deptColor }}
                                    >
                                      {cand.displayName.charAt(0)}
                                    </div>
                                    <span
                                      className="calibration-cand-name"
                                      title={cand.displayName}
                                    >
                                      {cand.displayName}
                                    </span>
                                  </div>
                                  <span className="calibration-cand-dept">{cand.department}</span>
                                </div>

                                <div className="calibration-cand-progression">
                                  <span>{cand.currentLevel}</span>
                                  <ArrowRight size={11} style={{ color: 'var(--muted)' }} />
                                  <strong>{cand.targetLevel}</strong>
                                  <span style={{ color: 'var(--muted)', fontSize: '10.5px' }}>
                                    ({cand.targetRole})
                                  </span>
                                </div>

                                <div className="calibration-cand-bottom">
                                  <span
                                    className={`calibration-readiness-pill ${
                                      cand.resultCode === 'READY_NOW'
                                        ? 'ready'
                                        : cand.resultCode === 'NOT_READY'
                                          ? 'not-ready'
                                          : 'dev'
                                    }`}
                                  >
                                    {cand.readinessLabel}
                                  </span>

                                  <button
                                    type="button"
                                    className="calibration-case-link"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/cases/${cand.caseId}`);
                                    }}
                                  >
                                    <span>Case</span>
                                    <ArrowUpRight size={12} />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Horizontal Axis (Performance) */}
              <div className="calibration-axis-horizontal" aria-hidden="true">
                <span className="calibration-axis-label-h">Low Performance</span>
                <span className="calibration-axis-label-h">Medium Performance</span>
                <span className="calibration-axis-label-h">High Performance ▶</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Cohort Table View */
        <div className="panel" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <TableIcon size={16} style={{ color: '#0084ce' }} />
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>
              Cohort Candidates Detailed Directory ({filteredCandidates.length})
            </h4>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table
              className="data-table"
              style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid var(--border)',
                    textAlign: 'left',
                    background: 'var(--surface-subtle)',
                  }}
                >
                  <th style={{ padding: '10px 12px' }}>Candidate</th>
                  <th style={{ padding: '10px 12px' }}>Department</th>
                  <th style={{ padding: '10px 12px' }}>Progression</th>
                  <th style={{ padding: '10px 12px' }}>Target Role</th>
                  <th style={{ padding: '10px 12px' }}>9-Box Placement</th>
                  <th style={{ padding: '10px 12px' }}>Performance</th>
                  <th style={{ padding: '10px 12px' }}>Potential</th>
                  <th style={{ padding: '10px 12px' }}>Readiness</th>
                  <th style={{ padding: '10px 12px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCandidates.map((cand) => (
                  <tr
                    key={cand.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedCandidateId(cand.id)}
                  >
                    <td style={{ padding: '10px 12px', fontWeight: 700 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: DEPT_COLORS[cand.department] || DEPT_COLORS.Default,
                            color: '#fff',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: '10.5px',
                            fontWeight: 700,
                          }}
                        >
                          {cand.displayName.charAt(0)}
                        </div>
                        <span>{cand.displayName}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>{cand.department}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {cand.currentLevel} <ArrowRight size={11} />{' '}
                        <strong>{cand.targetLevel}</strong>
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>{cand.targetRole}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontWeight: 600, color: '#0084ce' }}>
                        Box {cand.boxIndex}: {cand.boxLabel}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>{cand.performanceBand}</td>
                    <td style={{ padding: '10px 12px' }}>{cand.potentialBand}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span
                        className={`calibration-readiness-pill ${
                          cand.resultCode === 'READY_NOW'
                            ? 'ready'
                            : cand.resultCode === 'NOT_READY'
                              ? 'not-ready'
                              : 'dev'
                        }`}
                      >
                        {cand.readinessLabel}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <button
                        type="button"
                        className="calibration-case-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/cases/${cand.caseId}`);
                        }}
                      >
                        <span>View</span>
                        <ArrowUpRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cross-Department Comparison Table */}
      <div className="panel" style={{ padding: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Building2 size={16} style={{ color: '#0084ce' }} />
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>
            Cross-Department Readiness Distribution & Benchmark
          </h4>
        </div>

        <table
          className="data-table"
          style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}
        >
          <thead>
            <tr
              style={{
                borderBottom: '1px solid var(--border)',
                textAlign: 'left',
                background: 'var(--surface-subtle)',
              }}
            >
              <th style={{ padding: '10px 12px' }}>Department</th>
              <th style={{ padding: '10px 12px' }}>Total Candidates</th>
              <th style={{ padding: '10px 12px' }}>Ready Now</th>
              <th style={{ padding: '10px 12px' }}>With Development</th>
              <th style={{ padding: '10px 12px' }}>Not Ready</th>
              <th style={{ padding: '10px 12px' }}>Readiness Rate</th>
            </tr>
          </thead>
          <tbody>
            {matrix?.departmentBreakdown?.map((dept) => {
              const rate = dept.total > 0 ? Math.round((dept.readyNow / dept.total) * 100) : 0;
              return (
                <tr
                  key={dept.department}
                  style={{ borderBottom: '1px solid var(--border-subtle, #f1f5f9)' }}
                >
                  <td style={{ padding: '10px 12px', fontWeight: 700 }}>{dept.department}</td>
                  <td style={{ padding: '10px 12px' }}>{dept.total}</td>
                  <td style={{ padding: '10px 12px', color: '#15803d', fontWeight: 700 }}>
                    {dept.readyNow}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#d97706', fontWeight: 600 }}>
                    {dept.readyWithDevelopment}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#dc2626', fontWeight: 600 }}>
                    {dept.notReady}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          flex: 1,
                          background: 'var(--border)',
                          height: '7px',
                          borderRadius: '4px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            background: 'linear-gradient(90deg, #0084ce, #00a859)',
                            width: `${rate}%`,
                            height: '100%',
                            borderRadius: '4px',
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '11.5px', fontWeight: 700, minWidth: '32px' }}>
                        {rate}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Interactive Candidate Slide-Over Drawer */}
      {activeCandidate && (
        <div
          className="calibration-drawer-overlay"
          onClick={() => setSelectedCandidateId(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="drawer-cand-name"
        >
          <div className="calibration-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="calibration-drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    backgroundColor: DEPT_COLORS[activeCandidate.department] || DEPT_COLORS.Default,
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: '16px',
                    fontWeight: 800,
                  }}
                >
                  {activeCandidate.displayName.charAt(0)}
                </div>
                <div>
                  <h3
                    id="drawer-cand-name"
                    style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}
                  >
                    {activeCandidate.displayName}
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                    {activeCandidate.currentRole} • {activeCandidate.department}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="calibration-drawer-close"
                onClick={() => setSelectedCandidateId(null)}
                aria-label="Close details"
              >
                <X size={18} />
              </button>
            </div>

            <div className="calibration-drawer-body">
              {/* 9-Box Placement Summary */}
              <div className="calibration-drawer-section">
                <span className="calibration-drawer-section-title">9-Box Placement</span>
                <div
                  className="calibration-drawer-card"
                  style={{
                    borderLeft: `4px solid ${BOX_CONFIGS[activeCandidate.boxIndex]?.tierClass === 'tier-top' ? '#15803d' : '#0084ce'}`,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)' }}>
                      Box {activeCandidate.boxIndex}: {activeCandidate.boxLabel}
                    </span>
                    <span
                      className={`calibration-readiness-pill ${
                        activeCandidate.resultCode === 'READY_NOW'
                          ? 'ready'
                          : activeCandidate.resultCode === 'NOT_READY'
                            ? 'not-ready'
                            : 'dev'
                      }`}
                    >
                      {activeCandidate.readinessLabel}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>
                    {BOX_CONFIGS[activeCandidate.boxIndex]?.recommendation}
                  </p>
                </div>
              </div>

              {/* Assessment Breakdown */}
              <div className="calibration-drawer-section">
                <span className="calibration-drawer-section-title">Evaluation Metrics</span>
                <div className="calibration-drawer-card">
                  <div className="calibration-drawer-row">
                    <span>Performance Band</span>
                    <span
                      style={{
                        color: activeCandidate.performanceBand === 'HIGH' ? '#15803d' : 'inherit',
                      }}
                    >
                      {activeCandidate.performanceBand}
                    </span>
                  </div>
                  <div className="calibration-drawer-row">
                    <span>Potential Band</span>
                    <span
                      style={{
                        color: activeCandidate.potentialBand === 'HIGH' ? '#0084ce' : 'inherit',
                      }}
                    >
                      {activeCandidate.potentialBand}
                    </span>
                  </div>
                  <div className="calibration-drawer-row">
                    <span>Current Level</span>
                    <span>{activeCandidate.currentLevel}</span>
                  </div>
                  <div className="calibration-drawer-row">
                    <span>Target Level</span>
                    <span style={{ color: '#0084ce', fontWeight: 700 }}>
                      {activeCandidate.targetLevel}
                    </span>
                  </div>
                  <div className="calibration-drawer-row">
                    <span>Target Role</span>
                    <span>{activeCandidate.targetRole}</span>
                  </div>
                  <div className="calibration-drawer-row">
                    <span>Case Code</span>
                    <span style={{ fontFamily: 'monospace' }}>{activeCandidate.caseCode}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="calibration-drawer-footer">
              <button
                type="button"
                className="primary-button"
                style={{ flex: 1, padding: '10px 16px', fontSize: '13px', fontWeight: 700 }}
                onClick={() => navigate(`/cases/${activeCandidate.caseId}`)}
              >
                <span>View Full Assessment Case</span>
                <ArrowUpRight size={15} />
              </button>
              <button
                type="button"
                className="secondary-button"
                style={{ padding: '10px 14px', fontSize: '13px' }}
                onClick={() => setSelectedCandidateId(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CalibrationPage;
