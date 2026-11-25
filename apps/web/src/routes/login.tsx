import { useState, useRef, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { defaultHomeForUser, login } from '../lib/auth';
import { SghAnimatedLogo } from '../design-system/brand/sgh-animated-logo';
import { SghLogo } from '../design-system/brand/sgh-logo';
import { ThinkingDots } from '../design-system/backgrounds/thinking-dots';
import { BorderGlow } from '../components/ui/border-glow';
import { AtmosphericBackground } from '../components/ui/atmospheric-background';

type LoginField = 'email' | 'password';
type LoginFieldErrors = Partial<Record<LoginField, string>>;

const PRODUCT_POINTS = [
  'Raise an assessment request for an employee',
  'Check eligibility and agree the assessment plan',
  'Record results and take the approval decision',
];

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const fromState = (
    location.state as { from?: { pathname?: string; search?: string } | string } | null
  )?.from;
  const redirectPath =
    typeof fromState === 'string'
      ? fromState
      : fromState?.pathname && fromState.pathname !== '/login'
        ? `${fromState.pathname}${fromState.search ?? ''}`
        : '';

  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const focusFirstInvalidField = (errors: LoginFieldErrors) => {
    if (errors.email) {
      emailInputRef.current?.focus();
    } else if (errors.password) {
      passwordInputRef.current?.focus();
    }
  };

  const clearFieldError = (field: LoginField) => {
    setFieldErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
  };

  const validateForm = (): boolean => {
    const nextErrors: LoginFieldErrors = {};
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      nextErrors.email = 'Enter your work email address.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      nextErrors.email = 'Enter a valid email address.';
    } else if (
      !normalizedEmail.toLowerCase().endsWith('@saudigerman.com') &&
      !(
        normalizedEmail.toLowerCase() === 'admin@me.com' &&
        ['localhost', '127.0.0.1'].includes(window.location.hostname)
      )
    ) {
      nextErrors.email = 'Use your @saudigerman.com email address.';
    }

    if (!password) {
      nextErrors.password = 'Enter your password.';
    } else if (password.length < 6) {
      nextErrors.password = 'Password must be at least 6 characters.';
    }

    setFieldErrors(nextErrors);
    focusFirstInvalidField(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const user = await login(email.trim(), password);
      queryClient.clear();
      const target = user.mustChangePassword
        ? '/change-password'
        : redirectPath || defaultHomeForUser(user);
      navigate(target, { replace: true });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to sign in. Please verify your credentials and try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="sgh-auth-root">
      <AtmosphericBackground variant="auth" />
      <ThinkingDots dotSize={1.4} spacing={32} speed={0.0014} isDark={false} />

      <div className="sgh-auth-container">
        <BorderGlow
          animated={true}
          borderRadius={20}
          glowColor="rgba(0, 132, 206, 0.55)"
          backgroundColor="rgba(255, 255, 255, 0.96)"
        >
          <section className="sgh-auth-grid">
            <div className="sgh-brand-pane">
              <div className="sgh-brand-pane-glow-1" aria-hidden="true" />
              <div className="sgh-brand-pane-glow-2" aria-hidden="true" />

              <div className="sgh-layer-z10">
                <div className="sgh-brand-header">
                  <SghAnimatedLogo size={50} showText={false} />
                  <div className="sgh-brand-divider" aria-hidden="true" />
                  <div>
                    <p className="sgh-brand-title">AssessFlow</p>
                    <p className="sgh-brand-subtitle">Saudi German Health</p>
                  </div>
                </div>

                <div className="sgh-brand-body">
                  <div className="sgh-pill-badge">
                    <span className="sgh-live-dot" aria-hidden="true" />
                    <span>Built for clinical &amp; talent assessment teams</span>
                  </div>

                  <h2 className="sgh-hero-heading">
                    Staff and candidate assessments, in one place.
                  </h2>

                  <p className="sgh-hero-description">
                    Each case moves from request to decision in the same workflow, so everyone
                    involved sees where it stands.
                  </p>

                  <div className="sgh-product-points">
                    {PRODUCT_POINTS.map((point, index) => (
                      <div key={point} className="sgh-point-item">
                        <span className="sgh-point-index">{index + 1}</span>
                        <p className="sgh-point-text">{point}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="sgh-brand-footer sgh-layer-z10">
                <p className="sgh-footer-security-text">For authorized Saudi German Health staff</p>

                <div className="sgh-clearance-badges" aria-hidden="true">
                  {['CHAIR', 'HR', 'EVAL', 'PRECEPTOR'].map((role) => (
                    <span key={role} className="sgh-clearance-pill">
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="sgh-form-pane">
              <div className="sgh-mobile-brand">
                <SghLogo size="sm" variant="horizontal" showSubtitle={false} />
                <div className="sgh-brand-divider" aria-hidden="true" />
                <div>
                  <p className="sgh-brand-title">AssessFlow</p>
                  <p className="sgh-brand-subtitle">Saudi German Health</p>
                </div>
              </div>

              <header className="sgh-form-header">
                <div className="sgh-workspace-badge">
                  <ShieldCheck size={14} className="sgh-icon-cyan" />
                  <span>Saudi German Health · Assessment Workspace</span>
                </div>

                <h1 className="sgh-form-title">Welcome back</h1>
                <p className="sgh-form-desc">Sign in with your work email.</p>
              </header>

              {error && (
                <div className="sgh-error-callout" role="alert">
                  <AlertCircle size={18} className="sgh-error-icon" />
                  <span>{error}</span>
                </div>
              )}

              <form className="sgh-login-form" onSubmit={handleSubmit} noValidate>
                <div className="sgh-field-group">
                  <label htmlFor="sgh-login-email" className="sgh-field-label">
                    Work Email
                  </label>
                  <div className="sgh-input-wrapper">
                    <Mail size={16} className="sgh-input-icon" />
                    <input
                      ref={emailInputRef}
                      id="sgh-login-email"
                      type="email"
                      className={`sgh-input-control ${fieldErrors.email ? 'has-error' : ''}`}
                      placeholder="name@saudigerman.com"
                      value={email}
                      autoComplete="email"
                      autoCapitalize="none"
                      spellCheck={false}
                      autoFocus
                      disabled={isSubmitting}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        clearFieldError('email');
                        if (error) setError('');
                      }}
                      aria-invalid={Boolean(fieldErrors.email)}
                      aria-describedby={fieldErrors.email ? 'sgh-email-error' : undefined}
                    />
                  </div>
                  {fieldErrors.email && (
                    <p id="sgh-email-error" className="sgh-field-error-msg" role="alert">
                      {fieldErrors.email}
                    </p>
                  )}
                </div>

                <div className="sgh-field-group">
                  <label htmlFor="sgh-login-password" className="sgh-field-label">
                    Password
                  </label>
                  <div className="sgh-input-wrapper">
                    <Lock size={16} className="sgh-input-icon" />
                    <input
                      ref={passwordInputRef}
                      id="sgh-login-password"
                      type={showPassword ? 'text' : 'password'}
                      className={`sgh-input-control ${fieldErrors.password ? 'has-error' : ''}`}
                      placeholder="Enter your password"
                      value={password}
                      autoComplete="current-password"
                      disabled={isSubmitting}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        clearFieldError('password');
                        if (error) setError('');
                      }}
                      aria-invalid={Boolean(fieldErrors.password)}
                      aria-describedby={fieldErrors.password ? 'sgh-password-error' : undefined}
                    />
                    <button
                      type="button"
                      className="sgh-pw-toggle"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword((prev) => !prev)}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p id="sgh-password-error" className="sgh-field-error-msg" role="alert">
                      {fieldErrors.password}
                    </p>
                  )}
                </div>

                <div className="sgh-form-meta-row">
                  <button
                    type="button"
                    onClick={() =>
                      setError(
                        'Password reset requests are managed by your hospital IT security administrator.',
                      )
                    }
                    className="sgh-forgot-link"
                    style={{ background: 'transparent', padding: 0 }}
                  >
                    Forgot password?
                  </button>
                </div>

                <button type="submit" className="sgh-btn-gradient" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <span className="sgh-btn-spinner" aria-hidden="true" />
                      <span>Signing in…</span>
                    </>
                  ) : (
                    <>
                      <span>Sign in to AssessFlow</span>
                      <ArrowRight size={17} className="sgh-btn-icon" />
                    </>
                  )}
                </button>
              </form>

              <div className="sgh-form-footer-note">
                Trouble signing in? Contact your hospital IT administrator.
              </div>
            </div>
          </section>
        </BorderGlow>
      </div>
    </main>
  );
}

export default LoginPage;
