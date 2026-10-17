import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { getSession, markTemporaryPasswordChanged } from '../lib/auth';

export function TemporaryPasswordPage() {
  const session = getSession();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (!session) return <Navigate to="/login" replace />;
  if (!session.mustChangePassword) return <Navigate to="/" replace />;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
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
      await api.changeTemporaryPassword(password, confirmation);
      markTemporaryPasswordChanged();
      navigate('/', { replace: true });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not change password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="admin-password-page">
      <form className="admin-password-card" onSubmit={submit}>
        <div className="admin-password-icon" aria-hidden="true">
          A
        </div>
        <h1>Set your password</h1>
        <p>Your administrator issued a one-time password. Create a new password to continue.</p>
        <label className="admin-field">
          <span>New password</span>
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
        <button type="submit" className="admin-button primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save password'}
        </button>
      </form>
    </main>
  );
}
