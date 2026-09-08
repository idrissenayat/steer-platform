CREATE TABLE "steer_drafts"."development_results" (
	"organization_id" text NOT NULL,
	"subject" text NOT NULL,
	"product_id" text NOT NULL,
	"operation_id" uuid NOT NULL,
	"step_id" text NOT NULL,
	"result_ref" uuid NOT NULL,
	"draft_id" uuid NOT NULL,
	"draft_revision" bigint NOT NULL,
	"result_digest" text NOT NULL,
	"record" jsonb NOT NULL,
	"encrypted_value" jsonb NOT NULL,
	CONSTRAINT "development_results_organization_id_operation_id_step_id_pk" PRIMARY KEY("organization_id","operation_id","step_id"),
	CONSTRAINT "development_result_reference" UNIQUE("organization_id","result_ref"),
	CONSTRAINT "development_result_bounds" CHECK ("steer_drafts"."development_results"."step_id" IN ('architect','test-agent') AND "steer_drafts"."development_results"."result_digest" ~ '^[a-f0-9]{64}$' AND octet_length("steer_drafts"."development_results"."record"::text) <= 16000 AND octet_length("steer_drafts"."development_results"."encrypted_value"::text) <= 1050000)
);
--> statement-breakpoint
ALTER TABLE "steer_drafts"."development_results" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "steer_drafts"."development_results" ADD CONSTRAINT "development_result_step" FOREIGN KEY ("organization_id","operation_id","step_id") REFERENCES "steer_execution"."intent_steps"("organization_id","operation_id","step_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "steer_drafts"."development_results" ADD CONSTRAINT "development_result_source" FOREIGN KEY ("organization_id","draft_id","draft_revision") REFERENCES "steer_drafts"."draft_revisions"("organization_id","draft_id","revision") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "development_result_owner" ON "steer_drafts"."development_results" AS PERMISSIVE FOR ALL TO public USING ("steer_drafts"."development_results"."organization_id" = nullif(current_setting('steer.draft_organization', true), '') AND "steer_drafts"."development_results"."subject" = nullif(current_setting('steer.draft_subject', true), '') AND "steer_drafts"."development_results"."product_id" = nullif(current_setting('steer.draft_product', true), '')) WITH CHECK ("steer_drafts"."development_results"."organization_id" = nullif(current_setting('steer.draft_organization', true), '') AND "steer_drafts"."development_results"."subject" = nullif(current_setting('steer.draft_subject', true), '') AND "steer_drafts"."development_results"."product_id" = nullif(current_setting('steer.draft_product', true), ''));