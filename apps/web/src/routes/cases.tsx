import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { reasonLabels } from '../lib/labels';
import { ErrorBanner, LoadingRows } from '../components/ui';
import { useToast } from '../hooks/use-toast';
import { getActiveUser } from '../lib/auth';
import type { AssessmentCaseSummary } from '@assessflow/contracts';
import Assessments from './assessments';
import { mapAssessmentCase } from './assessment-case-adapter';
import type { AssessmentListCase } from './assessments-logic';

export function CasesPage({ onNew }: { onNew?: () => void } = {}) {
  const { showToast } = useToast();
  const canCreateRequest = ['SYS_ADMIN', 'HR_ADMIN', 'DEV_LEAD', 'ASSESSOR'].includes(
    getActiveUser().role,
  );
  const {
    data: rawCases,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['cases'],
    queryFn: () => api.cases(),
  });
  const allCases = useMemo(() => rawCases ?? [], [rawCases]);
  const mappedCases = useMemo(() => allCases.map(mapAssessmentCase), [allCases]);
  const casesById = useMemo(() => new Map(allCases.map((item) => [item.id, item])), [allCases]);

  const handleExport = (selected: AssessmentListCase[]) => {
    const exportCases = selected
      .map((item) => casesById.get(item.id))
      .filter((item): item is AssessmentCaseSummary => Boolean(item));
    if (!exportCases.length) {
      showToast('No cases match current filter criteria to export.');
      return;
    }

    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
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
    const rows = exportCases.map((item) => [
      item.id,
      item.caseCode,
      escape(item.employeeName),
      escape(item.department),
      reasonLabels[item.assessmentReason] ?? item.assessmentReason,
      item.stage,
      item.status,
      item.requestedAt,
      escape(item.ageLabel),
    ]);
    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `assessflow_cases_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast(`Exported ${exportCases.length} assessment records to CSV successfully.`);
  };

  if (isLoading) return <LoadingRows />;

  return (
    <>
      {isError && <ErrorBanner message="Cases could not load from database." />}
      <Assessments
        cases={mappedCases}
        onExport={handleExport}
        onNew={canCreateRequest ? onNew : undefined}
      />
    </>
  );
}
