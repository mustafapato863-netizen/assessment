// ---------------------------------------------------------------------------
// AssessFlow Real Authentication
// ---------------------------------------------------------------------------
// Credentials are stored client-side for demo/MVP. Replace with a real JWT
// backend when deploying to production.
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

// -----------------------------------------------------------------------
// Registered accounts (in a real deployment these come from the backend)
// -----------------------------------------------------------------------
export const REGISTERED_USERS: Array<AppUser & { passwordHash: string }> = [
  {
    id: 'user-admin',
    email: 'admin@me.com',
    // Password stored as plain text for MVP demo only — replace with bcrypt
    passwordHash: 'Admin@123456',
    name: 'Admin',
    role: 'SYS_ADMIN',
    roleTitle: 'System Administrator',
    actorId: 'admin',
    avatarInitials: 'AD',
    avatarColor: 'avatar-purple',
    department: 'Security & Governance',
  },
];

const SESSION_KEY = 'assessflow:session';
const DEVELOPMENT_ADMIN_EMAIL = 'admin@me.com';
const DEVELOPMENT_ADMIN_PASSWORD = 'Admin@123456';

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
    if ('user' in parsed && parsed.user && parsed.token) return parsed.user;
    // Validate that the stored user still exists in registered list
    const legacyUser = parsed as AppUser;
    const found = REGISTERED_USERS.find((u) => u.id === legacyUser.id);
    if (!found) return null;
    return legacyUser;
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
    // Keep the original local demo administrator usable while the first company
    // account is provisioned. This exception only works on localhost.
    if (
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
      trimmedEmail === DEVELOPMENT_ADMIN_EMAIL &&
      password === DEVELOPMENT_ADMIN_PASSWORD
    ) {
      const account = REGISTERED_USERS[0]!;
      const { passwordHash: _passwordHash, ...user } = account;
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      } catch {
        // ignore storage errors
      }
      listeners.forEach((fn) => fn(user));
      return user;
    }
    throw error instanceof Error
      ? error
      : new Error('Invalid email or password. Please try again.');
  }
}

// ---------------------------------------------------------------------------
// Register a new user (admin-driven)
// ---------------------------------------------------------------------------
export function registerUser(
  email: string,
  password: string,
  name: string,
  role: AppUser['role'],
  roleTitle: string,
  department: string,
): AppUser {
  const existing = REGISTERED_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    throw new Error('An account with this email already exists.');
  }
  const initials = name
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
  const colors = ['avatar-purple', 'avatar-blue', 'avatar-amber', 'avatar-emerald', 'avatar-slate'];
  const color = colors[REGISTERED_USERS.length % colors.length] ?? 'avatar-purple';
  const newUser = {
    id: `user-${Date.now()}`,
    email,
    passwordHash: password,
    name,
    role,
    roleTitle,
    actorId: email.split('@')[0] ?? 'user',
    avatarInitials: initials,
    avatarColor: color,
    department,
  };
  REGISTERED_USERS.push(newUser);
  const { passwordHash: _, ...publicUser } = newUser;
  return publicUser;
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
