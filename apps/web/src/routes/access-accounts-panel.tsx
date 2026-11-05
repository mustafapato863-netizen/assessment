import { useEffect, useState } from 'react';
import {
  Check,
  LoaderCircle,
  LockKeyhole,
  Plus,
  Shield,
  X,
  UserRound,
  UserRoundX,
} from 'lucide-react';
import { api, type AccessAccount, type AccessRole, type AccessScope } from '../lib/api';
import { useToast } from '../hooks/use-toast';
import { PageHeading, PanelHeader } from '../components/ui';
import { getSession } from '../lib/auth';

const roleOptions: Array<{ value: AccessRole; label: string }> = [
  { value: 'Employee', label: 'Employee' },
  { value: 'Manager', label: 'Manager' },
  { value: 'EmployeeManager', label: 'Employee Manager' },
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

function allowedScopes(role: AccessRole | undefined): AccessScope[] {
  if (role === 'Manager') return ['ORGANIZATION'];
  if (role === 'EmployeeManager') return ['DEPARTMENTS'];
  if (role === 'Employee') return ['SELF'];
  return scopeOptions.map((option) => option.value);
}

function recommendedScope(role: AccessRole): AccessScope {
  if (role === 'Employee') return 'SELF';
  if (role === 'Manager') return 'ORGANIZATION';
  if (role === 'EmployeeManager') return 'DEPARTMENTS';
  if (role === 'Requester') return 'DIRECT_REPORTS';
  if (role === 'Assessor') return 'ORGANIZATION';
  if (role === 'BusinessApprover' || role === 'PanelLead') return 'ASSIGNED';
  if (role === 'HR' || role === 'Admin') return 'ORGANIZATION';
  if (role === 'Coordinator') return 'ASSIGNED';
  return 'NONE';
}

export function AccessAccountsPanel() {
  const { showToast } = useToast();
  const [accounts, setAccounts] = useState<AccessAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AccessRole>('Employee');
  const [scope, setScope] = useState<AccessScope>('SELF');
  const [scopeValues, setScopeValues] = useState('');
  const [scopeEdits, setScopeEdits] = useState<Record<string, string>>({});
  const [passwordEdits, setPasswordEdits] = useState<Record<string, string>>({});
  const currentUser = getSession();
  const canManageAdmin = currentUser?.role === 'SYS_ADMIN';
  const visibleRoleOptions = canManageAdmin
    ? roleOptions
    : roleOptions.filter((option) => option.value !== 'Admin');

  const loadAccounts = async () => {
    setLoading(true);
    setError('');
    try {
      setAccounts(await api.accessAccounts());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load access accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAccounts();
  }, []);

  const addAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.createAccessAccount({
        displayName: displayName.trim(),
        email: email.trim().toLowerCase(),
        password,
        roles: [role],
        scopeType: scope,
        scopeValues: ['DEPARTMENTS', 'DIRECT_REPORTS', 'SELF'].includes(scope)
          ? scopeValues
              .split(',')
              .map((value) => value.trim())
              .filter(Boolean)
          : [],
      });
      setDisplayName('');
      setEmail('');
      setPassword('');
      setScopeValues('');
      await loadAccounts();
      showToast('Company account access was added.');
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : 'Could not add account.');
    } finally {
      setSaving(false);
    }
  };

  const updateAccount = async (
    account: AccessAccount,
    changes: Partial<AccessAccount> & { password?: string },
  ) => {
    try {
      const updated = await api.updateAccessAccount(account.id, changes);
      setAccounts((previous) => previous.map((item) => (item.id === account.id ? updated : item)));
      showToast('Access settings saved.');
      return true;
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : 'Could not save access settings.');
      return false;
    }
  };

  const removeAccount = async (account: AccessAccount) => {
    if (!window.confirm(`Remove ${account.displayName} (${account.email}) from company access?`)) {
      return;
    }
    try {
      await api.removeAccessAccount(account.id);
      setAccounts((previous) => previous.filter((item) => item.id !== account.id));
      showToast('Company account access was removed.');
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : 'Could not remove account access.');
    }
  };

  const setAccountPassword = async (account: AccessAccount) => {
    const newPassword = passwordEdits[account.id] ?? '';
    if (newPassword.length < 6) {
      showToast('Password must be at least 6 characters.');
      return;
    }
    if (await updateAccount(account, { password: newPassword })) {
      setPasswordEdits((previous) => ({ ...previous, [account.id]: '' }));
      showToast(`Temporary password set for ${account.displayName}.`);
    }
  };

  return (
    <section className="panel" style={{ marginBottom: 24 }}>
      <PanelHeader
        icon={<Shield size={17} />}
        title="Company access and roles"
        action={<span className="soft-count">@saudigerman.com only</span>}
      />
      <div>
        <div className="pipeline-note" role="note" style={{ marginBottom: 16 }}>
          <LockKeyhole size={15} />
          <span>
            Accounts sign in here with a company email ending in @saudigerman.com and a password set
            by an Assessor or System Admin. Passwords are stored securely and never shown in this
            list.
          </span>
        </div>

        <form
          onSubmit={addAccount}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            alignItems: 'end',
            marginBottom: 20,
          }}
        >
          <label className="sgh-field-label">
            Employee name
            <input
              required
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Full name"
            />
          </label>
          <label className="sgh-field-label">
            Company email
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@saudigerman.com"
            />
          </label>
          <label className="sgh-field-label">
            Initial password
            <input
              required
              type="password"
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 letters or numbers"
            />
          </label>
          <label className="sgh-field-label">
            Role
            <select
              value={role}
              onChange={(event) => {
                const next = event.target.value as AccessRole;
                setRole(next);
                setScope(recommendedScope(next));
              }}
            >
              {visibleRoleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="sgh-field-label">
            Data scope
            <select value={scope} onChange={(event) => setScope(event.target.value as AccessScope)}>
              {allowedScopes(role)
                .map((value) => scopeOptions.find((option) => option.value === value)!)
                .map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
            </select>
          </label>
          {['DEPARTMENTS', 'DIRECT_REPORTS', 'SELF'].includes(scope) && (
            <label className="sgh-field-label">
              {scope === 'DEPARTMENTS'
                ? 'Departments'
                : scope === 'SELF'
                  ? 'Employee ID (optional if roster email matches)'
                  : 'Employee IDs'}
              <input
                value={scopeValues}
                onChange={(event) => setScopeValues(event.target.value)}
                placeholder={
                  scope === 'DEPARTMENTS'
                    ? 'Product, Finance'
                    : 'HRIS employee IDs, separated by commas'
                }
              />
            </label>
          )}
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? <LoaderCircle size={15} className="spin" /> : <Plus size={15} />}
            Add access
          </button>
        </form>

        {error && (
          <div
            className="pipeline-note"
            role="alert"
            style={{ color: '#b91c1c', marginBottom: 12 }}
          >
            {error}
          </div>
        )}
        {loading ? (
          <p style={{ color: 'var(--color-text-muted)' }}>Loading company accounts…</p>
        ) : accounts.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)' }}>
            No company accounts have been assigned yet.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="case-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Role</th>
                  <th>Data scope</th>
                  <th>Access</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <UserRound size={16} />
                        <span>
                          <strong>{account.displayName}</strong>
                          <br />
                          <small>{account.email}</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <select
                        aria-label={`Role for ${account.email}`}
                        value={account.roles[0] ?? ''}
                        onChange={(event) => {
                          const nextRole = event.target.value as AccessRole;
                          let nextScope = recommendedScope(nextRole);
                          if (nextScope === 'DIRECT_REPORTS' && account.scopeValues.length === 0)
                            nextScope = 'NONE';
                          updateAccount(account, {
                            roles: nextRole ? [nextRole] : [],
                            scopeType: nextScope,
                          });
                        }}
                      >
                        <option value="">No role</option>
                        {visibleRoleOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        aria-label={`Data scope for ${account.email}`}
                        value={account.scopeType}
                        onChange={(event) =>
                          updateAccount(account, { scopeType: event.target.value as AccessScope })
                        }
                      >
                        {allowedScopes(account.roles[0])
                          .map((value) => scopeOptions.find((option) => option.value === value)!)
                          .map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                      </select>
                      {['DEPARTMENTS', 'DIRECT_REPORTS', 'SELF'].includes(account.scopeType) && (
                        <input
                          aria-label={`Scope values for ${account.email}`}
                          value={scopeEdits[account.id] ?? account.scopeValues.join(', ')}
                          placeholder={
                            account.scopeType === 'DEPARTMENTS'
                              ? 'Department names'
                              : account.scopeType === 'SELF'
                                ? 'Employee ID (optional if roster email matches)'
                                : 'HRIS employee IDs'
                          }
                          onChange={(event) =>
                            setScopeEdits((previous) => ({
                              ...previous,
                              [account.id]: event.target.value,
                            }))
                          }
                          onBlur={() =>
                            updateAccount(account, {
                              scopeValues: (scopeEdits[account.id] ?? account.scopeValues.join(','))
                                .split(',')
                                .map((value) => value.trim())
                                .filter(Boolean),
                            })
                          }
                        />
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => updateAccount(account, { active: !account.active })}
                        >
                          {account.active ? (
                            <>
                              <Check size={14} /> Active
                            </>
                          ) : (
                            <>
                              <UserRoundX size={14} /> Disabled
                            </>
                          )}
                        </button>
                        <input
                          aria-label={`Temporary password for ${account.email}`}
                          type="password"
                          autoComplete="new-password"
                          minLength={6}
                          value={passwordEdits[account.id] ?? ''}
                          onChange={(event) =>
                            setPasswordEdits((previous) => ({
                              ...previous,
                              [account.id]: event.target.value,
                            }))
                          }
                          placeholder="Set password"
                          style={{ maxWidth: 155 }}
                        />
                        <button
                          className="secondary-button"
                          type="button"
                          disabled={(passwordEdits[account.id] ?? '').length < 6}
                          onClick={() => void setAccountPassword(account)}
                        >
                          Set password
                        </button>
                        <button
                          className="secondary-button"
                          type="button"
                          aria-label={`Remove access for ${account.displayName}`}
                          title="Remove access"
                          onClick={() => void removeAccount(account)}
                          style={{ color: 'var(--danger, #dc2626)', padding: '8px 10px' }}
                        >
                          <X size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

export function AccessAccountsPage() {
  return (
    <>
      <PageHeading
        eyebrow="ACCESS GOVERNANCE"
        title="Company access and roles"
        subtitle="Add, update, or remove company access and limit each account to its approved cycle scope."
      />
      <AccessAccountsPanel />
    </>
  );
}
