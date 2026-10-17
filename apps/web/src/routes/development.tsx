import { useMemo } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AssessmentCaseSummary, UpdateDevelopmentInput } from '@assessflow/contracts';
import { ErrorBanner, InlineError, LoadingRows } from '../components/ui';
import { api } from '../lib/api';
import DevelopmentView from './development-view';
import { mapAssessmentCase } from './assessment-case-adapter';
import {
  mapDevelopmentPlan,
  normalizeActionStatus,
  type DevelopmentActionStatus,
  type DevelopmentPlanData,
} from './development-logic';

type ApiAction = NonNullable<DevelopmentPlanData['actions']>[number];

function toApiStatus(
  status: string | null | undefined,
): 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' {
  const normalized = normalizeActionStatus(status);
  if (normalized === 'completed') return 'COMPLETED';
  if (normalized === 'in_progress') return 'IN_PROGRESS';
  return 'NOT_STARTED';
}

function toApiAction(action: ApiAction) {
  return {
    title: action.title,
    ownerName: action.ownerName,
    dueDate: action.dueDate ? new Date(action.dueDate).toISOString() : undefined,
    status: toApiStatus(action.status),
    evidenceNote: action.evidenceNote || undefined,
  };
}

export function DevelopmentPage() {
  const queryClient = useQueryClient();
  const casesQuery = useQuery({
    queryKey: ['cases'],
    queryFn: () => api.cases(),
    staleTime: 30_000,
  });

  const developmentCases = useMemo(
    () =>
      (casesQuery.data ?? []).filter((caseItem) => caseItem.status === 'DEVELOPMENT_IN_PROGRESS'),
    [casesQuery.data],
  );
  const planQueries = useQueries({
    queries: developmentCases.map((caseItem) => ({
      queryKey: ['development', caseItem.id],
      queryFn: () => api.getDevelopment<DevelopmentPlanData>(caseItem.id).catch(() => null),
      staleTime: 30_000,
    })),
  });

  const plans = useMemo(
    () =>
      developmentCases.map((caseItem, index) =>
        mapDevelopmentPlan(
          mapAssessmentCase(caseItem as AssessmentCaseSummary),
          planQueries[index]?.data ?? null,
        ),
      ),
    [developmentCases, planQueries],
  );

  const updatePlan = useMutation({
    mutationFn: ({ caseId, input }: { caseId: string; input: UpdateDevelopmentInput }) =>
      api.updateDevelopment(caseId, input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['development', variables.caseId] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['case', variables.caseId] });
    },
  });

  const saveActions = (planId: string, actions: ApiAction[]) => {
    const caseIndex = developmentCases.findIndex((caseItem) => caseItem.id === planId);
    const caseItem = developmentCases[caseIndex];
    if (!caseItem) return;
    const plan = planQueries[caseIndex]?.data ?? null;
    updatePlan.mutate({
      caseId: caseItem.id,
      input: {
        actions: actions.map(toApiAction),
        targetDate: plan?.targetDate ? new Date(plan.targetDate).toISOString() : undefined,
        expectedVersion: caseItem.version,
      },
    });
  };

  const onAddAction = (
    planId: string,
    data: { title: string; owner: string; dueDate: string | null },
  ) => {
    const caseIndex = developmentCases.findIndex((caseItem) => caseItem.id === planId);
    if (caseIndex < 0) return;
    const existingActions = planQueries[caseIndex]?.data?.actions ?? [];
    saveActions(planId, [
      ...existingActions,
      {
        title: data.title,
        ownerName: data.owner,
        dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : undefined,
        status: 'NOT_STARTED',
      },
    ]);
  };

  const onStatusChange = (planId: string, actionId: string, status: DevelopmentActionStatus) => {
    const caseIndex = developmentCases.findIndex((caseItem) => caseItem.id === planId);
    if (caseIndex < 0) return;
    const actions = planQueries[caseIndex]?.data?.actions ?? [];
    const mappedActions = plans[caseIndex]?.actions ?? [];
    const actionIndex = mappedActions.findIndex((action) => action.id === actionId);
    if (actionIndex < 0) return;
    saveActions(
      planId,
      actions.map((action, index) => ({
        ...action,
        status: index === actionIndex ? toApiStatus(status) : toApiStatus(action.status),
      })),
    );
  };

  const onSaveEvidence = (planId: string, actionId: string, note: string) => {
    const caseIndex = developmentCases.findIndex((caseItem) => caseItem.id === planId);
    if (caseIndex < 0) return;
    const actions = planQueries[caseIndex]?.data?.actions ?? [];
    const mappedActions = plans[caseIndex]?.actions ?? [];
    const actionIndex = mappedActions.findIndex((action) => action.id === actionId);
    if (actionIndex < 0) return;
    saveActions(
      planId,
      actions.map((action, index) => ({
        ...action,
        evidenceNote: index === actionIndex ? note || undefined : action.evidenceNote || undefined,
      })),
    );
  };

  if (casesQuery.isLoading) return <LoadingRows />;
  if (casesQuery.isError) {
    return (
      <ErrorBanner
        message="Development plans could not be loaded."
        onRetry={() => void casesQuery.refetch()}
      />
    );
  }
  if (planQueries.some((query) => query.isLoading)) return <LoadingRows />;

  return (
    <>
      {updatePlan.isError && <InlineError error={updatePlan.error} />}
      <DevelopmentView
        plans={plans}
        onAddAction={onAddAction}
        onStatusChange={onStatusChange}
        onSaveEvidence={onSaveEvidence}
      />
    </>
  );
}

export default DevelopmentPage;
