import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowUpRight, LockKeyhole, Search, Sparkles, Users } from 'lucide-react';
import { api } from '../lib/api';
import { copy, reasonLabels, type Copy } from '../lib/labels';
import { CaseTable, ErrorBanner, LoadingRows, PageHeading, PanelHeader } from '../components/ui';

interface SelectedEmployee {
  id: string;
  name: string;
}

export function EmployeesPage({
  t: propT,
  onOpenCase: propOnOpenCase,
}: {
  t?: Copy;
  onOpenCase?: (id: string) => void;
} = {}) {
  const t = propT ?? copy;
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const onOpenCase = propOnOpenCase ?? ((id: string) => navigate(`/cases/${id}`));

  const [search, setSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<SelectedEmployee | null>(
    params.id ? { id: params.id, name: params.id } : null,
  );

  const {
    data: cases,
    isLoading,
    isError,
  } = useQuery({ queryKey: ['cases', search], queryFn: () => api.cases(search) });

  // Group unique employees for quick 360 context selection
  const uniqueEmployees = useMemo(() => {
    if (!cases) return [];
    const map = new Map<string, { id: string; name: string; department: string; count: number }>();
    for (const c of cases) {
      const existing = map.get(c.employeeId);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(c.employeeId, {
          id: c.employeeId,
          name: c.employeeName,
          department: c.department,
          count: 1,
        });
      }
    }
    return Array.from(map.values());
  }, [cases]);

  // Selected employee's chronological case history across reasons
  const employeeCases = useMemo(() => {
    if (!selectedEmployee || !cases) return [];
    return cases
      .filter(
        (c) =>
          c.employeeId === selectedEmployee.id ||
          c.employeeName.toLowerCase() === selectedEmployee.name.toLowerCase(),
      )
      .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
  }, [cases, selectedEmployee]);

  const activeEmployeeInfo = useMemo(() => {
    if (!selectedEmployee) return null;
    const match = cases?.find(
      (c) =>
        c.employeeId === selectedEmployee.id ||
        c.employeeName.toLowerCase() === selectedEmployee.name.toLowerCase(),
    );
    if (match) {
      return {
        name: match.employeeName,
        department: match.department,
        id: match.employeeId,
      };
    }
    return { name: selectedEmployee.name, department: 'Talent Scope', id: selectedEmployee.id };
  }, [cases, selectedEmployee]);

  const reasons = useMemo(() => {
    const set = new Set(employeeCases.map((c) => c.assessmentReason));
    return Array.from(set);
  }, [employeeCases]);

  if (selectedEmployee && activeEmployeeInfo) {
    return (
      <>
        <button
          className="back-button"
          onClick={() => {
            setSelectedEmployee(null);
            if (params.id) navigate('/employees');
          }}
        >
          <ArrowLeft size={16} />
          Back to all employees
        </button>
        <PageHeading
          eyebrow="EMPLOYEE 360"
          title={`${activeEmployeeInfo.name}`}
          subtitle={`Scope-filtered 360 assessment history across ${reasons.length} reason${reasons.length === 1 ? '' : 's'} (${employeeCases.length} record${employeeCases.length === 1 ? '' : 's'}).`}
        />
        <div className="employee-360-summary">
          <div
            className="avatar avatar-purple"
            style={{ width: '48px', height: '48px', fontSize: '15px' }}
          >
            {activeEmployeeInfo.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)}
          </div>
          <div style={{ display: 'grid', gap: '4px', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: '15px' }}>{activeEmployeeInfo.name}</strong>
              <span className="soft-chip">{activeEmployeeInfo.department}</span>
              <span className="soft-chip">ID: {activeEmployeeInfo.id}</span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
                marginTop: '2px',
              }}
            >
              <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>
                Reasons:
              </span>
              {reasons.map((r) => (
                <span key={r} className="policy-chip">
                  <Sparkles size={12} />
                  {reasonLabels[r] ?? r}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="pipeline-note" role="note" style={{ margin: '0 0 16px' }}>
          <LockKeyhole size={16} />
          <span>
            Assessor-private evidence is hidden by policy. Chronological results and status badges
            are rendered for permitted talent scope only.
          </span>
        </div>
        <section className="panel cases-panel">
          <PanelHeader
            icon={<Users size={17} />}
            title="Chronological case history"
            action={<span className="soft-count">{employeeCases.length} records</span>}
          />
          {isError && <ErrorBanner message="Employee records could not load." />}
          {isLoading ? (
            <LoadingRows />
          ) : (
            <CaseTable cases={employeeCases} onOpen={onOpenCase} showResultChips={true} />
          )}
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeading
        eyebrow="TALENT SCOPE"
        title={t.employees}
        subtitle="Scope-filtered employee assessment records and cycle history."
      />
      <div className="pipeline-note" role="note" style={{ margin: '0 0 16px' }}>
        <LockKeyhole size={16} />
        <span>
          Assessor-private evidence is hidden by policy. Displaying scope-filtered history only.
        </span>
      </div>

      {uniqueEmployees.length > 0 && (
        <section className="panel" style={{ padding: '16px 20px', marginBottom: '18px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: 'var(--muted)',
                letterSpacing: '0.05em',
              }}
            >
              EMPLOYEE 360 DIRECTORY (CLICK TO VIEW HISTORY)
            </span>
            <span className="soft-count">{uniqueEmployees.length} talent profiles</span>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {uniqueEmployees.map((emp) => (
              <button
                key={emp.id}
                type="button"
                className="secondary-button"
                style={{ height: '36px', padding: '0 12px', fontSize: '11px', gap: '8px' }}
                onClick={() => setSelectedEmployee({ id: emp.id, name: emp.name })}
                title={`View 360 history for ${emp.name}`}
              >
                <div
                  className="avatar avatar-small"
                  style={{ width: '22px', height: '22px', fontSize: '9px' }}
                >
                  {emp.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)}
                </div>
                <strong>{emp.name}</strong>
                <span style={{ color: 'var(--muted)', fontWeight: 500 }}>
                  · {emp.count} case{emp.count === 1 ? '' : 's'}
                </span>
                <ArrowUpRight size={13} style={{ color: 'var(--indigo)' }} />
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="panel cases-panel">
        <PanelHeader
          icon={<Users size={17} />}
          title="Scope-filtered history"
          action={<span className="soft-count">{cases?.length ?? 0} records</span>}
        />
        <div className="case-toolbar">
          <div className="inline-search">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search employee, role, or department…"
            />
          </div>
        </div>
        {isError && <ErrorBanner message="Employee records could not load." />}
        {isLoading ? (
          <LoadingRows />
        ) : (
          <CaseTable
            cases={cases ?? []}
            onOpen={onOpenCase}
            onSelectEmployee={(id, name) => setSelectedEmployee({ id, name })}
          />
        )}
      </section>
    </>
  );
}
