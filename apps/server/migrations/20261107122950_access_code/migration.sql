CREATE TABLE "access_code" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"school_id" text NOT NULL,
	"kind" text NOT NULL,
	"secret_hash" text NOT NULL UNIQUE,
	"max_uses" integer,
	"uses" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "access_reservation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code_id" uuid NOT NULL,
	"token_hash" text NOT NULL UNIQUE,
	"expires_at" timestamp with time zone NOT NULL,
	"sign_ups" integer DEFAULT 0 NOT NULL,
	"spent_at" timestamp with time zone,
	"spent_by" text
);
--> statement-breakpoint
CREATE TABLE "access_sign_up" (
	"account_id" text,
	"reservation_id" uuid,
	CONSTRAINT "access_sign_up_pkey" PRIMARY KEY("account_id","reservation_id")
);
--> statement-breakpoint
CREATE INDEX "access_code_school" ON "access_code" ("school_id");--> statement-breakpoint
CREATE INDEX "access_reservation_code" ON "access_reservation" ("code_id");--> statement-breakpoint
ALTER TABLE "access_code" ADD CONSTRAINT "access_code_school_id_space_id_fkey" FOREIGN KEY ("school_id") REFERENCES "space"("id");--> statement-breakpoint
ALTER TABLE "access_reservation" ADD CONSTRAINT "access_reservation_code_id_access_code_id_fkey" FOREIGN KEY ("code_id") REFERENCES "access_code"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "access_sign_up" ADD CONSTRAINT "access_sign_up_account_id_auth_user_id_fkey" FOREIGN KEY ("account_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "access_sign_up" ADD CONSTRAINT "access_sign_up_reservation_id_access_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "access_reservation"("id") ON DELETE CASCADE;