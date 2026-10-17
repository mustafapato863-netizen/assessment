ALTER TABLE "AccessAccount"
ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "AssessmentCase"
ADD COLUMN "stageEnteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "GovernancePolicy" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "version" TEXT NOT NULL,
  "settings" JSONB NOT NULL,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GovernancePolicy_pkey" PRIMARY KEY ("id")
);

CREATE OR REPLACE FUNCTION set_assessment_case_stage_entered_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."stage" IS DISTINCT FROM OLD."stage" OR NEW."status" IS DISTINCT FROM OLD."status" THEN
    NEW."stageEnteredAt" = CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AssessmentCase_stage_entered_at_update"
BEFORE UPDATE ON "AssessmentCase"
FOR EACH ROW
EXECUTE FUNCTION set_assessment_case_stage_entered_at();
