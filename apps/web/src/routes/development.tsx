import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AssessmentCaseSummary, UpdateDevelopmentInput } from '@assessflow/contracts';
import { ErrorBanner, InlineError, LoadingRows } from '../components/ui';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
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
    () =>
      (casesQuery.data ?? []).filter((caseItem) => caseItem.status === 'DEVELOPMENT_IN_PROGRESS'),
    [casesQuery.data],
  );

  const planByCaseId = useMemo(
    () => new Map((devPlansQuery.data ?? []).map((p) => [p.caseId, p])),
    [devPlansQuery.data],
  );

  const plans = useMemo(
    () =>
      developmentCases.map((caseItem) =>
        mapDevelopmentPlan(
          mapAssessmentCase(caseItem as AssessmentCaseSummary),
          (planByCaseId.get(caseItem.id) as DevelopmentPlanData | undefined) ?? null,
        ),
      ),
    [developmentCases, planByCaseId],
  );

  const updatePlan = useMutation({
    mutationFn: ({ caseId, input }: { caseId: string; input: UpdateDevelopmentInput }) =>
      api.updateDevelopment(caseId, input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.developmentPlans() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.caseDevelopment(variables.caseId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cases() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.overview() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.caseDetail(variables.caseId) });
    },
  });

  const saveActions = async (planId: string, actions: ApiAction[]) => {
    const caseItem = developmentCases.find((item) => item.id === planId);
    if (!caseItem) return;
    const plan = planByCaseId.get(planId);
    await updatePlan.mutateAsync({
      caseId: caseItem.id,
      input: {
        actions: actions.map(toApiAction),
        targetDate: plan?.targetDate ? new Date(plan.targetDate).toISOString() : undefined,
        expectedVersion: caseItem.version,
      },
    });
  };

  const onAddAction = async (
    planId: string,
    data: { title: string; owner: string; dueDate: string | null },
  ) => {
    const existingActions = (planByCaseId.get(planId)?.actions ?? []) as ApiAction[];
    await saveActions(planId, [
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
    const caseIndex = developmentCases.findIndex((item) => item.id === planId);
    if (caseIndex < 0) return;
    const actions = (planByCaseId.get(planId)?.actions ?? []) as ApiAction[];
    const mappedActions = plans[caseIndex]?.actions ?? [];
    const actionIndex = mappedActions.findIndex((action) => action.id === actionId);
    if (actionIndex < 0) return;
    void saveActions(
      planId,
      actions.map((action, index) => ({
        ...action,
        status: index === actionIndex ? toApiStatus(status) : toApiStatus(action.status),
      })),
    );
  };

  const onSaveEvidence = (planId: string, actionId: string, note: string) => {
    const caseIndex = developmentCases.findIndex((item) => item.id === planId);
    if (caseIndex < 0) return;
    const actions = (planByCaseId.get(planId)?.actions ?? []) as ApiAction[];
    const mappedActions = plans[caseIndex]?.actions ?? [];
    const actionIndex = mappedActions.findIndex((action) => action.id === actionId);
    if (actionIndex < 0) return;
    void saveActions(
      planId,
      actions.map((action, index) => ({
        ...action,
        evidenceNote: index === actionIndex ? note || undefined : action.evidenceNote || undefined,
      })),
    );
  };

  if (casesQuery.isLoading || devPlansQuery.isLoading) return <LoadingRows />;
  if (casesQuery.isError || devPlansQuery.isError) {
    return (
      <ErrorBanner
        message="Development plans could not be loaded."
        onRetry={() => {
          void casesQuery.refetch();
          void devPlansQuery.refetch();
        }}
      />
    );
  }

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
