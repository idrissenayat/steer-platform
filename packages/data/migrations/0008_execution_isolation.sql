-- Execution rows are durable accounting/ownership records, not disposable projections.
-- No runtime deletion, binding rewrite, budget activation, refund or arbitrary SQL.
ALTER TABLE steer_execution.intent_operations FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE steer_execution.intent_steps FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON SCHEMA steer_execution FROM PUBLIC, steer_app, steer_projector, steer_auth_runtime;
--> statement-breakpoint
GRANT USAGE ON SCHEMA steer_execution TO steer_app;
--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA steer_execution FROM PUBLIC, steer_app, steer_projector, steer_auth_runtime;
--> statement-breakpoint
GRANT SELECT, INSERT ON steer_execution.intent_operations, steer_execution.intent_steps TO steer_app;
--> statement-breakpoint
GRANT UPDATE (record, result_ref) ON steer_execution.intent_steps TO steer_app;
--> statement-breakpoint
CREATE FUNCTION steer_execution.guard_intent_step() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  before_state text;
  after_state text := NEW.record->>'state';
  clock_ms bigint := floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
BEGIN
  IF (NEW.record->'binding'->>'organizationId') IS DISTINCT FROM NEW.organization_id
    OR (NEW.record->'binding'->>'operationId') IS DISTINCT FROM NEW.operation_id::text
    OR (NEW.record->'binding'->>'subject') IS DISTINCT FROM NEW.subject
    OR (NEW.record->'binding'->>'stepId') IS DISTINCT FROM NEW.step_id
    OR (NEW.record->>'reservationId') IS DISTINCT FROM NEW.reservation_id::text
    OR (NEW.record->>'fencingToken') IS NULL OR (NEW.record->>'updatedAt') IS NULL
    OR (NEW.record->>'fencingToken')::bigint NOT BETWEEN 1 AND 9007199254740991
    OR (NEW.record->>'updatedAt')::bigint NOT BETWEEN 0 AND clock_ms
    OR (NEW.record->>'owner') IS NULL
    OR after_state IS NULL OR after_state NOT IN ('claimed','dispatch-committed','outcome-unknown','succeeded','failed-known')
    OR ((after_state = 'succeeded') IS DISTINCT FROM (NEW.result_ref IS NOT NULL))
    OR ((after_state = 'succeeded') IS DISTINCT FROM (NEW.record->>'resultDigest' IS NOT NULL))
    OR ((after_state = 'claimed') IS DISTINCT FROM (NEW.record->>'leaseUntil' IS NOT NULL))
    OR (after_state = 'claimed' AND ((NEW.record->>'leaseUntil')::bigint <= clock_ms OR (NEW.record->>'leaseUntil')::bigint > clock_ms+300000))
    THEN RAISE EXCEPTION 'Invalid execution step' USING ERRCODE='23514'; END IF;
  IF TG_OP = 'INSERT' THEN
    IF after_state <> 'claimed' OR (NEW.record->>'fencingToken')::bigint <> 1
      THEN RAISE EXCEPTION 'Invalid initial step' USING ERRCODE='23514'; END IF;
  ELSE
    before_state := OLD.record->>'state';
    IF NEW.record->'binding' IS DISTINCT FROM OLD.record->'binding'
      OR (NEW.record->>'updatedAt')::bigint < (OLD.record->>'updatedAt')::bigint
      THEN RAISE EXCEPTION 'Immutable step changed' USING ERRCODE='23514'; END IF;
    IF before_state='claimed' AND after_state='claimed' THEN
      IF (OLD.record->>'leaseUntil')::bigint > clock_ms
        OR (NEW.record->>'fencingToken')::bigint <> (OLD.record->>'fencingToken')::bigint+1
        THEN RAISE EXCEPTION 'Invalid takeover' USING ERRCODE='23514'; END IF;
    ELSE
      IF NEW.record->>'owner' IS DISTINCT FROM OLD.record->>'owner'
        OR NEW.record->>'fencingToken' IS DISTINCT FROM OLD.record->>'fencingToken'
        OR NOT ((before_state='claimed' AND after_state='dispatch-committed' AND (OLD.record->>'leaseUntil')::bigint > clock_ms)
          OR (before_state='dispatch-committed' AND after_state IN ('outcome-unknown','succeeded','failed-known')))
        THEN RAISE EXCEPTION 'Invalid one-way transition' USING ERRCODE='23514'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION steer_execution.guard_intent_step() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER intent_step_guard BEFORE INSERT OR UPDATE ON steer_execution.intent_steps
  FOR EACH ROW EXECUTE FUNCTION steer_execution.guard_intent_step();
