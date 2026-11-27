CREATE TABLE "import_export" (
	"id" uuid PRIMARY KEY,
	"school_id" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"outcome" text,
	"report" jsonb DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE INDEX "import_export_school_started" ON "import_export" ("school_id","started_at");