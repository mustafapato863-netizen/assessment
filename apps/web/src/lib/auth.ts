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
  role: 'SYS_ADMIN' | 'HR_ADMIN' | 'ASSESSOR' | 'APPROVER' | 'DEV_LEAD';
  roleTitle: string;
  actorId: string;
  avatarInitials: string;
  avatarColor: string;
  department: string;
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

type AuthListener = (user: AppUser | null) => void;
const listeners: Set<AuthListener> = new Set();

// ---------------------------------------------------------------------------
// Read session
// ---------------------------------------------------------------------------
export function getSession(): AppUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppUser;
    // Validate that the stored user still exists in registered list
    const found = REGISTERED_USERS.find((u) => u.id === parsed.id);
    if (!found) return null;
    return parsed;
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
export function login(email: string, password: string): AppUser {
  const trimmedEmail = email.trim().toLowerCase();
  const account = REGISTERED_USERS.find(
    (u) => u.email.toLowerCase() === trimmedEmail && u.passwordHash === password,
  );
  if (!account) {
    throw new Error('Invalid email or password. Please try again.');
  }
  // Store session (without password)
  const { passwordHash: _, ...user } = account;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } catch {
    // ignore storage errors
  }
  listeners.forEach((fn) => fn(user));
  return user;
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
