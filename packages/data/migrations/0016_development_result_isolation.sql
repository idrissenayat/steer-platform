-- Disabled development storage only. No real-role provisioning or activation.
ALTER TABLE steer_drafts.development_results FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON steer_drafts.development_results FROM PUBLIC, steer_app, steer_projector, steer_auth_runtime, steer_draft_runtime;
--> statement-breakpoint
GRANT SELECT, INSERT ON steer_drafts.development_results TO steer_draft_runtime;
--> statement-breakpoint
CREATE FUNCTION steer_drafts.guard_development_result() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  draft steer_drafts.draft_lifecycles%ROWTYPE;
  source steer_drafts.draft_revisions%ROWTYPE;
  fields text[] := ARRAY['organizationId','subject','productId','operationId','stepId','inputDigest','stepInputDigest','draftId','draftRevision','draftRevisionDigest','scopeInputDigest','configurationDigest','draftConfigurationDigest','owner','fencingToken','reservationId','predecessorResultDigest','outputDigest','resultRef'];
BEGIN
  SELECT * INTO draft FROM steer_drafts.draft_lifecycles WHERE organization_id=NEW.organization_id AND draft_id=NEW.draft_id FOR UPDATE;
  IF NOT FOUND OR draft.held OR draft.created_at > clock_timestamp() OR draft.use_until <= clock_timestamp()
    THEN RAISE EXCEPTION 'Draft unavailable' USING ERRCODE='23514'; END IF;
  SELECT * INTO source FROM steer_drafts.draft_revisions WHERE organization_id=NEW.organization_id AND draft_id=NEW.draft_id AND revision=NEW.draft_revision;
  IF NOT FOUND OR draft.subject IS DISTINCT FROM NEW.subject OR draft.product_id IS DISTINCT FROM NEW.product_id
    OR jsonb_typeof(NEW.record) IS DISTINCT FROM 'object' OR NOT (NEW.record ?& fields) OR NEW.record - fields <> '{}'::jsonb
    OR NEW.record->>'organizationId' IS DISTINCT FROM NEW.organization_id OR NEW.record->>'subject' IS DISTINCT FROM NEW.subject
    OR NEW.record->>'productId' IS DISTINCT FROM NEW.product_id OR NEW.record->>'operationId' IS DISTINCT FROM NEW.operation_id::text
    OR NEW.record->>'stepId' IS DISTINCT FROM NEW.step_id OR NEW.record->>'resultRef' IS DISTINCT FROM NEW.result_ref::text
    OR NEW.record->>'draftId' IS DISTINCT FROM NEW.draft_id::text OR (NEW.record->>'draftRevision')::bigint IS DISTINCT FROM NEW.draft_revision
    OR NEW.record->>'draftRevisionDigest' IS DISTINCT FROM source.revision_digest
    OR NEW.record->>'scopeInputDigest' IS DISTINCT FROM source.record->>'scopeInputDigest'
    OR NEW.record->>'draftConfigurationDigest' IS DISTINCT FROM draft.configuration_digest
    OR NEW.record->>'configurationDigest' IS NULL OR NEW.record->>'configurationDigest' !~ '^[a-f0-9]{64}$'
    OR NEW.record->>'inputDigest' IS NULL OR NEW.record->>'inputDigest' !~ '^[a-f0-9]{64}$'
    OR NEW.record->>'stepInputDigest' IS NULL OR NEW.record->>'stepInputDigest' !~ '^[a-f0-9]{64}$'
    OR NEW.record->>'outputDigest' IS NULL OR NEW.record->>'outputDigest' !~ '^[a-f0-9]{64}$'
    OR NEW.record->>'owner' IS NULL OR length(NEW.record->>'owner') NOT BETWEEN 1 AND 200
    OR NEW.record->>'fencingToken' IS NULL OR (NEW.record->>'fencingToken')::bigint NOT BETWEEN 1 AND 9007199254740991
    OR (NEW.record->>'reservationId')::uuid IS NULL
    OR (NEW.step_id='architect' AND NEW.record->>'predecessorResultDigest' IS NOT NULL)
    OR (NEW.step_id='test-agent' AND (NEW.record->>'predecessorResultDigest' IS NULL OR NEW.record->>'predecessorResultDigest' !~ '^[a-f0-9]{64}$'))
    THEN RAISE EXCEPTION 'Invalid development result' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION steer_drafts.guard_development_result() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER development_result_guard BEFORE INSERT ON steer_drafts.development_results
  FOR EACH ROW EXECUTE FUNCTION steer_drafts.guard_development_result();
