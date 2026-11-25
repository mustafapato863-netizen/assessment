-- Trigram indexes so case search (ILIKE '%text%') can use an index instead of scanning every row.
-- Idempotent. Requires the pg_trgm extension (ships with PostgreSQL contrib).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "AssessmentCase_caseCode_trgm_idx"
  ON "AssessmentCase" USING gin ("caseCode" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "AssessmentCase_ownerName_trgm_idx"
  ON "AssessmentCase" USING gin ("ownerName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "AssessmentCase_departmentSnapshot_trgm_idx"
  ON "AssessmentCase" USING gin ("departmentSnapshot" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "AssessmentCase_targetRoleSnapshot_trgm_idx"
  ON "AssessmentCase" USING gin ("targetRoleSnapshot" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "EmployeeReference_displayName_trgm_idx"
  ON "EmployeeReference" USING gin ("displayName" gin_trgm_ops);
