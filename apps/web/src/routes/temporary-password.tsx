import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { defaultHomeForUser, getSession, logout } from '../lib/auth';
import { SghHeartSvg } from '../design-system/brand/sgh-heart-svg';
import './administration.css';

export function TemporaryPasswordPage() {
  const session = getSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (!session) return <Navigate to="/login" replace />;
  if (!session.mustChangePassword) return <Navigate to={defaultHomeForUser(session)} replace />;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!currentPassword) {
      setError('Enter the one-time password you signed in with.');
      return;
    }
    if (password.length < 12) {
      setError('Use at least 12 characters.');
      return;
    }
    if (password !== confirmation) {
      setError('The passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      await api.changeTemporaryPassword(currentPassword, password, confirmation);
      navigate(defaultHomeForUser({ ...session, mustChangePassword: false }), { replace: true });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not change password.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    logout();
    queryClient.clear();
    navigate('/login', { replace: true });
  };

  return (
    <main className="admin-password-page">
      <form className="admin-password-card" onSubmit={submit}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <div className="admin-password-icon" aria-hidden="true">
            <SghHeartSvg size={24} glow={false} />
          </div>
          <button
            type="button"
            className="secondary-button"
            style={{ minHeight: 36, padding: '0 12px', fontSize: 12.5 }}
            onClick={handleSignOut}
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11.5,
            fontWeight: 700,
            color: 'var(--primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 4,
          }}
        >
          <ShieldCheck size={14} />
          First-Time Account Security
        </div>
        <h1>Set your personal password</h1>
        <p>
          Signed in as <strong>{session.email}</strong>. Create a permanent password to unlock your
          workspace.
        </p>

        <label className="admin-field">
          <span>One-time password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </label>
        <label className="admin-field">
          <span>New password (minimum 12 characters)</span>
          <input
            type="password"
            autoComplete="new-password"
            minLength={12}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <label className="admin-field">
          <span>Confirm new password</span>
          <input
            type="password"
            autoComplete="new-password"
            minLength={12}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            required
          />
        </label>

        {error && (
          <p className="administration-error" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="primary-button"
          disabled={saving}
          style={{ width: '100%' }}
        >
          <KeyRound size={15} />
          {saving ? 'Updating password…' : 'Save & Enter Workspace'}
        </button>
      </form>
    </main>
  );
}
