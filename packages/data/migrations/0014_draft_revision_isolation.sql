ALTER TABLE steer_drafts.draft_revisions FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON steer_drafts.draft_revisions FROM PUBLIC, steer_app, steer_projector, steer_auth_runtime, steer_draft_runtime;
--> statement-breakpoint
GRANT SELECT, INSERT ON steer_drafts.draft_revisions TO steer_draft_runtime;
--> statement-breakpoint
CREATE FUNCTION steer_drafts.guard_draft_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  draft steer_drafts.draft_lifecycles%ROWTYPE;
  predecessor steer_drafts.draft_revisions%ROWTYPE;
  fields text[] := ARRAY['organizationId','subject','productId','draftId','revision','mutationId','commandDigest','parentRevision','parentDigest','sourceRevision','contentDigest','scopeInputDigest','configurationDigest','draftCreatedAt'];
BEGIN
  SELECT * INTO draft FROM steer_drafts.draft_lifecycles WHERE organization_id=NEW.organization_id AND draft_id=NEW.draft_id FOR UPDATE;
  IF NOT FOUND OR draft.held OR draft.use_until <= clock_timestamp()
    THEN RAISE EXCEPTION 'Draft unavailable' USING ERRCODE='23514'; END IF;
  IF jsonb_typeof(NEW.record) IS DISTINCT FROM 'object' OR NOT (NEW.record ?& fields) OR NEW.record - fields <> '{}'::jsonb
    OR NEW.record->>'organizationId' IS DISTINCT FROM NEW.organization_id
    OR NEW.record->>'subject' IS DISTINCT FROM NEW.subject OR NEW.subject IS DISTINCT FROM draft.subject
    OR NEW.record->>'productId' IS DISTINCT FROM NEW.product_id OR NEW.product_id IS DISTINCT FROM draft.product_id
    OR NEW.record->>'draftId' IS DISTINCT FROM NEW.draft_id::text
    OR NEW.record->>'mutationId' IS DISTINCT FROM NEW.mutation_id::text
    OR NEW.record->>'commandDigest' IS DISTINCT FROM NEW.command_digest
    OR NEW.record->>'configurationDigest' IS DISTINCT FROM draft.configuration_digest
    OR (NEW.record->>'draftCreatedAt')::timestamptz IS DISTINCT FROM draft.created_at
    OR (NEW.record->>'revision')::bigint IS DISTINCT FROM NEW.revision
    OR (NEW.record->>'parentRevision')::bigint IS DISTINCT FROM NEW.revision-1
    OR NEW.record->>'sourceRevision' IS NULL OR (NEW.record->>'sourceRevision')::bigint NOT BETWEEN 1 AND NEW.revision
    OR NEW.record->>'contentDigest' IS NULL OR NEW.record->>'contentDigest' !~ '^[a-f0-9]{64}$'
    OR NEW.record->>'scopeInputDigest' IS NULL OR NEW.record->>'scopeInputDigest' !~ '^[a-f0-9]{64}$'
    THEN RAISE EXCEPTION 'Invalid draft revision' USING ERRCODE='23514'; END IF;
  SELECT * INTO predecessor FROM steer_drafts.draft_revisions
    WHERE organization_id=NEW.organization_id AND draft_id=NEW.draft_id ORDER BY revision DESC LIMIT 1;
  IF NEW.revision IS DISTINCT FROM COALESCE(predecessor.revision,0)+1
    OR NEW.record->>'parentDigest' IS DISTINCT FROM predecessor.revision_digest
    OR (NEW.record->>'sourceRevision')::bigint NOT BETWEEN COALESCE((predecessor.record->>'sourceRevision')::bigint,1) AND COALESCE((predecessor.record->>'sourceRevision')::bigint,0)+1
    THEN RAISE EXCEPTION 'Draft parent changed' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION steer_drafts.guard_draft_revision() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER draft_revision_guard BEFORE INSERT ON steer_drafts.draft_revisions
  FOR EACH ROW EXECUTE FUNCTION steer_drafts.guard_draft_revision();
