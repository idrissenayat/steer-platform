ALTER TABLE steer_drafts.draft_lifecycles FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON steer_drafts.draft_lifecycles FROM PUBLIC, steer_app, steer_projector, steer_auth_runtime, steer_draft_runtime;
--> statement-breakpoint
GRANT SELECT, INSERT ON steer_drafts.draft_lifecycles TO steer_draft_runtime;
--> statement-breakpoint
GRANT UPDATE (use_until,held,hold_reference,discarded_at,published_at,publication_operation,publication_input) ON steer_drafts.draft_lifecycles TO steer_draft_runtime;
--> statement-breakpoint
CREATE FUNCTION steer_drafts.guard_draft_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.created_at > clock_timestamp()
    OR (NEW.discarded_at IS NOT NULL AND (NEW.discarded_at < NEW.created_at OR NEW.discarded_at > clock_timestamp()))
    OR (NEW.published_at IS NOT NULL AND (NEW.published_at < NEW.created_at OR NEW.published_at > clock_timestamp()))
    THEN RAISE EXCEPTION 'Invalid draft clock' USING ERRCODE='23514'; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.held OR NEW.discarded_at IS NOT NULL OR NEW.published_at IS NOT NULL
      THEN RAISE EXCEPTION 'Invalid initial draft' USING ERRCODE='23514'; END IF;
  ELSE
    IF (to_jsonb(NEW) - ARRAY['use_until','held','hold_reference','discarded_at','published_at','publication_operation','publication_input'])
      IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['use_until','held','hold_reference','discarded_at','published_at','publication_operation','publication_input'])
      OR NEW.use_until > OLD.use_until OR (OLD.held AND NOT NEW.held)
      OR (OLD.hold_reference IS NOT NULL AND NEW.hold_reference IS DISTINCT FROM OLD.hold_reference)
      OR (OLD.discarded_at IS NOT NULL AND NEW.discarded_at IS DISTINCT FROM OLD.discarded_at)
      OR (OLD.published_at IS NOT NULL AND (NEW.published_at IS DISTINCT FROM OLD.published_at
        OR NEW.publication_operation IS DISTINCT FROM OLD.publication_operation OR NEW.publication_input IS DISTINCT FROM OLD.publication_input))
      THEN RAISE EXCEPTION 'Immutable draft lifecycle changed' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION steer_drafts.guard_draft_lifecycle() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER draft_lifecycle_guard BEFORE INSERT OR UPDATE ON steer_drafts.draft_lifecycles
  FOR EACH ROW EXECUTE FUNCTION steer_drafts.guard_draft_lifecycle();
