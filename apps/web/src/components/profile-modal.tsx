import { useRef, useState } from 'react';
import { CheckCircle2, KeyRound, Mail, Shield, UserCheck, X } from 'lucide-react';
import { api, type ApiRequestError } from '../lib/api';
import { getSession } from '../lib/auth';
import { initials } from '../lib/format';
import { useFocusTrap } from '../hooks/use-focus-trap';
import { useToast } from '../hooks/use-toast';

export function ProfileModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const { showToast } = useToast();
  const user = getSession();

  const [tab, setTab] = useState<'profile' | 'password'>('profile');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useFocusTrap(isOpen, cardRef, onClose);

  if (!isOpen || !user) return null;

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (newPassword.length < 10) {
      setErrorMsg('New password must be at least 10 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('New password and confirmation do not match.');
      return;
    }

    setSaving(true);
    try {
      await api.changeTemporaryPassword(currentPassword, newPassword, confirmPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccessMsg('Your password was updated cleanly and your session has been refreshed.');
      showToast('Password updated cleanly.', 'success');
    } catch (err) {
      const apiErr = err as ApiRequestError;
      setErrorMsg(apiErr?.message ?? 'Could not update password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="drawer-backdrop settings-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={cardRef}
        className="settings-dialog-card panel profile-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
      >
        <div className="settings-dialog-header">
          <div className="profile-header-identity">
            <div className={`avatar avatar-lg ${user.avatarColor}`}>
              {user.avatarInitials || initials(user.name)}
            </div>
            <div>
              <h3 id="profile-modal-title">{user.name}</h3>
              <span>{user.roleTitle} · Saudi German Health</span>
            </div>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close profile dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="settings-tabs-bar" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'profile'}
            className={`settings-tab-btn ${tab === 'profile' ? 'active' : ''}`}
            onClick={() => setTab('profile')}
          >
            <UserCheck size={15} />
            Account & Scope
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'password'}
            className={`settings-tab-btn ${tab === 'password' ? 'active' : ''}`}
            onClick={() => {
              setTab('password');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
          >
            <KeyRound size={15} />
            Change Password
          </button>
        </div>

        <div className="settings-dialog-body">
          {tab === 'profile' && (
            <div className="settings-section">
              <div className="settings-meta-grid profile-meta-grid">
                <div className="meta-item">
                  <span>
                    <Mail size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                    Company Email
                  </span>
                  <strong>{user.email || '—'}</strong>
                </div>
                <div className="meta-item">
                  <span>
                    <Shield size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                    Primary Workspace Role
                  </span>
                  <strong>{user.roleTitle}</strong>
                </div>
                <div className="meta-item">
                  <span>Data Visibility Scope</span>
                  <strong>{user.scopeType ?? 'ORGANIZATION'}</strong>
                </div>
                <div className="meta-item">
                  <span>Assigned Departments / Scope Values</span>
                  <strong>
                    {user.scopeValues?.length ? user.scopeValues.join(', ') : user.department}
                  </strong>
                </div>
              </div>

              <div className="profile-roles-list">
                <span className="profile-roles-label">Active Access Roles</span>
                <div className="profile-roles-chips">
                  {user.backendRoles.map((role) => (
                    <span key={role} className="status-badge info">
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'password' && (
            <form onSubmit={(e) => void handlePasswordChange(e)} className="settings-section">
              {errorMsg && (
                <div className="inline-error" role="alert" style={{ marginBottom: 14 }}>
                  <span>{errorMsg}</span>
                </div>
              )}
              {successMsg && (
                <div className="settings-security-badge" role="status" style={{ marginBottom: 14 }}>
                  <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
                  <span>{successMsg}</span>
                </div>
              )}

              <div className="profile-password-fields">
                <label className="field">
                  <span>
                    Current password <b>*</b>
                  </span>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </label>

                <label className="field">
                  <span>
                    New password (min 10 characters) <b>*</b>
                  </span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={10}
                    required
                  />
                </label>

                <label className="field">
                  <span>
                    Confirm new password <b>*</b>
                  </span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={10}
                    required
                  />
                </label>
              </div>

              <div className="confirm-dialog-actions" style={{ marginTop: 16 }}>
                <button type="submit" className="primary-button" disabled={saving}>
                  {saving ? 'Updating password…' : 'Update password'}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="settings-dialog-footer">
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
            Signed in cleanly via SGH AssessFlow Session
          </span>
          <button type="button" className="secondary-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
