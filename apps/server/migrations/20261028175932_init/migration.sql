CREATE TABLE "job_run" (
	"name" text PRIMARY KEY,
	"last_run_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_epoch" (
	"id" uuid PRIMARY KEY
);
--> statement-breakpoint
-- Written once here; a restore rewrites it (sync.md, "Backup restores and the epoch").
INSERT INTO "sync_epoch" ("id") VALUES (gen_random_uuid());
