import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  CircleDashed,
  Clock3,
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
      <Icon size={13} strokeWidth={2.4} />
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
  action,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="panel-header">
      <div className="panel-title">
        <span className="panel-icon">{icon}</span>
        <h2>{title}</h2>
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
        <span className="metric-icon">
          <Icon size={17} />
        </span>
      </div>
      <strong>{metric.value}</strong>
      <div className="metric-bottom">
        <b>{metric.trend}</b>
        <span>{metric.context}</span>
      </div>
      <div className="metric-spark">
        <i />
      </div>
    </article>
  );
}

export function SkeletonMetric() {
  return (
    <article className="metric-card skeleton-card">
      <div className="skeleton-line short" />
      <div className="skeleton-line number" />
      <div className="skeleton-line" />
    </article>
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
    queryKey: ['result', caseId],
    queryFn: () => api.getResult<{ resultCode?: string }>(caseId).catch(() => null),
    staleTime: 60_000,
  });

  if (!result?.resultCode) {
    return (
      <span className="status-badge info" style={{ opacity: 0.75 }}>
        <CircleDashed size={13} />
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
  if (!cases.length)
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <Search size={21} />
        </div>
        <strong>No cases found</strong>
        <span>Try changing the search or create a new assessment request.</span>
      </div>
    );
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
              <td>
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
                    {item.employeeName
                      .split(' ')
                      .map((name) => name[0])
                      .join('')
                      .slice(0, 2)}
                  </div>
                  <div>
                    <strong>{item.caseCode}</strong>
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
                      </span>
                    )}
                  </div>
                </div>
              </td>
              <td>
                <span className="reason-label">{reasonLabels[item.assessmentReason]}</span>
                <small>{item.targetRole}</small>
              </td>
              <td>
                <div className="table-status">
                  <span>{item.stage}</span>
                  <StatusBadge status={item.status} />
                </div>
              </td>
              {showResultChips && (
                <td>
                  <CaseResultChip caseId={item.id} />
                </td>
              )}
              <td>{item.owner}</td>
              <td>
                <span>
                  {new Date(item.requestedAt).toLocaleDateString('en', {
                    day: '2-digit',
                    month: 'short',
                  })}
                </span>
                <small>{item.ageLabel}</small>
              </td>
              <td>
                <button
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
    <div className="loading-list">
      <div className="loader-ring" />
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
      <ShieldAlert size={18} />
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
  const apiError = error as ApiRequestError;
  const isConflict =
    apiError?.code === 'CONCURRENCY_CONFLICT' ||
    apiError?.message?.toLowerCase().includes('conflict') ||
    apiError?.message?.toLowerCase().includes('another session') ||
    apiError?.message?.toLowerCase().includes('refresh');

  return (
    <div className="inline-error" role="alert">
      <AlertTriangle size={16} />
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
            minHeight: '26px',
            padding: '0 8px',
            fontSize: '11px',
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
