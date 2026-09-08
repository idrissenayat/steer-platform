-- Disabled authoritative draft-clock metadata. Disposable development tests only.
CREATE TABLE "steer_drafts"."draft_lifecycles" (
	"organization_id" text NOT NULL,
	"subject" text NOT NULL,
	"product_id" text NOT NULL,
	"draft_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"configuration_digest" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"retention_deadline" timestamp with time zone NOT NULL,
	"use_until" timestamp with time zone NOT NULL,
	"held" boolean DEFAULT false NOT NULL,
	"hold_reference" uuid,
	"discarded_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"publication_operation" uuid,
	"publication_input" text,
	CONSTRAINT "draft_lifecycles_organization_id_draft_id_pk" PRIMARY KEY("organization_id","draft_id"),
	CONSTRAINT "draft_creation_request" UNIQUE("organization_id","subject","request_id"),
	CONSTRAINT "draft_lifecycle_bounds" CHECK ("steer_drafts"."draft_lifecycles"."configuration_digest" ~ '^[a-f0-9]{64}$' AND "steer_drafts"."draft_lifecycles"."retention_deadline" = "steer_drafts"."draft_lifecycles"."created_at" + interval '168 hours' AND "steer_drafts"."draft_lifecycles"."use_until" = LEAST("steer_drafts"."draft_lifecycles"."retention_deadline", "steer_drafts"."draft_lifecycles"."discarded_at" + interval '60 seconds', "steer_drafts"."draft_lifecycles"."published_at" + interval '60 seconds') AND "steer_drafts"."draft_lifecycles"."held" = ("steer_drafts"."draft_lifecycles"."hold_reference" IS NOT NULL) AND ("steer_drafts"."draft_lifecycles"."published_at" IS NULL) = ("steer_drafts"."draft_lifecycles"."publication_operation" IS NULL) AND ("steer_drafts"."draft_lifecycles"."published_at" IS NULL) = ("steer_drafts"."draft_lifecycles"."publication_input" IS NULL) AND ("steer_drafts"."draft_lifecycles"."publication_input" IS NULL OR "steer_drafts"."draft_lifecycles"."publication_input" ~ '^[a-f0-9]{64}$'))
);
--> statement-breakpoint
ALTER TABLE "steer_drafts"."draft_lifecycles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "draft_lifecycle_owner" ON "steer_drafts"."draft_lifecycles" AS PERMISSIVE FOR ALL TO public USING ("steer_drafts"."draft_lifecycles"."organization_id" = nullif(current_setting('steer.draft_organization', true), '') AND "steer_drafts"."draft_lifecycles"."subject" = nullif(current_setting('steer.draft_subject', true), '') AND "steer_drafts"."draft_lifecycles"."product_id" = nullif(current_setting('steer.draft_product', true), '')) WITH CHECK ("steer_drafts"."draft_lifecycles"."organization_id" = nullif(current_setting('steer.draft_organization', true), '') AND "steer_drafts"."draft_lifecycles"."subject" = nullif(current_setting('steer.draft_subject', true), '') AND "steer_drafts"."draft_lifecycles"."product_id" = nullif(current_setting('steer.draft_product', true), ''));
