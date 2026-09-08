-- Generated from the execution metadata schema; companion 0008 limits runtime authority.
CREATE SCHEMA "steer_execution";
--> statement-breakpoint
CREATE TABLE "steer_execution"."intent_operations" (
	"organization_id" text NOT NULL,
	"operation_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"draft_id" uuid NOT NULL,
	"draft_revision" bigint NOT NULL,
	"action" text NOT NULL,
	"configuration_revision" text NOT NULL,
	"binding" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "intent_operations_organization_id_operation_id_pk" PRIMARY KEY("organization_id","operation_id"),
	CONSTRAINT "intent_operation_owner" UNIQUE("organization_id","operation_id","subject"),
	CONSTRAINT "intent_operation_submission" UNIQUE("organization_id","draft_id","draft_revision","action","configuration_revision"),
	CONSTRAINT "intent_operation_bounds" CHECK ("steer_execution"."intent_operations"."draft_revision" BETWEEN 1 AND 9007199254740991 AND "steer_execution"."intent_operations"."action" IN ('develop','candidate-save') AND octet_length("steer_execution"."intent_operations"."binding"::text) <= 8000 AND "steer_execution"."intent_operations"."expires_at" > "steer_execution"."intent_operations"."created_at")
);
--> statement-breakpoint
ALTER TABLE "steer_execution"."intent_operations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "steer_execution"."intent_steps" (
	"organization_id" text NOT NULL,
	"operation_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"step_id" text NOT NULL,
	"record" jsonb NOT NULL,
	"predecessor_result_digest" text,
	"budget_id" uuid,
	"reservation_id" uuid NOT NULL,
	"result_ref" uuid,
	CONSTRAINT "intent_steps_organization_id_operation_id_step_id_pk" PRIMARY KEY("organization_id","operation_id","step_id"),
	CONSTRAINT "intent_step_bounds" CHECK ("steer_execution"."intent_steps"."step_id" IN ('architect','test-agent','candidate-save') AND octet_length("steer_execution"."intent_steps"."record"::text) <= 8000 AND ("steer_execution"."intent_steps"."predecessor_result_digest" IS NULL OR "steer_execution"."intent_steps"."predecessor_result_digest" ~ '^[a-f0-9]{64}$'))
);
--> statement-breakpoint
ALTER TABLE "steer_execution"."intent_steps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "steer_usage"."model_reservations" ADD COLUMN "operation_id" uuid;--> statement-breakpoint
ALTER TABLE "steer_usage"."model_reservations" ADD COLUMN "step_id" text;--> statement-breakpoint
ALTER TABLE "steer_execution"."intent_steps" ADD CONSTRAINT "intent_steps_organization_id_operation_id_subject_intent_operations_organization_id_operation_id_subject_fk" FOREIGN KEY ("organization_id","operation_id","subject") REFERENCES "steer_execution"."intent_operations"("organization_id","operation_id","subject") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "steer_execution"."intent_steps" ADD CONSTRAINT "intent_steps_organization_id_budget_id_reservation_id_model_reservations_organization_id_budget_id_reservation_id_fk" FOREIGN KEY ("organization_id","budget_id","reservation_id") REFERENCES "steer_usage"."model_reservations"("organization_id","budget_id","reservation_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "steer_usage"."model_reservations" ADD CONSTRAINT "model_reservation_step" UNIQUE("organization_id","operation_id","step_id");--> statement-breakpoint
ALTER TABLE "steer_usage"."model_reservations" ADD CONSTRAINT "model_reservation_step_pair" CHECK (("steer_usage"."model_reservations"."operation_id" IS NULL) = ("steer_usage"."model_reservations"."step_id" IS NULL));--> statement-breakpoint
CREATE POLICY "operation_scope" ON "steer_execution"."intent_operations" AS PERMISSIVE FOR ALL TO public USING ("steer_execution"."intent_operations"."organization_id" = nullif(current_setting('steer.execution_organization', true), '') AND "steer_execution"."intent_operations"."subject" = nullif(current_setting('steer.execution_subject', true), '')) WITH CHECK ("steer_execution"."intent_operations"."organization_id" = nullif(current_setting('steer.execution_organization', true), '') AND "steer_execution"."intent_operations"."subject" = nullif(current_setting('steer.execution_subject', true), ''));--> statement-breakpoint
CREATE POLICY "step_scope" ON "steer_execution"."intent_steps" AS PERMISSIVE FOR ALL TO public USING ("steer_execution"."intent_steps"."organization_id" = nullif(current_setting('steer.execution_organization', true), '') AND "steer_execution"."intent_steps"."subject" = nullif(current_setting('steer.execution_subject', true), '')) WITH CHECK ("steer_execution"."intent_steps"."organization_id" = nullif(current_setting('steer.execution_organization', true), '') AND "steer_execution"."intent_steps"."subject" = nullif(current_setting('steer.execution_subject', true), ''));
