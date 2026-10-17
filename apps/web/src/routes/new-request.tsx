import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, Send, X } from 'lucide-react';
import {
  createCaseSchema,
  type AssessmentCaseDetail,
  type CreateCaseInput,
} from '@assessflow/contracts';
import { api } from '../lib/api';
import { copy, type Copy } from '../lib/labels';
import { useToast } from '../hooks/use-toast';
import { Field, InlineError, PageHeading } from '../components/ui';

interface NewRequestFormProps {
  t: Copy;
  onClose: () => void;
  onCreated: (created: AssessmentCaseDetail) => void;
  isStandalone?: boolean;
}

const levelOptions = [
  'Entry',
  'Senior',
  'Supervisor',
  'Team Leader',
  'Manager',
  'Senior Manager',
  'Director',
  'Senior Director',
];
const currentLevelOptions = levelOptions;
const targetLevelOptions = levelOptions;

function NewRequestForm({ t: _t, onClose, onCreated, isStandalone }: NewRequestFormProps) {
  const [form, setForm] = useState<CreateCaseInput>({
    candidateType: 'INTERNAL_EMPLOYEE',
    // Left blank, the API creates a separate employee record for this request.
    employeeId: '',
    employeeName: '',
    department: '',
    currentRole: '',
    currentLevel: '',
    assessmentReason: 'PROMOTION',
    targetRole: '',
    targetLevel: '',
    candidateEmail: '',
    justification: '',
    priority: 'NORMAL',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const mutation = useMutation({
    mutationFn: () => api.createCase({ ...form, employeeId: form.employeeId?.trim() || 'emp-new' }),
    onSuccess: onCreated,
  });
  const update = (key: keyof CreateCaseInput, value: string) =>
    setForm((current) => ({ ...current, [key]: value }) as CreateCaseInput);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (form.candidateType === 'INTERNAL_EMPLOYEE' && !form.currentLevel) {
      setErrors({ currentLevel: 'Choose the employee’s current level' });
      return;
    }
    const parsed = createCaseSchema.safeParse({
      ...form,
      employeeId: form.employeeId?.trim() || 'emp-new',
    });
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          Object.entries(parsed.error.flatten().fieldErrors).map(([key, value]) => [
            key,
            value?.[0] ?? 'Required',
          ]),
        ),
      );
      return;
    }
    setErrors({});
    mutation.mutate();
  };

  return (
    <form
      onSubmit={submit}
      className="drawer-form"
      style={isStandalone ? { padding: '24px 0 0' } : undefined}
    >
      <div className="form-section">
        <span className="form-section-title">Candidate type</span>
        <div className="candidate-type-switch" role="group" aria-label="Candidate type">
          <button
            type="button"
            className={form.candidateType === 'INTERNAL_EMPLOYEE' ? 'active' : ''}
            onClick={() =>
              setForm((current) => ({
                ...current,
                candidateType: 'INTERNAL_EMPLOYEE',
                assessmentReason:
                  current.assessmentReason === 'EXTERNAL_RECRUITMENT'
                    ? 'PROMOTION'
                    : current.assessmentReason,
              }))
            }
          >
            Existing employee
          </button>
          <button
            type="button"
            className={form.candidateType === 'NEW_CANDIDATE' ? 'active' : ''}
            onClick={() =>
              setForm((current) => ({
                ...current,
                candidateType: 'NEW_CANDIDATE',
                assessmentReason: 'EXTERNAL_RECRUITMENT',
              }))
            }
          >
            New candidate
          </button>
        </div>
        <p className="candidate-type-help">
          {form.candidateType === 'NEW_CANDIDATE'
            ? 'For an external applicant who is not yet an employee.'
            : 'For a person who is already employed by the organization.'}
        </p>
        <span className="form-section-title">
          {form.candidateType === 'NEW_CANDIDATE' ? 'Candidate details' : 'Employee context'}
        </span>
        <div className="form-grid">
          <Field
            label={form.candidateType === 'NEW_CANDIDATE' ? 'Candidate name' : 'Employee name'}
            required
            value={form.employeeName}
            onChange={(value) => update('employeeName', value)}
            error={errors.employeeName}
            placeholder={form.candidateType === 'NEW_CANDIDATE' ? 'Full name' : 'Search employee'}
          />
          {form.candidateType === 'NEW_CANDIDATE' && (
            <Field
              label="Candidate email"
              required
              value={form.candidateEmail ?? ''}
              onChange={(value) => update('candidateEmail', value)}
              error={errors.candidateEmail}
              placeholder="name@example.com"
            />
          )}
          <Field
            label="Department"
            required
            value={form.department}
            onChange={(value) => update('department', value)}
            error={errors.department}
            placeholder="e.g. Product"
          />
          {form.candidateType === 'INTERNAL_EMPLOYEE' && (
            <Field
              label="Employee ID (staff number)"
              value={form.employeeId ?? ''}
              onChange={(value) => update('employeeId', value)}
              error={errors.employeeId}
              placeholder="Links repeat assessments of the same person"
            />
          )}
          {form.candidateType === 'INTERNAL_EMPLOYEE' && (
            <Field
              label="Current role"
              required
              value={form.currentRole ?? ''}
              onChange={(value) => update('currentRole', value)}
              error={errors.currentRole}
              placeholder="Current position"
            />
          )}
          {form.candidateType === 'INTERNAL_EMPLOYEE' && (
            <label className="field">
              <span>
                Current level <b>*</b>
              </span>
              <select
                value={form.currentLevel ?? ''}
                onChange={(event) => update('currentLevel', event.target.value)}
                aria-invalid={Boolean(errors.currentLevel)}
              >
                <option value="">Choose current level</option>
                {currentLevelOptions.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
              {errors.currentLevel && <small className="field-error">{errors.currentLevel}</small>}
            </label>
          )}
        </div>
      </div>
      <div className="form-section">
        <span className="form-section-title">Assessment request</span>
        <div className="form-grid">
          {form.candidateType === 'NEW_CANDIDATE' ? (
            <label className="field">
              <span>Assessment reason</span>
              <input value="External Recruitment" readOnly />
              <small className="candidate-type-help">Automatically set for new candidates.</small>
            </label>
          ) : (
            <label className="field">
              <span>
                Assessment reason <b>*</b>
              </span>
              <select
                value={form.assessmentReason}
                onChange={(event) => update('assessmentReason', event.target.value)}
              >
                <option value="PROMOTION">Promotion</option>
                <option value="INTERNAL_MOBILITY">Internal mobility</option>
                <option value="ROLE_REALIGNMENT">Role realignment</option>
              </select>
            </label>
          )}
          <Field
            label="Target role"
            required
            value={form.targetRole}
            onChange={(value) => update('targetRole', value)}
            error={errors.targetRole}
            placeholder="Target position"
          />
          <div>
            <label className="field">
              <span>
                Target level <b>*</b>
              </span>
              <select
                value={form.targetLevel}
                onChange={(event) => update('targetLevel', event.target.value)}
                aria-invalid={Boolean(errors.targetLevel)}
              >
                <option value="">Choose target level</option>
                {targetLevelOptions.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
              {errors.targetLevel && <small className="field-error">{errors.targetLevel}</small>}
            </label>
            <div style={{ marginTop: '7px', color: 'var(--secondary)', fontSize: '11px' }}>
              Select the level required for the target role.
            </div>
          </div>
        </div>
        <label className="field">
          <span>
            Business justification <b>*</b>
          </span>
          <textarea
            value={form.justification}
            onChange={(event) => update('justification', event.target.value)}
            placeholder="Explain the business context, target scope, and reason for review…"
            rows={5}
          />
          {errors.justification && <small className="field-error">{errors.justification}</small>}
        </label>
      </div>
      {mutation.isError && <InlineError error={mutation.error} />}
      <div
        className="drawer-footer"
        style={
          isStandalone
            ? {
                position: 'static',
                width: '100%',
                padding: '20px 0 0',
                boxShadow: 'none',
                background: 'transparent',
                borderTop: '1px solid var(--border)',
              }
            : undefined
        }
      >
        <button type="button" className="secondary-button" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="primary-button" disabled={mutation.isPending}>
          {mutation.isPending ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />}
          {mutation.isPending ? 'Creating…' : 'Save draft'}
        </button>
      </div>
    </form>
  );
}

export function NewRequestDrawer({
  t: propT,
  onClose: propOnClose,
  onCreated: propOnCreated,
}: {
  t?: Copy;
  onClose?: () => void;
  onCreated?: (created: AssessmentCaseDetail) => void;
} = {}) {
  const t = propT ?? copy;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const onClose = propOnClose ?? (() => navigate(-1));
  const onCreated =
    propOnCreated ??
    ((created: AssessmentCaseDetail) => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      showToast('Assessment request created as a draft.');
      navigate(`/cases/${created.id}`);
    });

  return (
    <div
      className="drawer-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <aside
        className="request-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-request-title"
      >
        <div className="drawer-header">
          <div>
            <span className="eyebrow">NEW WORKFLOW</span>
            <h2 id="new-request-title">{t.newRequest}</h2>
            <p>Capture the business need before the eligibility gate.</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={19} />
          </button>
        </div>
        <NewRequestForm t={t} onClose={onClose} onCreated={onCreated} isStandalone={false} />
      </aside>
    </div>
  );
}

export function NewRequestPage({ t: propT }: { t?: Copy } = {}) {
  const t = propT ?? copy;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const handleClose = () => navigate('/cases');
  const handleCreated = (created: AssessmentCaseDetail) => {
    queryClient.invalidateQueries({ queryKey: ['cases'] });
    showToast('Assessment request created as a draft.');
    navigate(`/cases/${created.id}`);
  };

  return (
    <>
      <PageHeading
        eyebrow="NEW WORKFLOW"
        title={t.newRequest}
        subtitle="Choose an existing employee or a new candidate, then enter the target role and business justification to create an eligibility request."
      />
      <section className="panel" style={{ maxWidth: '640px' }}>
        <div
          className="drawer-header"
          style={{ padding: '24px 0 16px', borderBottom: '1px solid var(--border)' }}
        >
          <div>
            <h2 id="new-request-title">{t.newRequest}</h2>
            <p>Capture the business need before the eligibility gate.</p>
          </div>
        </div>
        <NewRequestForm t={t} onClose={handleClose} onCreated={handleCreated} isStandalone={true} />
      </section>
    </>
  );
}
