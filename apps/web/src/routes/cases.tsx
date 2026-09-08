import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  BarChart2,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Filter,
  Plus,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import { api } from '../lib/api';
import { copy, type Copy } from '../lib/labels';
import { CaseTable, ErrorBanner, LoadingRows, PageHeading } from '../components/ui';
import { useToast } from '../hooks/use-toast';
import type { AssessmentCaseSummary } from '@assessflow/contracts';

type StatusFilterTab = 'ALL' | 'ELIGIBILITY' | 'ASSESSMENT' | 'APPROVAL' | 'COMPLETED';

export function CasesPage({
  t: propT,
  onOpenCase: propOnOpenCase,
  onNew: propOnNew,
}: {
  t?: Copy;
  onOpenCase?: (id: string) => void;
  onNew?: () => void;
} = {}) {
  const t = propT ?? copy;
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('search') ?? '';
  const [activeTab, setActiveTab] = useState<StatusFilterTab>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');

  const setSearch = (value: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) {
          next.set('search', value);
        } else {
          next.delete('search');
        }
        return next;
      },
      { replace: true },
    );
  };

  const onOpenCase = propOnOpenCase ?? ((id: string) => navigate(`/cases/${id}`));
  const onNew =
    propOnNew ?? (() => navigate('/cases/new', { state: { backgroundLocation: location } }));

  const {
    data: rawCases,
    isLoading,
    isError,
  } = useQuery({ queryKey: ['cases', search], queryFn: () => api.cases(search) });

  const allCases = useMemo(() => rawCases ?? [], [rawCases]);

  // Extract unique departments for filter dropdown
  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const c of allCases) {
      if (c.department?.trim()) set.add(c.department.trim());
    }
    return ['ALL', ...Array.from(set).sort()];
  }, [allCases]);

  // Calculate tab counts
  const tabCounts = useMemo(() => {
    return {
      ALL: allCases.length,
      ELIGIBILITY: allCases.filter(
        (c) => c.stage === 'ELIGIBILITY' || c.status === 'PENDING_ELIGIBILITY',
      ).length,
      ASSESSMENT: allCases.filter(
        (c) =>
          c.stage === 'PLANNING' ||
          c.stage === 'ASSESSMENT' ||
          c.status === 'IN_PROGRESS' ||
          c.status === 'DRAFT',
      ).length,
      APPROVAL: allCases.filter(
        (c) =>
          c.stage === 'APPROVAL' || c.stage === 'RECOMMENDATION' || c.status === 'PENDING_APPROVAL',
      ).length,
      COMPLETED: allCases.filter(
        (c) => c.stage === 'CLOSED' || c.status === 'APPROVED' || c.status === 'CANCELLED',
      ).length,
    };
  }, [allCases]);

  // Filter cases based on search, active status tab, and department
  const filteredCases = useMemo(() => {
    return allCases.filter((c) => {
      // Department filter
      if (departmentFilter !== 'ALL' && c.department !== departmentFilter) return false;

      // Status Tab filter
      if (activeTab === 'ELIGIBILITY') {
        return c.stage === 'ELIGIBILITY' || c.status === 'PENDING_ELIGIBILITY';
      }
      if (activeTab === 'ASSESSMENT') {
        return (
          c.stage === 'PLANNING' ||
          c.stage === 'ASSESSMENT' ||
          c.status === 'IN_PROGRESS' ||
          c.status === 'DRAFT'
        );
      }
      if (activeTab === 'APPROVAL') {
        return (
          c.stage === 'APPROVAL' || c.stage === 'RECOMMENDATION' || c.status === 'PENDING_APPROVAL'
        );
      }
      if (activeTab === 'COMPLETED') {
        return c.stage === 'CLOSED' || c.status === 'APPROVED' || c.status === 'CANCELLED';
      }
      return true;
    });
  }, [allCases, activeTab, departmentFilter]);

  // Real CSV Export generator
  const handleExportCSV = () => {
    if (filteredCases.length === 0) {
      showToast('No cases match current filter criteria to export.');
      return;
    }

    const headers = [
      'Case ID',
      'Case Code',
      'Employee Name',
      'Department',
      'Assessment Reason',
      'Stage',
      'Status',
      'Requested Date',
      'Age',
    ];

    const rows = filteredCases.map((c) => [
      c.id,
      c.caseCode,
      `"${c.employeeName.replace(/"/g, '""')}"`,
      `"${c.department.replace(/"/g, '""')}"`,
      c.assessmentReason,
      c.stage,
      c.status,
      c.requestedAt,
      `"${c.ageLabel.replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `assessflow_cases_${activeTab.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`Exported ${filteredCases.length} assessment records to CSV successfully.`);
  };

  return (
    <>
      <PageHeading
        eyebrow="ASSESSMENTS WORKSPACE"
        title="Assessment cases"
        subtitle="End-to-end talent pipeline management from intake through committee ratification."
        action={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="secondary-button" onClick={handleExportCSV}>
              <Download size={15} />
              Export CSV
            </button>
            <button className="primary-button" onClick={onNew}>
              <Plus size={17} />
              {t.newRequest}
            </button>
          </div>
        }
      />

      {/* Pipeline Summary Metrics Ribbon */}
      <div className="cases-metrics-ribbon">
        <div className="cases-metric-item">
          <div className="cases-metric-icon all">
            <Users size={17} />
          </div>
          <div className="cases-metric-content">
            <span className="cases-metric-num">{tabCounts.ALL}</span>
            <span className="cases-metric-lbl">Total Pipeline</span>
          </div>
        </div>

        <div className="cases-metric-item">
          <div className="cases-metric-icon in-assessment">
            <Clock size={17} />
          </div>
          <div className="cases-metric-content">
            <span className="cases-metric-num">{tabCounts.ASSESSMENT}</span>
            <span className="cases-metric-lbl">In Active Assessment</span>
          </div>
        </div>

        <div className="cases-metric-item">
          <div className="cases-metric-icon pending-approval">
            <BarChart2 size={17} />
          </div>
          <div className="cases-metric-content">
            <span className="cases-metric-num">{tabCounts.APPROVAL}</span>
            <span className="cases-metric-lbl">Pending Committee</span>
          </div>
        </div>

        <div className="cases-metric-item">
          <div className="cases-metric-icon completed">
            <CheckCircle2 size={17} />
          </div>
          <div className="cases-metric-content">
            <span className="cases-metric-num">{tabCounts.COMPLETED}</span>
            <span className="cases-metric-lbl">Ratified & Closed</span>
          </div>
        </div>
      </div>

      <section className="panel cases-panel">
        {/* Status Filter Tabs */}
        <div className="cases-filter-tabs-bar">
          <div className="cases-tabs-group" role="tablist" aria-label="Filter cases by status">
            <button
              role="tab"
              aria-selected={activeTab === 'ALL'}
              className={`cases-tab-btn ${activeTab === 'ALL' ? 'active' : ''}`}
              onClick={() => setActiveTab('ALL')}
            >
              All Cases <span className="tab-count-badge">{tabCounts.ALL}</span>
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'ELIGIBILITY'}
              className={`cases-tab-btn ${activeTab === 'ELIGIBILITY' ? 'active' : ''}`}
              onClick={() => setActiveTab('ELIGIBILITY')}
            >
              Eligibility Screen <span className="tab-count-badge">{tabCounts.ELIGIBILITY}</span>
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'ASSESSMENT'}
              className={`cases-tab-btn ${activeTab === 'ASSESSMENT' ? 'active' : ''}`}
              onClick={() => setActiveTab('ASSESSMENT')}
            >
              In Assessment <span className="tab-count-badge">{tabCounts.ASSESSMENT}</span>
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'APPROVAL'}
              className={`cases-tab-btn ${activeTab === 'APPROVAL' ? 'active' : ''}`}
              onClick={() => setActiveTab('APPROVAL')}
            >
              Pending Approval <span className="tab-count-badge">{tabCounts.APPROVAL}</span>
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'COMPLETED'}
              className={`cases-tab-btn ${activeTab === 'COMPLETED' ? 'active' : ''}`}
              onClick={() => setActiveTab('COMPLETED')}
            >
              Completed <span className="tab-count-badge">{tabCounts.COMPLETED}</span>
            </button>
          </div>
        </div>

        {/* Toolbar with Search and Department Selector */}
        <div className="case-toolbar" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div className="inline-search" style={{ flex: 1, minWidth: '240px' }}>
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search case, employee, department…"
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="department-filter-wrapper">
              <Building2 size={15} style={{ color: 'var(--color-text-muted, #64748b)' }} />
              <select
                aria-label="Filter by department"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="department-select"
              >
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept === 'ALL' ? 'All Departments' : dept}
                  </option>
                ))}
              </select>
            </div>

            <button
              className="secondary-button"
              onClick={handleExportCSV}
              title="Export filtered records"
            >
              <FileText size={15} />
              Export
            </button>
          </div>
        </div>

        {isError && <ErrorBanner message="Cases could not load from database." />}
        {isLoading ? (
          <LoadingRows />
        ) : filteredCases.length === 0 ? (
          <div className="empty-state" style={{ padding: '48px 16px', textAlign: 'center' }}>
            <Filter
              size={24}
              style={{ color: 'var(--color-text-muted, #64748b)', marginBottom: '8px' }}
            />
            <strong style={{ display: 'block', fontSize: '15px' }}>
              No cases match this filter
            </strong>
            <p
              style={{
                color: 'var(--color-text-muted, #64748b)',
                fontSize: '13px',
                margin: '4px 0 16px',
              }}
            >
              {search || departmentFilter !== 'ALL' || activeTab !== 'ALL'
                ? 'Try adjusting your search criteria or resetting filters.'
                : 'Get started by creating your first talent assessment request.'}
            </p>
            {(search || departmentFilter !== 'ALL' || activeTab !== 'ALL') && (
              <button
                className="secondary-button"
                onClick={() => {
                  setSearch('');
                  setActiveTab('ALL');
                  setDepartmentFilter('ALL');
                }}
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          <CaseTable cases={filteredCases} onOpen={onOpenCase} />
        )}
      </section>
    </>
  );
}
