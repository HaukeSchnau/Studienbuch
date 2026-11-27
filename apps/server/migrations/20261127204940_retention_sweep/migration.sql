CREATE TABLE "retention_sweep" (
	"school_id" text PRIMARY KEY,
	"swept_on" date NOT NULL,
	"swept_at" timestamp with time zone NOT NULL,
	"lessons" integer,
	"checkpoint" integer,
	"versions" integer,
	"failure" text
);
