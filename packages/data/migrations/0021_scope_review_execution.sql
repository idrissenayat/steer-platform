CREATE TABLE "steer_execution"."scope_review_batches" (
	"organization_id" text NOT NULL,
	"review_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"product_id" text NOT NULL,
	"batch_id" text NOT NULL,
	"record" jsonb NOT NULL,
	"budget_id" uuid NOT NULL,
	"reservation_id" uuid NOT NULL,
	CONSTRAINT "scope_review_batches_organization_id_review_id_batch_id_pk" PRIMARY KEY("organization_id","review_id","batch_id"),
	CONSTRAINT "scope_batch_bounds" CHECK ("steer_execution"."scope_review_batches"."batch_id" ~ '^[a-f0-9]{64}$' AND octet_length("steer_execution"."scope_review_batches"."record"::text) <= 8000)
);
--> statement-breakpoint
ALTER TABLE "steer_execution"."scope_review_batches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "steer_execution"."scope_review_runs" (
	"organization_id" text NOT NULL,
	"review_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"product_id" text NOT NULL,
	"draft_id" uuid NOT NULL,
	"draft_revision" bigint NOT NULL,
	"preparation_digest" text NOT NULL,
	"configuration_digest" text NOT NULL,
	"manifest" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "scope_review_runs_organization_id_review_id_pk" PRIMARY KEY("organization_id","review_id"),
	CONSTRAINT "scope_review_owner" UNIQUE("organization_id","review_id","subject","product_id"),
	CONSTRAINT "scope_review_submission" UNIQUE("organization_id","subject","draft_id","draft_revision","preparation_digest"),
	CONSTRAINT "scope_review_bounds" CHECK ("steer_execution"."scope_review_runs"."draft_revision" BETWEEN 1 AND 1000 AND "steer_execution"."scope_review_runs"."preparation_digest" ~ '^[a-f0-9]{64}$' AND "steer_execution"."scope_review_runs"."configuration_digest" ~ '^[a-f0-9]{64}$' AND octet_length("steer_execution"."scope_review_runs"."manifest"::text) <= 12000 AND "steer_execution"."scope_review_runs"."expires_at" > "steer_execution"."scope_review_runs"."created_at" AND "steer_execution"."scope_review_runs"."expires_at" <= "steer_execution"."scope_review_runs"."created_at" + interval '24 hours')
);
--> statement-breakpoint
ALTER TABLE "steer_execution"."scope_review_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "steer_usage"."scope_review_terms" (
	"organization_id" text NOT NULL,
	"budget_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"configuration_revision" text NOT NULL,
	"approval_digest" text NOT NULL,
	"profile_digest" text NOT NULL,
	"amount_microusd" bigint NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	CONSTRAINT "scope_review_terms_organization_id_budget_id_subject_pk" PRIMARY KEY("organization_id","budget_id","subject"),
	CONSTRAINT "scope_terms_bounds" CHECK ("steer_usage"."scope_review_terms"."approval_digest" ~ '^[a-f0-9]{64}$' AND "steer_usage"."scope_review_terms"."profile_digest" ~ '^[a-f0-9]{64}$' AND length("steer_usage"."scope_review_terms"."configuration_revision") BETWEEN 1 AND 200 AND "steer_usage"."scope_review_terms"."amount_microusd" BETWEEN 1 AND 1000000000000)
);
--> statement-breakpoint
ALTER TABLE "steer_usage"."scope_review_terms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "steer_usage"."model_reservations" DROP CONSTRAINT "model_reservation_role";--> statement-breakpoint
ALTER TABLE "steer_execution"."scope_review_batches" ADD CONSTRAINT "scope_review_batches_organization_id_review_id_subject_product_id_scope_review_runs_organization_id_review_id_subject_product_id_fk" FOREIGN KEY ("organization_id","review_id","subject","product_id") REFERENCES "steer_execution"."scope_review_runs"("organization_id","review_id","subject","product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "steer_execution"."scope_review_batches" ADD CONSTRAINT "scope_review_batches_organization_id_budget_id_reservation_id_model_reservations_organization_id_budget_id_reservation_id_fk" FOREIGN KEY ("organization_id","budget_id","reservation_id") REFERENCES "steer_usage"."model_reservations"("organization_id","budget_id","reservation_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "steer_usage"."scope_review_terms" ADD CONSTRAINT "scope_review_terms_organization_id_budget_id_subject_model_budgets_organization_id_budget_id_subject_fk" FOREIGN KEY ("organization_id","budget_id","subject") REFERENCES "steer_usage"."model_budgets"("organization_id","budget_id","subject") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "steer_usage"."model_reservations" ADD CONSTRAINT "model_reservation_role" CHECK ("steer_usage"."model_reservations"."role" IN ('architect', 'test-agent', 'scope-reviewer') AND ("steer_usage"."model_reservations"."role" <> 'scope-reviewer' OR ("steer_usage"."model_reservations"."operation_id" IS NOT NULL AND "steer_usage"."model_reservations"."step_id" ~ '^[a-f0-9]{64}$')));--> statement-breakpoint
CREATE POLICY "scope_batch_scope" ON "steer_execution"."scope_review_batches" AS PERMISSIVE FOR ALL TO public USING ("steer_execution"."scope_review_batches"."organization_id" = nullif(current_setting('steer.execution_organization', true), '') AND "steer_execution"."scope_review_batches"."subject" = nullif(current_setting('steer.execution_subject', true), '') AND "steer_execution"."scope_review_batches"."product_id" = nullif(current_setting('steer.execution_product', true), '')) WITH CHECK ("steer_execution"."scope_review_batches"."organization_id" = nullif(current_setting('steer.execution_organization', true), '') AND "steer_execution"."scope_review_batches"."subject" = nullif(current_setting('steer.execution_subject', true), '') AND "steer_execution"."scope_review_batches"."product_id" = nullif(current_setting('steer.execution_product', true), ''));--> statement-breakpoint
CREATE POLICY "scope_review_scope" ON "steer_execution"."scope_review_runs" AS PERMISSIVE FOR ALL TO public USING ("steer_execution"."scope_review_runs"."organization_id" = nullif(current_setting('steer.execution_organization', true), '') AND "steer_execution"."scope_review_runs"."subject" = nullif(current_setting('steer.execution_subject', true), '') AND "steer_execution"."scope_review_runs"."product_id" = nullif(current_setting('steer.execution_product', true), '')) WITH CHECK ("steer_execution"."scope_review_runs"."organization_id" = nullif(current_setting('steer.execution_organization', true), '') AND "steer_execution"."scope_review_runs"."subject" = nullif(current_setting('steer.execution_subject', true), '') AND "steer_execution"."scope_review_runs"."product_id" = nullif(current_setting('steer.execution_product', true), ''));--> statement-breakpoint
CREATE POLICY "scope_terms_scope" ON "steer_usage"."scope_review_terms" AS PERMISSIVE FOR ALL TO public USING ("steer_usage"."scope_review_terms"."organization_id" = nullif(current_setting('steer.usage_organization', true), '') AND "steer_usage"."scope_review_terms"."budget_id"::text = nullif(current_setting('steer.usage_budget', true), '') AND "steer_usage"."scope_review_terms"."subject" = nullif(current_setting('steer.usage_subject', true), '')) WITH CHECK ("steer_usage"."scope_review_terms"."organization_id" = nullif(current_setting('steer.usage_organization', true), '') AND "steer_usage"."scope_review_terms"."budget_id"::text = nullif(current_setting('steer.usage_budget', true), '') AND "steer_usage"."scope_review_terms"."subject" = nullif(current_setting('steer.usage_subject', true), ''));