-- Runtime roles must be provisioned separately as non-owner, non-bypass roles.
ALTER TABLE "steer"."ingestion_events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "steer"."projection_records" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON SCHEMA "steer" FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA "steer" TO "steer_app", "steer_projector";
--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA "steer" FROM PUBLIC, "steer_app", "steer_projector";
--> statement-breakpoint
GRANT SELECT ON "steer"."ingestion_events", "steer"."projection_records" TO "steer_app", "steer_projector";
--> statement-breakpoint
GRANT INSERT ON "steer"."ingestion_events" TO "steer_projector";
--> statement-breakpoint
GRANT INSERT, UPDATE ON "steer"."projection_records" TO "steer_projector";
