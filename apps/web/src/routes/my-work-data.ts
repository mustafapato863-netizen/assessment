import type { AssessmentCaseSummary, OverviewResponse } from '@assessflow/contracts';
import { statusLabels } from '../lib/labels';
import type { WorkItem } from './workQueue';

function stageLabel(stage: string): string {
  const labels: Record<string, string> = {
    REQUEST: 'Request',
    ELIGIBILITY: 'Eligibility',
    PLANNING: 'Planning',
    ASSESSMENT: 'Assessment',
    RESULT: 'Result',
    RECOMMENDATION: 'Decision',
    APPROVAL: 'Decision',
    FOLLOW_UP: 'Follow-up',
    CLOSED: 'Closed',
  };
  return labels[stage] ?? stage.replaceAll('_', ' ');
}

function taskType(task: OverviewResponse['tasks'][number]): WorkItem['type'] {
  const key = `${task.taskType ?? ''} ${task.title}`.toLowerCase();
  if (key.includes('approval') || key.includes('decision') || key.includes('sign-off'))
    return 'approval';
  if (
    key.includes('assessment') ||
    key.includes('evaluat') ||
    key.includes('evidence') ||
    key.includes('result') ||
    key.includes('rubric') ||
    key.includes('interview')
  )
    return 'evaluation';
  return 'task';
}

function actionLabel(task: OverviewResponse['tasks'][number]): string {
  const type = (task.taskType ?? '').toUpperCase();
  const title = task.title.toLowerCase();
  if (type.includes('EVENT_SCHEDULING') || title.includes('event scheduling'))
    return 'Schedule Event';
  if (type.includes('REASSESSMENT') || title.includes('schedule reassessment'))
    return 'Schedule Reassessment';
  if (type.includes('PLAN') || title.includes('finalize plan')) return 'Finalize Plan';
  if (type.includes('ELIGIBILITY') || title.includes('eligibility')) return 'Review Eligibility';
  if (type.includes('TRAINING') || title.includes('training')) return 'Complete Training';
  if (type.includes('RECOMMENDATION') || title.includes('recommendation'))
    return 'Submit Recommendation';
  if (type.includes('RESULT') || title.includes('result')) return 'Finalize Result';
  if (type.includes('ASSESSMENT') || title.includes('assessment') || title.includes('evidence'))
    return 'Submit Evidence';
  if (type.includes('APPROVAL') || type.includes('DECIDE') || title.includes('approval'))
    return 'Review Approval';
  if (type.includes('DEVELOPMENT') || title.includes('development') || title.includes('milestone'))
    return 'Update Follow-up';
  const subject = title.replace(/\s+for\s+.+$/i, '').trim();
  const actionWords = subject.split(/\s+/).filter(Boolean).slice(0, 2);
  return actionWords.length
    ? actionWords.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join(' ')
    : 'Review Case';
}

/** Join actionable tasks to the cases visible to the current user. */
export function mapWorkItems(
  tasks: OverviewResponse['tasks'] = [],
  cases: AssessmentCaseSummary[] = [],
): WorkItem[] {
  const casesByCode = new Map(cases.map((item) => [item.caseCode, item]));
  return tasks.flatMap((task) => {
    const caseItem = casesByCode.get(task.caseCode);
    if (!caseItem) return [];
    return [
      {
        id: task.id,
        caseId: caseItem.caseCode,
        name: caseItem.employeeName,
        department: caseItem.department,
        stage: stageLabel(caseItem.stage),
        dueDate: task.dueAt ?? null,
        statusLabel: statusLabels[caseItem.status] ?? caseItem.status.replaceAll('_', ' '),
        type: taskType(task),
        action: {
          label: actionLabel(task),
          href: `#/cases/${caseItem.id}`,
        },
      },
    ];
  });
}
