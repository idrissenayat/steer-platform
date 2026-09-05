ALTER TABLE steer_auth.login_transactions FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE steer_auth.browser_sessions FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON SCHEMA steer_auth FROM PUBLIC, steer_app, steer_projector, steer_auth_runtime;
--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA steer_auth FROM PUBLIC, steer_app, steer_projector, steer_auth_runtime;
--> statement-breakpoint
GRANT USAGE ON SCHEMA steer_auth TO steer_auth_runtime;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON steer_auth.login_transactions, steer_auth.browser_sessions TO steer_auth_runtime;
--> statement-breakpoint
REVOKE ALL ON SCHEMA steer FROM steer_auth_runtime;
--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA steer FROM steer_auth_runtime;
