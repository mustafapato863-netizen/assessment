import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Download, KeyRound, ShieldCheck, UserRound, UserRoundX, X } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { getSession } from '../lib/auth';
import {
  api,
  type AccessAccount,
  type AccessRole,
  type AccessScope,
  type AdminAuditEvent,
  type AdministrationPolicy,
} from '../lib/api';
import {
  DEFAULT_ADMINISTRATION_POLICY,
  policyChanges,
  policyValidationErrors,
  policyWeightTotal,
  totalSlaHours,
} from './administration-logic';
import './administration.css';

const roleOptions: Array<{ value: AccessRole; label: string }> = [
  { value: 'Employee', label: 'Employee' },
  { value: 'Manager', label: 'Manager' },
  { value: 'EmployeeManager', label: 'Employee manager' },
  { value: 'Requester', label: 'Requester' },
  { value: 'Assessor', label: 'Assessor' },
  { value: 'BusinessApprover', label: 'Approver / Committee' },
  { value: 'HR', label: 'HR / Cycle owner' },
  { value: 'Coordinator', label: 'Assessment coordinator' },
  { value: 'PanelLead', label: 'Panel lead' },
  { value: 'Auditor', label: 'Auditor (read only)' },
  { value: 'Admin', label: 'System admin' },
];

const scopeOptions: Array<{ value: AccessScope; label: string }> = [
  { value: 'SELF', label: 'Own record only' },
  { value: 'DIRECT_REPORTS', label: 'Direct reports' },
  { value: 'ASSIGNED', label: 'Assigned cases' },
  { value: 'DEPARTMENTS', label: 'Selected departments' },
  { value: 'ORGANIZATION', label: 'Entire organization' },
  { value: 'NONE', label: 'No case data' },
];

function recommendedScope(role: AccessRole): AccessScope {
  if (role === 'Employee') return 'SELF';
  if (role === 'Manager') return 'ORGANIZATION';
  if (role === 'EmployeeManager') return 'DEPARTMENTS';
  if (role === 'Requester') return 'DIRECT_REPORTS';
  if (role === 'Assessor' || role === 'HR' || role === 'Admin') return 'ORGANIZATION';
  if (role === 'BusinessApprover' || role === 'PanelLead' || role === 'Coordinator')
    return 'ASSIGNED';
  return 'NONE';
}

function allowedScopes(role: AccessRole): AccessScope[] {
  if (role === 'Employee') return ['SELF'];
  if (role === 'Manager') return ['ORGANIZATION'];
  if (role === 'EmployeeManager') return ['DEPARTMENTS'];
  if (role === 'Requester') return ['DIRECT_REPORTS', 'DEPARTMENTS', 'NONE'];
  if (role === 'BusinessApprover' || role === 'PanelLead' || role === 'Coordinator')
    return ['ASSIGNED'];
  return scopeOptions.map(({ value }) => value);
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatAuditDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const formatted = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  return formatted.replace(',', ',');
}

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function downloadCsv(rows: AdminAuditEvent[]) {
  const lines = [
    ['Audit ID', 'Timestamp', 'Actor', 'Action', 'Target', 'Reason', 'Proof hash', 'Integrity']
      .map(csvCell)
      .join(','),
    ...rows.map((row) =>
      [
        row.id,
        row.timestamp,
        row.actor,
        row.action,
        row.target,
        row.reason,
        row.hash,
        row.integrity,
      ]
        .map(csvCell)
        .join(','),
    ),
  ];
  const url = URL.createObjectURL(
    new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `assessflow-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function scopeLabel(scope: AccessScope): string {
  return scopeOptions.find((item) => item.value === scope)?.label ?? scope;
}

function humanizeAction(action: string): string {
  return action
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function AdministrationPage() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const currentUser = getSession();
  const [policy, setPolicy] = useState<AdministrationPolicy>(DEFAULT_ADMINISTRATION_POLICY);
  const [savedPolicy, setSavedPolicy] = useState<AdministrationPolicy>(
    DEFAULT_ADMINISTRATION_POLICY,
  );
  const [accounts, setAccounts] = useState<AccessAccount[]>([]);
  const [auditItems, setAuditItems] = useState<AdminAuditEvent[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditActions, setAuditActions] = useState<string[]>([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditAction, setAuditAction] = useState('');
  const [auditFrom, setAuditFrom] = useState('');
  const [auditTo, setAuditTo] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [auditLoading, setAuditLoading] = useState(false);
  const [accountLoading, setAccountLoading] = useState(true);
  const [policyLoading, setPolicyLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveReason, setSaveReason] = useState('');
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<AccessRole>('Employee');
  const [newScope, setNewScope] = useState<AccessScope>('SELF');
  const [newScopeValues, setNewScopeValues] = useState('');
  const [addingAccount, setAddingAccount] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<AccessAccount | null>(null);
  const [oneTimeCredential, setOneTimeCredential] = useState<{
    name: string;
    password: string;
  } | null>(null);
  const [auditError, setAuditError] = useState('');

  const validationErrors = useMemo(() => policyValidationErrors(policy), [policy]);
  const changes = useMemo(() => policyChanges(savedPolicy, policy), [savedPolicy, policy]);
  const weightTotal = policyWeightTotal(policy);
  const slaTotal = totalSlaHours(policy);
  const activeCount = accounts.filter((account) => account.active).length;
  const enabledSafeguards = Number(policy.blindGrading) + Number(policy.autoEscalate);

  const loadAudit = async (
    page = auditPage,
    overrides: Partial<{
      search: string;
      action: string;
      from: string;
      to: string;
    }> = {},
  ) => {
    setAuditLoading(true);
    setAuditError('');
    try {
      const result = await api.adminAudit({
        page,
        pageSize: 8,
        search: overrides.search ?? auditSearch,
        action: overrides.action ?? auditAction,
        from: overrides.from ?? auditFrom,
        to: overrides.to ?? auditTo,
      });
      setAuditItems(result.items);
      setAuditTotal(result.total);
      setAuditPage(result.page);
      setAuditActions((existing) =>
        [...new Set([...existing, ...result.items.map((item) => item.action)])].sort(),
      );
    } catch (error) {
      setAuditError(error instanceof Error ? error.message : 'Could not load audit history.');
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    Promise.all([api.adminPolicy(), api.adminAccessAccounts()])
      .then(([nextPolicy, nextAccounts]) => {
        if (!active) return;
        setPolicy(nextPolicy);
        setSavedPolicy(nextPolicy);
        setAccounts(nextAccounts);
      })
      .catch((error: unknown) => {
        if (active)
          setPageError(error instanceof Error ? error.message : 'Could not load Administration.');
      })
      .finally(() => {
        if (active) {
          setPolicyLoading(false);
          setAccountLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    void loadAudit(1);
    // Initial load only; filter updates are handled by the filter controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updatePolicy = (update: (current: AdministrationPolicy) => AdministrationPolicy) => {
    setPolicy((current) => update(current));
  };

  const changeWeight = (
    key: 'cbiWeight' | 'caseStudyWeight' | 'simulationWeight',
    value: string,
  ) => {
    updatePolicy((current) => ({ ...current, [key]: value === '' ? 0 : Number(value) }));
  };

  const changeSla = (key: keyof AdministrationPolicy['slaWindows'], value: string) => {
    updatePolicy((current) => ({
      ...current,
      slaWindows: { ...current.slaWindows, [key]: value === '' ? 0 : Number(value) },
    }));
  };

  const savePolicy = async () => {
    if (validationErrors.length || changes.length === 0) return;
    setSavingPolicy(true);
    try {
      const saved = await api.enforceAdminPolicy({
        policy,
        reason: saveReason.trim() || undefined,
      });
      setPolicy(saved);
      setSavedPolicy(saved);
      setSaveDialogOpen(false);
      setSaveReason('');
      await queryClient.invalidateQueries({ queryKey: ['overview'] });
      await loadAudit(1);
      showToast(`Policy ${saved.version} saved and enforced.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not enforce the policy.');
    } finally {
      setSavingPolicy(false);
    }
  };

  const addAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAddingAccount(true);
    try {
      const result = await api.adminCreateAccessAccount({
        displayName: newName.trim(),
        email: newEmail.trim().toLowerCase(),
        roles: [newRole],
        scopeType: newScope,
        scopeValues: ['DEPARTMENTS', 'DIRECT_REPORTS', 'SELF'].includes(newScope)
          ? newScopeValues
              .split(',')
              .map((value) => value.trim())
              .filter(Boolean)
          : [],
      });
      setAccounts((previous) => [result.account, ...previous]);
      setOneTimeCredential({
        name: result.account.displayName,
        password: result.temporaryPassword,
      });
      setNewName('');
      setNewEmail('');
      setNewScopeValues('');
      setNewRole('Employee');
      setNewScope('SELF');
      await loadAudit(1);
      showToast('Account created. Copy the one-time password before closing this notice.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not add access.');
    } finally {
      setAddingAccount(false);
    }
  };

  const updateAccount = async (account: AccessAccount, changesToSave: Partial<AccessAccount>) => {
    try {
      const saved = await api.adminUpdateAccessAccount(account.id, changesToSave);
      setAccounts((previous) => previous.map((item) => (item.id === saved.id ? saved : item)));
      await loadAudit(1);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not update the account.');
    }
  };

  const deactivateAccount = async () => {
    if (!deactivateTarget) return;
    try {
      const saved = await api.adminDeactivateAccessAccount(deactivateTarget.id);
      setAccounts((previous) => previous.map((item) => (item.id === saved.id ? saved : item)));
      setDeactivateTarget(null);
      await loadAudit(1);
      showToast(`${saved.displayName} was deactivated.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not deactivate the account.');
    }
  };

  const resetPassword = async (account: AccessAccount) => {
    try {
      const result = await api.adminResetAccessPassword(account.id);
      setAccounts((previous) =>
        previous.map((item) =>
          item.id === account.id ? { ...item, mustChangePassword: true } : item,
        ),
      );
      setOneTimeCredential({ name: account.displayName, password: result.temporaryPassword });
      await loadAudit(1);
      showToast(`Copy the one-time password for ${account.displayName} now.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not reset the password.');
    }
  };

  const exportAudit = async () => {
    try {
      const filters = { search: auditSearch, action: auditAction, from: auditFrom, to: auditTo };
      const first = await api.adminAudit({ ...filters, page: 1, pageSize: 100 });
      const all = [...first.items];
      for (let page = 2; all.length < first.total; page += 1) {
        const next = await api.adminAudit({ ...filters, page, pageSize: 100 });
        if (!next.items.length) break;
        all.push(...next.items);
      }
      downloadCsv(all);
      showToast(`Exported ${all.length} audit records.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not export the audit trail.');
    }
  };

  const updateAuditFilters = (
    next: Partial<{ search: string; action: string; from: string; to: string }>,
  ) => {
    const filters = {
      search: next.search ?? auditSearch,
      action: next.action ?? auditAction,
      from: next.from ?? auditFrom,
      to: next.to ?? auditTo,
    };
    if (next.search !== undefined) setAuditSearch(next.search);
    if (next.action !== undefined) setAuditAction(next.action);
    if (next.from !== undefined) setAuditFrom(next.from);
    if (next.to !== undefined) setAuditTo(next.to);
    void loadAudit(1, filters);
  };

  const formatScopeValue = (value: string) =>
    value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  const weightStatus =
    weightTotal === 100
      ? 'Total 100%'
      : weightTotal < 100
        ? `Adjust ${100 - weightTotal}% more`
        : `Adjust ${weightTotal - 100}% less`;

  return (
    <main className="administration-page">
      <header className="administration-heading">
        <div>
          <h1>Administration</h1>
          <p>Manage access, scoring rules, SLA windows, approval routes and the audit trail.</p>
        </div>
        <div className="administration-heading-actions">
          {changes.length > 0 && (
            <span className="administration-chip amber">{changes.length} unsaved changes</span>
          )}
          <button
            type="button"
            className="admin-button secondary"
            onClick={() => void exportAudit()}
          >
            <Download size={16} /> Export audit trail
          </button>
          <button
            type="button"
            className="admin-button primary"
            onClick={() => setSaveDialogOpen(true)}
            disabled={policyLoading || changes.length === 0 || validationErrors.length > 0}
          >
            Save and enforce policy
          </button>
        </div>
      </header>

      {pageError && (
        <div className="administration-error" role="alert">
          {pageError}
        </div>
      )}

      <section className="administration-kpis" aria-label="Administration summary">
        <article className="administration-kpi active-policy">
          <span>Active policy</span>
          <strong>
            {policyLoading ? '—' : policy.version}{' '}
            <span className={`administration-chip ${policy.updatedAt ? 'teal' : 'amber'}`}>
              {policy.updatedAt ? 'Enforced' : 'Default'}
            </span>
          </strong>
          <small>
            {policy.updatedAt ? 'Current enforced policy' : 'Save to enforce this default policy'}
          </small>
        </article>
        <article className="administration-kpi">
          <span>Accounts</span>
          <strong>{accountLoading ? '—' : accounts.length}</strong>
          <small>
            {activeCount} active, {accounts.length - activeCount} disabled
          </small>
        </article>
        <article className="administration-kpi">
          <span>Total target turnaround</span>
          <strong>{slaTotal / 24} days</strong>
          <small>
            {policy.slaWindows.eligibilityHours}h + {policy.slaWindows.assessorHours}h +{' '}
            {policy.slaWindows.committeeHours}h
          </small>
        </article>
        <article className="administration-kpi">
          <span>Safeguards on</span>
          <strong>{enabledSafeguards} of 2</strong>
          <small>Blind grading and SLA escalation</small>
        </article>
      </section>

      <section className="administration-card">
        <div className="administration-card-heading">
          <div>
            <h2>Company access and roles</h2>
            <p>
              Sign-in requires a company email. New accounts receive a one-time password and must
              change it at first sign-in.
            </p>
          </div>
          <span className="administration-chip teal">@saudigerman.com only</span>
        </div>
        <div className="admin-account-table">
          <div className="admin-account-grid account-header" role="row">
            <span aria-hidden="true" />
            <span>Person</span>
            <span>Role</span>
            <span>Data scope</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          {accountLoading ? (
            <div className="admin-table-message">Loading access accounts…</div>
          ) : accounts.length === 0 ? (
            <div className="admin-table-message">No company accounts have been assigned yet.</div>
          ) : (
            accounts.map((account) => {
              const role = account.roles[0] ?? 'Employee';
              const needsValues = ['DEPARTMENTS', 'DIRECT_REPORTS', 'SELF'].includes(
                account.scopeType,
              );
              const broad =
                account.scopeType === 'ORGANIZATION' && (role === 'Assessor' || role === 'Admin');
              return (
                <div className="admin-account-grid account-row" role="row" key={account.id}>
                  <span className="admin-avatar" aria-hidden="true">
                    {initials(account.displayName)}
                  </span>
                  <div className="admin-account-person">
                    <strong>{account.displayName}</strong>
                    <span>{account.email}</span>
                  </div>
                  <label className="admin-inline-field">
                    <span className="sr-only">Role for {account.displayName}</span>
                    <select
                      value={role}
                      onChange={(event) => {
                        const nextRole = event.target.value as AccessRole;
                        const nextScope = recommendedScope(nextRole);
                        void updateAccount(account, {
                          roles: [nextRole],
                          scopeType: nextScope,
                          scopeValues: nextScope === account.scopeType ? account.scopeValues : [],
                        });
                      }}
                    >
                      {roleOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="admin-scope-cell">
                    <label className="admin-inline-field">
                      <span className="sr-only">Data scope for {account.displayName}</span>
                      <select
                        value={account.scopeType}
                        onChange={(event) =>
                          void updateAccount(account, {
                            scopeType: event.target.value as AccessScope,
                          })
                        }
                      >
                        {allowedScopes(role).map((scope) => (
                          <option key={scope} value={scope}>
                            {scopeLabel(scope)}
                          </option>
                        ))}
                      </select>
                    </label>
                    {broad && <span className="administration-chip amber">Broad access</span>}
                    {needsValues && (
                      <label className="admin-inline-field scope-values">
                        <span className="sr-only">Scope values for {account.displayName}</span>
                        <input
                          defaultValue={account.scopeValues.join(', ')}
                          aria-label={`Scope values for ${account.displayName}`}
                          placeholder="Scope values"
                          onBlur={(event) => {
                            const values = formatScopeValue(event.currentTarget.value);
                            if (values.join(',') !== account.scopeValues.join(','))
                              void updateAccount(account, { scopeValues: values });
                          }}
                        />
                      </label>
                    )}
                  </div>
                  <span className={`administration-chip ${account.active ? 'teal' : 'gray'}`}>
                    {account.active ? 'Active' : 'Disabled'}
                    {account.mustChangePassword ? ' · Password change required' : ''}
                  </span>
                  <div className="admin-row-actions">
                    <button
                      type="button"
                      className="admin-text-button"
                      onClick={() => void resetPassword(account)}
                    >
                      <KeyRound size={15} /> Reset password
                    </button>
                    {account.active && (
                      <button
                        type="button"
                        className="admin-text-button danger"
                        onClick={() => setDeactivateTarget(account)}
                      >
                        <UserRoundX size={15} /> Deactivate
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="administration-card admin-add-access">
        <div className="administration-card-heading">
          <div>
            <h2>Add access</h2>
            <p>
              A random temporary password is generated and shown once after the account is created.
            </p>
          </div>
        </div>
        <form className="admin-form-grid" onSubmit={(event) => void addAccount(event)}>
          <label className="admin-field">
            <span>Name</span>
            <input
              required
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              autoComplete="name"
            />
          </label>
          <label className="admin-field">
            <span>Company email</span>
            <input
              required
              type="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              autoComplete="email"
            />
          </label>
          <label className="admin-field">
            <span>Role</span>
            <select
              value={newRole}
              onChange={(event) => {
                const nextRole = event.target.value as AccessRole;
                setNewRole(nextRole);
                setNewScope(recommendedScope(nextRole));
                setNewScopeValues('');
              }}
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>Data scope</span>
            <select
              value={newScope}
              onChange={(event) => setNewScope(event.target.value as AccessScope)}
            >
              {allowedScopes(newRole).map((scope) => (
                <option key={scope} value={scope}>
                  {scopeLabel(scope)}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>HRIS employee IDs (optional)</span>
            <input
              value={newScopeValues}
              onChange={(event) => setNewScopeValues(event.target.value)}
              aria-describedby="admin-hris-help"
            />
          </label>
          <span className="admin-field-help" id="admin-hris-help">
            Separate IDs with commas.
          </span>
          <button
            className="admin-button primary add-access-button"
            type="submit"
            disabled={addingAccount}
          >
            {addingAccount ? 'Creating…' : 'Add and create one-time password'}
          </button>
        </form>
      </section>

      <div className="administration-columns">
        <div className="administration-column">
          <section className="administration-card">
            <div className="administration-card-heading">
              <div>
                <h2>Scoring weights</h2>
                <p>Set the contribution each assessment method makes to the final score.</p>
              </div>
              <span className={`administration-chip ${weightTotal === 100 ? 'teal' : 'amber'}`}>
                {weightStatus}
              </span>
            </div>
            <div className="admin-policy-fields">
              <WeightField
                label="Competency-Based Interview (CBI)"
                value={policy.cbiWeight}
                onChange={(value) => changeWeight('cbiWeight', value)}
                description="Evaluates leadership behaviors, culture alignment and emotional intelligence."
              />
              <WeightField
                label="Strategic Case Study and Presentation"
                value={policy.caseStudyWeight}
                onChange={(value) => changeWeight('caseStudyWeight', value)}
                description="Assesses analytical rigor, commercial problem-solving and executive synthesis."
              />
              <WeightField
                label="Situational Roleplay and Simulation"
                value={policy.simulationWeight}
                onChange={(value) => changeWeight('simulationWeight', value)}
                description="Observes stakeholder negotiation and conflict resolution."
              />
              <label className="admin-field passing-score">
                <span>Minimum passing score</span>
                <span className="admin-number-with-unit">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={policy.passingScore}
                    onChange={(event) =>
                      updatePolicy((current) => ({
                        ...current,
                        passingScore: event.target.value === '' ? 0 : Number(event.target.value),
                      }))
                    }
                  />
                  <span>%</span>
                </span>
                <small>Candidates below this score are not ready.</small>
              </label>
            </div>
            {validationErrors.some((error) => error.startsWith('Scoring weights')) && (
              <p className="admin-validation-note" role="alert">
                {validationErrors.find((error) => error.startsWith('Scoring weights'))}
              </p>
            )}
          </section>

          <section className="administration-card">
            <div className="administration-card-heading">
              <div>
                <h2>Quality safeguards</h2>
                <p>Controls applied to assessment and approval work.</p>
              </div>
            </div>
            <label className="admin-toggle-row">
              <input
                type="checkbox"
                checked={policy.blindGrading}
                onChange={(event) =>
                  updatePolicy((current) => ({ ...current, blindGrading: event.target.checked }))
                }
              />
              <span>
                <strong>Two-assessor blind consensus</strong>
                <small>
                  Assessors score independently before preliminary submissions are sealed.
                </small>
              </span>
            </label>
            <label className="admin-toggle-row">
              <input
                type="checkbox"
                checked={policy.autoEscalate}
                onChange={(event) =>
                  updatePolicy((current) => ({ ...current, autoEscalate: event.target.checked }))
                }
              />
              <span>
                <strong>Automatic SLA escalation</strong>
                <small>Escalate when review passes its SLA window.</small>
              </span>
            </label>
          </section>
        </div>

        <div className="administration-column">
          <section className="administration-card">
            <div className="administration-card-heading">
              <div>
                <h2>SLA windows</h2>
                <p>
                  All values are hours. The windows below are the policy source used for SLA risk.
                </p>
              </div>
              <span className="administration-chip indigo">Hours</span>
            </div>
            <SlaField
              label="Eligibility screening"
              description="HR intake and tenure validation"
              hours={policy.slaWindows.eligibilityHours}
              onChange={(value) => changeSla('eligibilityHours', value)}
            />
            <SlaField
              label="Assessor execution and scoring"
              description={`Simulation conduct and evidence rubric · ${policy.slaWindows.assessorHours / 24} days`}
              hours={policy.slaWindows.assessorHours}
              onChange={(value) => changeSla('assessorHours', value)}
            />
            <SlaField
              label="Committee approval decision"
              description="Sponsor sign-off or escalation"
              hours={policy.slaWindows.committeeHours}
              onChange={(value) => changeSla('committeeHours', value)}
            />
            <div className="admin-sla-total">
              <strong>Total target turnaround</strong>
              <b>{slaTotal} hours</b>
              <span>{slaTotal / 24} days</span>
            </div>
            {validationErrors.some((error) => error.startsWith('Every SLA')) && (
              <p className="admin-validation-note" role="alert">
                {validationErrors.find((error) => error.startsWith('Every SLA'))}
              </p>
            )}
          </section>

          <section className="administration-card">
            <div className="administration-card-heading">
              <div>
                <h2>Approval route</h2>
                <p>Runs in this order after assessment results are ready.</p>
              </div>
            </div>
            <ApprovalStep
              number="1"
              title="Lead assessor recommendation"
              description="Validates competency evidence and submits the final rubric synthesis."
              conditional={false}
            />
            <ApprovalStep
              number="2"
              title="Business unit VP sponsor"
              description="Reviews business justification, budget readiness and head-count fit."
              conditional={false}
            />
            <ApprovalStep
              number="3"
              title="Executive talent committee"
              description="Only for executive tracks at L6 and above, or disputed outcomes."
              conditional
            />
          </section>
        </div>
      </div>

      <section className="administration-card admin-audit-card">
        <div className="administration-card-heading">
          <div>
            <h2>Audit trail</h2>
            <p>
              Records are loaded from the application database with the administrator who made each
              change.
            </p>
          </div>
          <span className="administration-chip amber">Integrity: Not verified</span>
        </div>
        <div className="admin-audit-filters">
          <label className="admin-field search-field">
            <span>Search actor, action or target</span>
            <input
              type="search"
              value={auditSearch}
              onChange={(event) => updateAuditFilters({ search: event.target.value })}
            />
          </label>
          <label className="admin-field">
            <span>Action type</span>
            <select
              value={auditAction}
              onChange={(event) => updateAuditFilters({ action: event.target.value })}
            >
              <option value="">All actions</option>
              {auditActions.map((action) => (
                <option key={action} value={action}>
                  {humanizeAction(action)}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>From date</span>
            <input
              type="date"
              value={auditFrom}
              onChange={(event) => updateAuditFilters({ from: event.target.value })}
            />
          </label>
          <label className="admin-field">
            <span>To date</span>
            <input
              type="date"
              value={auditTo}
              onChange={(event) => updateAuditFilters({ to: event.target.value })}
            />
          </label>
        </div>
        {auditError && (
          <p className="administration-error" role="alert">
            {auditError}
          </p>
        )}
        <div className="admin-audit-table" aria-busy={auditLoading}>
          <div className="admin-audit-grid audit-header" role="row">
            <span>ID</span>
            <span>Time</span>
            <span>Actor</span>
            <span>Action</span>
            <span>Details</span>
            <span>Proof hash</span>
            <span>Integrity</span>
          </div>
          {auditLoading ? (
            <div className="admin-table-message">Loading audit history…</div>
          ) : auditItems.length === 0 ? (
            <div className="admin-table-message">No audit events match these filters.</div>
          ) : (
            auditItems.map((item) => (
              <div className="admin-audit-grid audit-row" role="row" key={item.id}>
                <span className="admin-mono" title={item.id}>
                  AUD-{item.id.slice(0, 8)}
                </span>
                <time dateTime={item.timestamp}>{formatAuditDate(item.timestamp)}</time>
                <span>{item.actor}</span>
                <span>{humanizeAction(item.action)}</span>
                <span title={item.reason ?? item.target}>{item.reason || item.target}</span>
                <span className="admin-mono" title={item.hash ?? 'No proof hash is stored'}>
                  {item.hash ? `${item.hash.slice(0, 6)}…${item.hash.slice(-4)}` : '—'}
                </span>
                <span className="administration-chip amber">Not verified</span>
              </div>
            ))
          )}
        </div>
        <div className="admin-audit-pagination">
          <span>
            Showing {auditTotal === 0 ? 0 : (auditPage - 1) * 8 + 1}–
            {Math.min(auditPage * 8, auditTotal)} of {auditTotal} events
          </span>
          <div>
            <button
              type="button"
              className="admin-button secondary"
              disabled={auditPage <= 1 || auditLoading}
              onClick={() => void loadAudit(auditPage - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className="admin-button secondary"
              disabled={auditPage * 8 >= auditTotal || auditLoading}
              onClick={() => void loadAudit(auditPage + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {oneTimeCredential && (
        <div className="admin-modal-backdrop" role="presentation">
          <section
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="one-time-password-title"
          >
            <button
              type="button"
              className="admin-modal-close"
              aria-label="Close one-time password"
              onClick={() => setOneTimeCredential(null)}
            >
              <X size={18} />
            </button>
            <h2 id="one-time-password-title">One-time password for {oneTimeCredential.name}</h2>
            <p>
              Copy it now. It will not be shown again, and the account must change it at first
              sign-in.
            </p>
            <code className="admin-temp-password">{oneTimeCredential.password}</code>
            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-button secondary"
                onClick={() => {
                  void navigator.clipboard?.writeText(oneTimeCredential.password);
                  showToast('Temporary password copied.');
                }}
              >
                Copy password
              </button>
              <button
                type="button"
                className="admin-button primary"
                onClick={() => setOneTimeCredential(null)}
              >
                Done
              </button>
            </div>
          </section>
        </div>
      )}

      {deactivateTarget && (
        <div className="admin-modal-backdrop" role="presentation">
          <section
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="deactivate-title"
          >
            <button
              type="button"
              className="admin-modal-close"
              aria-label="Close confirmation"
              onClick={() => setDeactivateTarget(null)}
            >
              <X size={18} />
            </button>
            <h2 id="deactivate-title">Deactivate {deactivateTarget.displayName}?</h2>
            <p>
              {deactivateTarget.email} will no longer be able to sign in. Their audit history
              remains available.
            </p>
            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-button secondary"
                onClick={() => setDeactivateTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-button danger-button"
                onClick={() => void deactivateAccount()}
              >
                Deactivate account
              </button>
            </div>
          </section>
        </div>
      )}

      {saveDialogOpen && (
        <div className="admin-modal-backdrop" role="presentation">
          <section
            className="admin-modal admin-policy-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="policy-confirm-title"
          >
            <button
              type="button"
              className="admin-modal-close"
              aria-label="Close policy confirmation"
              onClick={() => setSaveDialogOpen(false)}
            >
              <X size={18} />
            </button>
            <h2 id="policy-confirm-title">Save and enforce policy?</h2>
            <p>Review the old and new values before applying policy {policy.version}.</p>
            <div className="admin-change-list">
              {changes.map((change) => (
                <div key={change.label}>
                  <strong>{change.label}</strong>
                  <span>
                    {change.oldValue} <b>→</b> {change.newValue}
                  </span>
                </div>
              ))}
            </div>
            <label className="admin-field">
              <span>Change note (optional)</span>
              <textarea
                maxLength={2000}
                value={saveReason}
                onChange={(event) => setSaveReason(event.target.value)}
              />
            </label>
            {validationErrors.length > 0 && (
              <ul className="admin-modal-errors">
                {validationErrors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            )}
            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-button secondary"
                onClick={() => setSaveDialogOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-button primary"
                disabled={savingPolicy || validationErrors.length > 0}
                onClick={() => void savePolicy()}
              >
                {savingPolicy ? 'Saving…' : 'Confirm and enforce'}
              </button>
            </div>
          </section>
        </div>
      )}

      {currentUser?.role !== 'SYS_ADMIN' && (
        <div className="administration-error" role="alert">
          System admin access is required to manage this page.
        </div>
      )}
    </main>
  );
}

function WeightField({
  label,
  value,
  onChange,
  description,
}: {
  label: string;
  value: number;
  onChange: (value: string) => void;
  description: string;
}) {
  return (
    <div className="admin-weight-field">
      <label className="admin-weight-heading">
        <span>{label}</span>
        <span className="admin-number-with-unit">
          <input
            aria-label={`${label} percentage`}
            type="number"
            min="0"
            max="100"
            step="1"
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
          <span>%</span>
        </span>
      </label>
      <input
        aria-label={`${label} slider`}
        className="admin-weight-slider"
        type="range"
        min="0"
        max="100"
        step="1"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{ '--slider-value': `${value}%` } as CSSProperties}
      />
      <p>{description}</p>
    </div>
  );
}

function SlaField({
  label,
  description,
  hours,
  onChange,
}: {
  label: string;
  description: string;
  hours: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="admin-sla-field">
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <span className="admin-number-with-unit">
        <input
          aria-label={`${label} SLA hours`}
          type="number"
          min="1"
          step="1"
          value={hours}
          onChange={(event) => onChange(event.target.value)}
        />
        <span>hours</span>
      </span>
    </label>
  );
}

function ApprovalStep({
  number,
  title,
  description,
  conditional,
}: {
  number: string;
  title: string;
  description: string;
  conditional: boolean;
}) {
  return (
    <div className="admin-approval-step">
      <span className="admin-step-number">{number}</span>
      <div>
        <strong>{title}</strong>
        <small>{description}</small>
      </div>
      <span className={`administration-chip ${conditional ? 'gray' : 'indigo'}`}>
        {conditional ? 'Conditional' : 'Mandatory'}
      </span>
    </div>
  );
}
