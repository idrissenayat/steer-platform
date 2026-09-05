-- Derived, repository-scoped delivery cursors. Existing projections require an initial snapshot.
CREATE TABLE "steer"."projection_changes" (
	"organization_id" text NOT NULL,
	"repository" text NOT NULL,
	"generation" uuid NOT NULL,
	"position" bigint NOT NULL,
	"record_key" text NOT NULL,
	"source_revision" text NOT NULL,
	"content_digest" text NOT NULL,
	CONSTRAINT "projection_changes_organization_id_repository_generation_position_pk" PRIMARY KEY("organization_id","repository","generation","position"),
	CONSTRAINT "projection_change_position" CHECK ("steer"."projection_changes"."position" > 0)
);
--> statement-breakpoint
ALTER TABLE "steer"."projection_changes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "steer"."projection_streams" (
	"organization_id" text NOT NULL,
	"repository" text NOT NULL,
	"generation" uuid DEFAULT gen_random_uuid() NOT NULL,
	"position" bigint NOT NULL,
	CONSTRAINT "projection_streams_organization_id_repository_pk" PRIMARY KEY("organization_id","repository"),
	CONSTRAINT "projection_stream_position" CHECK ("steer"."projection_streams"."position" > 0)
);
--> statement-breakpoint
ALTER TABLE "steer"."projection_streams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "change_tenant" ON "steer"."projection_changes" AS PERMISSIVE FOR ALL TO public USING ("steer"."projection_changes"."organization_id" = nullif(current_setting('steer.organization_id', true), '')) WITH CHECK ("steer"."projection_changes"."organization_id" = nullif(current_setting('steer.organization_id', true), ''));--> statement-breakpoint
CREATE POLICY "stream_tenant" ON "steer"."projection_streams" AS PERMISSIVE FOR ALL TO public USING ("steer"."projection_streams"."organization_id" = nullif(current_setting('steer.organization_id', true), '')) WITH CHECK ("steer"."projection_streams"."organization_id" = nullif(current_setting('steer.organization_id', true), ''));
--> statement-breakpoint
ALTER TABLE steer.projection_streams FORCE ROW LEVEL SECURITY;
ALTER TABLE steer.projection_changes FORCE ROW LEVEL SECURITY;
REVOKE ALL ON steer.projection_streams, steer.projection_changes FROM PUBLIC, steer_app, steer_projector;
GRANT SELECT ON steer.projection_streams, steer.projection_changes TO steer_app, steer_projector;
GRANT INSERT, UPDATE ON steer.projection_streams TO steer_projector;
GRANT INSERT ON steer.projection_changes TO steer_projector;
--> statement-breakpoint
CREATE FUNCTION steer.record_projection_change() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
DECLARE stream_generation uuid; stream_position bigint;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.organization_id, NEW.repository, NEW.record_key)
    IS DISTINCT FROM (OLD.organization_id, OLD.repository, OLD.record_key) THEN
    RAISE EXCEPTION 'Projection identity cannot move between streams';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN RETURN NEW; END IF;
  -- The row lock is held until commit: a later position cannot commit first.
  -- Rollback reverts the position and event together with the projection.
  INSERT INTO steer.projection_streams (organization_id, repository, position)
    VALUES (NEW.organization_id, NEW.repository, 1)
    ON CONFLICT (organization_id, repository) DO UPDATE
      SET position = steer.projection_streams.position + 1
    RETURNING generation, position INTO stream_generation, stream_position;
  INSERT INTO steer.projection_changes
    (organization_id, repository, generation, position, record_key, source_revision, content_digest)
    VALUES (NEW.organization_id, NEW.repository, stream_generation, stream_position,
      NEW.record_key, NEW.source_revision, NEW.content_digest);
  RETURN NEW;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION steer.record_projection_change() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION steer.record_projection_change() TO steer_projector;
CREATE TRIGGER projection_change AFTER INSERT OR UPDATE ON steer.projection_records
  FOR EACH ROW EXECUTE FUNCTION steer.record_projection_change();
