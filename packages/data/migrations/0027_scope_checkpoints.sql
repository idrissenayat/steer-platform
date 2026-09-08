-- Development only. Existing ownership and reservation guards stay in force;
-- succeeded binds an immutable encrypted response, never semantic clearance.
CREATE OR REPLACE FUNCTION steer_execution.guard_scope_batch() RETURNS trigger LANGUAGE plpgsql AS $$
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
    OR (after_state<>'succeeded' AND NEW.record->'resultDigest' IS DISTINCT FROM 'null'::jsonb)
    OR (after_state='succeeded' AND (jsonb_typeof(NEW.record->'resultDigest') IS DISTINCT FROM 'string'
      OR coalesce(NEW.record->>'resultDigest','') !~ '^[a-f0-9]{64}$'))
    OR (NEW.record->>'fencingToken') IS NULL OR (NEW.record->>'updatedAt') IS NULL
    OR (NEW.record->>'fencingToken')::bigint NOT BETWEEN 1 AND 9007199254740991
    OR (NEW.record->>'updatedAt')::bigint NOT BETWEEN 0 AND clock_ms
    OR coalesce(length(NEW.record->>'owner'),0) NOT BETWEEN 1 AND 200
    OR after_state IS NULL OR after_state NOT IN ('claimed','dispatch-committed','outcome-unknown','failed-known','succeeded')
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
          OR (before_state='dispatch-committed' AND after_state IN ('outcome-unknown','failed-known','succeeded')))
        THEN RAISE EXCEPTION 'Invalid scope transition' USING ERRCODE='23514'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
-- This narrow trigger can examine retained metadata but cannot expose it to the
-- execution runtime. The trusted migration owner, fixed path, exact session role
-- and transaction-local scope checks are required; public execution is revoked.
CREATE FUNCTION steer_execution.guard_scope_checkpoint() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE
  response steer_drafts.scope_review_observations%ROWTYPE;
  request steer_drafts.scope_review_observations%ROWTYPE;
  original steer_drafts.scope_review_originals%ROWTYPE;
  draft steer_drafts.draft_lifecycles%ROWTYPE;
  review steer_execution.scope_review_runs%ROWTYPE;
BEGIN
  IF NEW.record->>'state' IS DISTINCT FROM 'succeeded' THEN RETURN NEW; END IF;
  IF session_user <> 'steer_app'
    OR NEW.organization_id IS DISTINCT FROM nullif(current_setting('steer.execution_organization',true),'')
    OR NEW.subject IS DISTINCT FROM nullif(current_setting('steer.execution_subject',true),'')
    OR NEW.product_id IS DISTINCT FROM nullif(current_setting('steer.execution_product',true),'')
    THEN RAISE EXCEPTION 'Scope checkpoint unavailable' USING ERRCODE='23514'; END IF;
  SELECT * INTO response FROM steer_drafts.scope_review_observations
    WHERE organization_id=NEW.organization_id AND review_id=NEW.review_id AND batch_id=NEW.batch_id AND stage='response';
  SELECT * INTO request FROM steer_drafts.scope_review_observations
    WHERE organization_id=NEW.organization_id AND review_id=NEW.review_id AND batch_id=NEW.batch_id AND stage='request';
  SELECT * INTO original FROM steer_drafts.scope_review_originals
    WHERE organization_id=NEW.organization_id AND review_id=NEW.review_id;
  SELECT * INTO review FROM steer_execution.scope_review_runs
    WHERE organization_id=NEW.organization_id AND review_id=NEW.review_id;
  -- A lifecycle writer may take the reverse lock order through an observation.
  -- Fail immediately on contention rather than waiting while holding this batch.
  SELECT * INTO draft FROM steer_drafts.draft_lifecycles
    WHERE organization_id=NEW.organization_id AND draft_id=review.draft_id FOR SHARE NOWAIT;
  IF response.review_id IS NULL OR request.review_id IS NULL OR original.review_id IS NULL OR review.review_id IS NULL OR draft.draft_id IS NULL
    OR response.subject IS DISTINCT FROM NEW.subject OR response.product_id IS DISTINCT FROM NEW.product_id
    OR request.subject IS DISTINCT FROM NEW.subject OR request.product_id IS DISTINCT FROM NEW.product_id
    OR original.subject IS DISTINCT FROM NEW.subject OR original.product_id IS DISTINCT FROM NEW.product_id
    OR review.subject IS DISTINCT FROM NEW.subject OR review.product_id IS DISTINCT FROM NEW.product_id
    OR draft.subject IS DISTINCT FROM NEW.subject OR draft.product_id IS DISTINCT FROM NEW.product_id
    OR draft.held OR draft.created_at>clock_timestamp() OR draft.use_until<=clock_timestamp() OR review.expires_at<=clock_timestamp()
    OR response.draft_id IS DISTINCT FROM review.draft_id OR response.draft_revision IS DISTINCT FROM review.draft_revision
    OR original.draft_id IS DISTINCT FROM review.draft_id OR original.draft_revision IS DISTINCT FROM review.draft_revision
    OR response.record->'configurationDigest' IS DISTINCT FROM to_jsonb(draft.configuration_digest)
    OR original.record->'configurationDigest' IS DISTINCT FROM to_jsonb(draft.configuration_digest)
    OR original.record->'executionConfigurationDigest' IS DISTINCT FROM to_jsonb(review.configuration_digest)
    OR response.record->'preparationDigest' IS DISTINCT FROM to_jsonb(review.preparation_digest)
    OR response.payload_digest IS DISTINCT FROM NEW.record->>'resultDigest'
    OR response.record->'payloadDigest' IS DISTINCT FROM to_jsonb(response.payload_digest)
    OR response.record->'requestDigest' IS DISTINCT FROM to_jsonb(request.payload_digest)
    OR (response.record-ARRAY['stage','payloadDigest','requestDigest','outputDigest']) IS DISTINCT FROM
      (request.record-ARRAY['stage','payloadDigest','requestDigest','outputDigest'])
    OR response.record->'owner' IS DISTINCT FROM NEW.record->'owner'
    OR response.record->'fencingToken' IS DISTINCT FROM NEW.record->'fencingToken'
    OR response.record->'reservationId' IS DISTINCT FROM NEW.record->'reservationId'
    OR response.record->'stepInputDigest' IS DISTINCT FROM NEW.record->'binding'->'inputDigest'
    THEN RAISE EXCEPTION 'Invalid scope checkpoint binding' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION steer_execution.guard_scope_checkpoint() FROM PUBLIC,steer_app,steer_projector,steer_auth_runtime,steer_draft_runtime;
--> statement-breakpoint
CREATE TRIGGER scope_checkpoint_guard BEFORE INSERT OR UPDATE ON steer_execution.scope_review_batches
  FOR EACH ROW EXECUTE FUNCTION steer_execution.guard_scope_checkpoint();
