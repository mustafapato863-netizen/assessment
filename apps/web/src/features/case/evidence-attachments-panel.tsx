import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  Upload,
} from 'lucide-react';
import type { AssessmentCaseDetail, AttachmentSummary } from '@assessflow/contracts';
import { api, ApiRequestError } from '../../lib/api';
import { formatDateTime, formatFileSize } from '../../lib/format';
import { queryKeys } from '../../lib/query-keys';
import { InlineError, PanelHeader, StatusBadge } from '../../components/ui';
import { AssessorScorecard } from './scorecard-panel';
import { AiCopilotCard } from './ai-copilot-card';
import { getAvailableAction, PAST_ASSESSMENT_STATUSES, type EventItem } from './case-utils';

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Could not read file contents.'));
    reader.readAsDataURL(file);
  });
}

export function EvidencePanel({
  caseDetail,
  onToast,
  onRefresh,
  onGoToStage,
}: {
  caseDetail: AssessmentCaseDetail;
  onToast: (msg: string) => void;
  onRefresh: () => void;
  onGoToStage?: (stage: string) => void;
}) {
  const queryClient = useQueryClient();
  const isEditableStage = caseDetail.status === 'SCHEDULED' || caseDetail.status === 'IN_PROGRESS';
  const isPastAssessment = PAST_ASSESSMENT_STATUSES.includes(caseDetail.status);
  const isVisible = isEditableStage || isPastAssessment;

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [submittedEvents, setSubmittedEvents] = useState<Record<string, boolean>>({});

  const { data: attachments = [], refetch: refetchAttachments } = useQuery({
    queryKey: queryKeys.caseAttachments(caseDetail.id),
    queryFn: () => api.caseAttachments(caseDetail.id),
    enabled: isVisible,
    refetchInterval: (query) => {
      const list = (query.state.data as AttachmentSummary[] | undefined) ?? [];
      return list.some((a) => a.scanStatus === 'PENDING' || a.scanStatus === 'SCANNING')
        ? 3000
        : false;
    },
  });

  const { data: events } = useQuery({
    queryKey: queryKeys.caseEvents(caseDetail.id),
    queryFn: () => api.listEvents<EventItem>(caseDetail.id),
    enabled: isVisible,
  });

  const action = getAvailableAction(caseDetail, 'SUBMIT_EVIDENCE');

  const saveDraft = useMutation({
    mutationFn: ({ eventId, summary }: { eventId: string; summary: string }) =>
      api.saveEvidenceDraft(eventId, { summary, expectedVersion: caseDetail.version }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.caseDetail(caseDetail.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.caseEvents(caseDetail.id) });
      onToast('Evidence draft saved.');
    },
  });

  const submitEvidence = useMutation({
    mutationFn: ({ eventId, summary }: { eventId: string; summary: string }) =>
      api.submitEvidence(eventId, { summary, expectedVersion: caseDetail.version }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.caseDetail(caseDetail.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.caseEvents(caseDetail.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.overview() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cases() });
      setSubmittedEvents((prev) => ({ ...prev, [variables.eventId]: true }));
      onToast('Assessor evidence submitted.');
    },
  });

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';

    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setUploadError('File size exceeds 10MB maximum limit. Please select a smaller file.');
      return;
    }

    const lastDot = file.name.lastIndexOf('.');
    const ext = lastDot !== -1 ? file.name.slice(lastDot).toLowerCase() : '';
    const allowed = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
    if (!allowed.includes(ext)) {
      setUploadError(
        'Unsupported file format. Please upload a .pdf, .doc, .docx, .jpg, or .png file.',
      );
      return;
    }

    setUploadError(null);
    setPreviewError(null);
    setIsUploading(true);

    const mimeMap: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
    };
    const contentType = mimeMap[ext] || file.type || 'application/pdf';

    try {
      const contentBase64 = await readFileAsBase64(file);
      await api.createAttachment({
        caseId: caseDetail.id,
        fileName: file.name,
        contentType,
        sizeBytes: file.size,
        classification: 'EVIDENCE',
        contentBase64,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.caseAttachments(caseDetail.id) });
      onToast(`Attachment "${file.name}" uploaded for anti-malware security scanning.`);
    } catch (err) {
      setUploadError((err as Error).message || 'Failed to upload attachment.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpenCleanFile = async (att: AttachmentSummary, mode: 'preview' | 'download') => {
    setPreviewError(null);
    try {
      const blob = await api.fetchCleanAttachmentBlob(att.id, mode);
      const url = URL.createObjectURL(blob);
      if (mode === 'preview') {
        window.open(url, '_blank', 'noopener,noreferrer');
        onToast(`Opened clean preview for ${att.fileName}.`);
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = att.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        onToast(`Downloading ${att.fileName}.`);
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'SCAN_NOT_CLEAN') {
        const msg = `Scan not clean: Attachment cannot be accessed (${err.scanStatus || att.scanStatus}).`;
        setPreviewError(msg);
        onToast(msg);
      } else {
        const msg = (err as Error).message || 'Could not retrieve clean attachment.';
        setPreviewError(msg);
        onToast(msg);
      }
    }
  };

  if (!isVisible) return null;

  const firstEditableEventId = events?.find((ev) => !submittedEvents[ev.id])?.id;
  const activeEvidenceDraft = firstEditableEventId ? (summaries[firstEditableEventId] ?? '') : '';

  return (
    <section className="panel evidence-panel">
      <PanelHeader
        icon={<FileText size={17} />}
        title="Assessor evidence"
        action={<StatusBadge status={caseDetail.status} />}
      />

      {isEditableStage && (
        <>
          <p className="panel-intro">
            Record detailed behavioral evidence for each scheduled evaluation session. Minimum 20
            characters required.
          </p>

          <AiCopilotCard
            caseId={caseDetail.id}
            defaultTab="bias"
            currentEvidenceText={activeEvidenceDraft}
            onApplySanitizedText={
              firstEditableEventId
                ? (cleanText) => {
                    setSummaries((prev) => ({ ...prev, [firstEditableEventId]: cleanText }));
                    onToast('Objective wording applied to current session draft.');
                  }
                : undefined
            }
          />

          {events && events.length > 0 ? (
            <div style={{ display: 'grid', gap: 18 }}>
              {events.map((ev) => {
                const isSubmitted = submittedEvents[ev.id];
                const summary = summaries[ev.id] ?? '';
                const isPending =
                  (saveDraft.isPending && saveDraft.variables?.eventId === ev.id) ||
                  (submitEvidence.isPending && submitEvidence.variables?.eventId === ev.id);

                return (
                  <div
                    key={ev.id}
                    style={{
                      padding: 14,
                      border: '1px solid var(--border)',
                      borderRadius: 11,
                      background: isSubmitted ? 'var(--surface-subtle)' : '#fff',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 10,
                      }}
                    >
                      <strong>Session: {ev.startsAt ? formatDateTime(ev.startsAt) : ev.id}</strong>
                      <StatusBadge status={isSubmitted ? 'COMPLETED' : ev.status} />
                    </div>
                    {isSubmitted ? (
                      <>
                        <div className="restricted-callout">
                          <LockKeyhole size={16} />
                          <div>
                            <strong>Evidence submitted &amp; locked</strong>
                            <span>
                              This evidence record is sealed and read-only for audit integrity.
                            </span>
                          </div>
                        </div>
                        <label className="field">
                          <span>Submitted summary</span>
                          <textarea value={summary} readOnly rows={3} disabled />
                        </label>
                      </>
                    ) : (
                      <>
                        <label className="field">
                          <span>
                            Evidence summary <b>*</b> (min 20 chars)
                          </span>
                          <textarea
                            value={summary}
                            onChange={(e) =>
                              setSummaries((prev) => ({ ...prev, [ev.id]: e.target.value }))
                            }
                            placeholder="Detail the candidate's observed competencies, behaviors, and situational responses…"
                            rows={4}
                            disabled={isPending}
                          />
                          <small
                            style={{
                              color: summary.trim().length < 20 ? 'var(--muted)' : 'var(--success)',
                              fontSize: 11,
                              display: 'block',
                              marginTop: 4,
                            }}
                          >
                            {summary.trim().length} / 20 characters minimum
                          </small>
                        </label>
                        <div className="action-row" style={{ marginTop: 12 }}>
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={isPending || summary.trim().length < 20}
                            onClick={() => saveDraft.mutate({ eventId: ev.id, summary })}
                          >
                            {saveDraft.isPending && saveDraft.variables?.eventId === ev.id ? (
                              <LoaderCircle className="spin" size={16} />
                            ) : (
                              <FileText size={16} />
                            )}
                            Save draft
                          </button>
                          <button
                            type="button"
                            className="primary-button"
                            disabled={
                              isPending ||
                              summary.trim().length < 20 ||
                              (action ? !action.enabled : false)
                            }
                            onClick={() => submitEvidence.mutate({ eventId: ev.id, summary })}
                          >
                            {submitEvidence.isPending &&
                            submitEvidence.variables?.eventId === ev.id ? (
                              <LoaderCircle className="spin" size={16} />
                            ) : (
                              <CheckCircle2 size={16} />
                            )}
                            {action?.label ?? 'Submit evidence'}
                          </button>
                        </div>
                      </>
                    )}
                    {saveDraft.isError && saveDraft.variables?.eventId === ev.id && (
                      <InlineError error={saveDraft.error} onRefresh={onRefresh} />
                    )}
                    {submitEvidence.isError && submitEvidence.variables?.eventId === ev.id && (
                      <InlineError error={submitEvidence.error} onRefresh={onRefresh} />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>
              No assessment events scheduled yet. Schedule an event above before recording evidence.
            </div>
          )}

          <AssessorScorecard
            caseId={caseDetail.id}
            onToast={onToast}
            onRefresh={onRefresh}
            onGoToResult={onGoToStage ? () => onGoToStage('Result') : undefined}
          />
        </>
      )}

      {!isEditableStage && (
        <p className="panel-intro">
          Assessment evidence and uploaded evaluation documents are archived below.
        </p>
      )}

      {/* Evidence Attachments with Anti-Malware Scan Gate */}
      <div
        style={{
          marginTop: isEditableStage ? 24 : 8,
          paddingTop: isEditableStage ? 20 : 0,
          borderTop: isEditableStage ? '1px solid var(--border)' : 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 10,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <strong style={{ fontSize: 13.5 }}>Evidence attachments &amp; scan gate</strong>
              <span className="soft-count">{attachments.length} files</span>
            </div>
            <p style={{ margin: '3px 0 0', color: 'var(--muted)', fontSize: 11.5 }}>
              Upload evaluation evidence documents (.pdf, .doc, .docx, .jpg, .png up to 10MB) for
              automated anti-malware screening.
            </p>
          </div>
          {isEditableStage && (
            <label
              className="secondary-button"
              style={{ cursor: isUploading ? 'not-allowed' : 'pointer' }}
            >
              {isUploading ? <LoaderCircle size={15} className="spin" /> : <Upload size={15} />}
              Upload document
              <input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.png"
                style={{ display: 'none' }}
                disabled={isUploading}
                onChange={handleFileChange}
              />
            </label>
          )}
        </div>

        {uploadError && (
          <div className="restricted-callout" style={{ marginTop: 10 }} role="alert">
            <AlertTriangle size={15} />
            <div>
              <strong>Attachment validation notice</strong>
              <span>{uploadError}</span>
            </div>
          </div>
        )}

        {previewError && (
          <div className="restricted-callout" style={{ marginTop: 10 }} role="alert">
            <AlertTriangle size={15} />
            <div>
              <strong>Document scan policy warning</strong>
              <span>{previewError}</span>
            </div>
          </div>
        )}

        {attachments.length > 0 ? (
          <div className="attachment-list">
            {attachments.map((att) => (
              <div key={att.id} className="attachment-item">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <FileText size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <strong
                      style={{
                        fontSize: 12.5,
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {att.fileName}
                    </strong>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {formatFileSize(att.sizeBytes)} · {att.classification}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <StatusBadge status={att.scanStatus} />
                  {att.scanStatus === 'CLEAN' ? (
                    <>
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => void handleOpenCleanFile(att, 'preview')}
                        title="Preview clean attachment"
                      >
                        <ExternalLink size={14} />
                        Preview
                      </button>
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => void handleOpenCleanFile(att, 'download')}
                        title="Download clean attachment"
                      >
                        <Download size={14} />
                        Download
                      </button>
                    </>
                  ) : (
                    <span
                      className="scan-pending-note"
                      style={{
                        color: 'var(--muted)',
                        fontSize: 11.5,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Clock3 size={12} />
                      {att.scanStatus === 'REJECTED' || att.scanStatus === 'FAILED'
                        ? 'Quarantined'
                        : 'Scan pending'}
                    </span>
                  )}
                  <button
                    type="button"
                    className="row-action"
                    onClick={() => void refetchAttachments()}
                    title="Refresh scan status"
                    aria-label="Refresh scan status"
                  >
                    <RotateCcw size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 10 }}>
            No evidence attachments registered yet. Supported formats: .pdf, .doc, .docx, .jpg, .png
            (up to 10MB).
          </div>
        )}
      </div>
    </section>
  );
}
