-- Development-only: no real records activation, deletion or dispatch grant.
ALTER TABLE steer_drafts.scope_review_observations FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON steer_drafts.scope_review_observations FROM PUBLIC,steer_app,steer_projector,steer_auth_runtime,steer_draft_runtime;
--> statement-breakpoint
GRANT SELECT,INSERT ON steer_drafts.scope_review_observations TO steer_draft_runtime;
--> statement-breakpoint
-- Narrow trigger capability, not a general execution-schema read grant. The
-- migration owner must be trusted. Qualify every business relation, fix search_path,
-- check caller scope before any cross-schema lookup and revoke public execution.
CREATE FUNCTION steer_drafts.guard_scope_observation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE
  draft steer_drafts.draft_lifecycles%ROWTYPE;
  original steer_drafts.scope_review_originals%ROWTYPE;
  batch steer_execution.scope_review_batches%ROWTYPE;
  review steer_execution.scope_review_runs%ROWTYPE;
  request steer_drafts.scope_review_observations%ROWTYPE;
  fields text[] := ARRAY['organizationId','subject','productId','reviewId','preparationDigest','batchId','stage','draftId','draftRevision','configurationDigest','owner','fencingToken','reservationId','stepInputDigest','payloadDigest','requestDigest','outputDigest'];
  envelope_fields text[] := ARRAY['version','keyId','iv','tag','ciphertext'];
BEGIN
  IF session_user <> 'steer_draft_runtime'
    OR NEW.organization_id IS DISTINCT FROM nullif(current_setting('steer.draft_organization',true),'')
    OR NEW.subject IS DISTINCT FROM nullif(current_setting('steer.draft_subject',true),'')
    OR NEW.product_id IS DISTINCT FROM nullif(current_setting('steer.draft_product',true),'')
    THEN RAISE EXCEPTION 'Scope observation unavailable' USING ERRCODE='23514'; END IF;
  SELECT * INTO draft FROM steer_drafts.draft_lifecycles
    WHERE organization_id=NEW.organization_id AND draft_id=NEW.draft_id FOR UPDATE;
  IF NOT FOUND OR draft.subject IS DISTINCT FROM NEW.subject OR draft.product_id IS DISTINCT FROM NEW.product_id
    OR draft.held OR draft.created_at>clock_timestamp() OR draft.use_until<=clock_timestamp()
    THEN RAISE EXCEPTION 'Scope observation unavailable' USING ERRCODE='23514'; END IF;
  SELECT * INTO original FROM steer_drafts.scope_review_originals
    WHERE organization_id=NEW.organization_id AND review_id=NEW.review_id;
  SELECT * INTO review FROM steer_execution.scope_review_runs
    WHERE organization_id=NEW.organization_id AND review_id=NEW.review_id;
  -- Serialize the insert with execution state changes; an earlier adapter check
  -- alone is insufficient when quarantine wins the race before this transaction.
  SELECT * INTO batch FROM steer_execution.scope_review_batches
    WHERE organization_id=NEW.organization_id AND review_id=NEW.review_id AND batch_id=NEW.batch_id FOR SHARE;
  IF original.review_id IS NULL OR review.review_id IS NULL OR batch.batch_id IS NULL
    OR original.subject IS DISTINCT FROM NEW.subject OR original.product_id IS DISTINCT FROM NEW.product_id
    OR original.draft_id IS DISTINCT FROM NEW.draft_id OR original.draft_revision IS DISTINCT FROM NEW.draft_revision
    OR review.subject IS DISTINCT FROM NEW.subject OR review.product_id IS DISTINCT FROM NEW.product_id
    OR review.draft_id IS DISTINCT FROM NEW.draft_id OR review.draft_revision IS DISTINCT FROM NEW.draft_revision
    OR original.record->'executionConfigurationDigest' IS DISTINCT FROM to_jsonb(review.configuration_digest)
    OR review.expires_at<=clock_timestamp() OR batch.record->>'state' IS DISTINCT FROM 'dispatch-committed'
    OR batch.subject IS DISTINCT FROM NEW.subject OR batch.product_id IS DISTINCT FROM NEW.product_id
    OR jsonb_typeof(NEW.record) IS DISTINCT FROM 'object' OR NOT (NEW.record ?& fields) OR NEW.record - fields <> '{}'::jsonb
    OR NEW.record->'organizationId' IS DISTINCT FROM to_jsonb(NEW.organization_id)
    OR NEW.record->'subject' IS DISTINCT FROM to_jsonb(NEW.subject) OR NEW.record->'productId' IS DISTINCT FROM to_jsonb(NEW.product_id)
    OR NEW.record->'reviewId' IS DISTINCT FROM to_jsonb(NEW.review_id::text) OR NEW.record->'batchId' IS DISTINCT FROM to_jsonb(NEW.batch_id)
    OR NEW.record->'stage' IS DISTINCT FROM to_jsonb(NEW.stage) OR NEW.record->'draftId' IS DISTINCT FROM to_jsonb(NEW.draft_id::text)
    OR NEW.record->'draftRevision' IS DISTINCT FROM to_jsonb(NEW.draft_revision)
    OR NEW.record->'configurationDigest' IS DISTINCT FROM to_jsonb(draft.configuration_digest)
    OR NEW.record->'configurationDigest' IS DISTINCT FROM original.record->'configurationDigest'
    OR NEW.record->'preparationDigest' IS DISTINCT FROM to_jsonb(original.preparation_digest)
    OR NEW.record->'preparationDigest' IS DISTINCT FROM to_jsonb(review.preparation_digest)
    OR NEW.record->'owner' IS DISTINCT FROM batch.record->'owner' OR NEW.record->'fencingToken' IS DISTINCT FROM batch.record->'fencingToken'
    OR NEW.record->'reservationId' IS DISTINCT FROM to_jsonb(batch.reservation_id::text)
    OR NEW.record->'stepInputDigest' IS DISTINCT FROM batch.record->'binding'->'inputDigest'
    OR NEW.record->'payloadDigest' IS DISTINCT FROM to_jsonb(NEW.payload_digest)
    OR NEW.stage NOT IN ('request','response')
    THEN RAISE EXCEPTION 'Invalid scope observation binding' USING ERRCODE='23514'; END IF;
  IF NEW.stage='request' THEN
    IF NEW.record->'requestDigest' IS DISTINCT FROM 'null'::jsonb OR NEW.record->'outputDigest' IS DISTINCT FROM 'null'::jsonb
      THEN RAISE EXCEPTION 'Invalid scope request' USING ERRCODE='23514'; END IF;
  ELSE
    SELECT * INTO request FROM steer_drafts.scope_review_observations
      WHERE organization_id=NEW.organization_id AND review_id=NEW.review_id AND batch_id=NEW.batch_id AND stage='request';
    IF request.review_id IS NULL OR NEW.record->'requestDigest' IS DISTINCT FROM to_jsonb(request.payload_digest)
      OR (NEW.record-ARRAY['stage','payloadDigest','requestDigest','outputDigest']) IS DISTINCT FROM
        (request.record-ARRAY['stage','payloadDigest','requestDigest','outputDigest'])
      OR jsonb_typeof(NEW.record->'outputDigest') IS DISTINCT FROM 'string'
      OR coalesce(NEW.record->>'outputDigest','') !~ '^[a-f0-9]{64}$'
      THEN RAISE EXCEPTION 'Invalid scope response' USING ERRCODE='23514'; END IF;
  END IF;
  IF jsonb_typeof(NEW.encrypted_value) IS DISTINCT FROM 'object' OR NOT (NEW.encrypted_value ?& envelope_fields)
    OR NEW.encrypted_value-envelope_fields <> '{}'::jsonb OR NEW.encrypted_value->'version' IS DISTINCT FROM '1'::jsonb
    OR coalesce(NEW.encrypted_value->>'keyId','') !~ '^[A-Za-z0-9_-]{1,100}$'
    OR coalesce(NEW.encrypted_value->>'iv','') !~ '^[A-Za-z0-9_-]{16}$'
    OR coalesce(NEW.encrypted_value->>'tag','') !~ '^[A-Za-z0-9_-]{22}$'
    OR coalesce(NEW.encrypted_value->>'ciphertext','') !~ '^[A-Za-z0-9_-]+$'
    THEN RAISE EXCEPTION 'Invalid scope observation envelope' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION steer_drafts.guard_scope_observation() FROM PUBLIC,steer_app,steer_projector,steer_auth_runtime,steer_draft_runtime;
--> statement-breakpoint
CREATE TRIGGER scope_observation_guard BEFORE INSERT ON steer_drafts.scope_review_observations
  FOR EACH ROW EXECUTE FUNCTION steer_drafts.guard_scope_observation();
