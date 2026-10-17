import { AppRole } from './auth.types';

/**
 * Route-level permission mappings derived directly from:
 * AssessFlow_System_Design_Pack_v1.0/08_AssessFlow_Permissions_RACI_Matrix_v1.0.xlsx
 *
 * App roles:
 * - Requester: Technical Manager / Case Initiator
 * - Manager: Managerial review and direct-report workflow
 * - HR: HR / Talent Administrator, HR Process Owner, HR Approver
 * - Coordinator: Assessment Coordinator
 * - Assessor: Assessment Panel Member
 * - PanelLead: Lead Assessor / Panel Chair
 * - BusinessApprover: Business Approver in approval route
 * - Admin: System Administrator
 * - Auditor: Read-only Auditor
 * - Employee: Self-service access to released information
 */
export const ROUTE_PERMISSIONS = {
  // Read / Overview / Tasks
  OVERVIEW: [
    'Requester',
    'Manager',
    'HR',
    'Coordinator',
    'Assessor',
    'PanelLead',
    'BusinessApprover',
    'Admin',
    'Auditor',
  ],
  TASKS: [
    'Requester',
    'Manager',
    'HR',
    'Coordinator',
    'Assessor',
    'PanelLead',
    'BusinessApprover',
    'Admin',
    'Auditor',
  ],
  CASE_LIST: [
    'Requester',
    'Manager',
    'EmployeeManager',
    'HR',
    'Coordinator',
    'Assessor',
    'PanelLead',
    'BusinessApprover',
    'Admin',
    'Auditor',
  ],
  CASE_GET: [
    'Requester',
    'Manager',
    'EmployeeManager',
    'HR',
    'Coordinator',
    'Assessor',
    'PanelLead',
    'BusinessApprover',
    'Admin',
    'Auditor',
  ],

  // Case Lifecycle: Create & Submit
  // Access model (2026-10-17): Assessor and Admin run the case workflow; managers
  // (Requester) may raise requests for their own team; everyone else reads in scope.
  CASE_CREATE: ['Requester', 'Assessor', 'Admin'],
  CASE_SUBMIT: ['Requester', 'Assessor', 'Admin'],

  // Eligibility
  ELIGIBILITY_DECIDE: ['Assessor', 'Admin'],
  ELIGIBILITY_OVERRIDE: ['Assessor', 'Admin'],

  // Planning
  PLAN_FINALIZE: ['Assessor', 'Admin'],
  PLAN_GET: [
    'Coordinator',
    'Assessor',
    'HR',
    'PanelLead',
    'Requester',
    'Manager',
    'EmployeeManager',
    'Admin',
    'Auditor',
  ],

  // Events
  EVENT_SCHEDULE: ['Assessor', 'Admin'],
  EVENT_LIST: [
    'Coordinator',
    'Assessor',
    'PanelLead',
    'HR',
    'Admin',
    'Requester',
    'Manager',
    'EmployeeManager',
    'Auditor',
  ],

  // Evidence
  // Panel leads may record evidence only for sessions they are assigned to.
  EVIDENCE_SAVE: ['Assessor', 'PanelLead', 'Admin'],
  EVIDENCE_SUBMIT: ['Assessor', 'PanelLead', 'Admin'],

  // Result
  RESULT_FINALIZE: ['Assessor', 'Admin'],
  // Reopening requires a written reason and is audited.
  RESULT_REOPEN: ['Assessor', 'Admin'],
  RESULT_GET: [
    'Manager',
    'EmployeeManager',
    'PanelLead',
    'Assessor',
    'Coordinator',
    'HR',
    'BusinessApprover',
    'Requester',
    'Admin',
    'Auditor',
    'Employee',
  ],

  // Recommendation
  RECOMMENDATION_SUBMIT: ['Assessor', 'Admin'],
  RECOMMENDATION_GET: [
    'Assessor',
    'HR',
    'Manager',
    'EmployeeManager',
    'BusinessApprover',
    'PanelLead',
    'Requester',
    'Coordinator',
    'Admin',
    'Auditor',
  ],

  // Approval
  // Assessors may not approve: segregation of duties (Gate 1 self-approval ban).
  APPROVAL_DECIDE: ['BusinessApprover', 'HR', 'Admin'],
  APPROVAL_LIST: [
    'Assessor',
    'BusinessApprover',
    'HR',
    'Requester',
    'Manager',
    'EmployeeManager',
    'Admin',
    'Auditor',
  ],

  // Development
  DEVELOPMENT_UPDATE: ['Assessor', 'Admin'],
  DEVELOPMENT_GET: [
    'Assessor',
    'Requester',
    'HR',
    'Manager',
    'EmployeeManager',
    'Coordinator',
    'PanelLead',
    'BusinessApprover',
    'Admin',
    'Auditor',
  ],

  // Reassessment & Closure
  REASSESSMENT_SCHEDULE: ['Assessor', 'Admin'],
  CASE_CLOSE: ['Assessor', 'Admin'],

  // Attachments (Gate 7 must M3)
  ATTACHMENT_UPLOAD: ['Requester', 'Assessor', 'PanelLead', 'Admin'],
  ATTACHMENT_READ: [
    'Requester',
    'HR',
    'Manager',
    'Coordinator',
    'Assessor',
    'PanelLead',
    'BusinessApprover',
    'Admin',
    'Auditor',
  ],
} as const satisfies Record<string, readonly AppRole[]>;
