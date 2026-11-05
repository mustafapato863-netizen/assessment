// ---------------------------------------------------------------------------
// AssessFlow Real Authentication
// ---------------------------------------------------------------------------
// Sign-in is checked by the API (POST /auth/login). This module only keeps the
// signed-in user and its token in localStorage.
// ---------------------------------------------------------------------------

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role:
    | 'SYS_ADMIN'
    | 'HR_ADMIN'
    | 'ASSESSOR'
    | 'APPROVER'
    | 'DEV_LEAD'
    | 'MANAGER'
    | 'EMPLOYEE_MANAGER'
    | 'EMPLOYEE';
  roleTitle: string;
  actorId: string;
  avatarInitials: string;
  avatarColor: string;
  department: string;
  mustChangePassword?: boolean;
}

const SESSION_KEY = 'assessflow:session';

interface StoredSession {
  user: AppUser;
  token: string;
}

type AuthListener = (user: AppUser | null) => void;
const listeners: Set<AuthListener> = new Set();

// ---------------------------------------------------------------------------
// Read session
// ---------------------------------------------------------------------------
export function getSession(): AppUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppUser | StoredSession;
    // Only a session issued by the API (with its token) counts as signed in.
    return 'user' in parsed && parsed.user && parsed.token ? parsed.user : null;
  } catch {
    return null;
  }
}

export function getAuthToken(): string | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppUser | StoredSession;
    return 'user' in parsed && parsed.token ? parsed.token : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Check if a user is authenticated
// ---------------------------------------------------------------------------
export function isAuthenticated(): boolean {
  return getSession() !== null;
}

// ---------------------------------------------------------------------------
// Login with email + password
// Returns the user on success, throws on failure
// ---------------------------------------------------------------------------
export async function login(email: string, password: string): Promise<AppUser> {
  const trimmedEmail = email.trim().toLowerCase();
  try {
    const { api } = await import('./api');
    const response = await api.authenticate(trimmedEmail, password);
    const account = response.user;
    const roleMap: Record<string, AppUser['role']> = {
      Admin: 'SYS_ADMIN',
      HR: 'HR_ADMIN',
      Assessor: 'ASSESSOR',
      PanelLead: 'ASSESSOR',
      BusinessApprover: 'APPROVER',
      Manager: 'MANAGER',
      EmployeeManager: 'EMPLOYEE_MANAGER',
      Requester: 'DEV_LEAD',
      Coordinator: 'HR_ADMIN',
      Auditor: 'HR_ADMIN',
      Employee: 'EMPLOYEE',
    };
    const role = account.roles.find((candidate) => candidate in roleMap) ?? 'Employee';
    const user: AppUser = {
      id: account.id,
      name: account.name,
      email: account.email,
      role: roleMap[role] ?? 'DEV_LEAD',
      roleTitle: role === 'Admin' ? 'System Administrator' : role,
      actorId: account.id,
      avatarInitials: account.name
        .split(/\s+/)
        .map((part) => part[0] ?? '')
        .join('')
        .toUpperCase()
        .slice(0, 2),
      avatarColor: 'avatar-purple',
      department: account.scopeValues[0] ?? 'Saudi German Health',
      mustChangePassword: account.mustChangePassword ?? false,
    };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ user, token: response.token }));
    } catch {
      // The session remains available for this page even if storage is disabled.
    }
    listeners.forEach((fn) => fn(user));
    return user;
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error('Invalid email or password. Please try again.');
  }
}

// ---------------------------------------------------------------------------
// Get active user for API headers (returns current session or throws)
// ---------------------------------------------------------------------------
export function getActiveUser(): AppUser {
  const session = getSession();
  if (!session) {
    // Return a minimal fallback for non-authenticated renders
    return {
      id: 'anonymous',
      name: 'Guest',
      email: '',
      role: 'HR_ADMIN',
      roleTitle: 'Guest',
      actorId: 'anonymous',
      avatarInitials: '?',
      avatarColor: 'avatar-slate',
      department: '',
    };
  }
  return session;
}

export function markTemporaryPasswordChanged(): void {
  const session = getSession();
  if (!session) return;
  const updated = { ...session, mustChangePassword: false };
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    const parsed = raw ? (JSON.parse(raw) as AppUser | StoredSession) : null;
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify(parsed && 'user' in parsed ? { ...parsed, user: updated } : updated),
    );
  } catch {
    // Keep the in-memory caller flow usable when browser storage is unavailable.
  }
  listeners.forEach((fn) => fn(updated));
}

// ---------------------------------------------------------------------------
// Sign out
// ---------------------------------------------------------------------------
export function logout(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
  listeners.forEach((fn) => fn(null));
}

// ---------------------------------------------------------------------------
// Subscribe to auth state changes
// ---------------------------------------------------------------------------
export function subscribeToAuth(fn: AuthListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
