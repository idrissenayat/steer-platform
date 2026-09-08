-- Disabled encrypted revision history. Disposable development tests only.
CREATE TABLE "steer_drafts"."draft_revisions" (
	"organization_id" text NOT NULL,
	"subject" text NOT NULL,
	"product_id" text NOT NULL,
	"draft_id" uuid NOT NULL,
	"revision" bigint NOT NULL,
	"mutation_id" uuid NOT NULL,
	"command_digest" text NOT NULL,
	"revision_digest" text NOT NULL,
	"record" jsonb NOT NULL,
	"encrypted_value" jsonb NOT NULL,
	"stored_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "draft_revisions_organization_id_draft_id_revision_pk" PRIMARY KEY("organization_id","draft_id","revision"),
	CONSTRAINT "draft_revision_mutation" UNIQUE("organization_id","draft_id","mutation_id"),
	CONSTRAINT "draft_revision_bounds" CHECK ("steer_drafts"."draft_revisions"."revision" BETWEEN 1 AND 1000 AND "steer_drafts"."draft_revisions"."command_digest" ~ '^[a-f0-9]{64}$' AND "steer_drafts"."draft_revisions"."revision_digest" ~ '^[a-f0-9]{64}$' AND octet_length("steer_drafts"."draft_revisions"."record"::text) <= 8000 AND octet_length("steer_drafts"."draft_revisions"."encrypted_value"::text) <= 1050000)
);
--> statement-breakpoint
ALTER TABLE "steer_drafts"."draft_revisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "steer_drafts"."draft_lifecycles" ADD CONSTRAINT "draft_lifecycle_identity" UNIQUE("organization_id","draft_id","subject","product_id");--> statement-breakpoint
ALTER TABLE "steer_drafts"."draft_revisions" ADD CONSTRAINT "draft_revision_owner" FOREIGN KEY ("organization_id","draft_id","subject","product_id") REFERENCES "steer_drafts"."draft_lifecycles"("organization_id","draft_id","subject","product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "draft_revision_owner" ON "steer_drafts"."draft_revisions" AS PERMISSIVE FOR ALL TO public USING ("steer_drafts"."draft_revisions"."organization_id" = nullif(current_setting('steer.draft_organization', true), '') AND "steer_drafts"."draft_revisions"."subject" = nullif(current_setting('steer.draft_subject', true), '') AND "steer_drafts"."draft_revisions"."product_id" = nullif(current_setting('steer.draft_product', true), '')) WITH CHECK ("steer_drafts"."draft_revisions"."organization_id" = nullif(current_setting('steer.draft_organization', true), '') AND "steer_drafts"."draft_revisions"."subject" = nullif(current_setting('steer.draft_subject', true), '') AND "steer_drafts"."draft_revisions"."product_id" = nullif(current_setting('steer.draft_product', true), ''));
