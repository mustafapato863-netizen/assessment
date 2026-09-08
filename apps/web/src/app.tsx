import { useCallback, useEffect, useState } from 'react';
import {
  HashRouter,
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
import { TasksPage } from './routes/tasks';
import type { Copy, View } from './lib/labels';

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [toast, setToast] = useState<string | null>(null);

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
        <Route element={<AppShell />}>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/cases" element={<CasesPage />} />
          <Route path="/cases/new" element={<NewRequestPage />} />
          <Route path="/cases/:id" element={<CasePage />} />
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/employees/:id" element={<EmployeesPage />} />
          <Route path="/employees/:id/history" element={<EmployeesPage />} />
          <Route path="/development" element={<DevelopmentPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/admin" element={<AdminPage />} />
          {PILOT_FLAGS.calibration && <Route path="/calibration" element={<CalibrationPage />} />}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>

      {backgroundLocation && (
        <Routes>
          <Route
            path="/cases/new"
            element={
              <NewRequestDrawer
                onClose={() => navigate(-1)}
                onCreated={(created) => {
                  queryClient.invalidateQueries({ queryKey: ['cases'] });
                  showToast('Assessment request created as a draft.');
                  navigate(`/cases/${created.id}`);
                }}
              />
            }
          />
        </Routes>
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
