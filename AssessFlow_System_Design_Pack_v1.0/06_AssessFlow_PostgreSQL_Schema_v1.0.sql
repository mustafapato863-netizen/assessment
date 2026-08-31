-- AssessFlow PostgreSQL Schema v1.0
-- Prepared 10 August 2026
-- Standalone baseline. In an integrated host application, replace *_id reference UUIDs
-- with foreign keys to authoritative users/employees/positions/levels as appropriate.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS af_assessment_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_code varchar(40) NOT NULL UNIQUE,
  employee_id uuid NOT NULL,
  requester_user_id uuid NOT NULL,
  assessment_reason varchar(40) NOT NULL CHECK (assessment_reason IN ('INTERNAL_MOBILITY','PROMOTION','ROLE_REALIGNMENT')),
  current_position_id uuid NULL,
  current_level_id uuid NULL,
  target_position_id uuid NOT NULL,
  target_level_id uuid NULL,
  department_id uuid NULL,
  complexity_band varchar(30) NULL,
  justification text NOT NULL,
  priority varchar(20) NULL,
  requested_completion_date date NULL,
  stage varchar(40) NOT NULL DEFAULT 'REQUEST',
  status varchar(50) NOT NULL DEFAULT 'DRAFT',
  current_owner_user_id uuid NULL,
  scoring_enabled boolean NOT NULL DEFAULT false,
  current_plan_id uuid NULL,
  current_result_revision_id uuid NULL,
  current_recommendation_revision_id uuid NULL,
  row_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL,
  closed_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS ix_af_cases_queue ON af_assessment_cases(status, stage, current_owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_af_cases_employee ON af_assessment_cases(employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_af_cases_target ON af_assessment_cases(assessment_reason, target_position_id, target_level_id);

CREATE TABLE IF NOT EXISTS af_eligibility_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_case_id uuid NOT NULL UNIQUE REFERENCES af_assessment_cases(id) ON DELETE CASCADE,
  status varchar(30) NOT NULL DEFAULT 'NOT_STARTED',
  reviewer_user_id uuid NULL,
  decision varchar(20) NULL CHECK (decision IS NULL OR decision IN ('ELIGIBLE','NOT_ELIGIBLE')),
  decision_reason text NULL,
  override_requested boolean NOT NULL DEFAULT false,
  override_reason text NULL,
  override_approver_user_id uuid NULL,
  override_decision varchar(20) NULL CHECK (override_decision IS NULL OR override_decision IN ('APPROVED','REJECTED')),
  decided_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS af_eligibility_criterion_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eligibility_review_id uuid NOT NULL REFERENCES af_eligibility_reviews(id) ON DELETE CASCADE,
  criterion_code varchar(60) NOT NULL,
  criterion_label_snapshot varchar(200) NOT NULL,
  blocking boolean NOT NULL DEFAULT false,
  result varchar(20) NOT NULL CHECK (result IN ('MET','NOT_MET','NOT_APPLICABLE','NOT_CHECKED')),
  evidence_note text NULL,
  source_value varchar(500) NULL,
  reviewed_by uuid NULL,
  reviewed_at timestamptz NULL,
  UNIQUE (eligibility_review_id, criterion_code)
);

CREATE TABLE IF NOT EXISTS af_assessment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_case_id uuid NOT NULL REFERENCES af_assessment_cases(id) ON DELETE CASCADE,
  revision_no integer NOT NULL CHECK (revision_no > 0),
  status varchar(30) NOT NULL DEFAULT 'DRAFT',
  recommended_method_set varchar(200) NULL,
  deviation_reason text NULL,
  scoring_profile_id uuid NULL,
  prepared_by uuid NOT NULL,
  finalized_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_case_id, revision_no)
);

CREATE TABLE IF NOT EXISTS af_assessment_plan_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_plan_id uuid NOT NULL REFERENCES af_assessment_plans(id) ON DELETE CASCADE,
  method_code varchar(30) NOT NULL CHECK (method_code IN ('CBI','CASE_STUDY','ROLEPLAY')),
  sequence_no integer NOT NULL CHECK (sequence_no > 0),
  required boolean NOT NULL DEFAULT true,
  instructions text NULL,
  template_id uuid NULL,
  planned_duration_minutes integer NULL CHECK (planned_duration_minutes IS NULL OR planned_duration_minutes > 0),
  UNIQUE (assessment_plan_id, method_code)
);

CREATE TABLE IF NOT EXISTS af_assessment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_case_id uuid NOT NULL REFERENCES af_assessment_cases(id) ON DELETE CASCADE,
  plan_method_id uuid NOT NULL REFERENCES af_assessment_plan_methods(id),
  status varchar(30) NOT NULL DEFAULT 'PLANNED',
  scheduled_start timestamptz NULL,
  scheduled_end timestamptz NULL,
  timezone varchar(100) NULL,
  location_text varchar(300) NULL,
  meeting_url text NULL,
  actual_start timestamptz NULL,
  actual_end timestamptz NULL,
  completion_note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (scheduled_end IS NULL OR scheduled_start IS NULL OR scheduled_end > scheduled_start),
  CHECK (actual_end IS NULL OR actual_start IS NULL OR actual_end >= actual_start)
);

CREATE INDEX IF NOT EXISTS ix_af_events_case_status ON af_assessment_events(assessment_case_id, status, scheduled_start);

CREATE TABLE IF NOT EXISTS af_assessment_event_assessors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_event_id uuid NOT NULL REFERENCES af_assessment_events(id) ON DELETE CASCADE,
  assessor_user_id uuid NOT NULL,
  role varchar(30) NOT NULL CHECK (role IN ('LEAD','PANEL_MEMBER','OBSERVER')),
  submission_required boolean NOT NULL DEFAULT true,
  submission_status varchar(20) NOT NULL DEFAULT 'PENDING' CHECK (submission_status IN ('PENDING','SUBMITTED')),
  evidence_summary text NULL,
  strengths text NULL,
  gaps text NULL,
  submitted_at timestamptz NULL,
  UNIQUE (assessment_event_id, assessor_user_id)
);

CREATE TABLE IF NOT EXISTS af_assessment_result_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_case_id uuid NOT NULL REFERENCES af_assessment_cases(id) ON DELETE CASCADE,
  revision_no integer NOT NULL CHECK (revision_no > 0),
  result_code varchar(40) NOT NULL CHECK (result_code IN ('READY_NOW','READY_WITH_DEVELOPMENT','NOT_READY','INCOMPLETE')),
  overall_score numeric(8,3) NULL,
  evidence_summary text NOT NULL,
  strengths text NULL,
  gaps text NULL,
  development_focus text NULL,
  finalized_by uuid NOT NULL,
  finalized_at timestamptz NULL,
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_case_id, revision_no)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_af_current_result_per_case
  ON af_assessment_result_revisions(assessment_case_id)
  WHERE is_current = true;

CREATE TABLE IF NOT EXISTS af_recommendation_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_case_id uuid NOT NULL REFERENCES af_assessment_cases(id) ON DELETE CASCADE,
  revision_no integer NOT NULL CHECK (revision_no > 0),
  result_revision_id uuid NOT NULL REFERENCES af_assessment_result_revisions(id),
  recommendation_code varchar(60) NOT NULL,
  rationale text NOT NULL,
  requires_development boolean NOT NULL DEFAULT false,
  requires_reassessment boolean NOT NULL DEFAULT false,
  reassessment_target_date date NULL,
  prepared_by uuid NOT NULL,
  submitted_at timestamptz NULL,
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT requires_reassessment OR reassessment_target_date IS NOT NULL),
  UNIQUE (assessment_case_id, revision_no)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_af_current_recommendation_per_case
  ON af_recommendation_revisions(assessment_case_id)
  WHERE is_current = true;

CREATE TABLE IF NOT EXISTS af_decision_approval_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_case_id uuid NOT NULL REFERENCES af_assessment_cases(id) ON DELETE CASCADE,
  recommendation_revision_id uuid NOT NULL REFERENCES af_recommendation_revisions(id),
  step_no integer NOT NULL CHECK (step_no > 0),
  approver_role_code varchar(60) NOT NULL,
  approver_user_id uuid NULL,
  status varchar(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','CHANGES_REQUESTED','SKIPPED')),
  comment text NULL,
  decided_at timestamptz NULL,
  UNIQUE (recommendation_revision_id, step_no)
);

CREATE TABLE IF NOT EXISTS af_development_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_case_id uuid NOT NULL UNIQUE REFERENCES af_assessment_cases(id) ON DELETE CASCADE,
  status varchar(30) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','COMPLETED','CANCELLED')),
  owner_user_id uuid NOT NULL,
  start_date date NULL,
  target_completion_date date NULL,
  completion_summary text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS af_development_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  development_plan_id uuid NOT NULL REFERENCES af_development_plans(id) ON DELETE CASCADE,
  action_text text NOT NULL,
  owner_user_id uuid NOT NULL,
  due_date date NULL,
  status varchar(20) NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED','IN_PROGRESS','COMPLETED','CANCELLED')),
  completion_evidence text NULL,
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_af_development_due ON af_development_actions(status, due_date, owner_user_id);

CREATE TABLE IF NOT EXISTS af_reassessment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_case_id uuid NOT NULL REFERENCES af_assessment_cases(id) ON DELETE CASCADE,
  new_case_id uuid NULL REFERENCES af_assessment_cases(id),
  target_date date NOT NULL,
  reason text NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED','DUE','CREATED','COMPLETED','CANCELLED')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS af_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_case_id uuid NOT NULL REFERENCES af_assessment_cases(id) ON DELETE CASCADE,
  task_type varchar(50) NOT NULL,
  owner_user_id uuid NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','COMPLETED','CANCELLED')),
  due_at timestamptz NULL,
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_af_tasks_owner ON af_tasks(owner_user_id, status, due_at);

CREATE TABLE IF NOT EXISTS af_workflow_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_case_id uuid NOT NULL REFERENCES af_assessment_cases(id) ON DELETE CASCADE,
  from_stage varchar(40) NULL,
  from_status varchar(50) NULL,
  to_stage varchar(40) NOT NULL,
  to_status varchar(50) NOT NULL,
  action_code varchar(60) NOT NULL,
  actor_user_id uuid NOT NULL,
  reason text NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  context jsonb NULL
);
CREATE INDEX IF NOT EXISTS ix_af_transition_case_time ON af_workflow_transitions(assessment_case_id, occurred_at);

CREATE TABLE IF NOT EXISTS af_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_case_id uuid NOT NULL REFERENCES af_assessment_cases(id) ON DELETE CASCADE,
  event_id uuid NULL REFERENCES af_assessment_events(id) ON DELETE SET NULL,
  classification varchar(40) NOT NULL CHECK (classification IN ('TEMPLATE','EMPLOYEE_SUBMISSION','EVIDENCE','OTHER')),
  storage_key text NOT NULL,
  file_name varchar(255) NOT NULL,
  content_type varchar(120) NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  checksum varchar(128) NULL,
  uploaded_by uuid NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  retention_until date NULL
);

-- Optional scoring extension. These tables may be deployed now and remain unused.
CREATE TABLE IF NOT EXISTS af_scoring_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_code varchar(60) NOT NULL,
  version_no integer NOT NULL CHECK (version_no > 0),
  name varchar(200) NOT NULL,
  scale_min numeric(8,3) NOT NULL,
  scale_max numeric(8,3) NOT NULL,
  thresholds jsonb NOT NULL DEFAULT '{}'::jsonb,
  critical_fail_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  effective_from date NULL,
  effective_to date NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_code, version_no),
  CHECK (scale_max > scale_min)
);

CREATE TABLE IF NOT EXISTS af_scoring_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scoring_profile_id uuid NOT NULL REFERENCES af_scoring_profiles(id) ON DELETE RESTRICT,
  component_code varchar(60) NOT NULL,
  method_code varchar(30) NOT NULL,
  weight numeric(8,5) NULL CHECK (weight IS NULL OR (weight >= 0 AND weight <= 1)),
  required boolean NOT NULL DEFAULT true,
  max_score numeric(8,3) NULL,
  sequence_no integer NOT NULL DEFAULT 1,
  UNIQUE (scoring_profile_id, component_code)
);

CREATE TABLE IF NOT EXISTS af_score_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_revision_id uuid NOT NULL REFERENCES af_assessment_result_revisions(id) ON DELETE CASCADE,
  component_id uuid NOT NULL REFERENCES af_scoring_components(id),
  assessor_user_id uuid NOT NULL,
  raw_score numeric(8,3) NOT NULL,
  normalized_score numeric(8,3) NULL,
  comment text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (result_revision_id, component_id, assessor_user_id)
);

CREATE TABLE IF NOT EXISTS af_calibration_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_case_id uuid NOT NULL REFERENCES af_assessment_cases(id) ON DELETE CASCADE,
  status varchar(20) NOT NULL DEFAULT 'DRAFT',
  facilitator_user_id uuid NOT NULL,
  notes text NULL,
  finalized_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS af_calibration_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calibration_session_id uuid NOT NULL REFERENCES af_calibration_sessions(id) ON DELETE CASCADE,
  score_entry_id uuid NOT NULL REFERENCES af_score_entries(id) ON DELETE CASCADE,
  original_score numeric(8,3) NOT NULL,
  adjusted_score numeric(8,3) NOT NULL,
  reason text NOT NULL,
  adjusted_by uuid NOT NULL,
  adjusted_at timestamptz NOT NULL DEFAULT now()
);

-- Add circular current-pointer foreign keys only after referenced tables exist.
ALTER TABLE af_assessment_cases
  ADD CONSTRAINT fk_af_case_current_plan FOREIGN KEY (current_plan_id) REFERENCES af_assessment_plans(id) DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT fk_af_case_current_result FOREIGN KEY (current_result_revision_id) REFERENCES af_assessment_result_revisions(id) DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT fk_af_case_current_recommendation FOREIGN KEY (current_recommendation_revision_id) REFERENCES af_recommendation_revisions(id) DEFERRABLE INITIALLY DEFERRED;

-- Recommended reporting views can be implemented after host organization/role dimension joins are finalized.
