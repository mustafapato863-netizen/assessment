# AssessFlow System Design Pack v1.0

Prepared: 10 August 2026

This pack translates the approved AssessFlow planning documents into implementation-ready design artifacts.

## Files

1. `06_AssessFlow_Database_Implementation_v1.0.docx` — physical PostgreSQL design, table-level schema, constraints, indexes, history, reporting views, and future scoring extension.
2. `06_AssessFlow_PostgreSQL_Schema_v1.0.sql` — executable standalone baseline DDL. Replace reference IDs with host-system foreign keys when integrating into an existing platform.
3. `07_AssessFlow_API_Contract_v1.0.docx` — REST API contract, workflow commands, validation, error model, concurrency, and event guidance.
4. `07_AssessFlow_OpenAPI_v1.0.yaml` — machine-readable OpenAPI baseline for core endpoints and schemas.
5. `08_AssessFlow_Permissions_RACI_Matrix_v1.0.xlsx` — permission catalog, role matrix, data scope rules, and workflow responsibility matrix.
6. `09_AssessFlow_UI_Wireframes_v1.0.docx` — low-fidelity screen layouts and interactions for the MVP workflow.

## Key MVP architecture decision

Numeric scoring is **future-ready but disabled by default**. Result finalization, recommendation, approval, development, reassessment, and closure must work with no numeric score. Enabling scoring later uses versioned profiles/components and does not require redesigning the core case/result/approval flow.

## Suggested implementation order

1. Auth/permissions + reference/master adapters
2. Assessment Case + workflow transition engine + audit
3. Eligibility
4. Planning + events + assessor submissions
5. Result finalization
6. Recommendation + approval
7. Development + reassessment
8. Reports + admin configuration
9. Optional scoring feature only after policy/rubric governance is approved
