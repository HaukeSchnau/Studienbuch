CREATE TABLE "source_changes" (
	"runId" uuid,
	"entityKind" text,
	"externalId" text,
	"changeType" text NOT NULL,
	"beforeVersionId" uuid,
	"afterVersionId" uuid,
	CONSTRAINT "source_changes_pkey" PRIMARY KEY("runId","entityKind","externalId")
);
--> statement-breakpoint
CREATE TABLE "source_record_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"dataSourceId" text NOT NULL,
	"dataset" text NOT NULL,
	"scope" text NOT NULL,
	"entityKind" text NOT NULL,
	"externalId" text NOT NULL,
	"contentHash" text NOT NULL,
	"payload" jsonb NOT NULL,
	"firstObservedInRunId" uuid NOT NULL,
	"observedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_records" (
	"dataSourceId" text,
	"dataset" text,
	"scope" text,
	"entityKind" text,
	"externalId" text,
	"currentVersionId" uuid NOT NULL,
	"active" boolean NOT NULL,
	"firstSeenInRunId" uuid NOT NULL,
	"lastChangedInRunId" uuid NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_records_pkey" PRIMARY KEY("dataSourceId","dataset","scope","entityKind","externalId")
);
--> statement-breakpoint
ALTER TABLE "source_import_runs" ADD COLUMN "outcome" text DEFAULT 'Migrated' NOT NULL;--> statement-breakpoint
ALTER TABLE "source_import_runs" ADD COLUMN "addedCount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "source_import_runs" ADD COLUMN "updatedCount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "source_import_runs" ADD COLUMN "removedCount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "source_import_runs" ADD COLUMN "reactivatedCount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
INSERT INTO "source_record_versions" (
	"dataSourceId",
	"dataset",
	"scope",
	"entityKind",
	"externalId",
	"contentHash",
	"payload",
	"firstObservedInRunId",
	"observedAt"
)
SELECT DISTINCT ON (
	r."dataSourceId",
	r."dataset",
	r."scope",
	o."entityKind",
	o."externalId",
	o."contentHash"
)
	r."dataSourceId",
	r."dataset",
	r."scope",
	o."entityKind",
	o."externalId",
	o."contentHash",
	o."payload",
	o."runId",
	r."observedAt"
FROM "source_observations" o
JOIN "source_import_runs" r ON r."id" = o."runId"
ORDER BY
	r."dataSourceId",
	r."dataset",
	r."scope",
	o."entityKind",
	o."externalId",
	o."contentHash",
	r."observedAt",
	r."id";--> statement-breakpoint
WITH observation_history AS (
	SELECT
		r."dataSourceId",
		r."dataset",
		r."scope",
		o."entityKind",
		o."externalId",
		o."contentHash",
		first_value(o."runId") OVER (
			PARTITION BY r."dataSourceId", r."dataset", r."scope", o."entityKind", o."externalId"
			ORDER BY r."observedAt", r."id"
		) AS "firstSeenInRunId",
		row_number() OVER (
			PARTITION BY r."dataSourceId", r."dataset", r."scope", o."entityKind", o."externalId"
			ORDER BY r."isCurrent" DESC, r."observedAt" DESC, r."id" DESC
		) AS "identityRank"
	FROM "source_observations" o
	JOIN "source_import_runs" r ON r."id" = o."runId"
)
INSERT INTO "source_records" (
	"dataSourceId",
	"dataset",
	"scope",
	"entityKind",
	"externalId",
	"currentVersionId",
	"active",
	"firstSeenInRunId",
	"lastChangedInRunId"
)
SELECT
	h."dataSourceId",
	h."dataset",
	h."scope",
	h."entityKind",
	h."externalId",
	v."id",
	EXISTS (
		SELECT 1
		FROM "source_import_runs" current_run
		JOIN "source_observations" current_observation
			ON current_observation."runId" = current_run."id"
		WHERE current_run."dataSourceId" = h."dataSourceId"
			AND current_run."dataset" = h."dataset"
			AND current_run."scope" = h."scope"
			AND current_run."isCurrent" = true
			AND current_observation."entityKind" = h."entityKind"
			AND current_observation."externalId" = h."externalId"
	),
	h."firstSeenInRunId",
	v."firstObservedInRunId"
FROM observation_history h
JOIN "source_record_versions" v
	ON v."dataSourceId" = h."dataSourceId"
	AND v."dataset" = h."dataset"
	AND v."scope" = h."scope"
	AND v."entityKind" = h."entityKind"
	AND v."externalId" = h."externalId"
	AND v."contentHash" = h."contentHash"
WHERE h."identityRank" = 1;--> statement-breakpoint
INSERT INTO "source_changes" (
	"runId",
	"entityKind",
	"externalId",
	"changeType",
	"beforeVersionId",
	"afterVersionId"
)
SELECT
	r."id",
	record."entityKind",
	record."externalId",
	'Added',
	NULL,
	record."currentVersionId"
FROM "source_records" record
JOIN "source_import_runs" r
	ON r."dataSourceId" = record."dataSourceId"
	AND r."dataset" = record."dataset"
	AND r."scope" = record."scope"
	AND r."isCurrent" = true
WHERE record."active" = true;--> statement-breakpoint
UPDATE "source_import_runs" r
SET "addedCount" = changes."count"
FROM (
	SELECT "runId", count(*)::integer AS "count"
	FROM "source_changes"
	GROUP BY "runId"
) changes
WHERE r."id" = changes."runId";--> statement-breakpoint
DROP TABLE "source_observations";--> statement-breakpoint
ALTER TABLE "source_import_runs" ALTER COLUMN "outcome" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "source_import_runs" ALTER COLUMN "completeness" DROP DEFAULT;--> statement-breakpoint
CREATE INDEX "source_changes_after_version_idx" ON "source_changes" ("afterVersionId");--> statement-breakpoint
CREATE UNIQUE INDEX "source_record_versions_identity_hash_unique" ON "source_record_versions" ("dataSourceId","dataset","scope","entityKind","externalId","contentHash");--> statement-breakpoint
CREATE INDEX "source_record_versions_identity_idx" ON "source_record_versions" ("dataSourceId","dataset","scope","entityKind","externalId");--> statement-breakpoint
CREATE INDEX "source_records_current_version_idx" ON "source_records" ("currentVersionId");--> statement-breakpoint
ALTER TABLE "source_changes" ADD CONSTRAINT "source_changes_runId_source_import_runs_id_fkey" FOREIGN KEY ("runId") REFERENCES "source_import_runs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "source_changes" ADD CONSTRAINT "source_changes_beforeVersionId_source_record_versions_id_fkey" FOREIGN KEY ("beforeVersionId") REFERENCES "source_record_versions"("id");--> statement-breakpoint
ALTER TABLE "source_changes" ADD CONSTRAINT "source_changes_afterVersionId_source_record_versions_id_fkey" FOREIGN KEY ("afterVersionId") REFERENCES "source_record_versions"("id");--> statement-breakpoint
ALTER TABLE "source_record_versions" ADD CONSTRAINT "source_record_versions_QIvVd3c22OXq_fkey" FOREIGN KEY ("firstObservedInRunId") REFERENCES "source_import_runs"("id");--> statement-breakpoint
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_currentVersionId_source_record_versions_id_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "source_record_versions"("id");--> statement-breakpoint
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_firstSeenInRunId_source_import_runs_id_fkey" FOREIGN KEY ("firstSeenInRunId") REFERENCES "source_import_runs"("id");--> statement-breakpoint
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_lastChangedInRunId_source_import_runs_id_fkey" FOREIGN KEY ("lastChangedInRunId") REFERENCES "source_import_runs"("id");
