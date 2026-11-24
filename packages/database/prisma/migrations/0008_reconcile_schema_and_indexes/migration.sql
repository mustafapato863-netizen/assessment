-- Reconcile schema additions created outside 0001..0007 and add missing performance indexes.

CREATE TABLE IF NOT EXISTS "AccessAccount" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "entraObjectId" TEXT,
  "email" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "passwordHash" TEXT,
  "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
  "passwordChangedAt" TIMESTAMP(3),
  "roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "scopeType" TEXT NOT NULL DEFAULT 'NONE',
  "scopeValues" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccessAccount_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AccessAccount"
  ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "AccessAccount_entraObjectId_key" ON "AccessAccount"("entraObjectId");
CREATE UNIQUE INDEX IF NOT EXISTS "AccessAccount_email_key" ON "AccessAccount"("email");
CREATE INDEX IF NOT EXISTS "AccessAccount_active_email_idx" ON "AccessAccount"("active", "email");

ALTER TABLE "AssessmentCase"
  ADD COLUMN IF NOT EXISTS "feedbackReleasedAt" TIMESTAMP(3);

ALTER TABLE "AssessmentPlan"
  ADD COLUMN IF NOT EXISTS "scorecardConfig" JSONB;

ALTER TABLE "ResultRevision"
  ADD COLUMN IF NOT EXISTS "scorecardSummary" JSONB;

CREATE TABLE IF NOT EXISTS "AssessmentScorecard" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "caseId" UUID NOT NULL,
  "assessorId" TEXT NOT NULL,
  "assessorName" TEXT NOT NULL,
  "ratings" JSONB NOT NULL,
  "submittedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssessmentScorecard_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AssessmentScorecard_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "AssessmentCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "AssessmentScorecard_caseId_assessorId_key" ON "AssessmentScorecard"("caseId", "assessorId");
CREATE INDEX IF NOT EXISTS "AssessmentScorecard_caseId_submittedAt_idx" ON "AssessmentScorecard"("caseId", "submittedAt");

CREATE INDEX IF NOT EXISTS "EmployeeReference_email_idx" ON "EmployeeReference"("email");
CREATE INDEX IF NOT EXISTS "AssessmentCase_organizationId_requestedAt_idx" ON "AssessmentCase"("organizationId", "requestedAt");
CREATE INDEX IF NOT EXISTS "AssessmentCase_organizationId_feedbackReleasedAt_status_idx" ON "AssessmentCase"("organizationId", "feedbackReleasedAt", "status");
CREATE INDEX IF NOT EXISTS "AssessmentCase_candidateType_status_departmentSnapshot_idx" ON "AssessmentCase"("candidateType", "status", "departmentSnapshot");
CREATE INDEX IF NOT EXISTS "AssessmentCase_createdAt_idx" ON "AssessmentCase"("createdAt");
CREATE INDEX IF NOT EXISTS "AssessmentPlanMethod_planId_idx" ON "AssessmentPlanMethod"("planId");
CREATE INDEX IF NOT EXISTS "AssessmentEvent_planMethodId_idx" ON "AssessmentEvent"("planMethodId");
CREATE INDEX IF NOT EXISTS "EventAssessor_userId_idx" ON "EventAssessor"("userId");
CREATE INDEX IF NOT EXISTS "EvidenceSubmission_caseId_idx" ON "EvidenceSubmission"("caseId");
CREATE INDEX IF NOT EXISTS "EvidenceSubmission_createdAt_idx" ON "EvidenceSubmission"("createdAt");
CREATE INDEX IF NOT EXISTS "Attachment_scanStatus_createdAt_idx" ON "Attachment"("scanStatus", "createdAt");
CREATE INDEX IF NOT EXISTS "Attachment_evidenceId_idx" ON "Attachment"("evidenceId");
CREATE INDEX IF NOT EXISTS "ApprovalStep_decision_role_idx" ON "ApprovalStep"("decision", "role");
CREATE INDEX IF NOT EXISTS "ApprovalStep_approverId_idx" ON "ApprovalStep"("approverId");
CREATE INDEX IF NOT EXISTS "DevelopmentAction_planId_idx" ON "DevelopmentAction"("planId");
CREATE INDEX IF NOT EXISTS "ReassessmentLink_sourceCaseId_idx" ON "ReassessmentLink"("sourceCaseId");
CREATE INDEX IF NOT EXISTS "Task_caseId_status_taskType_idx" ON "Task"("caseId", "status", "taskType");
CREATE INDEX IF NOT EXISTS "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");
CREATE INDEX IF NOT EXISTS "AuditEvent_action_createdAt_idx" ON "AuditEvent"("action", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditEvent_caseId_action_idx" ON "AuditEvent"("caseId", "action");
CREATE INDEX IF NOT EXISTS "AccessLog_createdAt_idx" ON "AccessLog"("createdAt");

-- Only reset stageEnteredAt when the workflow stage itself changes.
CREATE OR REPLACE FUNCTION set_assessment_case_stage_entered_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."stage" IS DISTINCT FROM OLD."stage" THEN
    NEW."stageEnteredAt" = CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
