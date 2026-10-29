CREATE TABLE "account_key" (
	"account_id" text,
	"generation" integer,
	"record" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_key_pkey" PRIMARY KEY("account_id","generation")
);
--> statement-breakpoint
CREATE TABLE "key_wrapper" (
	"account_id" text,
	"id" text,
	"kind" smallint NOT NULL,
	"credential_id" text NOT NULL,
	"statement" jsonb NOT NULL,
	"created_by_session" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "key_wrapper_pkey" PRIMARY KEY("account_id","id")
);
--> statement-breakpoint
CREATE TABLE "key_wrapper_seal" (
	"account_id" text,
	"wrapper_id" text,
	"generation" integer,
	"seal" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "key_wrapper_seal_pkey" PRIMARY KEY("account_id","wrapper_id","generation")
);
--> statement-breakpoint
CREATE TABLE "recovery_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"account_id" text NOT NULL,
	"kind" text NOT NULL,
	"method" text NOT NULL,
	"credential_id" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "key_wrapper_kind" ON "key_wrapper" ("account_id","kind","credential_id");--> statement-breakpoint
CREATE INDEX "key_wrapper_session" ON "key_wrapper" ("created_by_session");--> statement-breakpoint
CREATE INDEX "recovery_event_account" ON "recovery_event" ("account_id","at");--> statement-breakpoint
ALTER TABLE "account_key" ADD CONSTRAINT "account_key_account_id_auth_user_id_fkey" FOREIGN KEY ("account_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "key_wrapper" ADD CONSTRAINT "key_wrapper_account_id_auth_user_id_fkey" FOREIGN KEY ("account_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "key_wrapper_seal" ADD CONSTRAINT "key_wrapper_seal_qs2BvQLndf0f_fkey" FOREIGN KEY ("account_id","wrapper_id") REFERENCES "key_wrapper"("account_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "recovery_event" ADD CONSTRAINT "recovery_event_account_id_auth_user_id_fkey" FOREIGN KEY ("account_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;