export type PrioritySortableCase = {
  slaBreachRisk: boolean;
  daysRemaining: number;
  stage: string;
  requestedAt: string;
};

const pipelineStageOrder: Record<string, number> = {
  REQUEST: 0,
  ELIGIBILITY: 1,
  PLANNING: 2,
  ASSESSMENT: 3,
  RESULT: 4,
  RECOMMENDATION: 5,
  APPROVAL: 5,
  FOLLOW_UP: 6,
  CLOSED: 7,
};

export function sortPriorityActionCases<T extends PrioritySortableCase>(items: readonly T[]): T[] {
  const requestTime = (value: string) => {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
  };

  return [...items].sort(
    (a, b) =>
      Number(b.slaBreachRisk) - Number(a.slaBreachRisk) ||
      a.daysRemaining - b.daysRemaining ||
      (pipelineStageOrder[a.stage] ?? Number.MAX_SAFE_INTEGER) -
        (pipelineStageOrder[b.stage] ?? Number.MAX_SAFE_INTEGER) ||
      requestTime(a.requestedAt) - requestTime(b.requestedAt),
  );
}

export function getRemainingTime(targetDays: number, elapsedDays: number) {
  const daysRemaining = Math.max(0, Math.floor(targetDays - elapsedDays));

  return {
    daysRemaining,
    label: daysRemaining === 0 ? 'Due today' : `${daysRemaining}d left`,
  };
}
