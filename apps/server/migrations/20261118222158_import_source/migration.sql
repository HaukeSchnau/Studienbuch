CREATE TABLE "import_run" (
	"id" uuid PRIMARY KEY,
	"school_id" text NOT NULL,
	"date" date NOT NULL,
	"nightly" boolean NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"outcome" text,
	"reserved" integer NOT NULL,
	"sent" integer DEFAULT 0 NOT NULL,
	"report" jsonb DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_school" (
	"school_id" text PRIMARY KEY,
	"lease_until" timestamp with time zone,
	"lease_owner" uuid,
	"paused_by" text,
	"paused_at" timestamp with time zone,
	"revision" integer DEFAULT 0 NOT NULL,
	"observed_at" timestamp with time zone,
	"previous" jsonb,
	"pending" jsonb DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_version" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "source_version_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"school_id" text NOT NULL,
	"path" text NOT NULL,
	"day" date,
	"observed_at" timestamp with time zone NOT NULL,
	"hash" text NOT NULL,
	"body" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "import_run_school_date" ON "import_run" ("school_id","date");--> statement-breakpoint
CREATE INDEX "source_version_latest" ON "source_version" ("school_id","path","day","observed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "source_version_observed" ON "source_version" ("school_id","observed_at");