import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError, getBaseUrl } from './api';
import { canAccessRoute, defaultHomeForUser, hasBackendRole, type AppUser } from './auth';
import { downloadCsv, formatDate, formatFileSize, formatRelativeTime, initials } from './format';
import { queryKeys } from './query-keys';

function makeUser(overrides: Partial<AppUser> = {}): AppUser {
  return {
    id: 'user-1',
    name: 'Test User',
    email: 'test@saudigerman.com',
    role: 'SYS_ADMIN',
    backendRoles: ['Admin'],
    roleTitle: 'System Administrator',
    actorId: 'user-1',
    avatarInitials: 'TU',
    avatarColor: '#0084ce',
    department: 'HR',
    scopeType: 'ORGANIZATION',
    mustChangePassword: false,
    ...overrides,
  };
}

describe('format utilities', () => {
  it('computes initials cleanly across empty, single, and multi-word names', () => {
    expect(initials(null)).toBe('?');
    expect(initials('   ')).toBe('?');
    expect(initials('Amina')).toBe('AM');
    expect(initials('Amina Al-Mansoor')).toBe('AA');
    expect(initials('Dr. Tariq Al Rashid')).toBe('DR');
  });

  it('formats dates, sizes, and relative timestamps safely', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('not-a-date')).toBe('—');
    expect(formatDate('2026-06-15T12:00:00.000Z')).toContain('2026');

    expect(formatFileSize(-1)).toBe('—');
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(2 * 1024 * 1024)).toBe('2.00 MB');

    expect(formatRelativeTime(undefined)).toBe('—');
    expect(formatRelativeTime(new Date().toISOString())).toBe('Just now');
  });

  it('escapes formula-injection prefixes in downloadCsv exports', async () => {
    let capturedBlob: Blob | undefined;
    const clicked = vi.fn();
    const anchor = {
      href: '',
      download: '',
      style: { display: '' },
      click: clicked,
    };

    vi.stubGlobal('URL', {
      createObjectURL: vi.fn((blob: Blob) => {
        capturedBlob = blob;
        return 'blob:test';
      }),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal('document', {
      createElement: vi.fn(() => anchor),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
    });
    vi.stubGlobal('window', {
      setTimeout: vi.fn((cb: () => void) => {
        cb();
        return 1;
      }),
    });

    downloadCsv('report.csv', ['Name', 'Formula'], [['=CMD()', '+1+1"quoted']]);

    expect(clicked).toHaveBeenCalledOnce();
    expect(anchor.download).toBe('report.csv');
    expect(capturedBlob).toBeDefined();
    const csvText = await capturedBlob!.text();
    expect(csvText).toContain(`"'=CMD()","'+1+1""quoted"`);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });
});

describe('auth role and route helpers', () => {
  it('routes each role to its safe default home without redirect loops', () => {
    expect(defaultHomeForUser(null)).toBe('/login');
    expect(defaultHomeForUser(makeUser({ mustChangePassword: true }))).toBe('/change-password');
    expect(defaultHomeForUser(makeUser({ role: 'ASSESSOR', backendRoles: ['Assessor'] }))).toBe(
      '/assessor',
    );
    expect(defaultHomeForUser(makeUser({ role: 'EMPLOYEE', backendRoles: ['Employee'] }))).toBe(
      '/my-result',
    );
    expect(
      defaultHomeForUser(makeUser({ role: 'APPROVER', backendRoles: ['BusinessApprover'] })),
    ).toBe('/tasks');
    expect(defaultHomeForUser(makeUser({ role: 'SYS_ADMIN', backendRoles: ['Admin'] }))).toBe('/');
  });

  it('aligns canAccessRoute with backend RBAC expectations', () => {
    const approver = makeUser({ role: 'APPROVER', backendRoles: ['BusinessApprover'] });
    const assessor = makeUser({ role: 'ASSESSOR', backendRoles: ['Assessor'] });
    const employee = makeUser({ role: 'EMPLOYEE', backendRoles: ['Employee'] });
    const hr = makeUser({ role: 'HR_ADMIN', backendRoles: ['HR'] });

    expect(canAccessRoute(null, 'overview')).toBe(false);
    expect(canAccessRoute(approver, 'overview')).toBe(false);
    expect(canAccessRoute(approver, 'tasks')).toBe(true);
    expect(canAccessRoute(assessor, 'assessor')).toBe(true);
    expect(canAccessRoute(assessor, 'employees')).toBe(false);
    expect(canAccessRoute(employee, 'my-result')).toBe(true);
    expect(canAccessRoute(employee, 'cases')).toBe(false);
    expect(canAccessRoute(hr, 'admin')).toBe(false);
    expect(canAccessRoute(hr, 'calibration')).toBe(true);
    expect(
      hasBackendRole(makeUser({ backendRoles: ['PanelLead'] }), ['PanelLead', 'Assessor']),
    ).toBe(true);
  });
});

describe('query keys & api error model', () => {
  it('produces stable hierarchical query keys', () => {
    expect(queryKeys.caseAttachments('c-1')).toEqual(['case', 'c-1', 'attachments']);
    expect(queryKeys.adminRolesMatrix()).toEqual(['admin', 'roles-matrix']);
    expect(queryKeys.healthReady()).toEqual(['health', 'ready']);
  });

  it('exposes structured metadata on ApiRequestError and safe relative API base URL', () => {
    const err = new ApiRequestError(
      'Too many requests',
      'RATE_LIMITED',
      { email: ['Invalid'] },
      undefined,
      null,
      429,
      'corr-123',
      30,
    );
    expect(err.status).toBe(429);
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.correlationId).toBe('corr-123');
    expect(err.retryAfterSeconds).toBe(30);
    expect(getBaseUrl().endsWith('/api/v1/assessflow')).toBe(true);
    expect(getBaseUrl().endsWith('/')).toBe(false);
  });
});
