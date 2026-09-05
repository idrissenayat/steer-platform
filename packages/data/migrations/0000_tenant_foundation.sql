CREATE SCHEMA "steer";
--> statement-breakpoint
CREATE TABLE "steer"."ingestion_events" (
	"organization_id" text NOT NULL,
	"event_id" text NOT NULL,
	"repository" text NOT NULL,
	"source_revision" text NOT NULL,
	"content_digest" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ingestion_events_organization_id_event_id_pk" PRIMARY KEY("organization_id","event_id")
);
--> statement-breakpoint
ALTER TABLE "steer"."ingestion_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "steer"."projection_records" (
	"organization_id" text NOT NULL,
	"record_key" text NOT NULL,
	"repository" text NOT NULL,
	"source_revision" text NOT NULL,
	"content_digest" text NOT NULL,
	"value" jsonb NOT NULL,
	CONSTRAINT "projection_records_organization_id_record_key_pk" PRIMARY KEY("organization_id","record_key")
);
--> statement-breakpoint
ALTER TABLE "steer"."projection_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "event_tenant" ON "steer"."ingestion_events" AS PERMISSIVE FOR ALL TO public USING ("steer"."ingestion_events"."organization_id" = nullif(current_setting('steer.organization_id', true), '')) WITH CHECK ("steer"."ingestion_events"."organization_id" = nullif(current_setting('steer.organization_id', true), ''));--> statement-breakpoint
CREATE POLICY "projection_tenant" ON "steer"."projection_records" AS PERMISSIVE FOR ALL TO public USING ("steer"."projection_records"."organization_id" = nullif(current_setting('steer.organization_id', true), '')) WITH CHECK ("steer"."projection_records"."organization_id" = nullif(current_setting('steer.organization_id', true), ''));