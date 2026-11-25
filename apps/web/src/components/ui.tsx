import { useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Check,
  CircleDashed,
  Clock3,
  Copy,
  FileText,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import type { AssessmentCaseSummary } from '@assessflow/contracts';
import { useQuery } from '@tanstack/react-query';
import { api, type ApiRequestError } from '../lib/api';
import { reasonLabels, statusLabels, statusTone } from '../lib/labels';
import { formatDate, initials } from '../lib/format';
import { queryKeys } from '../lib/query-keys';
import { formatCaseId } from '../lib/format-case-id';

export function CaseCodeDisplay({
  caseCode,
  className = '',
}: {
  caseCode: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copyFullCaseCode = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(caseCode);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = caseCode;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <span className={`case-id-display ${className}`.trim()}>
      <span
        className="case-id-display-value"
        tabIndex={0}
        aria-label={`Case number ${caseCode}. Focus to view the full number and copy it.`}
      >
        {formatCaseId(caseCode)}
      </span>
      <span className="case-id-tooltip" role="group" aria-label="Full case number">
        <code>{caseCode}</code>
        <button
          type="button"
          className="case-id-copy-button"
          aria-label={`Copy full case number ${caseCode}`}
          onClick={copyFullCaseCode}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </span>
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone = statusTone(status);
  const Icon =
    tone === 'success'
      ? CheckCircle2
      : tone === 'danger'
        ? XCircle
        : tone === 'warning'
          ? AlertTriangle
          : tone === 'decision'
            ? Sparkles
            : tone === 'teal'
              ? ShieldCheck
              : CircleDashed;
  return (
    <span className={`status-badge ${tone}`}>
      <Icon size={13} strokeWidth={2.4} aria-hidden="true" />
      {statusLabels[status] ?? status}
    </span>
  );
}

export function PageHeading({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

export function PanelHeader({
  icon,
  title,
  titleTooltip,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  titleTooltip?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="panel-header">
      <div className="panel-title">
        <span className="panel-icon" aria-hidden="true">
          {icon}
        </span>
        <h2 title={titleTooltip}>{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function MetricCard({
  metric,
}: {
  metric: { label: string; value: number; context: string; trend: string; tone: string };
}) {
  const Icon =
    metric.tone === 'danger'
      ? AlertTriangle
      : metric.tone === 'warning'
        ? Clock3
        : metric.tone === 'positive'
          ? CheckCircle2
          : FileText;
  return (
    <article className={`metric-card ${metric.tone}`}>
      <div className="metric-top">
        <span>{metric.label}</span>
        <span className="metric-icon" aria-hidden="true">
          <Icon size={17} />
        </span>
      </div>
      <strong>{metric.value}</strong>
      <div className="metric-bottom">
        <b>{metric.trend}</b>
        <span>{metric.context}</span>
      </div>
      <div className="metric-spark" aria-hidden="true">
        <i />
      </div>
    </article>
  );
}

export function SkeletonMetric() {
  return (
    <article className="metric-card skeleton-card" aria-hidden="true">
      <div className="skeleton-line short" />
      <div className="skeleton-line number" />
      <div className="skeleton-line" />
    </article>
  );
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="compact-empty-state" role="status">
      <span className="compact-empty-state-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="compact-empty-state-copy">
        <strong title={title}>{title}</strong>
        <span title={description}>{description}</span>
      </span>
    </div>
  );
}

export function InfoItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="info-item">
      <span>
        {icon}
        {label}
      </span>
      <strong>{value}</strong>
    </div>
  );
}

export function RailItem({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rail-item">
      <span>{label}</span>
      <strong className={tone ?? ''}>{value}</strong>
    </div>
  );
}

export function CaseResultChip({ caseId }: { caseId: string }) {
  const { data: result } = useQuery({
    queryKey: queryKeys.caseResult(caseId),
    queryFn: () => api.getResult<{ resultCode?: string }>(caseId).catch(() => null),
    staleTime: 60_000,
  });

  if (!result?.resultCode) {
    return (
      <span className="status-badge info" style={{ opacity: 0.78 }}>
        <CircleDashed size={13} aria-hidden="true" />
        Pending result
      </span>
    );
  }
  return <StatusBadge status={result.resultCode} />;
}

export function CaseTable({
  cases,
  onOpen,
  onSelectEmployee,
  showResultChips,
}: {
  cases: AssessmentCaseSummary[];
  onOpen: (id: string) => void;
  onSelectEmployee?: (employeeId: string, employeeName: string) => void;
  showResultChips?: boolean;
}) {
  if (!cases.length) {
    return (
      <div className="empty-state" role="status">
        <div className="empty-icon" aria-hidden="true">
          <Search size={21} />
        </div>
        <strong>No cases found</strong>
        <span>Try changing the search filter or create a new assessment request.</span>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Case / employee</th>
            <th>Reason</th>
            <th>Stage / status</th>
            {showResultChips && <th>Result</th>}
            <th>Owner</th>
            <th>Requested</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {cases.map((item) => (
            <tr key={item.id} onClick={() => onOpen(item.id)}>
              <td className="cell-person">
                <div className="table-person">
                  <div
                    className="avatar avatar-small"
                    style={onSelectEmployee ? { cursor: 'pointer' } : undefined}
                    onClick={
                      onSelectEmployee
                        ? (event) => {
                            event.stopPropagation();
                            onSelectEmployee(item.employeeId, item.employeeName);
                          }
                        : undefined
                    }
                    title={onSelectEmployee ? 'View employee 360 history' : undefined}
                  >
                    {initials(item.employeeName)}
                  </div>
                  <div>
                    <strong>
                      <CaseCodeDisplay caseCode={item.caseCode} />
                    </strong>
                    {onSelectEmployee ? (
                      <button
                        type="button"
                        className="employee-link-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectEmployee(item.employeeId, item.employeeName);
                        }}
                        title="View employee 360 history"
                      >
                        {item.employeeName} · {item.department}
                      </button>
                    ) : (
                      <span>
                        {item.employeeName} · {item.department}
                        {item.candidateType === 'NEW_CANDIDATE' && (
                          <small className="case-type-tag">New candidate</small>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </td>
              <td data-label="Reason">
                <span className="reason-label">
                  {reasonLabels[item.assessmentReason] ?? item.assessmentReason}
                </span>
                <small>{item.targetRole}</small>
              </td>
              <td data-label="Status">
                <div className="table-status">
                  <span>{item.stage}</span>
                  <StatusBadge status={item.status} />
                </div>
              </td>
              {showResultChips && (
                <td data-label="Result">
                  <CaseResultChip caseId={item.id} />
                </td>
              )}
              <td data-label="Owner">{item.owner}</td>
              <td data-label="Requested">
                <span>{formatDate(item.requestedAt, { day: '2-digit', month: 'short' })}</span>
                <small>{item.ageLabel}</small>
              </td>
              <td className="cell-action">
                <button
                  type="button"
                  className="row-action"
                  aria-label={`Open ${item.caseCode}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpen(item.id);
                  }}
                >
                  <ArrowUpRight size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Field({
  label,
  required,
  value,
  onChange,
  error,
  placeholder,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
}) {
  return (
    <label className="field">
      <span>
        {label} {required && <b>*</b>}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}

export function LoadingRows() {
  return (
    <div className="loading-list" role="status" aria-live="polite">
      <div className="loader-ring" aria-hidden="true" />
      <span>Loading workspace data…</span>
    </div>
  );
}

export function ErrorBanner({
  message,
  onRetry,
  retryLabel = 'Retry',
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div className="error-banner" role="alert">
      <ShieldAlert size={18} aria-hidden="true" />
      <span>{message}</span>
      {onRetry && (
        <button
          type="button"
          className="secondary-button retry-button"
          onClick={onRetry}
          aria-label="Retry request"
        >
          <RotateCcw size={13} />
          {retryLabel}
        </button>
      )}
    </div>
  );
}

export function InlineError({ error, onRefresh }: { error: unknown; onRefresh?: () => void }) {
  const apiError = error as ApiRequestError | undefined;
  const isConflict =
    apiError?.status === 409 ||
    apiError?.code === 'CONCURRENCY_CONFLICT' ||
    apiError?.message?.toLowerCase().includes('conflict') ||
    apiError?.message?.toLowerCase().includes('another session') ||
    apiError?.message?.toLowerCase().includes('refresh');

  return (
    <div className="inline-error" role="alert">
      <AlertTriangle size={16} aria-hidden="true" />
      <div style={{ display: 'grid', gap: '3px', flex: 1 }}>
        <span>{apiError?.message ?? 'The action could not be completed.'}</span>
        {isConflict && (
          <small style={{ color: 'inherit', opacity: 0.9 }}>
            Conflict detected (409): Refresh the case to get the latest version and retry.
          </small>
        )}
      </div>
      {isConflict && onRefresh && (
        <button
          type="button"
          className="secondary-button"
          style={{
            minHeight: '30px',
            padding: '0 10px',
            fontSize: '12px',
            marginInlineStart: 'auto',
          }}
          onClick={onRefresh}
        >
          <RotateCcw size={12} />
          Refresh
        </button>
      )}
    </div>
  );
}
