ALTER TABLE "steer_usage"."model_reservations" DROP CONSTRAINT "model_reservations_organization_id_budget_id_model_budgets_organization_id_budget_id_fk";
--> statement-breakpoint
ALTER TABLE "steer_usage"."model_budgets" ADD CONSTRAINT "model_budget_owner" UNIQUE("organization_id","budget_id","subject");
--> statement-breakpoint
ALTER TABLE "steer_usage"."model_reservations" ADD CONSTRAINT "model_reservations_organization_id_budget_id_subject_model_budgets_organization_id_budget_id_subject_fk" FOREIGN KEY ("organization_id","budget_id","subject") REFERENCES "steer_usage"."model_budgets"("organization_id","budget_id","subject") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
-- Runtime cannot activate, raise, reset or delete budgets; it can only append reservations.
ALTER TABLE "steer_usage"."model_budgets" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "steer_usage"."model_reservations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON SCHEMA "steer_usage" FROM PUBLIC, "steer_projector", "steer_auth_runtime";
--> statement-breakpoint
GRANT USAGE ON SCHEMA "steer_usage" TO "steer_app";
--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA "steer_usage" FROM PUBLIC, "steer_app", "steer_projector", "steer_auth_runtime";
--> statement-breakpoint
GRANT SELECT ON "steer_usage"."model_budgets", "steer_usage"."model_reservations" TO "steer_app";
--> statement-breakpoint
GRANT INSERT ON "steer_usage"."model_reservations" TO "steer_app";
