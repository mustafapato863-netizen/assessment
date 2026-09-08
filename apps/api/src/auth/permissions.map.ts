import { AppRole } from './auth.types';

/**
 * Route-level permission mappings derived directly from:
 * AssessFlow_System_Design_Pack_v1.0/08_AssessFlow_Permissions_RACI_Matrix_v1.0.xlsx
 *
 * App roles:
 * - Requester: Technical Manager / Case Initiator
 * - HR: HR / Talent Administrator, HR Process Owner, HR Approver
 * - Coordinator: Assessment Coordinator
 * - Assessor: Assessment Panel Member
 * - PanelLead: Lead Assessor / Panel Chair
 * - BusinessApprover: Business Approver in approval route
 * - Admin: System Administrator
 * - Auditor: Read-only Auditor
 */
export const ROUTE_PERMISSIONS = {
  // Read / Overview / Tasks
  OVERVIEW: [
    'Requester',
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
    'HR',
    'Coordinator',
    'Assessor',
    'PanelLead',
    'BusinessApprover',
    'Admin',
    'Auditor',
  ],

  // Case Lifecycle: Create & Submit
  CASE_CREATE: ['Requester', 'HR', 'Admin'],
  CASE_SUBMIT: ['Requester', 'HR', 'Admin'],

  // Eligibility
  ELIGIBILITY_DECIDE: ['HR', 'Admin'],
  ELIGIBILITY_OVERRIDE: ['Requester', 'HR', 'Admin'],

  // Planning
  PLAN_FINALIZE: ['Coordinator', 'HR', 'Admin'],
  PLAN_GET: ['Coordinator', 'HR', 'PanelLead', 'Requester', 'Admin', 'Auditor'],

  // Events
  EVENT_SCHEDULE: ['Coordinator', 'HR', 'Admin', 'Requester'],
  EVENT_LIST: ['Coordinator', 'Assessor', 'PanelLead', 'HR', 'Admin', 'Requester', 'Auditor'],

  // Evidence
  EVIDENCE_SAVE: ['Assessor', 'PanelLead', 'HR', 'Admin'],
  EVIDENCE_SUBMIT: ['Assessor', 'PanelLead', 'HR', 'Admin'],

  // Result
  RESULT_FINALIZE: ['PanelLead', 'HR', 'Admin'],
  RESULT_REOPEN: ['HR', 'Admin'],
  RESULT_GET: [
    'PanelLead',
    'Assessor',
    'Coordinator',
    'HR',
    'BusinessApprover',
    'Requester',
    'Admin',
    'Auditor',
  ],

  // Recommendation
  RECOMMENDATION_SUBMIT: ['HR', 'Requester', 'Admin'],
  RECOMMENDATION_GET: [
    'HR',
    'BusinessApprover',
    'PanelLead',
    'Requester',
    'Coordinator',
    'Admin',
    'Auditor',
  ],

  // Approval
  APPROVAL_DECIDE: ['BusinessApprover', 'HR', 'Admin'],
  APPROVAL_LIST: ['BusinessApprover', 'HR', 'Requester', 'Admin', 'Auditor'],

  // Development
  DEVELOPMENT_UPDATE: ['Requester', 'HR', 'Admin'],
  DEVELOPMENT_GET: [
    'Requester',
    'HR',
    'Coordinator',
    'PanelLead',
    'BusinessApprover',
    'Admin',
    'Auditor',
  ],

  // Reassessment & Closure
  REASSESSMENT_SCHEDULE: ['HR', 'Admin'],
  CASE_CLOSE: ['HR', 'Admin'],

  // Attachments (Gate 7 must M3)
  ATTACHMENT_UPLOAD: ['Requester', 'HR', 'Coordinator', 'Assessor', 'PanelLead', 'Admin'],
  ATTACHMENT_READ: [
    'Requester',
    'HR',
    'Coordinator',
    'Assessor',
    'PanelLead',
    'BusinessApprover',
    'Admin',
    'Auditor',
  ],
} as const satisfies Record<string, readonly AppRole[]>;
