import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  LoaderCircle,
  Plus,
} from 'lucide-react';
import type {
  AssessmentCaseDetail,
  FinalizePlanInput,
  ScheduleEventInput,
} from '@assessflow/contracts';
import { api, type AssessorAccountOption } from '../../lib/api';
import { hasBackendRole, getSession } from '../../lib/auth';
import { formatDateTime } from '../../lib/format';
import { queryKeys } from '../../lib/query-keys';
import { InlineError, PanelHeader, StatusBadge } from '../../components/ui';
import {
  getAvailableAction,
  PAST_ASSESSMENT_STATUSES,
  PAST_PLANNING_STATUSES,
  type EventItem,
  type PlanData,
} from './case-utils';

export function PlanPanel({
  caseDetail,
  onToast,
  onRefresh,
}: {
  caseDetail: AssessmentCaseDetail;
  onToast: (msg: string) => void;
  onRefresh: () => void;
}) {
  const queryClient = useQueryClient();
  const isPastPlanning = PAST_PLANNING_STATUSES.includes(caseDetail.status);
  const isReady = caseDetail.status === 'READY_FOR_PLANNING';

  const { data: plan } = useQuery({
    queryKey: queryKeys.casePlan(caseDetail.id),
    queryFn: () => api.getPlan<PlanData>(caseDetail.id),
    enabled: isPastPlanning || caseDetail.adminEditStage === 'PLANNING',
    retry: false,
  });

  const [selectedMethods, setSelectedMethods] = useState<string[]>(['CBI']);
  const [leadAssessor, setLeadAssessor] = useState('');

  useEffect(() => {
    if (!plan) return;
    if (plan.methods?.length) setSelectedMethods(plan.methods.map((method) => method.methodCode));
    setLeadAssessor(plan.leadAssessor ?? '');
  }, [plan]);

  const action = getAvailableAction(caseDetail, 'FINALIZE_PLAN');

  const finalizePlan = useMutation({
    mutationFn: (input: FinalizePlanInput) => api.finalizePlan(caseDetail.id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.caseDetail(caseDetail.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.casePlan(caseDetail.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.overview() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cases() });
      onToast('Assessment plan finalized.');
    },
  });

  if (!isReady && !(isPastPlanning && plan)) {
    return null;
  }

  if (isPastPlanning && plan && caseDetail.adminEditStage !== 'PLANNING') {
    return (
      <section className="panel plan-panel">
        <PanelHeader
          icon={<ClipboardCheck size={17} />}
          title="Assessment plan"
          action={<span className="status-badge success">Plan finalized</span>}
        />
        <div className="criteria-table">
          {plan.methods?.map((method) => (
            <div className="criterion-row" key={method.methodCode}>
              <div>
                <strong>{method.methodLabel || method.methodCode}</strong>
                <span>
                  {method.required !== false ? 'Required evaluation method' : 'Optional method'}
                </span>
              </div>
              <span className="criterion-result met">
                <Check size={14} />
                Configured
              </span>
            </div>
          ))}
        </div>
        {plan.leadAssessor && (
          <div style={{ marginTop: 13, fontSize: 12.5, color: 'var(--secondary)' }}>
            Lead assessor: <strong>{plan.leadAssessor}</strong>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="panel plan-panel">
      <PanelHeader
        icon={<ClipboardCheck size={17} />}
        title="Assessment plan"
        action={<StatusBadge status={caseDetail.status} />}
      />
      <p className="panel-intro">
        Select evaluation methods and assign a lead assessor to finalize the assessment plan.
      </p>
      <div className="form-section">
        <span className="form-section-title">Evaluation methods</span>
        <div style={{ display: 'grid', gap: 8 }}>
          {[
            { code: 'CBI', label: 'CBI (Competency-Based Interview)' },
            { code: 'CASE_STUDY', label: 'Case Study-Work Sample' },
            { code: 'ROLEPLAY', label: 'Roleplay' },
            { code: 'ASSESSMENT_CENTER', label: 'Assessment Center' },
          ].map((m) => (
            <label
              key={m.code}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              <input
                type="checkbox"
                checked={selectedMethods.includes(m.code)}
                disabled={finalizePlan.isPending}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedMethods((prev) => [...prev, m.code]);
                  } else {
                    setSelectedMethods((prev) => prev.filter((c) => c !== m.code));
                  }
                }}
              />
              <span>{m.label}</span>
            </label>
          ))}
        </div>
      </div>
      <label className="field" style={{ marginTop: 14 }}>
        <span>Lead assessor</span>
        <input
          value={leadAssessor}
          onChange={(e) => setLeadAssessor(e.target.value)}
          placeholder="e.g. Dr. Ahmed Mansour"
          disabled={finalizePlan.isPending}
        />
      </label>
      <div className="action-row" style={{ marginTop: 16 }}>
        <button
          type="button"
          className="primary-button"
          disabled={
            finalizePlan.isPending ||
            selectedMethods.length === 0 ||
            (action ? !action.enabled : false)
          }
          onClick={() => {
            finalizePlan.mutate({
              methods: selectedMethods.map((code) => ({
                methodCode: code,
                methodLabel:
                  code === 'CBI'
                    ? 'CBI'
                    : code === 'CASE_STUDY'
                      ? 'Case Study-Work Sample'
                      : code === 'ROLEPLAY'
                        ? 'Roleplay'
                        : 'Assessment Center',
                required: true,
              })),
              leadAssessor: leadAssessor.trim() || undefined,
              expectedVersion: caseDetail.version,
            });
          }}
        >
          {finalizePlan.isPending ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <CheckCircle2 size={16} />
          )}
          {action?.label ?? 'Finalize plan'}
        </button>
      </div>
      {finalizePlan.isError && <InlineError error={finalizePlan.error} onRefresh={onRefresh} />}
    </section>
  );
}

export function EventsPanel({
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
  const [startsAt, setStartsAt] = useState('');
  const [location, setLocation] = useState('');
  const [assessorIds, setAssessorIds] = useState<string[]>([]);
  const [manualAssessors, setManualAssessors] = useState<AssessorAccountOption[]>([]);
  const [manualAssessorName, setManualAssessorName] = useState('');
  const [manualAssessorEmail, setManualAssessorEmail] = useState('');

  const isSchedulingActive = caseDetail.status === 'PLANNING' || caseDetail.status === 'SCHEDULED';
  const hasEventsContext =
    isSchedulingActive ||
    caseDetail.status === 'IN_PROGRESS' ||
    PAST_ASSESSMENT_STATUSES.includes(caseDetail.status);
  const canAssignAssessors = hasBackendRole(user, ['Admin', 'HR', 'Assessor']);

  const assessorOptionsQuery = useQuery({
    queryKey: queryKeys.assessorOptions(),
    queryFn: api.assessorAccounts,
    enabled: isSchedulingActive && canAssignAssessors,
  });
  const assessorOptions = assessorOptionsQuery.data ?? [];
  const allAssessorOptions = [...assessorOptions, ...manualAssessors];

  const { data: events } = useQuery({
    queryKey: queryKeys.caseEvents(caseDetail.id),
    queryFn: () => api.listEvents<EventItem>(caseDetail.id),
    enabled: hasEventsContext,
  });

  const action = getAvailableAction(caseDetail, 'SCHEDULE_EVENT');

  const scheduleEvent = useMutation({
    mutationFn: (input: ScheduleEventInput) => api.scheduleEvent(caseDetail.id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.caseDetail(caseDetail.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.caseEvents(caseDetail.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.overview() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cases() });
      setStartsAt('');
      setLocation('');
      setAssessorIds([]);
      setManualAssessors([]);
      setManualAssessorName('');
      setManualAssessorEmail('');
      onToast('Assessment event scheduled.');
    },
  });

  if (!hasEventsContext) return null;
  if (!isSchedulingActive && (!events || events.length === 0)) return null;

  return (
    <section className="panel events-panel">
      <PanelHeader
        icon={<CalendarDays size={17} />}
        title="Assessment events"
        action={<StatusBadge status={caseDetail.status} />}
      />
      {isSchedulingActive && (
        <>
          <p className="panel-intro">
            Schedule evaluation sessions and assign accredited assessors for this candidate.
          </p>
          <div className="form-section">
            <span className="form-section-title">Schedule session</span>
            <div className="form-grid">
              <label className="field">
                <span>
                  Start date and time <b>*</b>
                </span>
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  disabled={scheduleEvent.isPending}
                />
              </label>
              <label className="field">
                <span>Location / room</span>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Assessment Room 302 or Teams link"
                  disabled={scheduleEvent.isPending}
                />
              </label>
            </div>
            {canAssignAssessors && (
              <fieldset className="assessor-picker">
                <legend>
                  Assign assessors <b>*</b>
                </legend>
                {assessorOptionsQuery.isError && (
                  <p className="assessor-picker-empty">
                    Saved assessor accounts could not be loaded. Add names manually below.
                  </p>
                )}
                {assessorOptionsQuery.isLoading ? (
                  <p className="assessor-picker-empty">Loading active assessor accounts…</p>
                ) : allAssessorOptions.length ? (
                  <div className="assessor-picker-options">
                    {allAssessorOptions.map((assessor) => (
                      <label key={assessor.id} className="assessor-picker-option">
                        <input
                          type="checkbox"
                          checked={assessorIds.includes(assessor.id)}
                          onChange={(event) =>
                            setAssessorIds((selected) =>
                              event.target.checked
                                ? [...selected, assessor.id]
                                : selected.filter((id) => id !== assessor.id),
                            )
                          }
                          disabled={scheduleEvent.isPending}
                        />
                        <span>
                          <strong>{assessor.displayName}</strong>
                          <small>{assessor.email}</small>
                        </span>
                        {manualAssessors.some((item) => item.id === assessor.id) && (
                          <small className="assessor-picker-manual">Manual</small>
                        )}
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="assessor-picker-empty">
                    No saved assessor accounts found. Add people manually below.
                  </p>
                )}
                <div className="assessor-manual-form">
                  <label className="field">
                    <span>Person name</span>
                    <input
                      value={manualAssessorName}
                      onChange={(event) => setManualAssessorName(event.target.value)}
                      placeholder="e.g. Ahmed Mohamed"
                      disabled={scheduleEvent.isPending}
                    />
                  </label>
                  <label className="field">
                    <span>Company email</span>
                    <input
                      type="email"
                      value={manualAssessorEmail}
                      onChange={(event) => setManualAssessorEmail(event.target.value)}
                      placeholder="name@saudigerman.com"
                      disabled={scheduleEvent.isPending}
                    />
                  </label>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={
                      scheduleEvent.isPending ||
                      manualAssessorName.trim().length < 2 ||
                      !/^[^\s@]+@saudigerman\.com$/i.test(manualAssessorEmail.trim()) ||
                      allAssessorOptions.length >= 20 ||
                      allAssessorOptions.some(
                        (assessor) =>
                          assessor.email.toLowerCase() === manualAssessorEmail.trim().toLowerCase(),
                      )
                    }
                    onClick={() => {
                      const email = manualAssessorEmail.trim().toLowerCase();
                      const addedAssessor: AssessorAccountOption = {
                        id: email,
                        displayName: manualAssessorName.trim(),
                        email,
                        roles: ['Assessor'],
                      };
                      setManualAssessors((current) => [...current, addedAssessor]);
                      setAssessorIds((current) => [...current, addedAssessor.id]);
                      setManualAssessorName('');
                      setManualAssessorEmail('');
                    }}
                  >
                    <Plus size={15} /> Add person
                  </button>
                </div>
                <p className="assessor-picker-note">
                  Manual names are saved with this session. To sign in and submit scores, each
                  person needs an active AssessFlow Assessor account matching that email.
                </p>
              </fieldset>
            )}
            <div className="action-row" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="primary-button"
                disabled={
                  scheduleEvent.isPending ||
                  !startsAt ||
                  (canAssignAssessors && assessorIds.length === 0) ||
                  (action ? !action.enabled : false)
                }
                onClick={() => {
                  scheduleEvent.mutate({
                    startsAt: new Date(startsAt).toISOString(),
                    location: location.trim() || undefined,
                    assessors: assessorIds.map((id) => {
                      const assessor = allAssessorOptions.find((option) => option.id === id)!;
                      return { userId: assessor.id, displayName: assessor.displayName };
                    }),
                    expectedVersion: caseDetail.version,
                  });
                }}
              >
                {scheduleEvent.isPending ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <CalendarDays size={16} />
                )}
                {action?.label ?? 'Schedule event'}
              </button>
            </div>
            {scheduleEvent.isError && (
              <InlineError error={scheduleEvent.error} onRefresh={onRefresh} />
            )}
          </div>
        </>
      )}

      <div style={{ marginTop: isSchedulingActive ? 20 : 0 }}>
        <span className="form-section-title" style={{ display: 'block', marginBottom: 10 }}>
          Scheduled sessions ({events?.length ?? 0})
        </span>
        {events && events.length > 0 ? (
          <div className="criteria-table">
            {events.map((ev) => (
              <div className="criterion-row" key={ev.id}>
                <div>
                  <strong>{ev.startsAt ? formatDateTime(ev.startsAt) : 'Date TBD'}</strong>
                  <span>
                    {ev.location || 'Location TBD'} · {ev.assessors?.length ?? 0} assessor
                    {(ev.assessors?.length ?? 0) === 1 ? '' : 's'}
                  </span>
                </div>
                <StatusBadge status={ev.status} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>No sessions scheduled yet.</div>
        )}
      </div>
    </section>
  );
}
