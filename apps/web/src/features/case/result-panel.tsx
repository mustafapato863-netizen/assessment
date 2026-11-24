import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  CheckCircle2,
  CircleDashed,
  FileCheck2,
  LoaderCircle,
  RotateCcw,
} from 'lucide-react';
import type {
  AssessmentCaseDetail,
  AssessorRecommendationCode,
  FinalizeResultInput,
  ReopenResultInput,
} from '@assessflow/contracts';
import { api } from '../../lib/api';
import { getSession, hasBackendRole } from '../../lib/auth';
import { queryKeys } from '../../lib/query-keys';
import { InlineError, PanelHeader, StatusBadge } from '../../components/ui';
import { PromptDialog } from '../../components/dialogs';
import {
  AssessmentSummary,
  AssessorScorecard,
  defaultAssessorRecommendation,
  resultCodeLabel,
} from './scorecard-panel';
import { AiCopilotCard } from './ai-copilot-card';
import {
  getAvailableAction,
  PAST_RESULT_STATUSES,
  type AssessmentSummaryData,
  type ResultData,
  type ScorecardResponse,
} from './case-utils';

export function ResultPanel({
  caseDetail,
  onToast,
  onRefresh,
}: {
  caseDetail: AssessmentCaseDetail;
  onToast: (msg: string) => void;
  onRefresh: () => void;
}) {
  const queryClient = useQueryClient();
  const user = getSession();
  const isFinalizedOrPast = PAST_RESULT_STATUSES.includes(caseDetail.status);
  const isInProgress = caseDetail.status === 'IN_PROGRESS';
  const isPendingResult = caseDetail.status === 'PENDING_RESULT';
  const isVisible = isInProgress || isPendingResult || isFinalizedOrPast;

  const { data: result } = useQuery({
    queryKey: queryKeys.caseResult(caseDetail.id),
    queryFn: () => api.getResult<ResultData>(caseDetail.id),
    enabled: isFinalizedOrPast,
    retry: false,
  });

  const { data: scorecard } = useQuery({
    queryKey: queryKeys.caseScorecard(caseDetail.id),
    queryFn: () => api.scorecard<ScorecardResponse>(caseDetail.id),
    enabled: isVisible,
    retry: false,
  });

  const summaryData: AssessmentSummaryData | undefined =
    scorecard?.aggregate ??
    (result?.scorecardSummary
      ? {
          completeCount: result.scorecardSummary.completeCount,
          technical: result.scorecardSummary.technical,
          behavioral: result.scorecardSummary.behavioral,
          overall: result.scorecardSummary.overall,
          knockout: result.scorecardSummary.knockout,
          technicalWeight:
            result.scorecardSummary.technicalWeight ?? scorecard?.config?.technicalWeight ?? 50,
          behavioralWeight:
            result.scorecardSummary.behavioralWeight ?? scorecard?.config?.behavioralWeight ?? 50,
          technicalIssues: result.scorecardSummary.technicalIssues ?? [],
          behavioralIssues: result.scorecardSummary.behavioralIssues ?? [],
          knockoutChecks: result.scorecardSummary.knockoutChecks ?? [],
        }
      : undefined);

  const scorecardResolved = scorecard !== undefined;
  const scorecardConfigured = Boolean(scorecard?.config);
  const automaticResultCode = scorecard?.aggregate?.completeCount
    ? (scorecard.aggregate.resultCode ?? 'INCOMPLETE')
    : 'INCOMPLETE';

  const [manualResultCode, setManualResultCode] = useState<
    'READY_NOW' | 'READY_WITH_DEVELOPMENT' | 'NOT_READY'
  >('READY_NOW');
  const [evidenceSummary, setEvidenceSummary] = useState('');
  const [assessorRecommendation, setAssessorRecommendation] = useState<string | undefined>();
  const [recDialogOpen, setRecDialogOpen] = useState(false);
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);

  const finalizeAction = getAvailableAction(caseDetail, 'FINALIZE_RESULT');
  const reopenAction = getAvailableAction(caseDetail, 'REOPEN_RESULT');
  const canEditAssessorRecommendation =
    (caseDetail.status === 'IN_PROGRESS' ||
      caseDetail.status === 'PENDING_RESULT' ||
      caseDetail.status === 'RESULT_FINALIZED') &&
    hasBackendRole(user, ['Assessor', 'PanelLead', 'HR', 'Admin']);
  const canReopenFinalResult =
    caseDetail.status === 'RESULT_FINALIZED' && hasBackendRole(user, ['Admin']);

  const finalizeResult = useMutation({
    mutationFn: (input: FinalizeResultInput) => api.finalizeResult(caseDetail.id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.caseDetail(caseDetail.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.caseResult(caseDetail.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.overview() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cases() });
      onToast('Assessment result finalized.');
    },
  });

  const reopenResult = useMutation({
    mutationFn: (input: ReopenResultInput) => api.reopenResult(caseDetail.id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.caseDetail(caseDetail.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.caseResult(caseDetail.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.overview() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cases() });
      setReopenDialogOpen(false);
      onToast('Assessment result reopened for review.');
    },
  });

  const updateRecommendation = useMutation({
    mutationFn: ({ code, reason }: { code: string; reason: string }) =>
      api.updateAssessorRecommendation(caseDetail.id, {
        code,
        reason,
        expectedVersion: caseDetail.version,
      }),
    onSuccess: ({ code }) => {
      setAssessorRecommendation(code);
      void queryClient.invalidateQueries({ queryKey: queryKeys.caseDetail(caseDetail.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.caseResult(caseDetail.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.overview() });
      setRecDialogOpen(false);
      onToast('Assessor recommendation updated and recorded in audit history.');
    },
  });

  if (!isVisible) return null;

  if (isFinalizedOrPast) {
    return (
      <section className="panel result-panel">
        <PanelHeader
          icon={<FileCheck2 size={17} />}
          title="Final assessment result"
          action={<StatusBadge status={result?.resultCode ?? caseDetail.status} />}
        />
        {summaryData && (
          <AssessmentSummary
            caseDetail={caseDetail}
            summary={summaryData}
            assessors={scorecard?.submissions ?? []}
            finalizedAt={result?.finalizedAt}
            finalizedBy={result?.finalizedBy}
            recommendationCode={
              assessorRecommendation ??
              result?.scorecardSummary?.assessorRecommendation ??
              defaultAssessorRecommendation(summaryData)
            }
            editable={canEditAssessorRecommendation}
            onRecommendationChange={
              canEditAssessorRecommendation ? setAssessorRecommendation : undefined
            }
          />
        )}
        {canEditAssessorRecommendation && summaryData && (
          <div className="action-row" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="secondary-button"
              disabled={
                updateRecommendation.isPending ||
                !assessorRecommendation ||
                assessorRecommendation ===
                  (result?.scorecardSummary?.assessorRecommendation ??
                    defaultAssessorRecommendation(summaryData))
              }
              onClick={() => setRecDialogOpen(true)}
            >
              {updateRecommendation.isPending ? 'Saving…' : 'Save recommendation change'}
            </button>
            {updateRecommendation.isError && (
              <InlineError error={updateRecommendation.error} onRefresh={onRefresh} />
            )}
          </div>
        )}
        <div className="summary-grid" style={{ marginTop: 14 }}>
          <div className="info-item">
            <span>Official result</span>
            <strong>{resultCodeLabel(result?.resultCode ?? 'INCOMPLETE')}</strong>
          </div>
          <div className="info-item">
            <span>Finalized by</span>
            <strong>{result?.finalizedBy ?? 'Panel Lead'}</strong>
          </div>
        </div>
        {result?.evidenceSummary && (
          <div className="justification" style={{ marginTop: 14 }}>
            <span>Evidence summary</span>
            <p>{result.evidenceSummary}</p>
          </div>
        )}
        {canReopenFinalResult && (
          <div style={{ marginTop: 20, paddingTop: 15, borderTop: '1px solid var(--border)' }}>
            <div className="action-row">
              <button
                type="button"
                className="secondary-button"
                disabled={reopenResult.isPending || (reopenAction ? !reopenAction.enabled : false)}
                onClick={() => setReopenDialogOpen(true)}
              >
                <RotateCcw size={16} />
                {reopenAction?.label ?? 'Reopen result'}
              </button>
            </div>
            {reopenResult.isError && (
              <InlineError error={reopenResult.error} onRefresh={onRefresh} />
            )}
          </div>
        )}

        <PromptDialog
          isOpen={recDialogOpen}
          title="Save assessor recommendation update"
          description="Explain why the assessor recommendation is being adjusted. This reason is stored in the immutable audit trail."
          label="Change reason"
          placeholder="e.g. Updated after cross-panel competency calibration review…"
          minLength={3}
          confirmLabel="Save recommendation"
          busy={updateRecommendation.isPending}
          onCancel={() => setRecDialogOpen(false)}
          onConfirm={async (reason) => {
            if (!assessorRecommendation) return;
            await updateRecommendation.mutateAsync({ code: assessorRecommendation, reason });
          }}
        />

        <PromptDialog
          isOpen={reopenDialogOpen}
          title="Reopen finalized result"
          description="Reopening the finalized result returns the case to IN_PROGRESS and logs an audit entry."
          label="Reopen reason"
          placeholder="Explain why this finalized result is being reopened for review…"
          minLength={10}
          confirmLabel="Confirm reopen"
          severity="destructive"
          busy={reopenResult.isPending}
          onCancel={() => setReopenDialogOpen(false)}
          onConfirm={async (reason) => {
            await reopenResult.mutateAsync({
              reason,
              expectedVersion: caseDetail.version,
            });
          }}
        />
      </section>
    );
  }

  return (
    <section className="panel result-panel">
      <PanelHeader
        icon={<FileCheck2 size={17} />}
        title="Finalize assessment result"
        action={<StatusBadge status={caseDetail.status} />}
      />
      <p className="panel-intro">
        Synthesize evidence across sessions and record the official evaluation outcome.
      </p>

      <AiCopilotCard
        caseId={caseDetail.id}
        defaultTab="synthesis"
        onApplySynthesis={(synthesis) => {
          setEvidenceSummary((prev) =>
            prev.trim()
              ? `${prev.trim()}\n\n${synthesis.executiveSummary}`
              : synthesis.executiveSummary,
          );
          onToast('Copilot synthesis added to result summary.');
        }}
      />

      {isPendingResult && (
        <AssessorScorecard caseId={caseDetail.id} onToast={onToast} onRefresh={onRefresh} />
      )}
      {summaryData && (
        <AssessmentSummary
          caseDetail={caseDetail}
          summary={summaryData}
          assessors={scorecard?.submissions ?? []}
          recommendationCode={
            assessorRecommendation ??
            (summaryData ? defaultAssessorRecommendation(summaryData) : undefined)
          }
          editable={canEditAssessorRecommendation}
          onRecommendationChange={
            canEditAssessorRecommendation ? setAssessorRecommendation : undefined
          }
        />
      )}
      <div className="rs-panel rs-evidence">
        {scorecardResolved && !scorecardConfigured && (
          <label className="rs-field" style={{ marginBottom: 12 }}>
            <span className="rs-field-head">
              <span>Readiness outcome</span>
            </span>
            <select
              value={manualResultCode}
              onChange={(e) =>
                setManualResultCode(
                  e.target.value as 'READY_NOW' | 'READY_WITH_DEVELOPMENT' | 'NOT_READY',
                )
              }
              disabled={finalizeResult.isPending}
            >
              <option value="READY_NOW">Ready now</option>
              <option value="READY_WITH_DEVELOPMENT">Ready with development</option>
              <option value="NOT_READY">Not ready</option>
            </select>
          </label>
        )}
        <label className="rs-field">
          <span className="rs-field-head">
            <span>Evidence summary</span>
            <span className="rs-num rs-muted rs-normal">{evidenceSummary.length} / 4000</span>
          </span>
          <textarea
            value={evidenceSummary}
            maxLength={4000}
            onChange={(e) => setEvidenceSummary(e.target.value)}
            placeholder="Consolidated observations and overall performance rationale…"
            rows={5}
            disabled={finalizeResult.isPending}
          />
        </label>
      </div>
      <div className="rs-footer">
        <div className="rs-checks">
          {[
            ...(scorecardConfigured
              ? [
                  {
                    ok: Boolean(scorecard?.aggregate?.completeCount),
                    label: scorecard?.aggregate?.completeCount
                      ? 'Scorecard submitted'
                      : 'Waiting for a submitted scorecard',
                  },
                ]
              : []),
            {
              ok: Boolean(
                assessorRecommendation ??
                (summaryData ? defaultAssessorRecommendation(summaryData) : undefined),
              ),
              label: 'Recommendation selected',
            },
            {
              ok: evidenceSummary.trim().length > 0,
              label: evidenceSummary.trim()
                ? 'Evidence summary added'
                : 'Evidence summary (recommended)',
            },
          ].map((check) => (
            <span key={check.label} className={`rs-check ${check.ok ? 'ok' : 'todo'}`}>
              {check.ok ? <Check size={16} /> : <CircleDashed size={16} />}
              {check.label}
            </span>
          ))}
        </div>
        <button
          type="button"
          className="primary-button"
          disabled={
            finalizeResult.isPending ||
            !scorecardResolved ||
            (scorecardConfigured && !scorecard?.aggregate?.completeCount) ||
            (finalizeAction ? !finalizeAction.enabled : false)
          }
          onClick={() =>
            finalizeResult.mutate({
              resultCode: scorecardConfigured ? automaticResultCode : manualResultCode,
              assessorRecommendation: (assessorRecommendation ??
                (summaryData ? defaultAssessorRecommendation(summaryData) : undefined)) as
                AssessorRecommendationCode | undefined,
              evidenceSummary: evidenceSummary.trim() || undefined,
              expectedVersion: caseDetail.version,
            })
          }
        >
          {finalizeResult.isPending ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <CheckCircle2 size={16} />
          )}
          {finalizeAction?.label ?? 'Finalize result'}
        </button>
      </div>
      {finalizeResult.isError && <InlineError error={finalizeResult.error} onRefresh={onRefresh} />}
    </section>
  );
}
