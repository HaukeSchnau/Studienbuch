CREATE TABLE "directory_entities" (
	"key" text PRIMARY KEY,
	"dataSourceId" text NOT NULL,
	"entityKind" text NOT NULL,
	"entityId" text NOT NULL,
	"schoolId" text NOT NULL,
	"contentHash" text NOT NULL,
	"payload" jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "directory_entity_sources" (
	"entityKey" text,
	"sourceRecordVersionId" uuid,
	CONSTRAINT "directory_entity_sources_pkey" PRIMARY KEY("entityKey","sourceRecordVersionId")
);
--> statement-breakpoint
CREATE TABLE "directory_projection_changes" (
	"projectionRunId" uuid,
	"entityKey" text,
	"entityKind" text NOT NULL,
	"entityId" text NOT NULL,
	"changeType" text NOT NULL,
	"beforeContentHash" text,
	"afterContentHash" text,
	CONSTRAINT "directory_projection_changes_pkey" PRIMARY KEY("projectionRunId","entityKey")
);
--> statement-breakpoint
CREATE TABLE "directory_projection_run_sources" (
	"projectionRunId" uuid,
	"sourceRunId" uuid,
	CONSTRAINT "directory_projection_run_sources_pkey" PRIMARY KEY("projectionRunId","sourceRunId")
);
--> statement-breakpoint
CREATE TABLE "directory_projection_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"dataSourceId" text NOT NULL,
	"outcome" text NOT NULL,
	"entityCount" integer NOT NULL,
	"addedCount" integer DEFAULT 0 NOT NULL,
	"updatedCount" integer DEFAULT 0 NOT NULL,
	"removedCount" integer DEFAULT 0 NOT NULL,
	"relinkedCount" integer DEFAULT 0 NOT NULL,
	"diagnostics" jsonb NOT NULL,
	"projectedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "directory_entities_identity_unique" ON "directory_entities" ("dataSourceId","entityKind","entityId");--> statement-breakpoint
CREATE INDEX "directory_entities_school_idx" ON "directory_entities" ("schoolId","entityKind");--> statement-breakpoint
CREATE INDEX "directory_projection_changes_entity_idx" ON "directory_projection_changes" ("entityKey");--> statement-breakpoint
CREATE INDEX "directory_projection_runs_source_idx" ON "directory_projection_runs" ("dataSourceId");--> statement-breakpoint
ALTER TABLE "directory_entity_sources" ADD CONSTRAINT "directory_entity_sources_entityKey_directory_entities_key_fkey" FOREIGN KEY ("entityKey") REFERENCES "directory_entities"("key") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "directory_entity_sources" ADD CONSTRAINT "directory_entity_sources_tkFs5ZTDxd4u_fkey" FOREIGN KEY ("sourceRecordVersionId") REFERENCES "source_record_versions"("id");--> statement-breakpoint
ALTER TABLE "directory_projection_changes" ADD CONSTRAINT "directory_projection_changes_AxpC8rkV8ak4_fkey" FOREIGN KEY ("projectionRunId") REFERENCES "directory_projection_runs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "directory_projection_run_sources" ADD CONSTRAINT "directory_projection_run_sources_w3Zm998VQEoj_fkey" FOREIGN KEY ("projectionRunId") REFERENCES "directory_projection_runs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "directory_projection_run_sources" ADD CONSTRAINT "directory_projection_run_sources_v9n5BG7K2tbL_fkey" FOREIGN KEY ("sourceRunId") REFERENCES "source_import_runs"("id");