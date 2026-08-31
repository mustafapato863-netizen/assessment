-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AssessmentReason" AS ENUM ('PROMOTION', 'INTERNAL_MOBILITY', 'ROLE_REALIGNMENT');

-- CreateEnum
CREATE TYPE "CaseStage" AS ENUM ('REQUEST', 'ELIGIBILITY', 'PLANNING', 'ASSESSMENT', 'RESULT', 'RECOMMENDATION', 'APPROVAL', 'FOLLOW_UP', 'CLOSED');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PENDING_ELIGIBILITY', 'NOT_ELIGIBLE', 'READY_FOR_PLANNING', 'PLANNING', 'SCHEDULED', 'IN_PROGRESS', 'PENDING_RESULT', 'RESULT_FINALIZED', 'PENDING_RECOMMENDATION', 'PENDING_APPROVAL', 'APPROVED', 'DEVELOPMENT_IN_PROGRESS', 'REASSESSMENT_DUE', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EligibilityDecision" AS ENUM ('ELIGIBLE', 'NOT_ELIGIBLE', 'OVERRIDE_REQUESTED', 'OVERRIDE_APPROVED', 'OVERRIDE_REJECTED');

-- CreateEnum
CREATE TYPE "CriterionResult" AS ENUM ('MET', 'NOT_MET', 'NOT_CHECKED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('PLANNED', 'SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'RESCHEDULED', 'CANCELLED', 'PARTICIPANT_NO_SHOW', 'ASSESSOR_NO_SHOW');

-- CreateEnum
CREATE TYPE "ResultCode" AS ENUM ('READY_NOW', 'READY_WITH_DEVELOPMENT', 'NOT_READY', 'INCOMPLETE');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('PENDING', 'SCANNING', 'CLEAN', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeReference" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "externalId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "department" TEXT NOT NULL,
    "managerName" TEXT,
    "currentRole" TEXT NOT NULL,
    "currentLevel" TEXT,
    "employmentState" TEXT NOT NULL DEFAULT 'ACTIVE',
    "sourceUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentCase" (
    "id" UUID NOT NULL,
    "caseCode" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "assessmentReason" "AssessmentReason" NOT NULL,
    "stage" "CaseStage" NOT NULL,
    "status" "CaseStatus" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "ownerName" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "currentRoleSnapshot" TEXT NOT NULL,
    "targetRoleSnapshot" TEXT NOT NULL,
    "targetLevelSnapshot" TEXT,
    "managerSnapshot" TEXT,
    "departmentSnapshot" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EligibilityReview" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "decision" "EligibilityDecision",
    "decisionReason" TEXT,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EligibilityReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EligibilityCriterionResult" (
    "id" UUID NOT NULL,
    "reviewId" UUID NOT NULL,
    "criterionCode" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "blocking" BOOLEAN NOT NULL DEFAULT false,
    "result" "CriterionResult" NOT NULL DEFAULT 'NOT_CHECKED',
    "sourceValue" TEXT,
    "evidenceNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EligibilityCriterionResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentPlan" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "complexityBand" TEXT,
    "leadAssessor" TEXT,
    "deviationReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentPlanMethod" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "methodCode" TEXT NOT NULL,
    "methodLabel" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "durationMin" INTEGER,
    "templateKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentPlanMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentEvent" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "planMethodId" UUID,
    "status" "EventStatus" NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "timezone" TEXT,
    "location" TEXT,
    "meetingLink" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventAssessor" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventAssessor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceSubmission" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "assessorId" TEXT NOT NULL,
    "assessorName" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "strengths" TEXT,
    "gaps" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvidenceSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "evidenceId" UUID,
    "classification" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "scanStatus" "ScanStatus" NOT NULL DEFAULT 'PENDING',
    "scanReason" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scannedAt" TIMESTAMP(3),

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResultRevision" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "resultCode" "ResultCode",
    "evidenceSummary" TEXT,
    "strengths" TEXT,
    "gaps" TEXT,
    "developmentFocus" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "finalizedBy" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "reopenReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResultRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationRevision" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'DRAFT',
    "rationale" TEXT NOT NULL,
    "requiresDevelopment" BOOLEAN NOT NULL DEFAULT false,
    "requiresReassessment" BOOLEAN NOT NULL DEFAULT false,
    "targetDate" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalStep" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "approverId" TEXT,
    "approverName" TEXT,
    "decision" "ApprovalDecision" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevelopmentPlan" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "ownerName" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevelopmentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevelopmentAction" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "evidenceNote" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevelopmentAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReassessmentLink" (
    "id" UUID NOT NULL,
    "sourceCaseId" UUID NOT NULL,
    "reassessmentCaseId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReassessmentLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" UUID NOT NULL,
    "caseId" UUID,
    "assigneeId" TEXT NOT NULL,
    "assigneeName" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "caseId" UUID,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "reason" TEXT,
    "previousData" JSONB,
    "newData" JSONB,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessLog" (
    "id" UUID NOT NULL,
    "caseId" UUID,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationOutbox" (
    "id" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" UUID NOT NULL,
    "outboxId" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "providerId" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "resourceId" TEXT,
    "requestHash" TEXT NOT NULL,
    "responseStatus" INTEGER NOT NULL,
    "responseBody" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetentionPolicy" (
    "id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "retentionDays" INTEGER,
    "legalHoldEnabled" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetentionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrSyncBatch" (
    "id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "syncType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sourceCursor" TEXT,
    "recordsRead" INTEGER NOT NULL DEFAULT 0,
    "recordsApplied" INTEGER NOT NULL DEFAULT 0,
    "recordsFailed" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "HrSyncBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_code_key" ON "Organization"("code");

-- CreateIndex
CREATE INDEX "EmployeeReference_organizationId_department_idx" ON "EmployeeReference"("organizationId", "department");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeReference_organizationId_externalId_key" ON "EmployeeReference"("organizationId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentCase_caseCode_key" ON "AssessmentCase"("caseCode");

-- CreateIndex
CREATE INDEX "AssessmentCase_organizationId_status_stage_idx" ON "AssessmentCase"("organizationId", "status", "stage");

-- CreateIndex
CREATE INDEX "AssessmentCase_organizationId_ownerName_status_idx" ON "AssessmentCase"("organizationId", "ownerName", "status");

-- CreateIndex
CREATE INDEX "AssessmentCase_employeeId_requestedAt_idx" ON "AssessmentCase"("employeeId", "requestedAt");

-- CreateIndex
CREATE INDEX "AssessmentCase_departmentSnapshot_assessmentReason_idx" ON "AssessmentCase"("departmentSnapshot", "assessmentReason");

-- CreateIndex
CREATE UNIQUE INDEX "EligibilityReview_caseId_key" ON "EligibilityReview"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "EligibilityCriterionResult_reviewId_criterionCode_key" ON "EligibilityCriterionResult"("reviewId", "criterionCode");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentPlan_caseId_key" ON "AssessmentPlan"("caseId");

-- CreateIndex
CREATE INDEX "AssessmentEvent_caseId_status_startsAt_idx" ON "AssessmentEvent"("caseId", "status", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventAssessor_eventId_userId_key" ON "EventAssessor"("eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceSubmission_eventId_assessorId_key" ON "EvidenceSubmission"("eventId", "assessorId");

-- CreateIndex
CREATE INDEX "Attachment_caseId_scanStatus_idx" ON "Attachment"("caseId", "scanStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ResultRevision_caseId_revision_key" ON "ResultRevision"("caseId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "RecommendationRevision_caseId_revision_key" ON "RecommendationRevision"("caseId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalStep_caseId_sequence_key" ON "ApprovalStep"("caseId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "DevelopmentPlan_caseId_key" ON "DevelopmentPlan"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "ReassessmentLink_reassessmentCaseId_key" ON "ReassessmentLink"("reassessmentCaseId");

-- CreateIndex
CREATE INDEX "Task_assigneeId_status_dueAt_idx" ON "Task"("assigneeId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "AuditEvent_caseId_createdAt_idx" ON "AuditEvent"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_actorId_createdAt_idx" ON "AuditEvent"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AccessLog_resourceType_resourceId_createdAt_idx" ON "AccessLog"("resourceType", "resourceId", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationOutbox_publishedAt_occurredAt_idx" ON "NotificationOutbox"("publishedAt", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDelivery_outboxId_channel_recipient_key" ON "NotificationDelivery"("outboxId", "channel", "recipient");

-- CreateIndex
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_key_actorId_command_key" ON "IdempotencyKey"("key", "actorId", "command");

-- CreateIndex
CREATE UNIQUE INDEX "RetentionPolicy_category_key" ON "RetentionPolicy"("category");

-- AddForeignKey
ALTER TABLE "EmployeeReference" ADD CONSTRAINT "EmployeeReference_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentCase" ADD CONSTRAINT "AssessmentCase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentCase" ADD CONSTRAINT "AssessmentCase_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "EmployeeReference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EligibilityReview" ADD CONSTRAINT "EligibilityReview_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "AssessmentCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EligibilityCriterionResult" ADD CONSTRAINT "EligibilityCriterionResult_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "EligibilityReview"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentPlan" ADD CONSTRAINT "AssessmentPlan_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "AssessmentCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentPlanMethod" ADD CONSTRAINT "AssessmentPlanMethod_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AssessmentPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentEvent" ADD CONSTRAINT "AssessmentEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "AssessmentCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentEvent" ADD CONSTRAINT "AssessmentEvent_planMethodId_fkey" FOREIGN KEY ("planMethodId") REFERENCES "AssessmentPlanMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAssessor" ADD CONSTRAINT "EventAssessor_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "AssessmentEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceSubmission" ADD CONSTRAINT "EvidenceSubmission_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "AssessmentCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceSubmission" ADD CONSTRAINT "EvidenceSubmission_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "AssessmentEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "AssessmentCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "EvidenceSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultRevision" ADD CONSTRAINT "ResultRevision_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "AssessmentCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationRevision" ADD CONSTRAINT "RecommendationRevision_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "AssessmentCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "AssessmentCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevelopmentPlan" ADD CONSTRAINT "DevelopmentPlan_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "AssessmentCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevelopmentAction" ADD CONSTRAINT "DevelopmentAction_planId_fkey" FOREIGN KEY ("planId") REFERENCES "DevelopmentPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReassessmentLink" ADD CONSTRAINT "ReassessmentLink_sourceCaseId_fkey" FOREIGN KEY ("sourceCaseId") REFERENCES "AssessmentCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReassessmentLink" ADD CONSTRAINT "ReassessmentLink_reassessmentCaseId_fkey" FOREIGN KEY ("reassessmentCaseId") REFERENCES "AssessmentCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "AssessmentCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "AssessmentCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessLog" ADD CONSTRAINT "AccessLog_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "AssessmentCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
