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

function NewRequestForm({ t: _t, onClose, onCreated, isStandalone }: NewRequestFormProps) {
  const [form, setForm] = useState<CreateCaseInput>({
    employeeId: 'emp-new',
    employeeName: '',
    department: '',
    currentRole: '',
    assessmentReason: 'PROMOTION',
    targetRole: '',
    targetLevel: 'L4',
    justification: '',
    priority: 'NORMAL',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const mutation = useMutation({ mutationFn: () => api.createCase(form), onSuccess: onCreated });
  const update = (key: keyof CreateCaseInput, value: string) =>
    setForm((current) => ({ ...current, [key]: value }) as CreateCaseInput);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = createCaseSchema.safeParse(form);
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
        <span className="form-section-title">Employee context</span>
        <div className="form-grid">
          <Field
            label="Employee name"
            required
            value={form.employeeName}
            onChange={(value) => update('employeeName', value)}
            error={errors.employeeName}
            placeholder="Search employee"
          />
          <Field
            label="Department"
            required
            value={form.department}
            onChange={(value) => update('department', value)}
            error={errors.department}
            placeholder="e.g. Product"
          />
          <Field
            label="Current role"
            required
            value={form.currentRole}
            onChange={(value) => update('currentRole', value)}
            error={errors.currentRole}
            placeholder="Current position"
          />
        </div>
      </div>
      <div className="form-section">
        <span className="form-section-title">Assessment request</span>
        <div className="form-grid">
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
          <Field
            label="Target role"
            required
            value={form.targetRole}
            onChange={(value) => update('targetRole', value)}
            error={errors.targetRole}
            placeholder="Target position"
          />
          <Field
            label="Target level"
            required
            value={form.targetLevel}
            onChange={(value) => update('targetLevel', value)}
            error={errors.targetLevel}
            placeholder="L4"
          />
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
        subtitle="Capture the business need before the eligibility gate."
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
