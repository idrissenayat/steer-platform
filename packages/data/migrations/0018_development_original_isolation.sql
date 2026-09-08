-- Disposable development only; real migration activation remains held.
ALTER TABLE steer_drafts.development_originals FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON steer_drafts.development_originals FROM PUBLIC,steer_app,steer_projector,steer_auth_runtime,steer_draft_runtime;
--> statement-breakpoint
GRANT SELECT,INSERT ON steer_drafts.development_originals TO steer_draft_runtime;
--> statement-breakpoint
CREATE FUNCTION steer_drafts.guard_development_original() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  draft steer_drafts.draft_lifecycles%ROWTYPE;
  source steer_drafts.draft_revisions%ROWTYPE;
  fields text[] := ARRAY['organizationId','subject','productId','operationId','inputDigest','draftId','draftRevision','draftRevisionDigest','scopeInputDigest','configurationDigest','executionConfigurationDigest'];
BEGIN
  SELECT * INTO draft FROM steer_drafts.draft_lifecycles WHERE organization_id=NEW.organization_id AND draft_id=NEW.draft_id FOR UPDATE;
  IF NOT FOUND OR draft.held OR draft.created_at>clock_timestamp() OR draft.use_until<=clock_timestamp()
    THEN RAISE EXCEPTION 'Draft unavailable' USING ERRCODE='23514'; END IF;
  SELECT * INTO source FROM steer_drafts.draft_revisions WHERE organization_id=NEW.organization_id AND draft_id=NEW.draft_id AND revision=NEW.draft_revision;
  IF NOT FOUND OR draft.subject IS DISTINCT FROM NEW.subject OR draft.product_id IS DISTINCT FROM NEW.product_id
    OR jsonb_typeof(NEW.record) IS DISTINCT FROM 'object' OR NOT (NEW.record ?& fields) OR NEW.record - fields <> '{}'::jsonb
    OR NEW.record->>'organizationId' IS DISTINCT FROM NEW.organization_id OR NEW.record->>'subject' IS DISTINCT FROM NEW.subject
    OR NEW.record->>'productId' IS DISTINCT FROM NEW.product_id OR NEW.record->>'operationId' IS DISTINCT FROM NEW.operation_id::text
    OR NEW.record->>'inputDigest' IS DISTINCT FROM NEW.input_digest OR NEW.record->>'draftId' IS DISTINCT FROM NEW.draft_id::text
    OR (NEW.record->>'draftRevision')::bigint IS DISTINCT FROM NEW.draft_revision
    OR NEW.record->>'draftRevisionDigest' IS DISTINCT FROM source.revision_digest
    OR NEW.record->>'scopeInputDigest' IS DISTINCT FROM source.record->>'scopeInputDigest'
    OR NEW.record->>'configurationDigest' IS DISTINCT FROM draft.configuration_digest
    OR NEW.record->>'executionConfigurationDigest' IS NULL OR NEW.record->>'executionConfigurationDigest' !~ '^[a-f0-9]{64}$'
    THEN RAISE EXCEPTION 'Invalid development original' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION steer_drafts.guard_development_original() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER development_original_guard BEFORE INSERT ON steer_drafts.development_originals
  FOR EACH ROW EXECUTE FUNCTION steer_drafts.guard_development_original();
