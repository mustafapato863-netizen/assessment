import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  ChevronDown,
  ClipboardCheck,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings2,
  Sparkles,
  User,
  UserCheck,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import { getActiveUser, getSession, logout, subscribeToAuth, type AppUser } from '../lib/auth';
import { SghHeartSvg } from '../design-system/brand/sgh-heart-svg';
import { SettingsModal } from './settings-modal';
import { copy, type Copy, type View } from '../lib/labels';
import { PILOT_FLAGS } from '../lib/flags';
import { useToast, ToastContext, type ToastContextValue } from '../hooks/use-toast';
import { CommandPalette, ShortcutsHelpDialog, useKeyboardShortcuts } from './command-palette';
import { api } from '../lib/api';
import { getKpis } from '../routes/workQueue';
import { mapWorkItems } from '../routes/my-work-data';
import { mapCasesForEmployeeStats } from '../routes/assessment-case-adapter';
import { employeeStats, groupByEmployee } from '../routes/employees-logic';
import { mapAssessmentCase } from '../routes/assessment-case-adapter';
import {
  developmentKpis,
  mapDevelopmentPlan,
  type DevelopmentPlanData,
} from '../routes/development-logic';

export { useToast, ToastContext, type ToastContextValue };

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="offline-banner" role="status" aria-live="polite">
      <WifiOff size={16} />
      <span>
        You are currently working offline. Changes cannot be synced until connection is restored.
      </span>
    </div>
  );
}

function isRouteActive(id: string, pathname: string): boolean {
  if (id === 'overview') return pathname === '/' || pathname === '';
  if (id === 'cases') return pathname.startsWith('/cases') || pathname.startsWith('/assessments');
  return pathname === `/${id}` || pathname.startsWith(`/${id}/`);
}

export function NavItem({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: { id: string; label: string; icon: typeof LayoutDashboard; count?: string; path?: string };
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`nav-item ${active ? 'active' : ''} ${collapsed ? 'collapsed' : ''}`}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      aria-current={active ? 'page' : undefined}
    >
      <item.icon size={18} />
      {!collapsed && <span>{item.label}</span>}
      {!collapsed && item.count && <span className="nav-count">{item.count}</span>}
    </button>
  );
}

export function Sidebar({
  collapsed,
  mobileOpen,
  view,
  t: propT,
  onSelect,
  onClose,
  activeUser,
  onOpenSettings,
}: {
  collapsed: boolean;
  mobileOpen: boolean;
  view?: View;
  t?: Copy;
  onSelect?: (view: View) => void;
  onClose: () => void;
  activeUser?: AppUser | null;
  onOpenSettings?: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const t = propT ?? copy;
  const user = activeUser ?? null;
  const canSeeMyWork = [
    'SYS_ADMIN',
    'HR_ADMIN',
    'MANAGER',
    'EMPLOYEE_MANAGER',
    'DEV_LEAD',
    'APPROVER',
    'ASSESSOR',
  ].includes(user?.role ?? '');
  const { data: overviewData } = useQuery({
    queryKey: ['overview'],
    queryFn: api.overview,
    enabled: canSeeMyWork,
  });
  const { data: casesData } = useQuery({
    queryKey: ['cases'],
    queryFn: () => api.cases(),
    enabled: canSeeMyWork,
  });
  const developmentCases = (casesData ?? []).filter(
    (caseItem) => caseItem.status === 'DEVELOPMENT_IN_PROGRESS',
  );
  const developmentPlanQueries = useQueries({
    queries: developmentCases.map((caseItem) => ({
      queryKey: ['development', caseItem.id],
      queryFn: () => api.getDevelopment<DevelopmentPlanData>(caseItem.id).catch(() => null),
      staleTime: 30_000,
    })),
  });
  const myWorkItems = mapWorkItems(overviewData?.tasks ?? [], casesData ?? []);
  const myWorkCount =
    overviewData && casesData ? String(getKpis(myWorkItems).openCases) : undefined;
  const employeeCount = casesData
    ? String(employeeStats(groupByEmployee(mapCasesForEmployeeStats(casesData))).people)
    : undefined;
  const developmentCount = casesData
    ? String(
        developmentKpis(
          developmentCases.map((caseItem, index) =>
            mapDevelopmentPlan(
              mapAssessmentCase(caseItem),
              developmentPlanQueries[index]?.data ?? null,
            ),
          ),
        ).activePlans,
      )
    : undefined;

  const standardItems: Array<{
    id: View;
    label: string;
    icon: typeof LayoutDashboard;
    count?: string;
    path: string;
  }> = [
    { id: 'overview', label: t.overview, icon: LayoutDashboard, path: '/' },
    { id: 'tasks', label: t.tasks, icon: ListTodo, count: myWorkCount, path: '/tasks' },
    {
      id: 'cases',
      label: t.cases,
      icon: ClipboardCheck,
      count: casesData ? String(casesData.length) : undefined,
      path: '/assessments',
    },
    {
      id: 'employees',
      label: t.employees,
      icon: Users,
      count: employeeCount,
      path: '/employees',
    },
    {
      id: 'development',
      label: t.development,
      icon: Sparkles,
      count: developmentCount,
      path: '/development',
    },
    {
      id: 'insights',
      label: t.insights,
      icon: BarChart3,
      path: '/insights',
    },
    ...(PILOT_FLAGS.calibration
      ? [{ id: 'calibration' as View, label: t.calibration, icon: Sparkles, path: '/calibration' }]
      : []),
  ];
  const items: Array<{
    id: View;
    label: string;
    icon: typeof LayoutDashboard;
    count?: string;
    path: string;
  }> =
    user?.role === 'ASSESSOR'
      ? [
          ...standardItems,
          { id: 'assessor', label: 'My assessments', icon: UserCheck, path: '/assessor' },
        ]
      : user?.role === 'EMPLOYEE'
        ? [{ id: 'my-result', label: 'My result', icon: ClipboardCheck, path: '/my-result' }]
        : user?.role === 'EMPLOYEE_MANAGER'
          ? [
              {
                id: 'employees',
                label: t.employees,
                icon: Users,
                count: employeeCount,
                path: '/employees',
              },
              {
                id: 'cases',
                label: t.cases,
                icon: ClipboardCheck,
                count: casesData ? String(casesData.length) : undefined,
                path: '/assessments',
              },
            ]
          : standardItems;
  const workspaceItems =
    user?.role === 'ASSESSOR'
      ? [
          ...standardItems.slice(0, 4),
          { id: 'assessor' as View, label: 'My assessments', icon: UserCheck, path: '/assessor' },
        ]
      : user?.role === 'EMPLOYEE' || user?.role === 'EMPLOYEE_MANAGER'
        ? items
        : items.slice(0, 4);
  const insightItems = user?.role === 'ASSESSOR' ? standardItems.slice(4) : items.slice(4);

  const handleSelect = (itemId: View, path: string) => {
    if (onSelect) {
      onSelect(itemId);
    } else {
      navigate(path);
      onClose();
    }
  };

  const initials = user?.avatarInitials ?? '?';
  const avatarColor = user?.avatarColor ?? 'avatar-slate';

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-header">
        <div
          className="brand-mark"
          style={{ background: 'transparent', boxShadow: 'none', padding: 0 }}
        >
          <SghHeartSvg size={28} glow={true} />
        </div>
        <div className="brand-copy">
          <strong>AssessFlow</strong>
          <small>Saudi German Health</small>
        </div>
        <button
          className="icon-button mobile-close"
          aria-label="Close navigation"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>

      <div className="workspace-switch">
        <div className="workspace-icon">
          <Sparkles size={19} />
        </div>
        <div className="workspace-copy">
          <strong>{t.workspace}</strong>
          <small>{t.cycle}</small>
        </div>
        <span className="online-dot" />
      </div>

      <nav className="nav-groups" aria-label="Main navigation">
        <span className="nav-label">WORKSPACE</span>
        {workspaceItems.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            active={view ? view === item.id : isRouteActive(item.id, location.pathname)}
            collapsed={collapsed}
            onClick={() => handleSelect(item.id, item.path)}
          />
        ))}
        {user?.role !== 'EMPLOYEE' && user?.role !== 'EMPLOYEE_MANAGER' && (
          <>
            <span className="nav-label nav-label-spaced">INSIGHTS</span>
            {insightItems.map((item) => (
              <NavItem
                key={item.id}
                item={item}
                active={view ? view === item.id : isRouteActive(item.id, location.pathname)}
                collapsed={collapsed}
                onClick={() => handleSelect(item.id, item.path)}
              />
            ))}
          </>
        )}
        {user?.role === 'SYS_ADMIN' && (
          <>
            <span className="nav-label nav-label-spaced">SYSTEM</span>
            <NavItem
              item={{ id: 'admin', label: t.admin, icon: Settings2 }}
              active={view ? view === 'admin' : isRouteActive('admin', location.pathname)}
              collapsed={collapsed}
              onClick={() => handleSelect('admin', '/admin')}
            />
          </>
        )}
      </nav>

      {!collapsed && (
        <div className="sidebar-cycle">
          <div className="cycle-orb orb-one" />
          <div className="cycle-orb orb-two" />
          <span>LIVE CYCLE</span>
          <strong>Leadership assessment</strong>
          <div className="cycle-footer">
            <small>FY26</small>
            <b>68%</b>
          </div>
          <div className="cycle-progress">
            <i />
          </div>
        </div>
      )}

      {!collapsed && user && (
        <div
          className="sidebar-user"
          role={user.role === 'SYS_ADMIN' ? 'button' : undefined}
          tabIndex={user.role === 'SYS_ADMIN' ? 0 : undefined}
          onClick={user.role === 'SYS_ADMIN' ? onOpenSettings : undefined}
          title={user.role === 'SYS_ADMIN' ? 'System Settings' : undefined}
          style={{ cursor: user.role === 'SYS_ADMIN' ? 'pointer' : 'default' }}
          onKeyDown={(e) =>
            user.role === 'SYS_ADMIN' && (e.key === 'Enter' || e.key === ' ') && onOpenSettings?.()
          }
        >
          <div className={`avatar ${avatarColor}`}>{initials}</div>
          <div>
            <strong>{user.name}</strong>
            <small>{user.roleTitle}</small>
          </div>
          <ChevronDown size={15} />
        </div>
      )}

      <button
        className="collapse-button"
        aria-label="Toggle sidebar"
        onClick={() => document.querySelector<HTMLButtonElement>('[data-sidebar-toggle]')?.click()}
      >
        <PanelLeftClose size={17} />
        <span>Collapse sidebar</span>
      </button>
    </aside>
  );
}

export function Topbar({
  t: propT,
  onOpenMenu,
  onToggleCollapse,
  collapsed,
  onOpenPalette,
  onOpenSettings,
  activeUser,
  onLogout,
}: {
  t?: Copy;
  onOpenMenu: () => void;
  onToggleCollapse: () => void;
  collapsed: boolean;
  onOpenPalette?: () => void;
  onOpenSettings?: () => void;
  activeUser?: AppUser | null;
  onLogout?: () => void;
}) {
  const t = propT ?? copy;
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    if (!userMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  const user = activeUser ?? null;
  const initials = user?.avatarInitials ?? '?';
  const avatarColor = user?.avatarColor ?? 'avatar-slate';

  return (
    <header className="topbar">
      <button className="icon-button mobile-menu" onClick={onOpenMenu} aria-label="Open navigation">
        <Menu size={21} />
      </button>
      <button
        data-sidebar-toggle
        className="icon-button desktop-toggle"
        onClick={onToggleCollapse}
        aria-label="Toggle sidebar"
      >
        {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
      </button>

      <div
        className="global-search"
        role="button"
        tabIndex={0}
        onClick={onOpenPalette}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenPalette?.();
          }
        }}
        aria-label="Open command palette"
        style={{ cursor: 'pointer' }}
      >
        <Search size={18} />
        <input
          aria-label={t.search}
          placeholder={t.search}
          readOnly
          tabIndex={-1}
          style={{ cursor: 'pointer' }}
        />
        <kbd>⌘ K</kbd>
      </div>

      <div className="topbar-actions">
        {/* Settings button */}
        {user?.role === 'SYS_ADMIN' && (
          <button
            className="icon-button settings-button"
            aria-label="System Settings"
            title="System Settings & Database Telemetry"
            onClick={() => {
              setUserMenuOpen(false);
              onOpenSettings?.();
            }}
          >
            <Settings2 size={19} />
          </button>
        )}

        {/* User profile dropdown */}
        <div className="topbar-user-wrapper" ref={userMenuRef} style={{ position: 'relative' }}>
          <button
            type="button"
            className="topbar-profile topbar-profile-interactive"
            onClick={() => setUserMenuOpen((prev) => !prev)}
            aria-label={`Signed in as ${user?.name ?? 'User'}. Click for account options.`}
            aria-expanded={userMenuOpen}
            aria-haspopup="true"
          >
            <div className={`avatar ${avatarColor}`}>{initials}</div>
            <div className="topbar-profile-copy">
              <strong>{user?.name ?? 'User'}</strong>
              <small>{user?.roleTitle ?? ''}</small>
            </div>
            <ChevronDown size={14} className={`dropdown-chevron ${userMenuOpen ? 'open' : ''}`} />
          </button>

          {userMenuOpen && (
            <div className="user-dropdown-menu panel" role="menu">
              {/* Account info */}
              <div className="user-dropdown-header">
                <div className={`avatar avatar-lg ${avatarColor}`}>{initials}</div>
                <div className="user-dropdown-info">
                  <strong>{user?.name ?? 'User'}</strong>
                  <small>{user?.email ?? ''}</small>
                  <span className="user-role-badge">{user?.roleTitle ?? ''}</span>
                </div>
              </div>

              <div className="user-dropdown-divider" />

              {user?.role === 'SYS_ADMIN' && (
                <button
                  type="button"
                  role="menuitem"
                  className="user-dropdown-item"
                  onClick={() => {
                    setUserMenuOpen(false);
                    onOpenSettings?.();
                  }}
                >
                  <Settings2 size={15} />
                  System Settings
                </button>
              )}

              <button
                type="button"
                role="menuitem"
                className="user-dropdown-item"
                onClick={() => {
                  setUserMenuOpen(false);
                  /* profile page - future */
                }}
              >
                <User size={15} />
                My Profile
              </button>

              <div className="user-dropdown-divider" />

              <button
                type="button"
                role="menuitem"
                className="user-dropdown-item user-dropdown-signout"
                onClick={() => {
                  setUserMenuOpen(false);
                  onLogout?.();
                }}
              >
                <LogOut size={15} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export function AppShell({
  children,
  collapsed: propCollapsed,
  mobileOpen: propMobileOpen,
  t: propT,
}: {
  children?: React.ReactNode;
  collapsed?: boolean;
  mobileOpen?: boolean;
  t?: Copy;
} = {}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeUser, setActiveUserState] = useState<AppUser | null>(getSession);

  const collapsed = propCollapsed ?? sidebarCollapsed;
  const mobileOpen = propMobileOpen ?? mobileMenuOpen;
  const t = propT ?? copy;

  useEffect(() => {
    const unsub = subscribeToAuth((u) => setActiveUserState(u));
    return unsub;
  }, []);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!getSession()) {
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  const handleLogout = () => {
    logout();
    queryClient.clear();
    showToast('You have been signed out successfully.');
    navigate('/login', { replace: true });
  };

  useKeyboardShortcuts({
    onOpenPalette: () => setPaletteOpen(true),
    onOpenShortcuts: () => setShortcutsOpen(true),
  });

  return (
    <div className="app-shell">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        t={t}
        onClose={() => setMobileMenuOpen(false)}
        activeUser={activeUser}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <div className="app-main">
        <OfflineBanner />
        <Topbar
          t={t}
          onOpenMenu={() => setMobileMenuOpen(true)}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
          collapsed={collapsed}
          onOpenPalette={() => setPaletteOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          activeUser={activeUser}
          onLogout={handleLogout}
        />
        <main className="page-content">{children ?? <Outlet />}</main>
      </div>
      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ShortcutsHelpDialog isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
