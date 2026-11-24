import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CheckCircle2, LoaderCircle, Plus, RotateCcw, Sparkles } from 'lucide-react';
import type {
  AssessmentCaseDetail,
  CloseCaseInput,
  ScheduleReassessmentInput,
  UpdateDevelopmentInput,
} from '@assessflow/contracts';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { queryKeys } from '../../lib/query-keys';
import { InlineError, PanelHeader, StatusBadge } from '../../components/ui';
import { ConfirmDialog, PromptDialog } from '../../components/dialogs';
import { AiCopilotCard } from './ai-copilot-card';
import { getAvailableAction, PAST_DECISION_STATUSES, type DevelopmentData } from './case-utils';

export function DevelopmentPanel({
  caseDetail,
  onToast,
  onRefresh,
}: {
  caseDetail: AssessmentCaseDetail;
  onToast: (msg: string) => void;
  onRefresh: () => void;
}) {
  const queryClient = useQueryClient();
  const isVisible = PAST_DECISION_STATUSES.includes(caseDetail.status);

  const { data: development } = useQuery({
    queryKey: queryKeys.caseDevelopment(caseDetail.id),
    queryFn: () => api.getDevelopment<DevelopmentData>(caseDetail.id),
    enabled: isVisible,
    retry: false,
  });

  const [title, setTitle] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [actionPlanText, setActionPlanText] = useState('');
  const [lmsText, setLmsText] = useState('');
  const [hiringOutcome, setHiringOutcome] = useState<'PENDING' | 'JOINED' | 'NOT_JOINED'>(
    caseDetail.hiringOutcome ?? 'PENDING',
  );
  const [hiringOutcomeReason, setHiringOutcomeReason] = useState<string>(
    caseDetail.hiringOutcomeReason ?? '',
  );
  const notesLoaded = useRef(false);
  const [reassessDialogOpen, setReassessDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);

  const updateAction = getAvailableAction(caseDetail, 'UPDATE_DEVELOPMENT');
  const reassessAction = getAvailableAction(caseDetail, 'SCHEDULE_REASSESSMENT');
  const closeAction = getAvailableAction(caseDetail, 'CLOSE_CASE');
  const canUpdateDevelopment = Boolean(updateAction?.enabled);

  useEffect(() => {
    notesLoaded.current = false;
    setHiringOutcome(caseDetail.hiringOutcome ?? 'PENDING');
    setHiringOutcomeReason(caseDetail.hiringOutcomeReason ?? '');
  }, [caseDetail.id, caseDetail.hiringOutcome, caseDetail.hiringOutcomeReason]);

  useEffect(() => {
    if (development && !notesLoaded.current) {
      setActionPlanText(development.actionPlan ?? '');
      setLmsText(development.learningManagementSystem ?? '');
      notesLoaded.current = true;
    }
  }, [development]);

  const serializeExistingActions = (
    overrideIndex?: number,
    nextStatus?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED',
  ) =>
    (development?.actions ?? []).map((a, idx) => ({
      title: a.title,
      ownerName: a.ownerName,
      status:
        (idx === overrideIndex && nextStatus
          ? nextStatus
          : (a.status as 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED')) ?? 'NOT_STARTED',
      ...(a.dueDate ? { dueDate: a.dueDate } : {}),
      ...(a.evidenceNote ? { evidenceNote: a.evidenceNote } : {}),
    }));

  const updateDev = useMutation({
    mutationFn: (input: UpdateDevelopmentInput) => api.updateDevelopment(caseDetail.id, input),
    onSuccess: (_data, input) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.caseDetail(caseDetail.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.caseDevelopment(caseDetail.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.developmentPlans() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.overview() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cases() });
      if (input.actions) {
        setTitle('');
        setOwnerName('');
        setDueDate('');
      }
      onToast(
        input.hiringOutcome ? 'Candidate hiring outcome saved.' : 'Development plan updated.',
      );
    },
  });

  const scheduleReassessment = useMutation({
    mutationFn: (input: ScheduleReassessmentInput) =>
      api.scheduleReassessment(caseDetail.id, input),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.caseDetail(caseDetail.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cases() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.overview() });
      setReassessDialogOpen(false);
      onToast(`Reassessment scheduled: case ${data.caseCode ?? ''}`);
    },
  });

  const closeCase = useMutation({
    mutationFn: (input: CloseCaseInput) => api.closeCase(caseDetail.id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.caseDetail(caseDetail.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cases() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.overview() });
      setCloseDialogOpen(false);
      onToast('Case closed and archived cleanly.');
    },
  });

  if (!isVisible) return null;

  return (
    <section className="panel development-panel">
      <PanelHeader
        icon={<Sparkles size={17} />}
        title="Development & follow-up"
        action={<StatusBadge status={caseDetail.status} />}
      />
      <p className="panel-intro">
        Track developmental milestones, schedule reassessments, or close the case once follow-up is
        completed.
      </p>

      {canUpdateDevelopment && (
        <AiCopilotCard
          caseId={caseDetail.id}
          defaultTab="actions"
          onApplyAction={(act) => {
            const target = new Date(Date.now() + act.targetWeeks * 7 * 24 * 60 * 60 * 1000)
              .toISOString()
              .slice(0, 10);
            setTitle(act.title);
            setOwnerName((prev) => prev || caseDetail.owner || 'Line Manager');
            setDueDate(target);
            onToast('Copilot milestone pre-filled in Development action form.');
          }}
        />
      )}

      <div className="form-section">
        <span className="form-section-title">Follow-up plans</span>
        <div className="form-grid">
          <label className="field">
            <span>Action plan</span>
            <textarea
              value={actionPlanText}
              onChange={(event) => setActionPlanText(event.target.value)}
              placeholder="Write the agreed action plan…"
              rows={4}
              disabled={!canUpdateDevelopment || updateDev.isPending}
            />
          </label>
          <label className="field">
            <span>Learning management system (LMS)</span>
            <textarea
              value={lmsText}
              onChange={(event) => setLmsText(event.target.value)}
              placeholder="Write the LMS courses or learning activities…"
              rows={4}
              disabled={!canUpdateDevelopment || updateDev.isPending}
            />
          </label>
        </div>
        <div className="action-row" style={{ marginTop: 10 }}>
          <button
            type="button"
            className="secondary-button"
            disabled={!canUpdateDevelopment || updateDev.isPending}
            onClick={() =>
              updateDev.mutate({
                actionPlan: actionPlanText,
                learningManagementSystem: lmsText,
                expectedVersion: caseDetail.version,
              })
            }
          >
            {updateDev.isPending ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <Check size={16} />
            )}
            Save follow-up plans
          </button>
        </div>
        {updateDev.isError && <InlineError error={updateDev.error} onRefresh={onRefresh} />}
      </div>

      {caseDetail.candidateType === 'NEW_CANDIDATE' && (
        <div className="form-section candidate-outcome-panel">
          <span className="form-section-title">Candidate hiring outcome</span>
          <p className="panel-intro">
            Record whether this assessed external candidate joined. This keeps assessment results
            separate from hiring outcomes.
          </p>
          <div className="form-grid">
            <label className="field">
              <span>Hiring outcome</span>
              <select
                value={hiringOutcome}
                onChange={(event) => setHiringOutcome(event.target.value as typeof hiringOutcome)}
                disabled={!canUpdateDevelopment || updateDev.isPending}
              >
                <option value="PENDING">Pending decision</option>
                <option value="JOINED">Joined the organization</option>
                <option value="NOT_JOINED">Did not join</option>
              </select>
            </label>
            {hiringOutcome === 'NOT_JOINED' && (
              <label className="field">
                <span>
                  Reason for not joining <b>*</b>
                </span>
                <select
                  value={hiringOutcomeReason}
                  onChange={(event) => setHiringOutcomeReason(event.target.value)}
                  disabled={!canUpdateDevelopment || updateDev.isPending}
                >
                  <option value="">Choose a reason</option>
                  <option value="ASSESSMENT">Assessment result</option>
                  <option value="OFFER_DECLINED">Candidate declined the offer</option>
                  <option value="ROLE_CANCELLED">Role was cancelled</option>
                  <option value="OTHER">Other reason</option>
                </select>
              </label>
            )}
          </div>
          <div className="action-row" style={{ marginTop: 10 }}>
            <button
              type="button"
              className="secondary-button"
              disabled={
                !canUpdateDevelopment ||
                updateDev.isPending ||
                (hiringOutcome === 'NOT_JOINED' && !hiringOutcomeReason)
              }
              onClick={() =>
                updateDev.mutate({
                  hiringOutcome,
                  hiringOutcomeReason:
                    hiringOutcome === 'NOT_JOINED'
                      ? (hiringOutcomeReason as
                          'ASSESSMENT' | 'OFFER_DECLINED' | 'ROLE_CANCELLED' | 'OTHER')
                      : null,
                  expectedVersion: caseDetail.version,
                })
              }
            >
              {updateDev.isPending ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Check size={16} />
              )}
              Save hiring outcome
            </button>
          </div>
        </div>
      )}

      {development?.actions && development.actions.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <span className="form-section-title" style={{ display: 'block', marginBottom: 8 }}>
            Current action items ({development.actions.length})
          </span>
          <div className="criteria-table">
            {development.actions.map((act, idx) => (
              <div className="criterion-row" key={act.id ?? idx}>
                <div>
                  <strong>{act.title}</strong>
                  <span>
                    Owner: {act.ownerName}
                    {act.dueDate ? ` · Due ${formatDate(act.dueDate)}` : ''}
                  </span>
                </div>
                {canUpdateDevelopment ? (
                  <select
                    aria-label={`Status for ${act.title}`}
                    value={act.status ?? 'NOT_STARTED'}
                    disabled={updateDev.isPending}
                    style={{ width: 'auto', minHeight: 34, padding: '4px 10px' }}
                    onChange={(e) => {
                      const nextStatus = e.target.value as
                        'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
                      updateDev.mutate({
                        actions: serializeExistingActions(idx, nextStatus),
                        expectedVersion: caseDetail.version,
                      });
                    }}
                  >
                    <option value="NOT_STARTED">Not started</option>
                    <option value="IN_PROGRESS">In progress</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                ) : (
                  <StatusBadge status={act.status ?? 'NOT_STARTED'} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {canUpdateDevelopment && (
        <div className="form-section">
          <span className="form-section-title">Add development action</span>
          <div className="form-grid">
            <label className="field">
              <span>
                Action title <b>*</b> (min 3 chars)
              </span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Cross-functional leadership project"
                disabled={updateDev.isPending}
              />
            </label>
            <label className="field">
              <span>
                Action owner <b>*</b> (min 2 chars)
              </span>
              <input
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="e.g. Direct Manager"
                disabled={updateDev.isPending}
              />
            </label>
            <label className="field">
              <span>Target due date</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={updateDev.isPending}
              />
            </label>
          </div>
          <div className="action-row" style={{ marginTop: 10 }}>
            <button
              type="button"
              className="primary-button"
              disabled={
                updateDev.isPending || title.trim().length < 3 || ownerName.trim().length < 2
              }
              onClick={() => {
                updateDev.mutate({
                  actions: [
                    ...serializeExistingActions(),
                    {
                      title: title.trim(),
                      ownerName: ownerName.trim(),
                      status: 'NOT_STARTED',
                      ...(dueDate
                        ? { dueDate: new Date(`${dueDate}T00:00:00Z`).toISOString() }
                        : {}),
                    },
                  ],
                  expectedVersion: caseDetail.version,
                });
              }}
            >
              {updateDev.isPending ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Plus size={16} />
              )}
              {updateAction?.label ?? 'Add action item'}
            </button>
          </div>
        </div>
      )}

      {(reassessAction?.enabled || closeAction?.enabled) && (
        <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
          <span className="form-section-title" style={{ display: 'block', marginBottom: 10 }}>
            Lifecycle management
          </span>
          <div className="action-row">
            {reassessAction?.enabled && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => setReassessDialogOpen(true)}
              >
                <RotateCcw size={16} />
                {reassessAction.label ?? 'Schedule reassessment'}
              </button>
            )}
            {closeAction?.enabled && (
              <button
                type="button"
                className="danger-button"
                onClick={() => setCloseDialogOpen(true)}
              >
                <CheckCircle2 size={16} />
                {closeAction.label ?? 'Close case'}
              </button>
            )}
          </div>
          {scheduleReassessment.isError && (
            <InlineError error={scheduleReassessment.error} onRefresh={onRefresh} />
          )}
          {closeCase.isError && <InlineError error={closeCase.error} onRefresh={onRefresh} />}
        </div>
      )}

      <PromptDialog
        isOpen={reassessDialogOpen}
        title="Schedule follow-up reassessment"
        description="Creates a linked DRAFT reassessment case while keeping this source dossier immutable."
        label="Reassessment reason"
        placeholder="Specify the reason for reassessment (minimum 10 characters)…"
        minLength={10}
        confirmLabel="Confirm reassessment"
        busy={scheduleReassessment.isPending}
        onCancel={() => setReassessDialogOpen(false)}
        onConfirm={async (reason) => {
          await scheduleReassessment.mutateAsync({
            reason,
            expectedVersion: caseDetail.version,
          });
        }}
      />

      <ConfirmDialog
        isOpen={closeDialogOpen}
        title="Close assessment case permanently?"
        description="Closing this case seals all assessment scores, recommendations, approvals, and follow-up actions."
        confirmLabel="Confirm close case"
        severity="destructive"
        consequences={[
          'All lifecycle mutations and edits will be locked permanently.',
          'The full immutable audit history remains accessible.',
        ]}
        busy={closeCase.isPending}
        onCancel={() => setCloseDialogOpen(false)}
        onConfirm={async () => {
          await closeCase.mutateAsync({ expectedVersion: caseDetail.version });
        }}
      />
    </section>
  );
}
