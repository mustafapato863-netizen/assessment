import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, type Location } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { PILOT_FLAGS } from './lib/flags';
import { ToastContext, type ToastTone } from './hooks/use-toast';
import { AppShell } from './components/shell';
import {
  canAccessRoute,
  defaultHomeForUser,
  getSession,
  subscribeToAuth,
  type AppRouteKey,
  type AppUser,
} from './lib/auth';
import type { Copy, View } from './lib/labels';

const LoginPage = lazy(() => import('./routes/login').then((m) => ({ default: m.LoginPage })));
const TemporaryPasswordPage = lazy(() =>
  import('./routes/temporary-password').then((m) => ({ default: m.TemporaryPasswordPage })),
);
const OverviewPage = lazy(() =>
  import('./routes/overview').then((m) => ({ default: m.OverviewPage })),
);
const MyWorkPage = lazy(() => import('./routes/my-work'));
const CasesPage = lazy(() => import('./routes/cases').then((m) => ({ default: m.CasesPage })));
const AssessmentsPage = CasesPage;
const CasePage = lazy(() => import('./routes/case').then((m) => ({ default: m.CasePage })));
const EmployeesPage = lazy(() =>
  import('./routes/employees').then((m) => ({ default: m.EmployeesPage })),
);
const DevelopmentPage = lazy(() =>
  import('./routes/development').then((m) => ({ default: m.DevelopmentPage })),
);
const CalibrationPage = lazy(() =>
  import('./routes/calibration').then((m) => ({ default: m.CalibrationPage })),
);
const InsightsPage = lazy(() =>
  import('./routes/insights').then((m) => ({ default: m.InsightsPage })),
);
const AssessorPage = lazy(() =>
  import('./routes/assessor').then((m) => ({ default: m.AssessorPage })),
);
const MyResultsPage = lazy(() =>
  import('./routes/my-result').then((m) => ({ default: m.MyResultsPage })),
);
const AdminPage = lazy(() => import('./routes/admin').then((m) => ({ default: m.AdminPage })));
const NewRequestPage = lazy(() =>
  import('./routes/new-request').then((m) => ({ default: m.NewRequestPage })),
);
const NewRequestDrawer = lazy(() =>
  import('./routes/new-request').then((m) => ({ default: m.NewRequestDrawer })),
);
const NotFoundPage = lazy(() =>
  import('./routes/placeholder').then((m) => ({ default: m.NotFoundPage })),
);

function RouteLoadingFallback() {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <div className="skeleton" style={{ height: 32, width: '34%', marginBottom: 18 }} />
      <div className="skeleton" style={{ height: 120, width: '100%', marginBottom: 16 }} />
      <div className="skeleton" style={{ height: 220, width: '100%' }} />
      <span className="sr-only">Loading view…</span>
    </div>
  );
}

interface BoundaryState {
  hasError: boolean;
  message: string;
}

class AppErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  override state: BoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { hasError: true, message: error.message || 'Unexpected workspace rendering error.' };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('AssessFlow ErrorBoundary:', error, info.componentStack);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-shell" role="alert">
          <div className="error-boundary-card">
            <span className="eyebrow">Workspace Recovery</span>
            <h1>Something went wrong</h1>
            <p>{this.state.message}</p>
            <div className="error-boundary-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() => window.location.reload()}
              >
                Reload workspace
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  this.setState({ hasError: false, message: '' });
                  window.location.assign('/');
                }}
              >
                Return home
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function useCurrentSession(): AppUser | null {
  const [user, setUser] = useState<AppUser | null>(() => getSession());
  useEffect(() => subscribeToAuth((next) => setUser(next)), []);
  return user;
}

function RoleGate({
  routeKey,
  user,
  children,
}: {
  routeKey: AppRouteKey;
  user: AppUser | null;
  children: ReactNode;
}) {
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
  if (!canAccessRoute(user, routeKey)) {
    return <Navigate to={defaultHomeForUser(user)} replace />;
  }
  return <>{children}</>;
}

function AuthenticatedWorkspace() {
  const user = useCurrentSession();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (user.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  const state = location.state as { backgroundLocation?: Location } | null;
  const backgroundLocation = state?.backgroundLocation;

  const refreshData = () => {
    void queryClient.invalidateQueries();
  };

  return (
    <AppShell>
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes location={backgroundLocation || location}>
          <Route
            path="/"
            element={
              <RoleGate routeKey="overview" user={user}>
                <OverviewPage />
              </RoleGate>
            }
          />
          <Route
            path="/tasks"
            element={
              <RoleGate routeKey="tasks" user={user}>
                <MyWorkPage />
              </RoleGate>
            }
          />
          <Route
            path="/assessor"
            element={
              <RoleGate routeKey="assessor" user={user}>
                <AssessorPage />
              </RoleGate>
            }
          />
          <Route
            path="/access"
            element={
              <RoleGate routeKey="admin" user={user}>
                <Navigate to="/admin" replace />
              </RoleGate>
            }
          />
          <Route
            path="/my-result"
            element={
              <RoleGate routeKey="my-result" user={user}>
                <MyResultsPage />
              </RoleGate>
            }
          />
          <Route
            path="/cases"
            element={
              <RoleGate routeKey="cases" user={user}>
                <CasesPage />
              </RoleGate>
            }
          />
          <Route
            path="/assessments"
            element={
              <RoleGate routeKey="cases" user={user}>
                <AssessmentsPage />
              </RoleGate>
            }
          />
          <Route
            path="/cases/new"
            element={
              <RoleGate routeKey="new-case" user={user}>
                <NewRequestPage />
              </RoleGate>
            }
          />
          <Route
            path="/cases/:id"
            element={
              <RoleGate routeKey="case-detail" user={user}>
                <CasePage />
              </RoleGate>
            }
          />
          <Route
            path="/employees"
            element={
              <RoleGate routeKey="employees" user={user}>
                <EmployeesPage />
              </RoleGate>
            }
          />
          <Route
            path="/employees/:id"
            element={
              <RoleGate routeKey="employees" user={user}>
                <EmployeesPage />
              </RoleGate>
            }
          />
          <Route
            path="/employees/:id/history"
            element={
              <RoleGate routeKey="employees" user={user}>
                <EmployeesPage />
              </RoleGate>
            }
          />
          <Route
            path="/development"
            element={
              <RoleGate routeKey="development" user={user}>
                <DevelopmentPage />
              </RoleGate>
            }
          />
          <Route
            path="/insights"
            element={
              <RoleGate routeKey="insights" user={user}>
                <InsightsPage />
              </RoleGate>
            }
          />
          <Route
            path="/admin"
            element={
              <RoleGate routeKey="admin" user={user}>
                <AdminPage />
              </RoleGate>
            }
          />
          <Route
            path="/calibration"
            element={
              <RoleGate routeKey="calibration" user={user}>
                <CalibrationPage />
              </RoleGate>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>

        {backgroundLocation && canAccessRoute(user, 'new-case') && (
          <Routes>
            <Route
              path="/cases/new"
              element={
                <NewRequestDrawer
                  onClose={() => {
                    navigate(backgroundLocation.pathname + (backgroundLocation.search || ''), {
                      replace: true,
                    });
                  }}
                  onCreated={() => {
                    refreshData();
                  }}
                />
              }
            />
          </Routes>
        )}
      </Suspense>
    </AppShell>
  );
}

function App() {
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    return subscribeToAuth((nextUser, reason) => {
      if (!nextUser && reason === 'expired') {
        setToast({
          message: 'Your session has expired. Please sign in again.',
          tone: 'warning',
        });
        navigate('/login', { replace: true });
      }
    });
  }, [navigate]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = useCallback((message: string, tone: ToastTone = 'info') => {
    setToast({ message, tone });
  }, []);

  const toastValue = useMemo(() => ({ showToast }), [showToast]);

  return (
    <AppErrorBoundary>
      <ToastContext.Provider value={toastValue}>
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/change-password" element={<TemporaryPasswordPage />} />
            <Route path="/*" element={<AuthenticatedWorkspace />} />
          </Routes>
        </Suspense>

        {toast && (
          <div className={`toast toast-${toast.tone}`} role="status" aria-live="polite">
            {toast.tone === 'error' || toast.tone === 'warning' ? (
              <AlertCircle size={16} aria-hidden="true" />
            ) : toast.tone === 'success' ? (
              <CheckCircle2 size={16} aria-hidden="true" />
            ) : (
              <Info size={16} aria-hidden="true" />
            )}
            <span>{toast.message}</span>
            <button
              type="button"
              className="toast-close"
              aria-label="Dismiss notification"
              onClick={() => setToast(null)}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        )}
      </ToastContext.Provider>
    </AppErrorBoundary>
  );
}

export { App, PILOT_FLAGS };
export type { View, Copy };
