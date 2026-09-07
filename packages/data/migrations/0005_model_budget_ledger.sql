CREATE SCHEMA "steer_usage";
--> statement-breakpoint
CREATE TABLE "steer_usage"."model_budgets" (
	"organization_id" text NOT NULL,
	"budget_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"configuration_revision" text NOT NULL,
	"approval_digest" text NOT NULL,
	"cap_microusd" bigint NOT NULL,
	"architect_microusd" bigint NOT NULL,
	"test_agent_microusd" bigint NOT NULL,
	"valid_after" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	CONSTRAINT "model_budgets_organization_id_budget_id_pk" PRIMARY KEY("organization_id","budget_id"),
	CONSTRAINT "model_budget_bounds" CHECK ("steer_usage"."model_budgets"."cap_microusd" BETWEEN 1 AND 1000000000000 AND "steer_usage"."model_budgets"."architect_microusd" BETWEEN 1 AND "steer_usage"."model_budgets"."cap_microusd" AND "steer_usage"."model_budgets"."test_agent_microusd" BETWEEN 1 AND "steer_usage"."model_budgets"."cap_microusd"),
	CONSTRAINT "model_budget_identity" CHECK (length("steer_usage"."model_budgets"."organization_id") BETWEEN 1 AND 200 AND length("steer_usage"."model_budgets"."subject") BETWEEN 1 AND 200 AND length("steer_usage"."model_budgets"."configuration_revision") BETWEEN 1 AND 200 AND "steer_usage"."model_budgets"."approval_digest" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "model_budget_time" CHECK ("steer_usage"."model_budgets"."expires_at" > "steer_usage"."model_budgets"."valid_after" AND "steer_usage"."model_budgets"."expires_at" <= "steer_usage"."model_budgets"."valid_after" + interval '24 hours')
);
--> statement-breakpoint
ALTER TABLE "steer_usage"."model_budgets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "steer_usage"."model_reservations" (
	"organization_id" text NOT NULL,
	"budget_id" uuid NOT NULL,
	"reservation_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"role" text NOT NULL,
	"amount_microusd" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "model_reservations_organization_id_budget_id_reservation_id_pk" PRIMARY KEY("organization_id","budget_id","reservation_id"),
	CONSTRAINT "model_reservation_amount" CHECK ("steer_usage"."model_reservations"."amount_microusd" BETWEEN 1 AND 1000000000000),
	CONSTRAINT "model_reservation_role" CHECK ("steer_usage"."model_reservations"."role" IN ('architect', 'test-agent'))
);
--> statement-breakpoint
ALTER TABLE "steer_usage"."model_reservations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "steer_usage"."model_reservations" ADD CONSTRAINT "model_reservations_organization_id_budget_id_model_budgets_organization_id_budget_id_fk" FOREIGN KEY ("organization_id","budget_id") REFERENCES "steer_usage"."model_budgets"("organization_id","budget_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "budget_scope" ON "steer_usage"."model_budgets" AS PERMISSIVE FOR ALL TO public USING ("steer_usage"."model_budgets"."organization_id" = nullif(current_setting('steer.usage_organization', true), '') AND "steer_usage"."model_budgets"."budget_id"::text = nullif(current_setting('steer.usage_budget', true), '') AND "steer_usage"."model_budgets"."subject" = nullif(current_setting('steer.usage_subject', true), '')) WITH CHECK ("steer_usage"."model_budgets"."organization_id" = nullif(current_setting('steer.usage_organization', true), '') AND "steer_usage"."model_budgets"."budget_id"::text = nullif(current_setting('steer.usage_budget', true), '') AND "steer_usage"."model_budgets"."subject" = nullif(current_setting('steer.usage_subject', true), ''));--> statement-breakpoint
CREATE POLICY "reservation_scope" ON "steer_usage"."model_reservations" AS PERMISSIVE FOR ALL TO public USING ("steer_usage"."model_reservations"."organization_id" = nullif(current_setting('steer.usage_organization', true), '') AND "steer_usage"."model_reservations"."budget_id"::text = nullif(current_setting('steer.usage_budget', true), '') AND "steer_usage"."model_reservations"."subject" = nullif(current_setting('steer.usage_subject', true), '')) WITH CHECK ("steer_usage"."model_reservations"."organization_id" = nullif(current_setting('steer.usage_organization', true), '') AND "steer_usage"."model_reservations"."budget_id"::text = nullif(current_setting('steer.usage_budget', true), '') AND "steer_usage"."model_reservations"."subject" = nullif(current_setting('steer.usage_subject', true), ''));