export type AppRole =
  | 'Requester'
  | 'HR'
  | 'Coordinator'
  | 'Assessor'
  | 'PanelLead'
  | 'BusinessApprover'
  | 'Admin'
  | 'Auditor';

export const APP_ROLES: readonly AppRole[] = [
  'Requester',
  'HR',
  'Coordinator',
  'Assessor',
  'PanelLead',
  'BusinessApprover',
  'Admin',
  'Auditor',
] as const;

export interface AuthActor {
  id: string;
  name: string;
  roles: AppRole[];
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
  ],
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
    case 'manager':
      return 'Requester';

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
