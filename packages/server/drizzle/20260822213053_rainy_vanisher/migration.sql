CREATE TABLE "source_import_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"provider" text NOT NULL,
	"dataSourceId" text NOT NULL,
	"dataset" text NOT NULL,
	"scope" text NOT NULL,
	"contentHash" text NOT NULL,
	"completeness" text DEFAULT 'Complete' NOT NULL,
	"observationCount" integer NOT NULL,
	"counts" jsonb NOT NULL,
	"diagnostics" jsonb NOT NULL,
	"isCurrent" boolean DEFAULT false NOT NULL,
	"observedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_observations" (
	"runId" uuid,
	"entityKind" text,
	"externalId" text,
	"contentHash" text NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "source_observations_pkey" PRIMARY KEY("runId","entityKind","externalId")
);
--> statement-breakpoint
CREATE INDEX "source_import_runs_scope_idx" ON "source_import_runs" ("dataSourceId","dataset","scope");--> statement-breakpoint
CREATE UNIQUE INDEX "source_import_runs_current_unique" ON "source_import_runs" ("dataSourceId","dataset","scope") WHERE "isCurrent" = true;--> statement-breakpoint
CREATE INDEX "source_observations_identity_idx" ON "source_observations" ("entityKind","externalId");--> statement-breakpoint
ALTER TABLE "source_observations" ADD CONSTRAINT "source_observations_runId_source_import_runs_id_fkey" FOREIGN KEY ("runId") REFERENCES "source_import_runs"("id") ON DELETE CASCADE;