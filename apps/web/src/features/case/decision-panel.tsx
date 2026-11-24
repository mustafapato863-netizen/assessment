import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, LoaderCircle, Send, ShieldCheck, XCircle } from 'lucide-react';
import type {
  AssessmentCaseDetail,
  DecideApprovalInput,
  SubmitRecommendationInput,
} from '@assessflow/contracts';
import { api } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';
import { InlineError, PanelHeader, StatusBadge } from '../../components/ui';
import { getAvailableAction, PAST_DECISION_STATUSES, type ApprovalStepItem } from './case-utils';

export function DecisionPanel({
  caseDetail,
  onToast,
  onRefresh,
}: {
  caseDetail: AssessmentCaseDetail;
  onToast: (msg: string) => void;
  onRefresh: () => void;
}) {
  const queryClient = useQueryClient();
  const isPastDecision = PAST_DECISION_STATUSES.includes(caseDetail.status);
  const isVisible =
    caseDetail.status === 'RESULT_FINALIZED' ||
    caseDetail.status === 'PENDING_RECOMMENDATION' ||
    caseDetail.status === 'PENDING_APPROVAL' ||
    isPastDecision;

  const showRecommendationForm =
    caseDetail.status === 'RESULT_FINALIZED' || caseDetail.status === 'PENDING_RECOMMENDATION';

  const [code, setCode] = useState('READY_FOR_PROMOTION');
  const [rationale, setRationale] = useState('');
  const [requiresDevelopment, setRequiresDevelopment] = useState(false);
  const [requiresManagerActionPlan, setRequiresManagerActionPlan] = useState(false);
  const [requiresReassessment, setRequiresReassessment] = useState(false);
  const [decisionComments, setDecisionComments] = useState<Record<string, string>>({});

  const {
    data: steps,
    isLoading: approvalStepsLoading,
    isError: approvalStepsError,
    error: approvalStepsErrorValue,
    refetch: refetchApprovalSteps,
  } = useQuery({
    queryKey: queryKeys.caseApprovals(caseDetail.id),
    queryFn: () => api.listApprovalSteps<ApprovalStepItem>(caseDetail.id),
    enabled: isVisible,
  });

  const recAction = getAvailableAction(caseDetail, 'SUBMIT_RECOMMENDATION');
  const approvalAction = getAvailableAction(caseDetail, 'DECIDE_APPROVAL');
  const activeApprovalStepId = steps?.find((step) => step.decision === 'PENDING')?.id;

  const submitRec = useMutation({
    mutationFn: (input: SubmitRecommendationInput) =>
      api.submitRecommendation(caseDetail.id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.caseDetail(caseDetail.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.caseApprovals(caseDetail.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.overview() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cases() });
      onToast('Recommendation submitted for approval.');
    },
  });

  const decideStep = useMutation({
    mutationFn: ({ stepId, input }: { stepId: string; input: DecideApprovalInput }) =>
      api.decideApprovalStep(stepId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.caseDetail(caseDetail.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.caseApprovals(caseDetail.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.overview() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cases() });
      onToast('Approval decision recorded.');
    },
  });

  if (!isVisible) return null;

  return (
    <section className="panel decision-panel">
      <PanelHeader
        icon={<ShieldCheck size={17} />}
        title="Decision & approvals"
        action={<StatusBadge status={caseDetail.status} />}
      />

      {showRecommendationForm && (
        <div>
          <p className="panel-intro">
            Submit an official business recommendation based on the finalized evaluation result.
          </p>
          <div className="form-grid">
            <label className="field">
              <span>
                Recommendation code <b>*</b>
              </span>
              <select
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={submitRec.isPending}
              >
                <option value="READY_FOR_PROMOTION">Ready for promotion</option>
                <option value="ACTING_FOR_3_MONTHS">Acting as for 3 Months</option>
                <option value="FIT_FOR_CURRENT_POSITION">Fit for current Position</option>
                <option value="UNFIT_FOR_CURRENT_POSITION">Unfit for current position</option>
                <option value="NOT_READY_FOR_PROMOTION">Not Ready for promotion</option>
                <option value="DOWNGRADE">Downgrade</option>
                <option value="REPLACEMENT">Replacement</option>
              </select>
            </label>
          </div>
          <label className="field" style={{ marginTop: 14 }}>
            <span>
              Rationale <b>*</b> (min 20 chars)
            </span>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Detail the business justification and competencies demonstrated (minimum 20 characters)…"
              rows={4}
              disabled={submitRec.isPending}
            />
            <small
              style={{
                color: rationale.trim().length < 20 ? 'var(--muted)' : 'var(--success)',
                fontSize: 11,
                display: 'block',
                marginTop: 4,
              }}
            >
              {rationale.trim().length} / 20 characters minimum
            </small>
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginTop: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
              <input
                type="checkbox"
                checked={requiresDevelopment}
                onChange={(e) => setRequiresDevelopment(e.target.checked)}
                disabled={submitRec.isPending}
              />
              <span>Requires development plan</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
              <input
                type="checkbox"
                checked={requiresManagerActionPlan}
                onChange={(e) => setRequiresManagerActionPlan(e.target.checked)}
                disabled={submitRec.isPending}
              />
              <span>Requires Action plan (Manager)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
              <input
                type="checkbox"
                checked={requiresReassessment}
                onChange={(e) => setRequiresReassessment(e.target.checked)}
                disabled={submitRec.isPending}
              />
              <span>Requires Reassessment (3 Months)</span>
            </label>
          </div>
          <div className="action-row" style={{ marginTop: 16 }}>
            <button
              type="button"
              className="primary-button"
              disabled={
                submitRec.isPending ||
                !code ||
                rationale.trim().length < 20 ||
                (recAction ? !recAction.enabled : false)
              }
              onClick={() =>
                submitRec.mutate({
                  code,
                  rationale: rationale.trim(),
                  requiresDevelopment,
                  requiresManagerActionPlan,
                  requiresReassessment,
                  expectedVersion: caseDetail.version,
                })
              }
            >
              {submitRec.isPending ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Send size={16} />
              )}
              {recAction?.label ?? 'Submit recommendation'}
            </button>
          </div>
          {submitRec.isError && <InlineError error={submitRec.error} onRefresh={onRefresh} />}
        </div>
      )}

      {approvalStepsLoading && (
        <p className="panel-intro" style={{ marginTop: 14 }}>
          Loading approval steps…
        </p>
      )}
      {approvalStepsError && (
        <InlineError
          error={approvalStepsErrorValue}
          onRefresh={() => void refetchApprovalSteps()}
        />
      )}
      {!approvalStepsLoading && !approvalStepsError && steps?.length === 0 && !isPastDecision && (
        <div className="empty-state" style={{ marginTop: 14, padding: 20 }}>
          No approval steps configured yet. Submit a recommendation to initialize the approval
          chain.
        </div>
      )}

      {steps && steps.length > 0 && (
        <div style={{ marginTop: showRecommendationForm ? 24 : 0 }}>
          <span className="form-section-title" style={{ display: 'block', marginBottom: 12 }}>
            Sequential approval steps ({steps.length})
          </span>
          <div style={{ display: 'grid', gap: 14 }}>
            {steps.map((step) => {
              const isPending = step.decision === 'PENDING';
              const isCurrentApprover =
                isPending &&
                step.id === activeApprovalStepId &&
                caseDetail.status === 'PENDING_APPROVAL';
              const comment = decisionComments[step.id] ?? '';
              const isMutating = decideStep.isPending && decideStep.variables?.stepId === step.id;

              return (
                <div
                  key={step.id}
                  style={{
                    padding: 14,
                    border: '1px solid var(--border)',
                    borderRadius: 11,
                    background: isCurrentApprover ? 'var(--brand-soft)' : '#fff',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}
                  >
                    <div>
                      <strong>
                        Step {step.sequence}:{' '}
                        {step.role.charAt(0) + step.role.slice(1).toLowerCase()} Approver
                      </strong>
                      {step.approverName && (
                        <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)' }}>
                          Decided by {step.approverName}
                        </span>
                      )}
                    </div>
                    <StatusBadge status={step.decision} />
                  </div>
                  {step.comment && (
                    <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--secondary)' }}>
                      Note: {step.comment}
                    </p>
                  )}
                  {isCurrentApprover && (
                    <div style={{ marginTop: 12 }}>
                      <label className="field">
                        <span>Decision comment (required for changes or rejection)</span>
                        <input
                          value={comment}
                          onChange={(e) =>
                            setDecisionComments((prev) => ({
                              ...prev,
                              [step.id]: e.target.value,
                            }))
                          }
                          placeholder="Provide context for approval, changes, or rejection…"
                          disabled={isMutating}
                        />
                      </label>
                      <div className="action-row" style={{ marginTop: 10 }}>
                        <button
                          type="button"
                          className="danger-button"
                          disabled={
                            isMutating ||
                            !comment.trim() ||
                            (approvalAction ? !approvalAction.enabled : false)
                          }
                          onClick={() =>
                            decideStep.mutate({
                              stepId: step.id,
                              input: {
                                decision: 'REJECTED',
                                comment: comment.trim(),
                                expectedVersion: caseDetail.version,
                              },
                            })
                          }
                        >
                          <XCircle size={16} />
                          Reject
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={
                            isMutating ||
                            !comment.trim() ||
                            (approvalAction ? !approvalAction.enabled : false)
                          }
                          onClick={() =>
                            decideStep.mutate({
                              stepId: step.id,
                              input: {
                                decision: 'CHANGES_REQUESTED',
                                comment: comment.trim(),
                                expectedVersion: caseDetail.version,
                              },
                            })
                          }
                        >
                          Request changes
                        </button>
                        <button
                          type="button"
                          className="primary-button"
                          disabled={
                            isMutating || (approvalAction ? !approvalAction.enabled : false)
                          }
                          onClick={() =>
                            decideStep.mutate({
                              stepId: step.id,
                              input: {
                                decision: 'APPROVED',
                                comment: comment.trim() || undefined,
                                expectedVersion: caseDetail.version,
                              },
                            })
                          }
                        >
                          {isMutating ? (
                            <LoaderCircle className="spin" size={16} />
                          ) : (
                            <CheckCircle2 size={16} />
                          )}
                          Approve
                        </button>
                      </div>
                    </div>
                  )}
                  {isPending && !isCurrentApprover && caseDetail.status === 'PENDING_APPROVAL' && (
                    <p style={{ margin: '10px 0 0', color: 'var(--muted)', fontSize: 11.5 }}>
                      Waiting for the previous approval step.
                    </p>
                  )}
                  {decideStep.isError && decideStep.variables?.stepId === step.id && (
                    <InlineError error={decideStep.error} onRefresh={onRefresh} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
