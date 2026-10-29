CREATE TABLE "auth_account" (
	"id" text PRIMARY KEY,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp with time zone,
	"refreshTokenExpiresAt" timestamp with time zone,
	"scope" text,
	"password" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_passkey" (
	"id" text PRIMARY KEY,
	"name" text,
	"publicKey" text NOT NULL,
	"userId" text NOT NULL,
	"credentialID" text NOT NULL,
	"counter" integer NOT NULL,
	"deviceType" text NOT NULL,
	"backedUp" boolean NOT NULL,
	"transports" text,
	"createdAt" timestamp with time zone,
	"aaguid" text
);
--> statement-breakpoint
CREATE TABLE "auth_session" (
	"id" text PRIMARY KEY,
	"expiresAt" timestamp with time zone NOT NULL,
	"token" text NOT NULL UNIQUE,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_user" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_verification" (
	"id" text PRIMARY KEY,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "captured_mail" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"text" text NOT NULL,
	"sent_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "auth_account_userId_idx" ON "auth_account" ("userId");--> statement-breakpoint
CREATE INDEX "auth_passkey_userId_idx" ON "auth_passkey" ("userId");--> statement-breakpoint
CREATE INDEX "auth_passkey_credentialID_idx" ON "auth_passkey" ("credentialID");--> statement-breakpoint
CREATE INDEX "auth_session_userId_idx" ON "auth_session" ("userId");--> statement-breakpoint
CREATE INDEX "auth_verification_identifier_idx" ON "auth_verification" ("identifier");--> statement-breakpoint
CREATE INDEX "captured_mail_sent_at" ON "captured_mail" ("sent_at");--> statement-breakpoint
ALTER TABLE "auth_account" ADD CONSTRAINT "auth_account_userId_auth_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "auth_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth_passkey" ADD CONSTRAINT "auth_passkey_userId_auth_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "auth_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth_session" ADD CONSTRAINT "auth_session_userId_auth_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "auth_user"("id") ON DELETE CASCADE;