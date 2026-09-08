-- Disabled draft-original storage. Development fixtures only pending D1 adoption.
CREATE SCHEMA "steer_drafts";
--> statement-breakpoint
CREATE TABLE "steer_drafts"."candidate_originals" (
	"organization_id" text NOT NULL,
	"subject" text NOT NULL,
	"product_id" text NOT NULL,
	"operation_id" uuid NOT NULL,
	"draft_id" uuid NOT NULL,
	"draft_revision" bigint NOT NULL,
	"input_digest" text NOT NULL,
	"payload_digest" text NOT NULL,
	"configuration_digest" text NOT NULL,
	"encrypted_value" jsonb NOT NULL,
	"draft_created_at" timestamp with time zone NOT NULL,
	"retention_deadline" timestamp with time zone NOT NULL,
	"use_until" timestamp with time zone NOT NULL,
	"held" boolean DEFAULT false NOT NULL,
	"stored_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_originals_organization_id_operation_id_pk" PRIMARY KEY("organization_id","operation_id"),
	CONSTRAINT "candidate_original_bounds" CHECK ("steer_drafts"."candidate_originals"."draft_revision" BETWEEN 1 AND 9007199254740991 AND "steer_drafts"."candidate_originals"."input_digest" ~ '^[a-f0-9]{64}$' AND "steer_drafts"."candidate_originals"."payload_digest" ~ '^[a-f0-9]{64}$' AND "steer_drafts"."candidate_originals"."configuration_digest" ~ '^[a-f0-9]{64}$' AND octet_length("steer_drafts"."candidate_originals"."encrypted_value"::text) <= 1050000 AND "steer_drafts"."candidate_originals"."retention_deadline" = "steer_drafts"."candidate_originals"."draft_created_at" + interval '168 hours' AND "steer_drafts"."candidate_originals"."use_until" <= "steer_drafts"."candidate_originals"."retention_deadline")
);
--> statement-breakpoint
ALTER TABLE "steer_drafts"."candidate_originals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "steer_drafts"."candidate_originals" ADD CONSTRAINT "candidate_original_operation_owner" FOREIGN KEY ("organization_id","operation_id","subject") REFERENCES "steer_execution"."intent_operations"("organization_id","operation_id","subject") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "candidate_original_owner" ON "steer_drafts"."candidate_originals" AS PERMISSIVE FOR ALL TO public USING ("steer_drafts"."candidate_originals"."organization_id" = nullif(current_setting('steer.draft_organization', true), '') AND "steer_drafts"."candidate_originals"."subject" = nullif(current_setting('steer.draft_subject', true), '') AND "steer_drafts"."candidate_originals"."product_id" = nullif(current_setting('steer.draft_product', true), '')) WITH CHECK ("steer_drafts"."candidate_originals"."organization_id" = nullif(current_setting('steer.draft_organization', true), '') AND "steer_drafts"."candidate_originals"."subject" = nullif(current_setting('steer.draft_subject', true), '') AND "steer_drafts"."candidate_originals"."product_id" = nullif(current_setting('steer.draft_product', true), ''));
