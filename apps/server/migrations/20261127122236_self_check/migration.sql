ALTER TABLE "import_run" ADD COLUMN "self_check" jsonb;--> statement-breakpoint
ALTER TABLE "import_school" ADD COLUMN "kurswahl" jsonb DEFAULT '[]' NOT NULL;