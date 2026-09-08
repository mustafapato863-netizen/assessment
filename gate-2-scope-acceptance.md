# AssessFlow Gate 2 — MVP Scope and Acceptance Criteria

**Status:** Approved 2026-09-04 by `admin` (Product/Business Owner + HR/Talent Policy Owner)
**Pilot departments (final):** Product, Engineering, People (matches demo seed)
**Purpose:** Define MVP scope, acceptance criteria, and explicit out-of-scope items based on BRD and workflow matrix.  
**Dependencies:** Gate 1 (BIZ-001, BIZ-004, BIZ-010, BIZ-012 minimum)  
**Owner:** Product/Business Owner + HR/Talent Policy Owner  

## MVP Boundary
- **Company scope:** Single-company pilot (to be confirmed in BIZ-013)
- **Departments:** Product, Engineering, People (3 pilot departments, final)
- **Assessment reasons:** All three reasons (Promotion, Internal Mobility, Role Realignment) or reduced set as approved
- **Timeline:** Pilot duration to be defined

## Core Workflow
Keep the core flow: request → eligibility → plan → evidence → result → recommendation → approval → closure  
*(Development/reassessment as conditional branches after approval)*

## Reason/Role/Department Matrix (final)

| Assessment Reason | Target Levels | Departments Included | Approval Route |
|-------------------|---------------|----------------------|----------------|
| Promotion         | L3-L6         | Product, Engineering, People | Sequential HR → Business; no self-approval; 14-day expiry |
| Internal Mobility | L2-L5         | Product, Engineering, People | Sequential HR → Business; no self-approval; 14-day expiry |
| Role Realignment  | L3-L6         | Product, Engineering, People | Sequential HR → Business; no self-approval; 14-day expiry |

## Given-When-Then Acceptance Criteria

### Request Transition
**Given:** Employee submits assessment request with justification  
**When:** Request is saved as draft  
**Then:** System shows "Draft" status, allows editing, and enables submit action  

**Given:** Draft request exists with required fields  
**When:** User submits request for eligibility review  
**Then:** Status changes to PENDING_ELIGIBILITY, stage to ELIGIBILITY, owner to HR/Talent, and eligibility review initialized  

### Eligibility Transition
**Given:** Case in PENDING_ELIGIBILITY status  
**When:** HR/Talent records eligibility decision with policy version  
**Then:** If ELIGIBLE: status → READY_FOR_PLANNING, stage → PLANNING, owner → Assessment Coordinator  
**Then:** If NOT_ELIGIBLE: status → NOT_ELIGIBLE, stage → ELIGIBILITY, owner → HR/Talent  

### Planning Transition
**Given:** Case in READY_FOR_PLANNING status  
**When:** Assessment Coordinator finalizes plan with methods and lead assessor  
**Then:** Status → PLANNING, stage → PLANNING, owner remains Assessment Coordinator, plan version incremented  

### Evidence Transition
**Given:** Case in PLANNING status with scheduled assessment events  
**When:** Assessor submits evidence for completed event  
**Then:** Evidence recorded with submission timestamp, assessor identity, and attachments (if any)  

### Result Transition
**Given:** Case in PLANNING status with all required evidence submitted  
**When:** Assessment Coordinator finalizes result  
**Then:** Status → PENDING_RESULT, stage → RESULT, owner → Assessment Coordinator, result revision created  

### Recommendation Transition
**Given:** Case in PENDING_RESULT status with finalized result  
**When:** Business Owner/Approver enters recommendation  
**Then:** Status → PENDING_RECOMMENDATION, stage → RECOMMENDATION, owner → Business Owner/Approver, recommendation revision created  

### Approval Transition
**Given:** Case in PENDING_RECOMMENDATION status with submitted recommendation  
**When:** Required approvers complete approval steps  
**Then:** Status → PENDING_APPROVAL, stage → APPROVAL, owner follows approval sequence, approval steps recorded  

### Closure Transition
**Given:** Case in APPROVED status with completed approval steps  
**When:** Employee acknowledges feedback and any follow-up actions assigned  
**Then:** Status → CLOSED, stage → CLOSED, closedAt timestamp set, follow-up tasks created  

### Conditional Branches
**Given:** Case in APPROVED status  
**When:** Recommendation includes development actions  
**Then:** Development branch activates: status → DEVELOPMENT_IN_PROGRESS, development plan created  

**Given:** Case in APPROVED status  
**When:** Reassessment triggers are met (time elapsed, organizational change, etc.)  
**Then:** Reassessment branch activates: reassessment case linked, target date set  

## Explicit Out-of-Scope Items
1. **Scoring:** Numeric scoring remains disabled for MVP (BIZ-012)
2. **Calibration Phase 2:** Calibration workspace hidden behind feature flag until Phase 2 policy approval
3. **Calendar integration:** Basic event scheduling exists; advanced calendar sync (Outlook/Google) deferred
4. **Advanced reporting:** Operational reports available; predictive analytics and trend analysis deferred
5. **Mobile app:** Responsive web UI supports mobile browsers; native mobile app deferred
6. **Third-party integrations:** HRIS/SSO adapters exist; other integrations (performance systems, learning platforms) deferred
7. **Bulk operations:** Individual case processing supported; bulk eligibility reassessment deferred
8. **AI-assisted features:** No AI-generated recommendations or automated evidence analysis in MVP

## Acceptance Evidence Requirements
- Approved `gate-2-scope-acceptance.md` with completed matrix and criteria — done 2026-09-04 (`admin`)
- Traceability: BRD workflow → AC-REQ/ELIG/PLAN/EVID/RES/REC/APPR/CLOSE criteria above; BIZ-001 reasons, BIZ-004 methods, BIZ-010 closure, BIZ-012 scoring-out
- QA Owner (`admin`) sign-off: all criteria testable Given-When-Then — signed 2026-09-04
- Examples cover Promotion/Product, Internal Mobility/Engineering, Role Realignment/People