CREATE TABLE "entity_links" (
	"dataSourceId" text,
	"entityKind" text,
	"externalId" text,
	"domainEntityKind" text,
	"domainEntityId" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entity_links_pkey" PRIMARY KEY("dataSourceId","entityKind","externalId","domainEntityKind")
);
--> statement-breakpoint
CREATE TABLE "timetable_occurrence_sources" (
	"occurrenceId" text,
	"sourceRecordVersionId" uuid,
	CONSTRAINT "timetable_occurrence_sources_pkey" PRIMARY KEY("occurrenceId","sourceRecordVersionId")
);
--> statement-breakpoint
CREATE TABLE "timetable_occurrences" (
	"id" text PRIMARY KEY,
	"dataSourceId" text NOT NULL,
	"scope" text NOT NULL,
	"date" text NOT NULL,
	"contentHash" text NOT NULL,
	"payload" jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timetable_projection_changes" (
	"projectionRunId" uuid,
	"occurrenceId" text,
	"changeType" text NOT NULL,
	"beforeContentHash" text,
	"afterContentHash" text,
	CONSTRAINT "timetable_projection_changes_pkey" PRIMARY KEY("projectionRunId","occurrenceId")
);
--> statement-breakpoint
CREATE TABLE "timetable_projection_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"dataSourceId" text NOT NULL,
	"scope" text NOT NULL,
	"sourceRunId" uuid NOT NULL,
	"outcome" text NOT NULL,
	"occurrenceCount" integer NOT NULL,
	"addedCount" integer DEFAULT 0 NOT NULL,
	"updatedCount" integer DEFAULT 0 NOT NULL,
	"removedCount" integer DEFAULT 0 NOT NULL,
	"relinkedCount" integer DEFAULT 0 NOT NULL,
	"projectedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "entity_links_domain_idx" ON "entity_links" ("domainEntityKind","domainEntityId");--> statement-breakpoint
CREATE INDEX "timetable_occurrences_source_date_idx" ON "timetable_occurrences" ("dataSourceId","date");--> statement-breakpoint
CREATE UNIQUE INDEX "timetable_occurrences_scope_id_unique" ON "timetable_occurrences" ("dataSourceId","scope","id");--> statement-breakpoint
CREATE INDEX "timetable_projection_changes_occurrence_idx" ON "timetable_projection_changes" ("occurrenceId");--> statement-breakpoint
CREATE INDEX "timetable_projection_runs_scope_idx" ON "timetable_projection_runs" ("dataSourceId","scope");--> statement-breakpoint
CREATE INDEX "timetable_projection_runs_source_run_idx" ON "timetable_projection_runs" ("sourceRunId");--> statement-breakpoint
ALTER TABLE "timetable_occurrence_sources" ADD CONSTRAINT "timetable_occurrence_sources_L2c5ZCeW184q_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "timetable_occurrences"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "timetable_occurrence_sources" ADD CONSTRAINT "timetable_occurrence_sources_PUqSR1EPm9CE_fkey" FOREIGN KEY ("sourceRecordVersionId") REFERENCES "source_record_versions"("id");--> statement-breakpoint
ALTER TABLE "timetable_projection_changes" ADD CONSTRAINT "timetable_projection_changes_pbKMLm2ONMG4_fkey" FOREIGN KEY ("projectionRunId") REFERENCES "timetable_projection_runs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "timetable_projection_runs" ADD CONSTRAINT "timetable_projection_runs_EGAv55i0DEr5_fkey" FOREIGN KEY ("sourceRunId") REFERENCES "source_import_runs"("id");