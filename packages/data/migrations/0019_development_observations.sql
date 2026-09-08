CREATE TABLE "steer_drafts"."development_observations" (
	"organization_id" text NOT NULL,
	"subject" text NOT NULL,
	"product_id" text NOT NULL,
	"operation_id" uuid NOT NULL,
	"step_id" text NOT NULL,
	"stage" text NOT NULL,
	"draft_id" uuid NOT NULL,
	"draft_revision" bigint NOT NULL,
	"payload_digest" text NOT NULL,
	"record" jsonb NOT NULL,
	"encrypted_value" jsonb NOT NULL,
	CONSTRAINT "development_observations_organization_id_operation_id_step_id_stage_pk" PRIMARY KEY("organization_id","operation_id","step_id","stage"),
	CONSTRAINT "development_observation_bounds" CHECK ("steer_drafts"."development_observations"."step_id" IN ('architect','test-agent') AND "steer_drafts"."development_observations"."stage" IN ('request','response') AND "steer_drafts"."development_observations"."payload_digest" ~ '^[a-f0-9]{64}$' AND octet_length("steer_drafts"."development_observations"."record"::text) <= 8000 AND octet_length("steer_drafts"."development_observations"."encrypted_value"::text) <= 1050000)
);
--> statement-breakpoint
ALTER TABLE "steer_drafts"."development_observations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "steer_drafts"."development_observations" ADD CONSTRAINT "development_observation_step" FOREIGN KEY ("organization_id","operation_id","step_id") REFERENCES "steer_execution"."intent_steps"("organization_id","operation_id","step_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "steer_drafts"."development_observations" ADD CONSTRAINT "development_observation_original" FOREIGN KEY ("organization_id","operation_id") REFERENCES "steer_drafts"."development_originals"("organization_id","operation_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "steer_drafts"."development_observations" ADD CONSTRAINT "development_observation_source" FOREIGN KEY ("organization_id","draft_id","draft_revision") REFERENCES "steer_drafts"."draft_revisions"("organization_id","draft_id","revision") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "development_observation_owner" ON "steer_drafts"."development_observations" AS PERMISSIVE FOR ALL TO public USING ("steer_drafts"."development_observations"."organization_id" = nullif(current_setting('steer.draft_organization', true), '') AND "steer_drafts"."development_observations"."subject" = nullif(current_setting('steer.draft_subject', true), '') AND "steer_drafts"."development_observations"."product_id" = nullif(current_setting('steer.draft_product', true), '')) WITH CHECK ("steer_drafts"."development_observations"."organization_id" = nullif(current_setting('steer.draft_organization', true), '') AND "steer_drafts"."development_observations"."subject" = nullif(current_setting('steer.draft_subject', true), '') AND "steer_drafts"."development_observations"."product_id" = nullif(current_setting('steer.draft_product', true), ''));