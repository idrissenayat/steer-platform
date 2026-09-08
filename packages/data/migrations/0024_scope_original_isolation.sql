-- Development-only until exact records adoption; no runtime activation or deletion.
ALTER TABLE steer_drafts.scope_review_originals FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON steer_drafts.scope_review_originals FROM PUBLIC,steer_app,steer_projector,steer_auth_runtime,steer_draft_runtime;
--> statement-breakpoint
GRANT SELECT,INSERT ON steer_drafts.scope_review_originals TO steer_draft_runtime;
--> statement-breakpoint
CREATE FUNCTION steer_drafts.guard_scope_original() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  draft steer_drafts.draft_lifecycles%ROWTYPE;
  source steer_drafts.draft_revisions%ROWTYPE;
  chunk jsonb;
  fields text[] := ARRAY['organizationId','subject','productId','reviewId','preparationDigest','payloadDigest','draftId','draftRevision','draftRevisionDigest','scopeInputDigest','configurationDigest','executionConfigurationDigest'];
  envelope_fields text[] := ARRAY['version','keyId','iv','tag','ciphertext'];
BEGIN
  SELECT * INTO draft FROM steer_drafts.draft_lifecycles WHERE organization_id=NEW.organization_id AND draft_id=NEW.draft_id FOR UPDATE;
  IF NOT FOUND OR draft.held OR draft.created_at>clock_timestamp() OR draft.use_until<=clock_timestamp()
    THEN RAISE EXCEPTION 'Draft unavailable' USING ERRCODE='23514'; END IF;
  SELECT * INTO source FROM steer_drafts.draft_revisions WHERE organization_id=NEW.organization_id AND draft_id=NEW.draft_id AND revision=NEW.draft_revision;
  IF NOT FOUND OR draft.subject IS DISTINCT FROM NEW.subject OR draft.product_id IS DISTINCT FROM NEW.product_id
    OR NEW.draft_revision <> (SELECT max(revision) FROM steer_drafts.draft_revisions WHERE organization_id=NEW.organization_id AND draft_id=NEW.draft_id)
    OR jsonb_typeof(NEW.record) IS DISTINCT FROM 'object' OR NOT (NEW.record ?& fields) OR NEW.record - fields <> '{}'::jsonb
    OR NEW.record->>'organizationId' IS DISTINCT FROM NEW.organization_id OR NEW.record->>'subject' IS DISTINCT FROM NEW.subject
    OR NEW.record->>'productId' IS DISTINCT FROM NEW.product_id OR NEW.record->>'reviewId' IS DISTINCT FROM NEW.review_id::text
    OR NEW.record->>'preparationDigest' IS DISTINCT FROM NEW.preparation_digest OR NEW.record->>'payloadDigest' IS DISTINCT FROM NEW.payload_digest
    OR NEW.record->>'draftId' IS DISTINCT FROM NEW.draft_id::text OR (NEW.record->>'draftRevision')::bigint IS DISTINCT FROM NEW.draft_revision
    OR NEW.record->>'draftRevisionDigest' IS DISTINCT FROM source.revision_digest
    OR NEW.record->>'scopeInputDigest' IS DISTINCT FROM source.record->>'scopeInputDigest'
    OR NEW.record->>'configurationDigest' IS DISTINCT FROM draft.configuration_digest
    OR coalesce(NEW.record->>'executionConfigurationDigest','') !~ '^[a-f0-9]{64}$'
    OR jsonb_typeof(NEW.encrypted_value) IS DISTINCT FROM 'object'
    OR NOT (NEW.encrypted_value ?& ARRAY['version','chunks']) OR NEW.encrypted_value - ARRAY['version','chunks'] <> '{}'::jsonb
    OR NEW.encrypted_value->'version' IS DISTINCT FROM '1'::jsonb OR jsonb_typeof(NEW.encrypted_value->'chunks') IS DISTINCT FROM 'array'
    OR jsonb_array_length(NEW.encrypted_value->'chunks') NOT BETWEEN 1 AND 8
    THEN RAISE EXCEPTION 'Invalid scope original' USING ERRCODE='23514'; END IF;
  FOR chunk IN SELECT value FROM jsonb_array_elements(NEW.encrypted_value->'chunks') LOOP
    IF jsonb_typeof(chunk) IS DISTINCT FROM 'object' OR NOT (chunk ?& envelope_fields) OR chunk - envelope_fields <> '{}'::jsonb
      OR chunk->'version' IS DISTINCT FROM '1'::jsonb OR coalesce(chunk->>'keyId','') !~ '^[A-Za-z0-9_-]{1,100}$'
      OR chunk->>'keyId' IS DISTINCT FROM NEW.encrypted_value->'chunks'->0->>'keyId'
      OR coalesce(chunk->>'iv','') !~ '^[A-Za-z0-9_-]{16}$' OR coalesce(chunk->>'tag','') !~ '^[A-Za-z0-9_-]{22}$'
      OR coalesce(chunk->>'ciphertext','') !~ '^[A-Za-z0-9_-]+$' OR octet_length(chunk::text)>500000
      THEN RAISE EXCEPTION 'Invalid scope envelope' USING ERRCODE='23514'; END IF;
  END LOOP;
  RETURN NEW;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION steer_drafts.guard_scope_original() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER scope_original_guard BEFORE INSERT ON steer_drafts.scope_review_originals
  FOR EACH ROW EXECUTE FUNCTION steer_drafts.guard_scope_original();
