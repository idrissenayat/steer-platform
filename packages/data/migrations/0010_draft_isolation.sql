-- Separate encrypted content role. No grant to projection, API or auth roles.
ALTER TABLE steer_drafts.candidate_originals FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON SCHEMA steer_drafts FROM PUBLIC, steer_app, steer_projector, steer_auth_runtime, steer_draft_runtime;
--> statement-breakpoint
GRANT USAGE ON SCHEMA steer_drafts TO steer_draft_runtime;
--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA steer_drafts FROM PUBLIC, steer_app, steer_projector, steer_auth_runtime, steer_draft_runtime;
--> statement-breakpoint
GRANT SELECT, INSERT ON steer_drafts.candidate_originals TO steer_draft_runtime;
--> statement-breakpoint
GRANT UPDATE (use_until, held) ON steer_drafts.candidate_originals TO steer_draft_runtime;
--> statement-breakpoint
CREATE FUNCTION steer_drafts.guard_candidate_original() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.draft_created_at > clock_timestamp() OR NEW.use_until <= clock_timestamp() OR NEW.held
      THEN RAISE EXCEPTION 'Draft unavailable' USING ERRCODE='23514'; END IF;
  ELSE
    IF (to_jsonb(NEW) - 'use_until' - 'held') IS DISTINCT FROM (to_jsonb(OLD) - 'use_until' - 'held')
      OR NEW.use_until > OLD.use_until OR (OLD.held AND NOT NEW.held)
      THEN RAISE EXCEPTION 'Immutable draft changed' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION steer_drafts.guard_candidate_original() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER candidate_original_guard BEFORE INSERT OR UPDATE ON steer_drafts.candidate_originals
  FOR EACH ROW EXECUTE FUNCTION steer_drafts.guard_candidate_original();
