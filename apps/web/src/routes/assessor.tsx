import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  MapPin,
  Search,
  Send,
  Eye,
  EyeOff,
  Users,
} from 'lucide-react';
import { api, type AssessorAssignment } from '../lib/api';
import { getActiveUser } from '../lib/auth';
import { CaseTable, ErrorBanner, PageHeading, PanelHeader } from '../components/ui';

type AssignmentFilter = 'ALL' | 'TO_DO' | 'SUBMITTED';

function AssignmentCard({ assignment }: { assignment: AssessorAssignment }) {
  const queryClient = useQueryClient();
  const [summary, setSummary] = useState(assignment.evidence?.summary ?? '');
  const [strengths, setStrengths] = useState(assignment.evidence?.strengths ?? '');
  const [gaps, setGaps] = useState(assignment.evidence?.gaps ?? '');
  const isSubmitted = assignment.evidenceStatus === 'SUBMITTED';
  const isCancelled = assignment.eventStatus === 'CANCELLED';
  const canReleaseFeedback = [
    'RESULT_FINALIZED',
    'PENDING_RECOMMENDATION',
    'PENDING_APPROVAL',
    'APPROVED',
    'DEVELOPMENT_IN_PROGRESS',
    'REASSESSMENT_DUE',
    'CLOSED',
  ].includes(assignment.caseStatus);
  const visibilityMutation = useMutation({
    mutationFn: () => api.setFeedbackVisibility(assignment.caseId, !assignment.feedbackReleasedAt),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assessor-assignments'] });
      void queryClient.invalidateQueries({ queryKey: ['cases'] });
    },
  });
  const mutation = useMutation({
    mutationFn: (submit: boolean) => {
      const input = {
        summary: summary.trim(),
        strengths: strengths.trim() || undefined,
        gaps: gaps.trim() || undefined,
      };
      return submit
        ? api.submitEvidence(assignment.eventId, input)
        : api.saveEvidenceDraft(assignment.eventId, input);
    },
    onSuccess: (_result, submit) => {
      void queryClient.invalidateQueries({ queryKey: ['assessor-assignments'] });
      void queryClient.invalidateQueries({ queryKey: ['case', assignment.caseId] });
      void queryClient.invalidateQueries({ queryKey: ['overview'] });
      if (submit) {
        void queryClient.invalidateQueries({ queryKey: ['cases'] });
      }
    },
  });

  const startsAt = assignment.startsAt
    ? new Date(assignment.startsAt).toLocaleString('en', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Date to be confirmed';

  return (
    <article className="assessor-assignment-card">
      <div className="assessor-assignment-heading">
        <div>
          <span className="assessor-case-code">{assignment.caseCode}</span>
          <h2>{assignment.employeeName}</h2>
          <p>
            {assignment.department} · {assignment.method}
          </p>
        </div>
        <span
          className={`assessor-evidence-state ${isCancelled ? 'cancelled' : assignment.evidenceStatus.toLowerCase()}`}
        >
          {isCancelled
            ? 'Session cancelled'
            : assignment.evidenceStatus === 'SUBMITTED'
              ? 'Submitted'
              : assignment.evidenceStatus === 'DRAFT'
                ? 'Draft saved'
                : 'Needs your review'}
        </span>
      </div>

      <div className="assessor-context-grid">
        <div>
          <small>Current role</small>
          <strong>{assignment.currentRole}</strong>
        </div>
        <div>
          <small>Target role</small>
          <strong>
            {assignment.targetRole}
            {assignment.targetLevel ? ` · ${assignment.targetLevel}` : ''}
          </strong>
        </div>
        <div>
          <small>Session</small>
          <strong>
            <CalendarClock size={14} /> {startsAt}
          </strong>
        </div>
        <div>
          <small>Location</small>
          <strong>
            <MapPin size={14} /> {assignment.location || 'To be confirmed'}
          </strong>
        </div>
      </div>

      <div className="assessor-evidence-form">
        <label className="field">
          <span>
            Observed evidence <b>*</b> (minimum 20 characters)
          </span>
          <textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="Describe specific behaviors and examples you observed during the assessment."
            rows={4}
            disabled={isSubmitted || isCancelled || mutation.isPending}
          />
          <small>{summary.trim().length} / 20 characters</small>
        </label>
        <div className="assessor-evidence-details">
          <label className="field">
            <span>Strengths observed</span>
            <textarea
              value={strengths}
              onChange={(event) => setStrengths(event.target.value)}
              placeholder="Add evidence based strengths"
              rows={3}
              disabled={isSubmitted || isCancelled || mutation.isPending}
            />
          </label>
          <label className="field">
            <span>Development areas</span>
            <textarea
              value={gaps}
              onChange={(event) => setGaps(event.target.value)}
              placeholder="Add specific development areas"
              rows={3}
              disabled={isSubmitted || isCancelled || mutation.isPending}
            />
          </label>
        </div>
        <div className="feedback-visibility-control">
          <div>
            <strong>
              {assignment.feedbackReleasedAt
                ? 'Viewable to the employee and their manager'
                : 'Hidden from the employee and their manager'}
            </strong>
            <small>
              Mark this after the employee has received feedback. Their own result becomes available
              at the same time.
            </small>
          </div>
          <button
            className={assignment.feedbackReleasedAt ? 'secondary-button' : 'primary-button'}
            type="button"
            disabled={!canReleaseFeedback || visibilityMutation.isPending}
            onClick={() => {
              const visible = !assignment.feedbackReleasedAt;
              if (
                !visible ||
                window.confirm(
                  'Has the employee received feedback? Their result will become viewable.',
                )
              ) {
                visibilityMutation.mutate();
              }
            }}
          >
            {assignment.feedbackReleasedAt ? <EyeOff size={15} /> : <Eye size={15} />}
            {assignment.feedbackReleasedAt ? 'Hide result' : 'Mark viewable'}
          </button>
        </div>
        {visibilityMutation.isError && (
          <ErrorBanner
            message={
              visibilityMutation.error instanceof Error
                ? visibilityMutation.error.message
                : 'Could not update feedback visibility.'
            }
          />
        )}
        {mutation.isError && (
          <ErrorBanner
            message={
              mutation.error instanceof Error
                ? mutation.error.message
                : 'Could not save this assessment.'
            }
          />
        )}
        <div className="assessor-evidence-actions">
          {isCancelled ? (
            <span className="assessor-submitted-note">This session was cancelled.</span>
          ) : isSubmitted ? (
            <span className="assessor-submitted-note">
              <CheckCircle2 size={16} /> Your submitted evidence is locked for audit history.
            </span>
          ) : (
            <>
              <button
                className="secondary-button"
                type="button"
                disabled={mutation.isPending || summary.trim().length < 20}
                onClick={() => mutation.mutate(false)}
              >
                <FileText size={15} /> Save draft
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={mutation.isPending || summary.trim().length < 20}
                onClick={() => {
                  if (
                    window.confirm('Submit this evidence? You cannot edit it after submission.')
                  ) {
                    mutation.mutate(true);
                  }
                }}
              >
                <Send size={15} /> Submit evidence
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

export function AssessorPage() {
  const user = getActiveUser();
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['assessor-assignments'],
    queryFn: api.assessorAssignments,
    enabled: user.role === 'ASSESSOR',
  });
  const {
    data: cycleCases,
    isLoading: casesLoading,
    isError: casesError,
    error: cycleCasesError,
  } = useQuery({
    queryKey: ['assessor-cycle-cases', user.id],
    queryFn: () => api.cases(),
    enabled: user.role === 'ASSESSOR',
  });
  const [filter, setFilter] = useState<AssignmentFilter>('ALL');
  const [search, setSearch] = useState('');
  const assignments = data ?? [];
  const openAssignments = assignments.filter(
    (item) => item.evidenceStatus !== 'SUBMITTED' && item.eventStatus !== 'CANCELLED',
  );
  const submittedCount = assignments.filter((item) => item.evidenceStatus === 'SUBMITTED').length;

  const filteredAssignments = useMemo(() => {
    const term = search.trim().toLowerCase();
    return assignments.filter((item) => {
      if (
        filter === 'TO_DO' &&
        (item.evidenceStatus === 'SUBMITTED' || item.eventStatus === 'CANCELLED')
      )
        return false;
      if (filter === 'SUBMITTED' && item.evidenceStatus !== 'SUBMITTED') return false;
      if (!term) return true;
      return [item.caseCode, item.employeeName, item.department, item.targetRole, item.method]
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [assignments, filter, search]);

  if (user.role !== 'ASSESSOR') return <Navigate to="/" replace />;

  return (
    <>
      <PageHeading
        eyebrow="ASSESSOR WORKSPACE"
        title={`My assessments${user.name ? `, ${user.name.split(' ')[0]}` : ''}`}
        subtitle="Review sessions assigned to you, record evidence, and submit your evaluation."
      />

      <div className="assessor-metrics">
        <div className="assessor-metric-card">
          <span className="assessor-metric-icon assigned">
            <Users size={18} />
          </span>
          <div>
            <small>Cycle cases</small>
            <strong>{cycleCases?.length ?? 0}</strong>
          </div>
        </div>
        <div className="assessor-metric-card">
          <span className="assessor-metric-icon assigned">
            <Users size={18} />
          </span>
          <div>
            <small>Assigned sessions</small>
            <strong>{assignments.length}</strong>
          </div>
        </div>
        <div className="assessor-metric-card">
          <span className="assessor-metric-icon pending">
            <ClipboardCheck size={18} />
          </span>
          <div>
            <small>Awaiting your evidence</small>
            <strong>{openAssignments.length}</strong>
          </div>
        </div>
        <div className="assessor-metric-card">
          <span className="assessor-metric-icon done">
            <CheckCircle2 size={18} />
          </span>
          <div>
            <small>Evidence submitted</small>
            <strong>{submittedCount}</strong>
          </div>
        </div>
      </div>

      <section className="panel assessor-queue">
        <PanelHeader
          icon={<Users size={17} />}
          title="All assessment cases"
          action={<span className="soft-count">{cycleCases?.length ?? 0} cases</span>}
        />
        {casesLoading ? (
          <div className="assessor-empty">
            <span className="loader-ring" />
            <p>Loading cycle cases…</p>
          </div>
        ) : casesError ? (
          <ErrorBanner
            message={
              cycleCasesError instanceof Error
                ? cycleCasesError.message
                : 'Could not load the assessment cycle.'
            }
          />
        ) : (
          <CaseTable cases={cycleCases ?? []} onOpen={(id) => navigate(`/cases/${id}`)} />
        )}
      </section>

      <section className="panel assessor-queue">
        <PanelHeader
          icon={<ClipboardCheck size={17} />}
          title="Assigned assessment sessions"
          action={<span className="soft-count">{filteredAssignments.length} sessions</span>}
        />
        <div className="assessor-queue-tools">
          <div className="assessor-filter-tabs" role="group" aria-label="Filter assessments">
            {(
              [
                ['ALL', 'All'],
                ['TO_DO', 'To do'],
                ['SUBMITTED', 'Submitted'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={filter === value ? 'active' : ''}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="assessor-search">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search employee, case, or department"
            />
          </label>
        </div>

        {isLoading ? (
          <div className="assessor-empty">
            <span className="loader-ring" />
            <p>Loading your assignments…</p>
          </div>
        ) : isError ? (
          <div className="assessor-empty">
            <ErrorBanner
              message={error instanceof Error ? error.message : 'Could not load assignments.'}
            />
          </div>
        ) : filteredAssignments.length ? (
          <div className="assessor-assignment-list">
            {filteredAssignments.map((assignment) => (
              <AssignmentCard key={assignment.eventId} assignment={assignment} />
            ))}
          </div>
        ) : (
          <div className="assessor-empty">
            <ClipboardCheck size={28} />
            <strong>
              {assignments.length ? 'No sessions match this filter' : 'No sessions assigned yet'}
            </strong>
            <p>
              When the assessment coordinator assigns you to a session, it will appear here with its
              rubric and evidence form.
            </p>
          </div>
        )}
      </section>
    </>
  );
}
