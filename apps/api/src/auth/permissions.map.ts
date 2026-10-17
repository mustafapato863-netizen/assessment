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
  CASE_CREATE: ['Requester', 'HR', 'Assessor', 'Admin'],
  CASE_SUBMIT: ['Requester', 'HR', 'Assessor', 'Admin'],

  // Eligibility
  ELIGIBILITY_DECIDE: ['HR', 'Assessor', 'Admin'],
  ELIGIBILITY_OVERRIDE: ['Requester', 'HR', 'Assessor', 'Admin'],

  // Planning
  PLAN_FINALIZE: ['Coordinator', 'HR', 'Assessor', 'Admin'],
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
  EVENT_SCHEDULE: ['Coordinator', 'HR', 'Assessor', 'Admin', 'Requester'],
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
  EVIDENCE_SAVE: ['Assessor', 'PanelLead', 'HR', 'Admin'],
  EVIDENCE_SUBMIT: ['Assessor', 'PanelLead', 'HR', 'Admin'],

  // Result
  RESULT_FINALIZE: ['PanelLead', 'HR', 'Assessor', 'Admin'],
  RESULT_REOPEN: ['Admin'],
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
  RECOMMENDATION_SUBMIT: ['HR', 'Requester', 'Assessor', 'Admin'],
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
  DEVELOPMENT_UPDATE: ['Requester', 'HR', 'Assessor', 'Admin'],
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
  REASSESSMENT_SCHEDULE: ['HR', 'Assessor', 'Admin'],
  CASE_CLOSE: ['HR', 'Assessor', 'Admin'],

  // Attachments (Gate 7 must M3)
  ATTACHMENT_UPLOAD: ['Requester', 'HR', 'Coordinator', 'Assessor', 'PanelLead', 'Admin'],
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
