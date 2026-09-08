CREATE TABLE "steer_drafts"."scope_review_observations" (
	"organization_id" text NOT NULL,
	"subject" text NOT NULL,
	"product_id" text NOT NULL,
	"review_id" uuid NOT NULL,
	"batch_id" text NOT NULL,
	"stage" text NOT NULL,
	"draft_id" uuid NOT NULL,
	"draft_revision" bigint NOT NULL,
	"payload_digest" text NOT NULL,
	"record" jsonb NOT NULL,
	"encrypted_value" jsonb NOT NULL,
	CONSTRAINT "scope_review_observations_organization_id_review_id_batch_id_stage_pk" PRIMARY KEY("organization_id","review_id","batch_id","stage"),
	CONSTRAINT "scope_observation_bounds" CHECK ("steer_drafts"."scope_review_observations"."batch_id" ~ '^[a-f0-9]{64}$' AND "steer_drafts"."scope_review_observations"."stage" IN ('request','response') AND "steer_drafts"."scope_review_observations"."payload_digest" ~ '^[a-f0-9]{64}$' AND octet_length("steer_drafts"."scope_review_observations"."record"::text) <= 8000 AND octet_length("steer_drafts"."scope_review_observations"."encrypted_value"::text) <= 1050000)
);
--> statement-breakpoint
ALTER TABLE "steer_drafts"."scope_review_observations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "steer_drafts"."scope_review_observations" ADD CONSTRAINT "scope_observation_batch" FOREIGN KEY ("organization_id","review_id","batch_id") REFERENCES "steer_execution"."scope_review_batches"("organization_id","review_id","batch_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "steer_drafts"."scope_review_observations" ADD CONSTRAINT "scope_observation_original" FOREIGN KEY ("organization_id","review_id") REFERENCES "steer_drafts"."scope_review_originals"("organization_id","review_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "steer_drafts"."scope_review_observations" ADD CONSTRAINT "scope_observation_source" FOREIGN KEY ("organization_id","draft_id","draft_revision") REFERENCES "steer_drafts"."draft_revisions"("organization_id","draft_id","revision") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "scope_observation_owner" ON "steer_drafts"."scope_review_observations" AS PERMISSIVE FOR ALL TO public USING ("steer_drafts"."scope_review_observations"."organization_id" = nullif(current_setting('steer.draft_organization', true), '') AND "steer_drafts"."scope_review_observations"."subject" = nullif(current_setting('steer.draft_subject', true), '') AND "steer_drafts"."scope_review_observations"."product_id" = nullif(current_setting('steer.draft_product', true), '')) WITH CHECK ("steer_drafts"."scope_review_observations"."organization_id" = nullif(current_setting('steer.draft_organization', true), '') AND "steer_drafts"."scope_review_observations"."subject" = nullif(current_setting('steer.draft_subject', true), '') AND "steer_drafts"."scope_review_observations"."product_id" = nullif(current_setting('steer.draft_product', true), ''));