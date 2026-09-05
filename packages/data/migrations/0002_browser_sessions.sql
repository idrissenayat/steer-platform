-- Generated tables, checks and namespace policies for ephemeral credentials.
CREATE SCHEMA "steer_auth";
--> statement-breakpoint
CREATE TABLE "steer_auth"."browser_sessions" (
	"namespace" text NOT NULL,
	"key_hash" text NOT NULL,
	"encrypted_value" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "browser_sessions_namespace_key_hash_pk" PRIMARY KEY("namespace","key_hash"),
	CONSTRAINT "browser_sessions_keys" CHECK ("steer_auth"."browser_sessions"."namespace" ~ '^[a-f0-9]{64}$' AND "steer_auth"."browser_sessions"."key_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "browser_sessions_ttl" CHECK ("steer_auth"."browser_sessions"."expires_at" > "steer_auth"."browser_sessions"."created_at" AND "steer_auth"."browser_sessions"."expires_at" <= "steer_auth"."browser_sessions"."created_at" + interval '5 minutes'),
	CONSTRAINT "browser_sessions_size" CHECK (octet_length("steer_auth"."browser_sessions"."encrypted_value"::text) <= 41000)
);
--> statement-breakpoint
ALTER TABLE "steer_auth"."browser_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "steer_auth"."login_transactions" (
	"namespace" text NOT NULL,
	"key_hash" text NOT NULL,
	"encrypted_value" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "login_transactions_namespace_key_hash_pk" PRIMARY KEY("namespace","key_hash"),
	CONSTRAINT "login_transactions_keys" CHECK ("steer_auth"."login_transactions"."namespace" ~ '^[a-f0-9]{64}$' AND "steer_auth"."login_transactions"."key_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "login_transactions_ttl" CHECK ("steer_auth"."login_transactions"."expires_at" > "steer_auth"."login_transactions"."created_at" AND "steer_auth"."login_transactions"."expires_at" <= "steer_auth"."login_transactions"."created_at" + interval '5 minutes'),
	CONSTRAINT "login_transactions_size" CHECK (octet_length("steer_auth"."login_transactions"."encrypted_value"::text) <= 41000)
);
--> statement-breakpoint
ALTER TABLE "steer_auth"."login_transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "browser_sessions_expiry" ON "steer_auth"."browser_sessions" USING btree ("namespace","expires_at");--> statement-breakpoint
CREATE INDEX "login_transactions_expiry" ON "steer_auth"."login_transactions" USING btree ("namespace","expires_at");--> statement-breakpoint
CREATE POLICY "browser_sessions_namespace" ON "steer_auth"."browser_sessions" AS PERMISSIVE FOR ALL TO public USING ("steer_auth"."browser_sessions"."namespace" = nullif(current_setting('steer.auth_namespace', true), '')) WITH CHECK ("steer_auth"."browser_sessions"."namespace" = nullif(current_setting('steer.auth_namespace', true), ''));--> statement-breakpoint
CREATE POLICY "login_transactions_namespace" ON "steer_auth"."login_transactions" AS PERMISSIVE FOR ALL TO public USING ("steer_auth"."login_transactions"."namespace" = nullif(current_setting('steer.auth_namespace', true), '')) WITH CHECK ("steer_auth"."login_transactions"."namespace" = nullif(current_setting('steer.auth_namespace', true), ''));
