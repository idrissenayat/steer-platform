-- Development-only until records/authority activation. No provisioning or grants
-- to change role terms, refunds, deletion, success claims or execution resets.
ALTER TABLE steer_usage.scope_review_terms FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE steer_execution.scope_review_runs FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE steer_execution.scope_review_batches FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON steer_usage.scope_review_terms, steer_execution.scope_review_runs, steer_execution.scope_review_batches
  FROM PUBLIC, steer_app, steer_projector, steer_auth_runtime, steer_draft_runtime;
--> statement-breakpoint
GRANT SELECT ON steer_usage.scope_review_terms TO steer_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON steer_execution.scope_review_runs, steer_execution.scope_review_batches TO steer_app;
--> statement-breakpoint
GRANT UPDATE (record) ON steer_execution.scope_review_batches TO steer_app;
--> statement-breakpoint
CREATE FUNCTION steer_execution.guard_scope_run() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE m jsonb := NEW.manifest; b jsonb; k text;
BEGIN
  IF jsonb_typeof(m) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(m)) <> 13
    OR m->>'kind' IS DISTINCT FROM 'steer-scope-review-manifest/v1'
    OR m->>'organizationId' IS DISTINCT FROM NEW.organization_id OR m->>'productId' IS DISTINCT FROM NEW.product_id
    OR m->>'draftId' IS DISTINCT FROM NEW.draft_id::text OR m->>'draftRevision' IS DISTINCT FROM NEW.draft_revision::text
    OR m->>'preparationDigest' IS DISTINCT FROM NEW.preparation_digest
    OR coalesce(length(m->>'repository'),0) NOT BETWEEN 1 AND 200
    OR coalesce((m->>'sourceRevision')::bigint,0) NOT BETWEEN 1 AND NEW.draft_revision
    OR jsonb_typeof(m->'batches') IS DISTINCT FROM 'array' OR jsonb_array_length(m->'batches') NOT BETWEEN 1 AND 8
    THEN RAISE EXCEPTION 'Invalid scope manifest' USING ERRCODE='23514'; END IF;
  FOREACH k IN ARRAY ARRAY['scopeInputDigest','sourceSnapshotDigest','planDigest','profileDigest'] LOOP
    IF coalesce(m->>k,'') !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid scope digest' USING ERRCODE='23514'; END IF;
  END LOOP;
  FOR b IN SELECT value FROM jsonb_array_elements(m->'batches') LOOP
    IF jsonb_typeof(b) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(b)) <> 2
      OR coalesce(b->>'batchId','') !~ '^[a-f0-9]{64}$' OR coalesce(b->>'inputDigest','') !~ '^[a-f0-9]{64}$'
      THEN RAISE EXCEPTION 'Invalid scope batch manifest' USING ERRCODE='23514'; END IF;
  END LOOP;
  IF (SELECT count(DISTINCT value->>'batchId') FROM jsonb_array_elements(m->'batches')) <> jsonb_array_length(m->'batches')
    THEN RAISE EXCEPTION 'Duplicate scope batch' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION steer_execution.guard_scope_run() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER scope_run_guard BEFORE INSERT ON steer_execution.scope_review_runs
  FOR EACH ROW EXECUTE FUNCTION steer_execution.guard_scope_run();
--> statement-breakpoint
CREATE FUNCTION steer_execution.guard_scope_batch() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  clock_ms bigint := floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
  after_state text := NEW.record->>'state';
  before_state text;
  review steer_execution.scope_review_runs%ROWTYPE;
  reservation steer_usage.model_reservations%ROWTYPE;
  expected_input text;
BEGIN
  SELECT * INTO review FROM steer_execution.scope_review_runs
    WHERE organization_id=NEW.organization_id AND review_id=NEW.review_id
      AND subject=NEW.subject AND product_id=NEW.product_id AND clock_timestamp() < expires_at;
  SELECT * INTO reservation FROM steer_usage.model_reservations
    WHERE organization_id=NEW.organization_id AND budget_id=NEW.budget_id AND reservation_id=NEW.reservation_id;
  SELECT b->>'inputDigest' INTO expected_input FROM jsonb_array_elements(review.manifest->'batches') b
    WHERE b->>'batchId'=NEW.batch_id;
  IF review.review_id IS NULL OR reservation.reservation_id IS NULL OR expected_input IS NULL
    OR reservation.role <> 'scope-reviewer' OR reservation.subject <> NEW.subject
    OR reservation.operation_id IS DISTINCT FROM NEW.review_id OR reservation.step_id IS DISTINCT FROM NEW.batch_id
    OR (NEW.record->'binding'->>'organizationId') IS DISTINCT FROM NEW.organization_id
    OR (NEW.record->'binding'->>'operationId') IS DISTINCT FROM NEW.review_id::text
    OR (NEW.record->'binding'->>'stepId') IS DISTINCT FROM NEW.batch_id
    OR (NEW.record->'binding'->>'subject') IS DISTINCT FROM NEW.subject
    OR (NEW.record->'binding'->>'draftId') IS DISTINCT FROM review.draft_id::text
    OR (NEW.record->'binding'->>'draftRevision') IS DISTINCT FROM review.draft_revision::text
    OR (NEW.record->'binding'->>'inputDigest') IS DISTINCT FROM expected_input
    OR coalesce(length(NEW.record->'binding'->>'configurationRevision'),0) NOT BETWEEN 1 AND 200
    OR (NEW.record->>'reservationId') IS DISTINCT FROM NEW.reservation_id::text
    OR jsonb_typeof(NEW.record) IS DISTINCT FROM 'object' OR jsonb_typeof(NEW.record->'binding') IS DISTINCT FROM 'object'
    OR (SELECT count(*) FROM jsonb_object_keys(NEW.record)) <> 8
    OR (SELECT count(*) FROM jsonb_object_keys(NEW.record->'binding')) <> 8
    OR NEW.record->'resultDigest' IS DISTINCT FROM 'null'::jsonb
    OR (NEW.record->>'fencingToken') IS NULL OR (NEW.record->>'updatedAt') IS NULL
    OR (NEW.record->>'fencingToken')::bigint NOT BETWEEN 1 AND 9007199254740991
    OR (NEW.record->>'updatedAt')::bigint NOT BETWEEN 0 AND clock_ms
    OR coalesce(length(NEW.record->>'owner'),0) NOT BETWEEN 1 AND 200
    OR after_state IS NULL OR after_state NOT IN ('claimed','dispatch-committed','outcome-unknown','failed-known')
    OR ((after_state='claimed') IS DISTINCT FROM (NEW.record->>'leaseUntil' IS NOT NULL))
    OR (after_state='claimed' AND ((NEW.record->>'leaseUntil')::bigint <= clock_ms OR (NEW.record->>'leaseUntil')::bigint > clock_ms+300000))
    THEN RAISE EXCEPTION 'Invalid scope batch' USING ERRCODE='23514'; END IF;
  IF TG_OP='INSERT' THEN
    IF after_state <> 'claimed' OR (NEW.record->>'fencingToken')::bigint <> 1
      THEN RAISE EXCEPTION 'Invalid initial scope batch' USING ERRCODE='23514'; END IF;
  ELSE
    IF (to_jsonb(NEW)-'record') IS DISTINCT FROM (to_jsonb(OLD)-'record')
      OR NEW.record->'binding' IS DISTINCT FROM OLD.record->'binding'
      OR NEW.record->>'reservationId' IS DISTINCT FROM OLD.record->>'reservationId'
      OR (NEW.record->>'updatedAt')::bigint < (OLD.record->>'updatedAt')::bigint
      THEN RAISE EXCEPTION 'Immutable scope batch changed' USING ERRCODE='23514'; END IF;
    before_state := OLD.record->>'state';
    IF before_state='claimed' AND after_state='claimed' THEN
      IF (OLD.record->>'leaseUntil')::bigint > clock_ms
        OR (NEW.record->>'fencingToken')::bigint <> (OLD.record->>'fencingToken')::bigint+1
        THEN RAISE EXCEPTION 'Invalid scope takeover' USING ERRCODE='23514'; END IF;
    ELSE
      IF NEW.record->>'owner' IS DISTINCT FROM OLD.record->>'owner'
        OR NEW.record->>'fencingToken' IS DISTINCT FROM OLD.record->>'fencingToken'
        OR NOT ((before_state='claimed' AND after_state='dispatch-committed' AND (OLD.record->>'leaseUntil')::bigint > clock_ms)
          OR (before_state='dispatch-committed' AND after_state IN ('outcome-unknown','failed-known')))
        THEN RAISE EXCEPTION 'Invalid scope transition' USING ERRCODE='23514'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION steer_execution.guard_scope_batch() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER scope_batch_guard BEFORE INSERT OR UPDATE ON steer_execution.scope_review_batches
  FOR EACH ROW EXECUTE FUNCTION steer_execution.guard_scope_batch();
