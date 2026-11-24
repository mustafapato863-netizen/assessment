import type { AccessRole, AccessScope } from './api';

// ---------------------------------------------------------------------------
// AssessFlow Authentication & Client Route Authorization
// ---------------------------------------------------------------------------

export type AppUiRole =
  | 'SYS_ADMIN'
  | 'HR_ADMIN'
  | 'ASSESSOR'
  | 'APPROVER'
  | 'DEV_LEAD'
  | 'MANAGER'
  | 'EMPLOYEE_MANAGER'
  | 'EMPLOYEE';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: AppUiRole;
  backendRoles: AccessRole[];
  roleTitle: string;
  scopeType?: AccessScope;
  scopeValues?: string[];
  actorId: string;
  avatarInitials: string;
  avatarColor: string;
  department: string;
  mustChangePassword?: boolean;
}

export type AppRouteKey =
  | 'overview'
  | 'tasks'
  | 'cases'
  | 'new-case'
  | 'case-detail'
  | 'employees'
  | 'development'
  | 'calibration'
  | 'insights'
  | 'assessor'
  | 'my-result'
  | 'admin';

const SESSION_KEY = 'assessflow:session';

interface StoredSession {
  user: AppUser;
  token: string;
}

type AuthListener = (user: AppUser | null, reason?: 'manual' | 'expired') => void;
const listeners: Set<AuthListener> = new Set();

const ROLE_PRECEDENCE: AccessRole[] = [
  'Admin',
  'HR',
  'Coordinator',
  'Auditor',
  'PanelLead',
  'Assessor',
  'BusinessApprover',
  'Manager',
  'EmployeeManager',
  'Requester',
  'Employee',
];

const ROLE_MAP: Record<AccessRole, AppUiRole> = {
  Admin: 'SYS_ADMIN',
  HR: 'HR_ADMIN',
  Coordinator: 'HR_ADMIN',
  Auditor: 'HR_ADMIN',
  PanelLead: 'ASSESSOR',
  Assessor: 'ASSESSOR',
  BusinessApprover: 'APPROVER',
  Manager: 'MANAGER',
  EmployeeManager: 'EMPLOYEE_MANAGER',
  Requester: 'DEV_LEAD',
  Employee: 'EMPLOYEE',
};

const ROLE_TITLES: Record<AccessRole, string> = {
  Admin: 'System Administrator',
  HR: 'HR Partner',
  Coordinator: 'Assessment Coordinator',
  Auditor: 'Governance Auditor',
  PanelLead: 'Panel Lead',
  Assessor: 'Assessor',
  BusinessApprover: 'Business Approver',
  Manager: 'Line Manager',
  EmployeeManager: 'Employee Manager',
  Requester: 'Case Requester',
  Employee: 'Employee',
};

const UI_ROLE_DEFAULT_BACKEND: Record<AppUiRole, AccessRole[]> = {
  SYS_ADMIN: ['Admin'],
  HR_ADMIN: ['HR'],
  ASSESSOR: ['Assessor'],
  APPROVER: ['BusinessApprover'],
  DEV_LEAD: ['Requester'],
  MANAGER: ['Manager'],
  EMPLOYEE_MANAGER: ['EmployeeManager'],
  EMPLOYEE: ['Employee'],
};

function readStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (!parsed || !parsed.user || !parsed.token) return null;
    if (!Array.isArray(parsed.user.backendRoles) || parsed.user.backendRoles.length === 0) {
      parsed.user.backendRoles = UI_ROLE_DEFAULT_BACKEND[parsed.user.role] ?? [];
    }
    return parsed as StoredSession;
  } catch {
    return null;
  }
}

export function getSession(): AppUser | null {
  return readStoredSession()?.user ?? null;
}

export function getAuthToken(): string | null {
  return readStoredSession()?.token ?? null;
}

export function isAuthenticated(): boolean {
  return getSession() !== null;
}

export function hasBackendRole(user: AppUser | null, allowed: readonly AccessRole[]): boolean {
  if (!user) return false;
  const effectiveRoles =
    Array.isArray(user.backendRoles) && user.backendRoles.length > 0
      ? user.backendRoles
      : (UI_ROLE_DEFAULT_BACKEND[user.role] ?? []);
  return effectiveRoles.some((r) => allowed.includes(r));
}

export function canAccessRoute(user: AppUser | null, route: AppRouteKey): boolean {
  if (!user) return false;
  switch (route) {
    case 'overview':
      return !['APPROVER', 'ASSESSOR', 'EMPLOYEE'].includes(user.role);
    case 'tasks':
    case 'cases':
    case 'case-detail':
      return user.role !== 'EMPLOYEE';
    case 'new-case':
      return hasBackendRole(user, ['Requester', 'Assessor', 'Admin']);
    case 'employees':
    case 'development':
    case 'insights':
      return !['ASSESSOR', 'EMPLOYEE'].includes(user.role);
    case 'calibration':
      return hasBackendRole(user, ['HR', 'Admin', 'Assessor', 'PanelLead', 'Manager', 'Auditor']);
    case 'assessor':
      return hasBackendRole(user, ['Assessor', 'PanelLead', 'HR', 'Admin']);
    case 'my-result':
      return true;
    case 'admin':
      return hasBackendRole(user, ['Admin']);
    default:
      return false;
  }
}

export function defaultHomeForUser(user: AppUser | null): string {
  if (!user) return '/login';
  if (user.mustChangePassword) return '/change-password';
  if (user.role === 'ASSESSOR') return '/assessor';
  if (user.role === 'EMPLOYEE') return '/my-result';
  if (user.role === 'APPROVER') return '/tasks';
  return '/';
}

export async function login(email: string, password: string): Promise<AppUser> {
  const trimmedEmail = email.trim().toLowerCase();
  const { api } = await import('./api');
  const response = await api.authenticate(trimmedEmail, password);
  const account = response.user;
  const primaryRole =
    ROLE_PRECEDENCE.find((candidate) => account.roles.includes(candidate)) ??
    account.roles[0] ??
    'Employee';
  const uiRole = ROLE_MAP[primaryRole] ?? 'DEV_LEAD';
  const user: AppUser = {
    id: account.id,
    name: account.name,
    email: account.email,
    role: uiRole,
    backendRoles: account.roles,
    roleTitle: ROLE_TITLES[primaryRole] ?? primaryRole,
    scopeType: account.scopeType,
    scopeValues: account.scopeValues,
    actorId: account.id,
    avatarInitials: account.name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0] ?? '')
      .join('')
      .toUpperCase()
      .slice(0, 2),
    avatarColor: 'avatar-cyan',
    department: account.scopeValues[0] ?? 'Saudi German Health',
    mustChangePassword: account.mustChangePassword ?? false,
  };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user, token: response.token }));
  } catch {
    // Session listeners still receive user when storage is restricted.
  }
  listeners.forEach((fn) => fn(user));
  return user;
}

export function getActiveUser(): AppUser {
  const session = getSession();
  if (!session) {
    return {
      id: 'anonymous',
      name: 'Guest',
      email: '',
      role: 'EMPLOYEE',
      backendRoles: [],
      roleTitle: 'Guest',
      actorId: 'anonymous',
      avatarInitials: '?',
      avatarColor: 'avatar-slate',
      department: '',
    };
  }
  return session;
}

export function markTemporaryPasswordChanged(newToken?: string): void {
  const stored = readStoredSession();
  if (!stored) return;
  const updated: AppUser = { ...stored.user, mustChangePassword: false };
  const nextToken = newToken?.trim() ? newToken : stored.token;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user: updated, token: nextToken }));
  } catch {
    // Ignore storage errors in private contexts.
  }
  listeners.forEach((fn) => fn(updated));
}

export function logout(reason: 'manual' | 'expired' = 'manual'): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
  listeners.forEach((fn) => fn(null, reason));
}

export function subscribeToAuth(fn: AuthListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
