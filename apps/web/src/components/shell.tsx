import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  BarChart3,
  Building2,
  ChevronDown,
  ClipboardCheck,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Scale,
  Search,
  Settings2,
  TrendingUp,
  User,
  UserCheck,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import { canAccessRoute, getSession, logout, subscribeToAuth, type AppUser } from '../lib/auth';
import { SghHeartSvg } from '../design-system/brand/sgh-heart-svg';
import { copy, type Copy, type View } from '../lib/labels';
import { PILOT_FLAGS } from '../lib/flags';
import { useToast, ToastContext, type ToastContextValue } from '../hooks/use-toast';
import { CommandPalette, ShortcutsHelpDialog, useKeyboardShortcuts } from './command-palette';
import { BackToTop } from './back-to-top';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';

const SettingsModal = lazy(() =>
  import('./settings-modal').then((m) => ({ default: m.SettingsModal })),
);
const ProfileModal = lazy(() =>
  import('./profile-modal').then((m) => ({ default: m.ProfileModal })),
);

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
      <WifiOff size={16} aria-hidden="true" />
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

interface SidebarNavItem {
  id: View;
  label: string;
  icon: typeof LayoutDashboard;
  count?: string;
  path: string;
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
  const hasCount = Boolean(item.count) && item.count !== '0';
  return (
    <button
      type="button"
      className={`nav-item ${active ? 'active' : ''} ${collapsed ? 'collapsed' : ''}`}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      aria-current={active ? 'page' : undefined}
    >
      <item.icon size={18} aria-hidden="true" />
      {!collapsed && <span>{item.label}</span>}
      {!collapsed && hasCount && <span className="nav-count">{item.count}</span>}
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
  onOpenProfile,
  onLogout,
}: {
  collapsed: boolean;
  mobileOpen: boolean;
  view?: View;
  t?: Copy;
  onSelect?: (view: View) => void;
  onClose: () => void;
  activeUser?: AppUser | null;
  onOpenSettings?: () => void;
  onOpenProfile?: () => void;
  onLogout?: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const t = propT ?? copy;
  const user = activeUser ?? null;

  const canSeeCases = canAccessRoute(user, 'cases');
  const canSeeOverview = canAccessRoute(user, 'overview') || canAccessRoute(user, 'tasks');

  const { data: overviewData } = useQuery({
    queryKey: queryKeys.overview(),
    queryFn: api.overview,
    enabled: Boolean(user) && canSeeOverview,
    staleTime: 60_000,
  });

  const { data: casesData } = useQuery({
    queryKey: queryKeys.cases(),
    queryFn: () => api.cases(),
    enabled: Boolean(user) && canSeeCases,
    staleTime: 60_000,
  });

  const navCounts = (
    overviewData as
      | (typeof overviewData & {
          navCounts?: {
            activeCases: number;
            openTasks: number;
            employees: number;
            activeDevelopment: number;
          };
        })
      | undefined
  )?.navCounts;

  const myWorkCount =
    navCounts !== undefined
      ? String(navCounts.openTasks)
      : overviewData?.tasks
        ? String(overviewData.tasks.length)
        : undefined;
  const casesCount =
    casesData !== undefined
      ? String(casesData.length)
      : navCounts !== undefined
        ? String(navCounts.activeCases)
        : undefined;
  const employeeCount =
    navCounts !== undefined
      ? String(navCounts.employees)
      : casesData
        ? String(new Set(casesData.map((c) => c.employeeId)).size)
        : undefined;
  const developmentCount =
    navCounts !== undefined
      ? String(navCounts.activeDevelopment)
      : casesData
        ? String(casesData.filter((c) => c.status === 'DEVELOPMENT_IN_PROGRESS').length)
        : undefined;

  const cycleCases = (casesData ?? []).filter((caseItem) => caseItem.status !== 'CANCELLED');
  const cycleStageCount = (stages: string[]) =>
    cycleCases.filter((caseItem) => stages.includes(caseItem.stage)).length;
  const cycleDecisionCount = cycleStageCount(['RECOMMENDATION', 'APPROVAL']);
  const cycleFollowUpCount = cycleStageCount(['FOLLOW_UP']);
  const cycleClosedCount = cycleStageCount(['CLOSED']);
  const cycleDoneCount = cycleDecisionCount + cycleFollowUpCount + cycleClosedCount;
  const cyclePercent = cycleCases.length
    ? Math.round((cycleDoneCount / cycleCases.length) * 100)
    : 0;
  const cycleSegmentPercent = (count: number) =>
    cycleCases.length ? (count / cycleCases.length) * 100 : 0;
  const cycleStages = [
    { key: 'decision', label: 'Decision', count: cycleDecisionCount },
    { key: 'follow-up', label: 'Follow-up', count: cycleFollowUpCount },
    { key: 'closed', label: 'Closed', count: cycleClosedCount },
  ];

  const workspaceItems: SidebarNavItem[] = [];
  if (canAccessRoute(user, 'overview')) {
    workspaceItems.push({ id: 'overview', label: t.overview, icon: LayoutDashboard, path: '/' });
  }
  if (canAccessRoute(user, 'tasks')) {
    workspaceItems.push({
      id: 'tasks',
      label: t.tasks,
      icon: ListTodo,
      count: myWorkCount,
      path: '/tasks',
    });
  }
  if (canAccessRoute(user, 'cases')) {
    workspaceItems.push({
      id: 'cases',
      label: t.cases,
      icon: ClipboardCheck,
      count: casesCount,
      path: '/assessments',
    });
  }
  if (canAccessRoute(user, 'assessor')) {
    workspaceItems.push({
      id: 'assessor',
      label: 'My assessments',
      icon: UserCheck,
      path: '/assessor',
    });
  }
  if (user?.role === 'EMPLOYEE') {
    workspaceItems.push({
      id: 'my-result',
      label: 'My result',
      icon: ClipboardCheck,
      path: '/my-result',
    });
  } else if (canAccessRoute(user, 'employees')) {
    workspaceItems.push({
      id: 'employees',
      label: t.employees,
      icon: Users,
      count: employeeCount,
      path: '/employees',
    });
  }

  const insightItems: SidebarNavItem[] = [];
  if (canAccessRoute(user, 'development')) {
    insightItems.push({
      id: 'development',
      label: t.development,
      icon: TrendingUp,
      count: developmentCount,
      path: '/development',
    });
  }
  if (canAccessRoute(user, 'insights')) {
    insightItems.push({
      id: 'insights',
      label: t.insights,
      icon: BarChart3,
      path: '/insights',
    });
  }
  if (PILOT_FLAGS.calibration && canAccessRoute(user, 'calibration')) {
    insightItems.push({
      id: 'calibration',
      label: t.calibration,
      icon: Scale,
      path: '/calibration',
    });
  }

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
  const isAdmin = canAccessRoute(user, 'admin');

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-header">
        <div className="brand-mark">
          <SghHeartSvg size={26} glow={true} />
        </div>
        <div className="brand-copy">
          <strong>AssessFlow</strong>
          <small>Saudi German Health</small>
        </div>
        <button
          type="button"
          className="icon-button mobile-close"
          aria-label="Close navigation"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>

      <div className="workspace-switch">
        <div className="workspace-icon" aria-hidden="true">
          <Building2 size={19} />
        </div>
        <div className="workspace-copy">
          <strong>Egypt</strong>
          <small>{t.cycle}</small>
        </div>
        <span className="online-dot" aria-hidden="true" />
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

        {insightItems.length > 0 && (
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

        {isAdmin && (
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

      {!collapsed && canSeeCases && (
        <div className="sidebar-cycle">
          <div className="cycle-header">
            <strong>Cycle progress</strong>
            <span className="cycle-live">
              <i aria-hidden="true" />
              Live
            </span>
          </div>
          <div className="cycle-headline">
            <b
              title={`${cycleDoneCount} of ${cycleCases.length} cases at Decision, Follow-up or Closed`}
            >
              {casesData ? `${cyclePercent}%` : '—'}
            </b>
            <small>of {casesData ? cycleCases.length : '—'} cases at decision or later</small>
          </div>
          <div className="cycle-progress" aria-hidden="true">
            {cycleStages.map((stage) => (
              <i
                key={stage.key}
                className={`seg-${stage.key}`}
                style={{ width: `${cycleSegmentPercent(stage.count)}%` }}
              />
            ))}
          </div>
          <ul className="cycle-stages">
            {cycleStages.map((stage) => (
              <li className="cycle-stage" key={stage.key}>
                <small className="cycle-stage-name">
                  <i className={`cycle-swatch seg-${stage.key}`} aria-hidden="true" />
                  {stage.label}
                </small>
                <b>{casesData ? String(stage.count) : '—'}</b>
              </li>
            ))}
          </ul>
          <div className="cycle-footer">
            <button
              type="button"
              className="cycle-view"
              style={{ background: 'transparent', padding: 0 }}
              onClick={() => {
                navigate('/assessments');
                onClose();
              }}
            >
              View cases
              <ArrowRight size={12} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {!collapsed && user && (
        <>
          <button
            type="button"
            className="sidebar-user"
            onClick={() => {
              onClose();
              onOpenProfile?.();
            }}
            title="Open My Profile & Password"
            style={{ width: '100%', textAlign: 'left' }}
          >
            <div className={`avatar ${avatarColor}`}>{initials}</div>
            <div>
              <strong>{user.name}</strong>
              <small>{user.roleTitle}</small>
            </div>
            <ChevronDown size={15} />
          </button>

          <div className="sidebar-mobile-actions">
            {isAdmin && (
              <button
                type="button"
                className="sidebar-mobile-btn"
                onClick={() => {
                  onClose();
                  onOpenSettings?.();
                }}
              >
                <Settings2 size={15} />
                System Settings
              </button>
            )}
            <button
              type="button"
              className="sidebar-mobile-btn signout"
              onClick={() => {
                onClose();
                onLogout?.();
              }}
            >
              <LogOut size={15} />
              Sign out
            </button>
          </div>
        </>
      )}
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
  onOpenProfile,
  activeUser,
  onLogout,
}: {
  t?: Copy;
  onOpenMenu: () => void;
  onToggleCollapse: () => void;
  collapsed: boolean;
  onOpenPalette?: () => void;
  onOpenSettings?: () => void;
  onOpenProfile?: () => void;
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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [userMenuOpen]);

  const user = activeUser ?? null;
  const initials = user?.avatarInitials ?? '?';
  const avatarColor = user?.avatarColor ?? 'avatar-slate';
  const isAdmin = canAccessRoute(user, 'admin');

  return (
    <header className="topbar">
      <button
        type="button"
        className="icon-button mobile-menu"
        onClick={onOpenMenu}
        aria-label="Open navigation"
      >
        <Menu size={21} />
      </button>
      <button
        type="button"
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
        <Search size={18} aria-hidden="true" />
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
        {isAdmin && (
          <button
            type="button"
            className="icon-button settings-button"
            aria-label="System Settings"
            title="System Settings & Health"
            onClick={() => {
              setUserMenuOpen(false);
              onOpenSettings?.();
            }}
          >
            <Settings2 size={19} />
          </button>
        )}

        <div className="topbar-user-wrapper" ref={userMenuRef} style={{ position: 'relative' }}>
          <button
            type="button"
            className="topbar-profile topbar-profile-interactive"
            onClick={() => setUserMenuOpen((prev) => !prev)}
            aria-label={`Signed in as ${user?.name ?? 'User'}. Account options.`}
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
              <div className="user-dropdown-header">
                <div className={`avatar avatar-lg ${avatarColor}`}>{initials}</div>
                <div className="user-dropdown-info">
                  <strong>{user?.name ?? 'User'}</strong>
                  <small>{user?.email ?? ''}</small>
                  <span className="user-role-badge">{user?.roleTitle ?? ''}</span>
                </div>
              </div>

              <div className="user-dropdown-divider" />

              {isAdmin && (
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
                  onOpenProfile?.();
                }}
              >
                <User size={15} />
                My Profile & Password
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
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeUser, setActiveUserState] = useState<AppUser | null>(getSession);

  const collapsed = propCollapsed ?? sidebarCollapsed;
  const mobileOpen = propMobileOpen ?? mobileMenuOpen;
  const t = propT ?? copy;

  useEffect(() => subscribeToAuth((u) => setActiveUserState(u)), []);

  const handleLogout = () => {
    logout();
    queryClient.clear();
    showToast('You have been signed out successfully.', 'success');
    navigate('/login', { replace: true });
  };

  useKeyboardShortcuts({
    onOpenPalette: () => setPaletteOpen(true),
    onOpenShortcuts: () => setShortcutsOpen(true),
  });

  return (
    <div className="app-shell">
      <Sidebar
        collapsed={collapsed && !mobileMenuOpen}
        mobileOpen={mobileOpen}
        t={t}
        onClose={() => setMobileMenuOpen(false)}
        activeUser={activeUser}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenProfile={() => setProfileOpen(true)}
        onLogout={handleLogout}
      />
      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}
      <div className="app-main">
        <OfflineBanner />
        <Topbar
          t={t}
          onOpenMenu={() => setMobileMenuOpen(true)}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
          collapsed={collapsed}
          onOpenPalette={() => setPaletteOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenProfile={() => setProfileOpen(true)}
          activeUser={activeUser}
          onLogout={handleLogout}
        />
        <main className="page-content">{children ?? <Outlet />}</main>
      </div>
      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ShortcutsHelpDialog isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </Suspense>
      )}
      {profileOpen && (
        <Suspense fallback={null}>
          <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
        </Suspense>
      )}
      <BackToTop />
    </div>
  );
}
