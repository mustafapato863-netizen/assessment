import { createHmac } from 'node:crypto';

/**
 * E2E Test API Client and Seeding Utilities
 *
 * Assumptions:
 * - API Port: 3000 (http://localhost:3000/api/v1/assessflow)
 * - Web Port: 5174 (http://localhost:5174)
 * - PostgreSQL Port: 5433 (host port for asses_db)
 */

export const API_BASE_URL = process.env.API_URL ?? 'http://localhost:3000/api/v1/assessflow';
export const WEB_BASE_URL = process.env.WEB_URL ?? 'http://localhost:5174';

function signDevToken(actor: {
  id: string;
  name: string;
  email: string;
  roles: string[];
  scopeType: string;
  scopeValues: string[];
}): string {
  const secret =
    process.env.AUTH_JWT_SECRET?.trim() ||
    'assessflow-local-development-secret-change-before-deployment';
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ ...actor, iat: now, exp: now + 8 * 60 * 60 }),
  ).toString('base64url');
  const content = `${header}.${payload}`;
  const sig = createHmac('sha256', secret).update(content).digest('base64url');
  return `${content}.${sig}`;
}

export interface DemoSessionOverrides {
  id?: string;
  name?: string;
  email?: string;
  role?:
    | 'SYS_ADMIN'
    | 'HR_ADMIN'
    | 'MANAGER'
    | 'DEV_LEAD'
    | 'ASSESSOR'
    | 'APPROVER'
    | 'EMPLOYEE_MANAGER'
    | 'EMPLOYEE';
  backendRoles?: string[];
  department?: string;
  actorId?: string;
  mustChangePassword?: boolean;
}

/**
 * Pre-seeds localStorage['assessflow:session'] with a signed local JWT before page load
 * so protected SPA routes render cleanly under BrowserRouter.
 */
export async function signInDemoSession(
  page: { addInitScript: (fn: (arg: string) => void, arg: string) => Promise<void> },
  overrides: DemoSessionOverrides = {},
) {
  const id = overrides.id ?? 'e2e-admin';
  const name = overrides.name ?? 'Dr. Nadia Selim';
  const email = overrides.email ?? 'admin@saudigerman.com';
  const backendRoles = overrides.backendRoles ?? [
    'Admin',
    'HR',
    'Assessor',
    'PanelLead',
    'BusinessApprover',
    'Coordinator',
    'Requester',
    'Manager',
  ];
  const token = signDevToken({
    id,
    name,
    email,
    roles: backendRoles,
    scopeType: 'ORGANIZATION',
    scopeValues: [],
  });
  const payload = JSON.stringify({
    user: {
      id,
      name,
      email,
      role: overrides.role ?? 'SYS_ADMIN',
      backendRoles,
      roleTitle: 'System Administrator',
      department: overrides.department ?? 'Clinical Operations',
      scopeType: 'ORGANIZATION',
      scopeValues: [],
      actorId: overrides.actorId ?? id,
      avatarInitials: 'NS',
      avatarColor: '#0084ce',
      mustChangePassword: overrides.mustChangePassword ?? false,
    },
    token,
  });
  await page.addInitScript((serialized: string) => {
    window.localStorage.setItem('assessflow:session', serialized);
  }, payload);
}

export interface CreateCasePayload {
  employeeId?: string;
  employeeName: string;
  department: string;
  currentRole: string;
  currentLevel: string;
  assessmentReason: 'PROMOTION' | 'INTERNAL_MOBILITY' | 'ROLE_REALIGNMENT';
  targetRole: string;
  targetLevel: string;
  justification: string;
  priority?: 'NORMAL' | 'HIGH';
}

export async function createCaseViaApi(
  payload?: Partial<CreateCasePayload>,
  actorId = 'e2e-requester',
) {
  const body: CreateCasePayload = {
    employeeId: `emp-${Date.now()}`,
    employeeName: `Test Candidate ${Date.now().toString().slice(-4)}`,
    department: 'Engineering',
    currentRole: 'Software Engineer',
    currentLevel: 'L3',
    assessmentReason: 'PROMOTION',
    targetRole: 'Senior Platform Engineer',
    targetLevel: 'L4',
    justification:
      'Consistent high delivery and cross-functional leadership in platform engineering.',
    priority: 'NORMAL',
    ...payload,
  };

  const response = await fetch(`${API_BASE_URL}/cases`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-actor-id': actorId,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create case via API (${response.status}): ${errorText}`);
  }

  return response.json();
}

export async function submitCaseViaApi(
  caseId: string,
  expectedVersion = 1,
  actorId = 'e2e-requester',
) {
  const response = await fetch(`${API_BASE_URL}/cases/${caseId}/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-actor-id': actorId,
    },
    body: JSON.stringify({ expectedVersion }),
  });

  return {
    status: response.status,
    data: await response.json(),
  };
}

export async function decideEligibilityViaApi(
  caseId: string,
  decision: 'ELIGIBLE' | 'NOT_ELIGIBLE',
  expectedVersion: number,
  reason?: string,
  actorId = 'e2e-hr',
) {
  const response = await fetch(`${API_BASE_URL}/cases/${caseId}/eligibility/decision`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-actor-id': actorId,
    },
    body: JSON.stringify({ decision, expectedVersion, reason }),
  });

  return {
    status: response.status,
    data: await response.json(),
  };
}

export async function finalizePlanViaApi(
  caseId: string,
  expectedVersion: number,
  methods = [{ methodCode: 'CBI', methodLabel: 'CBI', required: true }],
  leadAssessor = 'Dr. Lead Assessor',
  actorId = 'e2e-coordinator',
) {
  const response = await fetch(`${API_BASE_URL}/cases/${caseId}/plan/finalize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-actor-id': actorId,
    },
    body: JSON.stringify({ expectedVersion, methods, leadAssessor }),
  });

  return {
    status: response.status,
    data: await response.json(),
  };
}

export async function scheduleEventViaApi(
  caseId: string,
  expectedVersion: number,
  startsAt = new Date(Date.now() + 86400000).toISOString(),
  location = 'Room 101',
  actorId = 'e2e-coordinator',
) {
  const response = await fetch(`${API_BASE_URL}/cases/${caseId}/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-actor-id': actorId,
    },
    body: JSON.stringify({ expectedVersion, startsAt, location }),
  });

  return {
    status: response.status,
    data: await response.json(),
  };
}
