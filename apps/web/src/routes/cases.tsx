import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AssessmentCaseSummary } from '@assessflow/contracts';
import { api } from '../lib/api';
import { canAccessRoute, getSession } from '../lib/auth';
import { downloadCsv } from '../lib/format';
import { reasonLabels } from '../lib/labels';
import { queryKeys } from '../lib/query-keys';
import { ErrorBanner, LoadingRows } from '../components/ui';
import { useToast } from '../hooks/use-toast';
import Assessments from './assessments';
import { mapAssessmentCase } from './assessment-case-adapter';
import type { AssessmentListCase } from './assessments-logic';

export function CasesPage({ onNew }: { onNew?: () => void } = {}) {
  const { showToast } = useToast();
  const user = getSession();
  const canCreateRequest = canAccessRoute(user, 'new-case');

  const {
    data: rawCases,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.cases(),
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
      showToast('No cases match current filter criteria to export.', 'warning');
      return;
    }

    downloadCsv(
      `assessflow_cases_${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'Case ID',
        'Case Code',
        'Employee Name',
        'Department',
        'Assessment Reason',
        'Stage',
        'Status',
        'Requested Date',
        'Age',
      ],
      exportCases.map((item) => [
        item.id,
        item.caseCode,
        item.employeeName,
        item.department,
        reasonLabels[item.assessmentReason] ?? item.assessmentReason,
        item.stage,
        item.status,
        item.requestedAt,
        item.ageLabel,
      ]),
    );
    showToast(`Exported ${exportCases.length} assessment records to CSV.`, 'success');
  };

  if (isLoading) return <LoadingRows />;

  return (
    <>
      {isError && (
        <ErrorBanner
          message="Cases could not load from the server."
          onRetry={() => void refetch()}
        />
      )}
      <Assessments
        cases={mappedCases}
        onExport={handleExport}
        onNew={canCreateRequest ? onNew : undefined}
      />
    </>
  );
}
