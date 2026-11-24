import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, LoaderCircle } from 'lucide-react';
import type { AssessmentCaseDetail } from '@assessflow/contracts';
import { api } from '../../lib/api';
import { InlineError } from '../../components/ui';

export function AdminRequestEditor({
  caseDetail,
  onSaved,
}: {
  caseDetail: AssessmentCaseDetail;
  onSaved: (updated: AssessmentCaseDetail) => void;
}) {
  const [targetRole, setTargetRole] = useState(caseDetail.targetRole);
  const [targetLevel, setTargetLevel] = useState(caseDetail.targetLevel);
  const [justification, setJustification] = useState(caseDetail.justification);
  const [reason, setReason] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      api.updateReopenedRequest(caseDetail.id, {
        targetRole,
        targetLevel,
        justification,
        reason,
        expectedVersion: caseDetail.version,
      }),
    onSuccess: onSaved,
  });

  return (
    <div className="admin-request-editor">
      <strong>Edit request details</strong>
      <label className="field">
        <span>Target role</span>
        <input value={targetRole} onChange={(event) => setTargetRole(event.target.value)} />
      </label>
      <label className="field">
        <span>Target level</span>
        <input value={targetLevel} onChange={(event) => setTargetLevel(event.target.value)} />
      </label>
      <label className="field">
        <span>Business justification</span>
        <textarea
          value={justification}
          onChange={(event) => setJustification(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Edit reason (minimum 10 characters)</span>
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} />
      </label>
      <div className="action-row">
        <button
          type="button"
          className="primary-button"
          disabled={
            mutation.isPending || reason.trim().length < 10 || justification.trim().length < 20
          }
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <CheckCircle2 size={16} />
          )}
          Save request edits
        </button>
      </div>
      {mutation.isError && <InlineError error={mutation.error} />}
    </div>
  );
}
