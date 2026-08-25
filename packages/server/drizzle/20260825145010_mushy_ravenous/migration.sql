CREATE TABLE "notebook_profiles" (
	"schoolAccessId" uuid PRIMARY KEY,
	"displayName" text NOT NULL,
	"cohort" text,
	"className" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operator_grants" (
	"userId" uuid PRIMARY KEY,
	"revokedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operator_setup_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"userId" uuid NOT NULL,
	"tokenHash" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"usedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passkey" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text,
	"publicKey" text NOT NULL,
	"userId" uuid NOT NULL,
	"credentialID" text NOT NULL,
	"counter" integer NOT NULL,
	"deviceType" text NOT NULL,
	"backedUp" boolean NOT NULL,
	"transports" text,
	"createdAt" timestamp with time zone DEFAULT now(),
	"aaguid" text
);
--> statement-breakpoint
CREATE TABLE "school_access_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"schoolId" text NOT NULL,
	"kind" text NOT NULL,
	"secretHash" text NOT NULL,
	"createdByUserId" uuid NOT NULL,
	"expiresAt" timestamp with time zone,
	"revokedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "school_access_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"accessCodeId" uuid NOT NULL,
	"tokenHash" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "school_accesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"userId" uuid NOT NULL,
	"schoolId" text NOT NULL,
	"kind" text NOT NULL,
	"sourceCodeId" uuid NOT NULL,
	"revokedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "operator_grants_active_idx" ON "operator_grants" ("revokedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "operator_setup_tokens_secret_unique" ON "operator_setup_tokens" ("tokenHash");--> statement-breakpoint
CREATE INDEX "operator_setup_tokens_user_idx" ON "operator_setup_tokens" ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "passkey_credential_unique" ON "passkey" ("credentialID");--> statement-breakpoint
CREATE INDEX "passkey_user_id_idx" ON "passkey" ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "school_access_codes_secret_unique" ON "school_access_codes" ("secretHash");--> statement-breakpoint
CREATE INDEX "school_access_codes_school_idx" ON "school_access_codes" ("schoolId","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "school_access_reservations_code_unique" ON "school_access_reservations" ("accessCodeId");--> statement-breakpoint
CREATE UNIQUE INDEX "school_access_reservations_token_unique" ON "school_access_reservations" ("tokenHash");--> statement-breakpoint
CREATE INDEX "school_access_reservations_expiry_idx" ON "school_access_reservations" ("expiresAt");--> statement-breakpoint
CREATE UNIQUE INDEX "school_accesses_source_code_unique" ON "school_accesses" ("sourceCodeId");--> statement-breakpoint
CREATE UNIQUE INDEX "school_accesses_active_identity_unique" ON "school_accesses" ("userId","schoolId","kind") WHERE "revokedAt" is null;--> statement-breakpoint
CREATE INDEX "school_accesses_user_idx" ON "school_accesses" ("userId");--> statement-breakpoint
CREATE INDEX "school_accesses_school_idx" ON "school_accesses" ("schoolId","kind");--> statement-breakpoint
ALTER TABLE "notebook_profiles" ADD CONSTRAINT "notebook_profiles_schoolAccessId_school_accesses_id_fkey" FOREIGN KEY ("schoolAccessId") REFERENCES "school_accesses"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "operator_grants" ADD CONSTRAINT "operator_grants_userId_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "operator_setup_tokens" ADD CONSTRAINT "operator_setup_tokens_userId_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_userId_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "school_access_codes" ADD CONSTRAINT "school_access_codes_schoolId_schools_id_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id");--> statement-breakpoint
ALTER TABLE "school_access_codes" ADD CONSTRAINT "school_access_codes_createdByUserId_users_id_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "school_access_reservations" ADD CONSTRAINT "school_access_reservations_2cU8fbpxvoUd_fkey" FOREIGN KEY ("accessCodeId") REFERENCES "school_access_codes"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "school_accesses" ADD CONSTRAINT "school_accesses_userId_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "school_accesses" ADD CONSTRAINT "school_accesses_schoolId_schools_id_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id");--> statement-breakpoint
ALTER TABLE "school_accesses" ADD CONSTRAINT "school_accesses_sourceCodeId_school_access_codes_id_fkey" FOREIGN KEY ("sourceCodeId") REFERENCES "school_access_codes"("id");