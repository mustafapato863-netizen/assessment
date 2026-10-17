import { useCallback, useEffect, useState } from 'react';
import {
  HashRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  type Location,
} from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, X } from 'lucide-react';
import { PILOT_FLAGS } from './lib/flags';
import { ToastContext } from './hooks/use-toast';
import { AppShell } from './components/shell';
import { AdminPage } from './routes/admin';
import { CasePage } from './routes/case';
import { CasesPage } from './routes/cases';
import { DevelopmentPage } from './routes/development';
import { EmployeesPage } from './routes/employees';
import { InsightsPage } from './routes/insights';
import { NewRequestDrawer, NewRequestPage } from './routes/new-request';
import { LoginPage } from './routes/login';
import { OverviewPage } from './routes/overview';
import { CalibrationPage } from './routes/calibration';
import { NotFoundPage } from './routes/placeholder';
import MyWorkPage from './routes/my-work';
import { AssessorPage } from './routes/assessor';
import { MyResultsPage } from './routes/my-result';
import { TemporaryPasswordPage } from './routes/temporary-password';
import { getActiveUser, type AppUser } from './lib/auth';
import type { Copy, View } from './lib/labels';

function RoleGate({ roles, children }: { roles: AppUser['role'][]; children: React.ReactNode }) {
  const user = getActiveUser();
  const role = user.role;
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
  if (roles.includes(role)) return <>{children}</>;
  const fallback =
    role === 'ASSESSOR'
      ? '/assessor'
      : role === 'EMPLOYEE'
        ? '/my-result'
        : role === 'EMPLOYEE_MANAGER'
          ? '/employees'
          : '/';
  return <Navigate to={fallback} replace />;
}

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [toast, setToast] = useState<string | null>(null);
  const [newRequestOpen, setNewRequestOpen] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const state = location.state as { backgroundLocation?: Location } | undefined;
  const backgroundLocation = state?.backgroundLocation;

  return (
    <ToastContext.Provider value={{ showToast }}>
      <Routes location={backgroundLocation || location}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/change-password" element={<TemporaryPasswordPage />} />
        <Route element={<AppShell />}>
          <Route
            path="/"
            element={
              <RoleGate roles={['SYS_ADMIN', 'HR_ADMIN', 'MANAGER', 'DEV_LEAD', 'ASSESSOR']}>
                <OverviewPage onNew={() => setNewRequestOpen(true)} />
              </RoleGate>
            }
          />
          <Route
            path="/tasks"
            element={
              <RoleGate
                roles={['SYS_ADMIN', 'HR_ADMIN', 'MANAGER', 'DEV_LEAD', 'APPROVER', 'ASSESSOR']}
              >
                <MyWorkPage />
              </RoleGate>
            }
          />
          <Route
            path="/assessor"
            element={
              <RoleGate roles={['ASSESSOR']}>
                <AssessorPage />
              </RoleGate>
            }
          />
          <Route
            path="/access"
            element={
              <RoleGate roles={['SYS_ADMIN']}>
                <Navigate to="/admin" replace />
              </RoleGate>
            }
          />
          <Route
            path="/my-result"
            element={
              <RoleGate roles={['EMPLOYEE']}>
                <MyResultsPage />
              </RoleGate>
            }
          />
          <Route
            path="/cases"
            element={
              <RoleGate
                roles={[
                  'SYS_ADMIN',
                  'HR_ADMIN',
                  'MANAGER',
                  'EMPLOYEE_MANAGER',
                  'DEV_LEAD',
                  'ASSESSOR',
                ]}
              >
                <CasesPage onNew={() => setNewRequestOpen(true)} />
              </RoleGate>
            }
          />
          <Route
            path="/assessments"
            element={
              <RoleGate
                roles={[
                  'SYS_ADMIN',
                  'HR_ADMIN',
                  'MANAGER',
                  'EMPLOYEE_MANAGER',
                  'DEV_LEAD',
                  'ASSESSOR',
                ]}
              >
                <CasesPage onNew={() => setNewRequestOpen(true)} />
              </RoleGate>
            }
          />
          <Route
            path="/cases/new"
            element={
              <RoleGate roles={['SYS_ADMIN', 'HR_ADMIN', 'DEV_LEAD', 'ASSESSOR']}>
                <NewRequestPage />
              </RoleGate>
            }
          />
          <Route
            path="/cases/:id"
            element={
              <RoleGate
                roles={[
                  'SYS_ADMIN',
                  'HR_ADMIN',
                  'MANAGER',
                  'EMPLOYEE_MANAGER',
                  'DEV_LEAD',
                  'ASSESSOR',
                  'APPROVER',
                ]}
              >
                <CasePage />
              </RoleGate>
            }
          />
          <Route
            path="/employees"
            element={
              <RoleGate
                roles={['SYS_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE_MANAGER', 'ASSESSOR']}
              >
                <EmployeesPage />
              </RoleGate>
            }
          />
          <Route
            path="/employees/:id"
            element={
              <RoleGate
                roles={['SYS_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE_MANAGER', 'ASSESSOR']}
              >
                <EmployeesPage />
              </RoleGate>
            }
          />
          <Route
            path="/employees/:id/history"
            element={
              <RoleGate
                roles={['SYS_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE_MANAGER', 'ASSESSOR']}
              >
                <EmployeesPage />
              </RoleGate>
            }
          />
          <Route
            path="/development"
            element={
              <RoleGate
                roles={['SYS_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE_MANAGER', 'ASSESSOR']}
              >
                <DevelopmentPage />
              </RoleGate>
            }
          />
          <Route
            path="/insights"
            element={
              <RoleGate roles={['SYS_ADMIN', 'HR_ADMIN', 'MANAGER', 'ASSESSOR']}>
                <InsightsPage />
              </RoleGate>
            }
          />
          <Route
            path="/admin"
            element={
              <RoleGate roles={['SYS_ADMIN']}>
                <AdminPage />
              </RoleGate>
            }
          />
          {PILOT_FLAGS.calibration && (
            <Route
              path="/calibration"
              element={
                <RoleGate roles={['SYS_ADMIN', 'HR_ADMIN', 'MANAGER', 'ASSESSOR']}>
                  <CalibrationPage />
                </RoleGate>
              }
            />
          )}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>

      {backgroundLocation && (
        <Routes>
          <Route
            path="/cases/new"
            element={
              <RoleGate roles={['SYS_ADMIN', 'HR_ADMIN', 'DEV_LEAD']}>
                <NewRequestDrawer
                  onClose={() => navigate(-1)}
                  onCreated={(created) => {
                    queryClient.invalidateQueries({ queryKey: ['cases'] });
                    showToast('Assessment request created as a draft.');
                    navigate(`/cases/${created.id}`);
                  }}
                />
              </RoleGate>
            }
          />
        </Routes>
      )}

      {newRequestOpen && (
        <NewRequestDrawer
          onClose={() => setNewRequestOpen(false)}
          onCreated={(created) => {
            queryClient.invalidateQueries({ queryKey: ['cases'] });
            queryClient.invalidateQueries({ queryKey: ['overview'] });
            setNewRequestOpen(false);
            showToast('Assessment request created as a draft.');
            navigate(`/cases/${created.id}`);
          }}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          <span>{toast}</span>
          <button aria-label="Dismiss" onClick={() => setToast(null)}>
            <X size={16} />
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}

function App() {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
}

export { App, PILOT_FLAGS };
export type { View, Copy };
