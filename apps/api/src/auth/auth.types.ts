export type AppRole =
  | 'Requester'
  | 'Manager'
  | 'HR'
  | 'Coordinator'
  | 'Assessor'
  | 'PanelLead'
  | 'BusinessApprover'
  | 'Admin'
  | 'Auditor'
  | 'Employee'
  | 'EmployeeManager';

export const APP_ROLES: readonly AppRole[] = [
  'Requester',
  'Manager',
  'HR',
  'Coordinator',
  'Assessor',
  'PanelLead',
  'BusinessApprover',
  'Admin',
  'Auditor',
  'Employee',
  'EmployeeManager',
] as const;

export interface AuthActor {
  id: string;
  name: string;
  email?: string;
  roles: AppRole[];
  scopeType?: string;
  scopeValues?: string[];
  mustChangePassword?: boolean;
}

export const DEFAULT_STUB_ACTOR: AuthActor = {
  id: 'demo-user',
  name: 'Demo user',
  roles: [
    'Requester',
    'HR',
    'Coordinator',
    'Assessor',
    'PanelLead',
    'BusinessApprover',
    'Admin',
    'Auditor',
    'Manager',
    'Employee',
  ],
  scopeType: 'ORGANIZATION',
  scopeValues: [],
};

/**
 * Normalizes case/naming variants from Entra app roles, groups, or headers
 * into canonical AssessFlow AppRole strings.
 */
export function normalizeRole(raw: string): AppRole | undefined {
  if (typeof raw !== 'string') return undefined;
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/[-_ ]+/g, '');

  switch (normalized) {
    case 'admin':
    case 'sysadmin':
    case 'systemadmin':
    case 'systemadministrator':
    case 'administrator':
      return 'Admin';

    case 'hr':
    case 'hrtalent':
    case 'hrtalentadmin':
    case 'hrtalentadministrator':
    case 'hrprocessowner':
    case 'hrapprover':
    case 'talent':
      return 'HR';

    case 'requester':
    case 'techmanager':
    case 'technicalmanager':
      return 'Requester';

    case 'manager':
    case 'managerial':
      return 'Manager';

    case 'employeemanager':
    case 'departmentmanager':
      return 'EmployeeManager';

    case 'employee':
    case 'selfservice':
      return 'Employee';

    case 'coordinator':
    case 'assessmentcoordinator':
      return 'Coordinator';

    case 'assessor':
      return 'Assessor';

    case 'panellead':
    case 'leadassessor':
      return 'PanelLead';

    case 'businessapprover':
    case 'approver':
      return 'BusinessApprover';

    case 'auditor':
    case 'audit':
    case 'readonly':
    case 'readonlyauditor':
      return 'Auditor';

    default:
      return undefined;
  }
}
