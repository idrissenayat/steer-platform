-- Disposable development only. Real records adoption/migration remains held.
ALTER TABLE steer_drafts.development_observations FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON steer_drafts.development_observations FROM PUBLIC,steer_app,steer_projector,steer_auth_runtime,steer_draft_runtime;
--> statement-breakpoint
GRANT SELECT,INSERT ON steer_drafts.development_observations TO steer_draft_runtime;
--> statement-breakpoint
CREATE FUNCTION steer_drafts.guard_development_observation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  draft steer_drafts.draft_lifecycles%ROWTYPE;
  original steer_drafts.development_originals%ROWTYPE;
  request steer_drafts.development_observations%ROWTYPE;
  fields text[] := ARRAY['organizationId','subject','productId','operationId','inputDigest','stepId','stage','draftId','draftRevision','configurationDigest','owner','fencingToken','reservationId','stepInputDigest','payloadDigest','requestDigest','outputDigest'];
BEGIN
  SELECT * INTO draft FROM steer_drafts.draft_lifecycles WHERE organization_id=NEW.organization_id AND draft_id=NEW.draft_id FOR UPDATE;
  IF NOT FOUND OR draft.held OR draft.created_at>clock_timestamp() OR draft.use_until<=clock_timestamp()
    THEN RAISE EXCEPTION 'Draft unavailable' USING ERRCODE='23514'; END IF;
  SELECT * INTO original FROM steer_drafts.development_originals WHERE organization_id=NEW.organization_id AND operation_id=NEW.operation_id;
  IF NOT FOUND OR original.draft_id IS DISTINCT FROM NEW.draft_id OR original.draft_revision IS DISTINCT FROM NEW.draft_revision
    OR draft.subject IS DISTINCT FROM NEW.subject OR draft.product_id IS DISTINCT FROM NEW.product_id
    OR jsonb_typeof(NEW.record) IS DISTINCT FROM 'object' OR NOT (NEW.record ?& fields) OR NEW.record - fields <> '{}'::jsonb
    OR NEW.record->>'organizationId' IS DISTINCT FROM NEW.organization_id OR NEW.record->>'subject' IS DISTINCT FROM NEW.subject
    OR NEW.record->>'productId' IS DISTINCT FROM NEW.product_id OR NEW.record->>'operationId' IS DISTINCT FROM NEW.operation_id::text
    OR NEW.record->>'inputDigest' IS DISTINCT FROM original.input_digest OR NEW.record->>'stepId' IS DISTINCT FROM NEW.step_id
    OR NEW.record->>'stage' IS DISTINCT FROM NEW.stage OR NEW.record->>'draftId' IS DISTINCT FROM NEW.draft_id::text
    OR (NEW.record->>'draftRevision')::bigint IS DISTINCT FROM NEW.draft_revision
    OR NEW.record->>'configurationDigest' IS DISTINCT FROM draft.configuration_digest
    OR NEW.record->>'payloadDigest' IS DISTINCT FROM NEW.payload_digest
    OR NEW.record->>'stepInputDigest' IS NULL OR NEW.record->>'stepInputDigest' !~ '^[a-f0-9]{64}$'
    OR NEW.record->>'owner' IS NULL OR length(NEW.record->>'owner') NOT BETWEEN 1 AND 200
    OR NEW.record->>'fencingToken' IS NULL OR (NEW.record->>'fencingToken')::bigint NOT BETWEEN 1 AND 9007199254740991
    OR (NEW.record->>'reservationId')::uuid IS NULL
    THEN RAISE EXCEPTION 'Invalid development observation' USING ERRCODE='23514'; END IF;
  IF NEW.stage='request' THEN
    IF NEW.record->>'requestDigest' IS NOT NULL OR NEW.record->>'outputDigest' IS NOT NULL
      THEN RAISE EXCEPTION 'Invalid development request' USING ERRCODE='23514'; END IF;
  ELSE
    SELECT * INTO request FROM steer_drafts.development_observations WHERE organization_id=NEW.organization_id AND operation_id=NEW.operation_id AND step_id=NEW.step_id AND stage='request';
    IF NOT FOUND OR NEW.record->>'requestDigest' IS DISTINCT FROM request.payload_digest
      OR NEW.record->>'owner' IS DISTINCT FROM request.record->>'owner'
      OR NEW.record->>'fencingToken' IS DISTINCT FROM request.record->>'fencingToken'
      OR NEW.record->>'reservationId' IS DISTINCT FROM request.record->>'reservationId'
      OR NEW.record->>'stepInputDigest' IS DISTINCT FROM request.record->>'stepInputDigest'
      OR NEW.record->>'outputDigest' IS NULL OR NEW.record->>'outputDigest' !~ '^[a-f0-9]{64}$'
      THEN RAISE EXCEPTION 'Invalid development response' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION steer_drafts.guard_development_observation() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER development_observation_guard BEFORE INSERT ON steer_drafts.development_observations
  FOR EACH ROW EXECUTE FUNCTION steer_drafts.guard_development_observation();
