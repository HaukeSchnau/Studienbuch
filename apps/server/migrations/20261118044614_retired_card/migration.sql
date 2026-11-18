CREATE TABLE "retired_card" (
	"account_id" text,
	"public_key" text,
	"retired_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "retired_card_pkey" PRIMARY KEY("account_id","public_key")
);
--> statement-breakpoint
ALTER TABLE "retired_card" ADD CONSTRAINT "retired_card_account_id_auth_user_id_fkey" FOREIGN KEY ("account_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;