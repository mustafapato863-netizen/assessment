import { useState, useRef, type FormEvent } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { login } from '../lib/auth';
import { SghAnimatedLogo } from '../design-system/brand/sgh-animated-logo';
import { SghLogo } from '../design-system/brand/sgh-logo';
import { SghAnimatedLoader } from '../design-system/brand/sgh-animated-loader';
import { ThinkingDots } from '../design-system/backgrounds/thinking-dots';
import { BorderGlow } from '../components/ui/border-glow';
import { AtmosphericBackground } from '../components/ui/atmospheric-background';

type LoginField = 'email' | 'password';
type LoginFieldErrors = Partial<Record<LoginField, string>>;

const PRODUCT_POINTS = [
  'Standardize clinical rubrics and competency benchmarks across departments',
  'Keep multi-rater evaluations, objective scoring, and committee sign-offs aligned',
  'Automate readiness tracking, credential verification, and compliance audit logs',
];

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const redirectPath = (location.state as { from?: string } | null)?.from;

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
    setIsAuthenticating(true);

    try {
      // Parallelize auth with minimum 2-second SGH brand typewriter loader animation
      await Promise.all([
        new Promise<void>((resolve, reject) => {
          try {
            login(email.trim(), password);
            resolve();
          } catch (err) {
            reject(err);
          }
        }),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);

      navigate(redirectPath || '/', { replace: true });
    } catch (err) {
      setIsAuthenticating(false);
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
    <>
      {/* SGH Fullscreen Animated Brand Loader Overlay on Login */}
      {isAuthenticating && (
        <SghAnimatedLoader
          fullScreen={true}
          durationMs={2000}
          textSequence="Saudi German Health"
          subtitle="Authenticating & Loading Assessment Workspace..."
          isDark={true}
        />
      )}

      <main className="sgh-auth-root">
        {/* Ambient Drifting Atmosphere */}
        <AtmosphericBackground variant="auth" />

        {/* Ambient Thinking Dots Particle Grid */}
        <ThinkingDots dotSize={1.4} spacing={32} speed={0.0014} isDark={true} />

        {/* Outer Glow Card Container */}
        <div className="sgh-auth-container">
          <BorderGlow
            animated={true}
            borderRadius={20}
            glowColor="rgba(0, 163, 224, 0.85)"
            backgroundColor="rgba(15, 23, 42, 0.94)"
          >
            <section className="sgh-auth-grid">
              {/* Left Column: Brand Story & Hospital Identity */}
              <div className="sgh-brand-pane">
                <div className="sgh-brand-pane-glow-1" aria-hidden="true" />
                <div className="sgh-brand-pane-glow-2" aria-hidden="true" />

                <div className="relative z-10">
                  {/* Brand Header */}
                  <div className="sgh-brand-header">
                    <SghAnimatedLogo size={50} showText={false} />
                    <div className="sgh-brand-divider" aria-hidden="true" />
                    <div>
                      <p className="sgh-brand-title">AssessFlow</p>
                      <p className="sgh-brand-subtitle">Saudi German Health</p>
                    </div>
                  </div>

                  {/* Hero Copy */}
                  <div className="sgh-brand-body">
                    <div className="sgh-pill-badge">
                      <span className="sgh-live-dot" aria-hidden="true" />
                      <span>Built for clinical & talent assessment teams</span>
                    </div>

                    <h2 className="sgh-hero-heading">
                      Accelerate clinical competency and talent calibration with confidence.
                    </h2>

                    <p className="sgh-hero-description">
                      One unified workspace for clinical preceptors, evaluators, department chairs,
                      and HR leadership to assess candidates and staff objectively.
                    </p>

                    {/* Product Capability Points */}
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

                {/* Footer Security Badge */}
                <div className="sgh-brand-footer relative z-10">
                  <p className="sgh-footer-security-text">
                    Enterprise Grade • Role-based Clinical Assessment
                  </p>

                  <div className="sgh-clearance-badges" aria-hidden="true">
                    {['CHAIR', 'HR', 'EVAL', 'PRECEPTOR'].map((role) => (
                      <span key={role} className="sgh-clearance-pill">
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Authentication Form */}
              <div className="sgh-form-pane">
                {/* Mobile Brand (visible when screen < 960px) */}
                <div className="sgh-mobile-brand">
                  <SghLogo size="sm" variant="horizontal" showSubtitle={false} />
                  <div className="h-5 w-px bg-white/15 mx-1" aria-hidden="true" />
                  <div>
                    <p className="m-0 text-sm font-extrabold text-white">AssessFlow</p>
                    <p className="m-0 text-[9px] font-bold uppercase tracking-wider text-[#00A3E0]">
                      Saudi German Health
                    </p>
                  </div>
                </div>

                {/* Form Header */}
                <header className="sgh-form-header">
                  <div className="sgh-workspace-badge">
                    <ShieldCheck size={14} className="text-[#00A3E0]" />
                    <span>Saudi German Health • Secure Assessment Workspace</span>
                  </div>

                  <h1 className="sgh-form-title">Welcome back</h1>
                  <p className="sgh-form-desc">
                    Enter your work credentials to continue to your assessment workspace.
                  </p>
                </header>

                {/* Error Callout */}
                {error && (
                  <div className="sgh-error-callout" role="alert">
                    <AlertCircle size={18} className="shrink-0 text-red-400 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Login Form */}
                <form className="sgh-login-form" onSubmit={handleSubmit} noValidate>
                  {/* Email Field */}
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
                        placeholder="admin@me.com"
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

                  {/* Password Field */}
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

                  {/* Forgot Password Link */}
                  <div className="sgh-form-meta-row">
                    <a
                      href="#/login"
                      onClick={(e) => {
                        e.preventDefault();
                        setError(
                          'Password reset requests are managed by your hospital IT security administrator.',
                        );
                      }}
                      className="sgh-forgot-link"
                    >
                      Forgot password?
                    </a>
                  </div>

                  {/* Submit Button with SGH Gradient */}
                  <button type="submit" className="sgh-btn-gradient" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <span className="sgh-btn-spinner" aria-hidden="true" />
                        <span>Authenticating…</span>
                      </>
                    ) : (
                      <>
                        <span>Sign in to AssessFlow</span>
                        <ArrowRight size={17} className="sgh-btn-icon" />
                      </>
                    )}
                  </button>
                </form>

                {/* Footer Note */}
                <div className="sgh-form-footer-note">
                  Secure Hospital Gateway • 256-bit Encryption • SGH Digital Health
                </div>
              </div>
            </section>
          </BorderGlow>
        </div>
      </main>
    </>
  );
}

export default LoginPage;
