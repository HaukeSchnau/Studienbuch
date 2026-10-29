CREATE TABLE "demo_account" (
	"account_id" text PRIMARY KEY,
	"persona" text NOT NULL UNIQUE
);
--> statement-breakpoint
ALTER TABLE "demo_account" ADD CONSTRAINT "demo_account_account_id_auth_user_id_fkey" FOREIGN KEY ("account_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;