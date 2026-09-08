CREATE TABLE "steer_drafts"."scope_review_originals" (
	"organization_id" text NOT NULL,
	"subject" text NOT NULL,
	"product_id" text NOT NULL,
	"review_id" uuid NOT NULL,
	"preparation_digest" text NOT NULL,
	"payload_digest" text NOT NULL,
	"draft_id" uuid NOT NULL,
	"draft_revision" bigint NOT NULL,
	"record" jsonb NOT NULL,
	"encrypted_value" jsonb NOT NULL,
	CONSTRAINT "scope_review_originals_organization_id_review_id_pk" PRIMARY KEY("organization_id","review_id"),
	CONSTRAINT "scope_original_bounds" CHECK ("steer_drafts"."scope_review_originals"."preparation_digest" ~ '^[a-f0-9]{64}$' AND "steer_drafts"."scope_review_originals"."payload_digest" ~ '^[a-f0-9]{64}$' AND octet_length("steer_drafts"."scope_review_originals"."record"::text) <= 8000 AND octet_length("steer_drafts"."scope_review_originals"."encrypted_value"::text) <= 4200000)
);
--> statement-breakpoint
ALTER TABLE "steer_drafts"."scope_review_originals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "steer_drafts"."scope_review_originals" ADD CONSTRAINT "scope_original_review_owner" FOREIGN KEY ("organization_id","review_id","subject","product_id") REFERENCES "steer_execution"."scope_review_runs"("organization_id","review_id","subject","product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "steer_drafts"."scope_review_originals" ADD CONSTRAINT "scope_original_source" FOREIGN KEY ("organization_id","draft_id","draft_revision") REFERENCES "steer_drafts"."draft_revisions"("organization_id","draft_id","revision") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "scope_original_owner" ON "steer_drafts"."scope_review_originals" AS PERMISSIVE FOR ALL TO public USING ("steer_drafts"."scope_review_originals"."organization_id" = nullif(current_setting('steer.draft_organization', true), '') AND "steer_drafts"."scope_review_originals"."subject" = nullif(current_setting('steer.draft_subject', true), '') AND "steer_drafts"."scope_review_originals"."product_id" = nullif(current_setting('steer.draft_product', true), '')) WITH CHECK ("steer_drafts"."scope_review_originals"."organization_id" = nullif(current_setting('steer.draft_organization', true), '') AND "steer_drafts"."scope_review_originals"."subject" = nullif(current_setting('steer.draft_subject', true), '') AND "steer_drafts"."scope_review_originals"."product_id" = nullif(current_setting('steer.draft_product', true), ''));