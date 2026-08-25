CREATE TABLE "school_enquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"schoolName" text NOT NULL,
	"contactName" text NOT NULL,
	"email" text NOT NULL,
	"message" text NOT NULL,
	"receivedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"notifiedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "school_enquiries_received_idx" ON "school_enquiries" ("receivedAt");