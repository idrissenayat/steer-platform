CREATE TABLE "steer_drafts"."development_originals" (
	"organization_id" text NOT NULL,
	"subject" text NOT NULL,
	"product_id" text NOT NULL,
	"operation_id" uuid NOT NULL,
	"input_digest" text NOT NULL,
	"draft_id" uuid NOT NULL,
	"draft_revision" bigint NOT NULL,
	"record" jsonb NOT NULL,
	"encrypted_value" jsonb NOT NULL,
	CONSTRAINT "development_originals_organization_id_operation_id_pk" PRIMARY KEY("organization_id","operation_id"),
	CONSTRAINT "development_original_bounds" CHECK ("steer_drafts"."development_originals"."input_digest" ~ '^[a-f0-9]{64}$' AND octet_length("steer_drafts"."development_originals"."record"::text) <= 8000 AND octet_length("steer_drafts"."development_originals"."encrypted_value"::text) <= 1050000)
);
--> statement-breakpoint
ALTER TABLE "steer_drafts"."development_originals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "steer_drafts"."development_originals" ADD CONSTRAINT "development_original_operation" FOREIGN KEY ("organization_id","operation_id") REFERENCES "steer_execution"."intent_operations"("organization_id","operation_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "steer_drafts"."development_originals" ADD CONSTRAINT "development_original_source" FOREIGN KEY ("organization_id","draft_id","draft_revision") REFERENCES "steer_drafts"."draft_revisions"("organization_id","draft_id","revision") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "development_original_owner" ON "steer_drafts"."development_originals" AS PERMISSIVE FOR ALL TO public USING ("steer_drafts"."development_originals"."organization_id" = nullif(current_setting('steer.draft_organization', true), '') AND "steer_drafts"."development_originals"."subject" = nullif(current_setting('steer.draft_subject', true), '') AND "steer_drafts"."development_originals"."product_id" = nullif(current_setting('steer.draft_product', true), '')) WITH CHECK ("steer_drafts"."development_originals"."organization_id" = nullif(current_setting('steer.draft_organization', true), '') AND "steer_drafts"."development_originals"."subject" = nullif(current_setting('steer.draft_subject', true), '') AND "steer_drafts"."development_originals"."product_id" = nullif(current_setting('steer.draft_product', true), ''));