CREATE TABLE "job_run" (
	"name" text PRIMARY KEY,
	"last_run_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_epoch" (
	"id" uuid PRIMARY KEY
);
