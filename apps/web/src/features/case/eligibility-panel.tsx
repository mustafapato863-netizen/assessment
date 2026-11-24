import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  CheckCircle2,
  CircleDashed,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type { AssessmentCaseDetail } from '@assessflow/contracts';
import { api } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';
import { InlineError, PanelHeader } from '../../components/ui';
import { PromptDialog } from '../../components/dialogs';
import { eligibilityCriterionLabel } from './case-utils';

export function EligibilityPanel({
  caseDetail,
  onToast,
  onRefresh,
}: {
  caseDetail: AssessmentCaseDetail;
  onToast: (msg: string) => void;
  onRefresh: () => void;
}) {
  const queryClient = useQueryClient();
  const [decisionReason, setDecisionReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [eligibilityCriteriaMet, setEligibilityCriteriaMet] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setEligibilityCriteriaMet({});
    setDecisionReason('');
    setShowReject(false);
  }, [caseDetail.id]);

  const decision = useMutation({
    mutationFn: (payload: {
      decision: 'ELIGIBLE' | 'NOT_ELIGIBLE';
      reason?: string;
      criteria?: Array<{ code: string; result: 'MET' | 'NOT_CHECKED' }>;
      expectedVersion: number;
    }) => api.decideEligibility(caseDetail.id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.caseDetail(caseDetail.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.overview() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cases() });
      setShowReject(false);
      setDecisionReason('');
      onToast('Eligibility decision saved and next workflow task created.');
    },
  });

  const override = useMutation({
    mutationFn: (reason: string) => api.requestOverride(caseDetail.id, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.caseDetail(caseDetail.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.overview() });
      setOverrideDialogOpen(false);
      onToast('Governance override request submitted.');
    },
  });

  if (['SUBMITTED', 'PENDING_ELIGIBILITY'].includes(caseDetail.status)) {
    return (
      <section className="panel decision-panel">
        <PanelHeader
          icon={<ShieldCheck size={17} />}
          title="Eligibility review"
          action={
            <span className="policy-chip">Policy {caseDetail.eligibility?.policyVersion}</span>
          }
        />
        <p className="panel-intro">
          Confirm policy criteria before this case moves to assessment planning. Every decision is
          recorded in the audit history.
        </p>
        <div className="criteria-table">
          {caseDetail.eligibility?.criteria.map((criterion) => (
            <div className="criterion-row" key={criterion.code}>
              <div>
                <strong>{eligibilityCriterionLabel(criterion.label)}</strong>
                <span>{criterion.blocking ? 'Blocking policy check' : 'Optional check'}</span>
              </div>
              <label className="eligibility-criterion-toggle">
                <input
                  type="checkbox"
                  checked={eligibilityCriteriaMet[criterion.code] ?? false}
                  onChange={(event) =>
                    setEligibilityCriteriaMet((current) => ({
                      ...current,
                      [criterion.code]: event.target.checked,
                    }))
                  }
                  aria-label={`Mark ${eligibilityCriterionLabel(criterion.label)} as met`}
                />
                <span
                  className={`criterion-result ${eligibilityCriteriaMet[criterion.code] ? 'met' : 'not_checked'}`}
                >
                  {eligibilityCriteriaMet[criterion.code] ? (
                    <Check size={14} />
                  ) : (
                    <CircleDashed size={14} />
                  )}
                  {eligibilityCriteriaMet[criterion.code] ? 'MET' : 'NOT CHECKED'}
                </span>
              </label>
            </div>
          ))}
        </div>
        <div className="decision-actions">
          {showReject && (
            <div className="reason-field">
              <label htmlFor="eligibility-reason">Decision reason</label>
              <textarea
                id="eligibility-reason"
                value={decisionReason}
                onChange={(event) => setDecisionReason(event.target.value)}
                placeholder="Explain the blocking policy reason…"
              />
            </div>
          )}
          <div className="action-row">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setShowReject((value) => !value)}
            >
              <XCircle size={16} />
              {showReject ? 'Cancel' : 'Mark not eligible'}
            </button>
            {showReject ? (
              <button
                type="button"
                className="danger-button"
                disabled={decision.isPending || !decisionReason.trim()}
                onClick={() =>
                  decision.mutate({
                    decision: 'NOT_ELIGIBLE',
                    reason: decisionReason,
                    criteria: (caseDetail.eligibility?.criteria ?? []).map((criterion) => ({
                      code: criterion.code,
                      result: eligibilityCriteriaMet[criterion.code] ? 'MET' : 'NOT_CHECKED',
                    })),
                    expectedVersion: caseDetail.version,
                  })
                }
              >
                {decision.isPending ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <ShieldAlert size={16} />
                )}
                Confirm decision
              </button>
            ) : (
              <button
                type="button"
                className="primary-button"
                disabled={decision.isPending}
                onClick={() =>
                  decision.mutate({
                    decision: 'ELIGIBLE',
                    criteria: (caseDetail.eligibility?.criteria ?? []).map((criterion) => ({
                      code: criterion.code,
                      result: eligibilityCriteriaMet[criterion.code] ? 'MET' : 'NOT_CHECKED',
                    })),
                    expectedVersion: caseDetail.version,
                  })
                }
              >
                {decision.isPending ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                Mark eligible
              </button>
            )}
          </div>
        </div>
        {decision.isError && <InlineError error={decision.error} onRefresh={onRefresh} />}
      </section>
    );
  }

  if (caseDetail.status === 'NOT_ELIGIBLE') {
    return (
      <>
        <section className="panel override-panel">
          <PanelHeader
            icon={<ShieldAlert size={17} />}
            title="Eligibility exception"
            action={<span className="status-badge danger">Governance required</span>}
          />
          <p className="panel-intro">
            This case is blocked by eligibility policy. A governance exception review is required
            before planning can continue.
          </p>
          <div className="restricted-callout">
            <LockKeyhole size={18} />
            <div>
              <strong>Override requires a documented reason and audit trail</strong>
              <span>Only authorized governance reviewers can approve an exception.</span>
            </div>
          </div>
          <button
            type="button"
            className="secondary-button"
            disabled={override.isPending}
            onClick={() => setOverrideDialogOpen(true)}
          >
            {override.isPending ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <RotateCcw size={16} />
            )}
            Request override review
          </button>
          {override.isError && <InlineError error={override.error} onRefresh={onRefresh} />}
        </section>

        <PromptDialog
          isOpen={overrideDialogOpen}
          title="Request eligibility override"
          description="Provide the business exception rationale to route this case for governance review."
          label="Override rationale"
          placeholder="e.g. Business-critical clinical leadership coverage requires immediate assessment…"
          minLength={10}
          confirmLabel="Submit override request"
          busy={override.isPending}
          onCancel={() => setOverrideDialogOpen(false)}
          onConfirm={async (reason) => {
            await override.mutateAsync(reason);
          }}
        />
      </>
    );
  }

  if (caseDetail.eligibility) {
    return (
      <section className="panel decision-summary-panel">
        <PanelHeader
          icon={<ShieldCheck size={17} />}
          title="Eligibility verification"
          action={<span className="status-badge success">Verified Eligible</span>}
        />
        <p className="panel-intro">Policy criteria verified. Assessment planning is unlocked.</p>
        <div className="criteria-table">
          {caseDetail.eligibility.criteria.map((criterion) => (
            <div className="criterion-row" key={criterion.code}>
              <div>
                <strong>{eligibilityCriterionLabel(criterion.label)}</strong>
                <span>{criterion.blocking ? 'Blocking criterion' : 'Non-blocking criterion'}</span>
              </div>
              <span className={`criterion-result ${criterion.result.toLowerCase()}`}>
                {criterion.result === 'MET' ? <Check size={14} /> : <CircleDashed size={14} />}
                {criterion.result.replace('_', ' ')}
              </span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return null;
}
