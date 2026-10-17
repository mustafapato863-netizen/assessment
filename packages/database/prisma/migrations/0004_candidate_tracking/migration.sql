ALTER TABLE "AssessmentCase"
  ADD COLUMN "candidateType" TEXT NOT NULL DEFAULT 'INTERNAL_EMPLOYEE',
  ADD COLUMN "candidateEmail" TEXT,
  ADD COLUMN "hiringOutcome" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "hiringOutcomeReason" TEXT;

CREATE INDEX "AssessmentCase_candidateType_hiringOutcome_hiringOutcomeReason_idx"
  ON "AssessmentCase"("candidateType", "hiringOutcome", "hiringOutcomeReason");
