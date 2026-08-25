CREATE TABLE "course_annual_observation_sources" (
	"annualObservationKey" text,
	"sourceRecordVersionId" uuid,
	CONSTRAINT "course_annual_observation_sources_pkey" PRIMARY KEY("annualObservationKey","sourceRecordVersionId")
);
--> statement-breakpoint
CREATE TABLE "course_annual_observations" (
	"key" text PRIMARY KEY,
	"dataSourceId" text NOT NULL,
	"observationId" text NOT NULL,
	"academicYearExternalId" text NOT NULL,
	"contentHash" text NOT NULL,
	"payload" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"courseOfferingId" uuid,
	"resolutionReason" text,
	"firstProjectedInRunId" uuid NOT NULL,
	"lastProjectedInRunId" uuid NOT NULL,
	"resolvedInRunId" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_identity_decisions" (
	"key" text PRIMARY KEY,
	"dataSourceId" text NOT NULL,
	"leftObservationKey" text NOT NULL,
	"rightObservationKey" text NOT NULL,
	"ruleId" text NOT NULL,
	"outcome" text NOT NULL,
	"contentHash" text NOT NULL,
	"payload" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"firstEvaluatedInRunId" uuid NOT NULL,
	"lastEvaluatedInRunId" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_occurrence_assignments" (
	"dataSourceId" text,
	"occurrenceId" text,
	"courseOfferingId" uuid,
	"annualObservationKey" text NOT NULL,
	"assignedInRunId" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_occurrence_assignments_pkey" PRIMARY KEY("dataSourceId","occurrenceId","courseOfferingId")
);
--> statement-breakpoint
CREATE TABLE "course_offering_academic_years" (
	"courseOfferingId" uuid,
	"academicYearId" text,
	"contentHash" text NOT NULL,
	"payload" jsonb NOT NULL,
	"updatedInRunId" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_offering_academic_years_pkey" PRIMARY KEY("courseOfferingId","academicYearId")
);
--> statement-breakpoint
CREATE TABLE "course_offerings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"dataSourceId" text NOT NULL,
	"schoolId" text NOT NULL,
	"createdInRunId" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_projection_run_sources" (
	"projectionRunId" uuid,
	"sourceRunId" uuid,
	CONSTRAINT "course_projection_run_sources_pkey" PRIMARY KEY("projectionRunId","sourceRunId")
);
--> statement-breakpoint
CREATE TABLE "course_projection_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"dataSourceId" text NOT NULL,
	"ruleId" text NOT NULL,
	"outcome" text NOT NULL,
	"annualObservationCount" integer NOT NULL,
	"decisionCount" integer NOT NULL,
	"resolvedObservationCount" integer NOT NULL,
	"unresolvedObservationCount" integer NOT NULL,
	"createdOfferingCount" integer DEFAULT 0 NOT NULL,
	"occurrenceAssignmentCount" integer NOT NULL,
	"changedCount" integer DEFAULT 0 NOT NULL,
	"projectedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "course_annual_observations_identity_unique" ON "course_annual_observations" ("dataSourceId","observationId");--> statement-breakpoint
CREATE INDEX "course_annual_observations_year_idx" ON "course_annual_observations" ("dataSourceId","academicYearExternalId","active");--> statement-breakpoint
CREATE INDEX "course_annual_observations_offering_idx" ON "course_annual_observations" ("courseOfferingId");--> statement-breakpoint
CREATE UNIQUE INDEX "course_identity_decisions_pair_unique" ON "course_identity_decisions" ("dataSourceId","leftObservationKey","rightObservationKey");--> statement-breakpoint
CREATE INDEX "course_identity_decisions_outcome_idx" ON "course_identity_decisions" ("dataSourceId","outcome");--> statement-breakpoint
CREATE INDEX "course_occurrence_assignments_occurrence_idx" ON "course_occurrence_assignments" ("dataSourceId","occurrenceId");--> statement-breakpoint
CREATE UNIQUE INDEX "course_occurrence_assignments_evidence_unique" ON "course_occurrence_assignments" ("dataSourceId","occurrenceId","annualObservationKey") WHERE "annualObservationKey" is not null;--> statement-breakpoint
CREATE INDEX "course_offerings_school_idx" ON "course_offerings" ("schoolId");--> statement-breakpoint
CREATE INDEX "course_projection_runs_source_idx" ON "course_projection_runs" ("dataSourceId");--> statement-breakpoint
ALTER TABLE "course_annual_observation_sources" ADD CONSTRAINT "course_annual_observation_sources_lx64Ns3KJKs2_fkey" FOREIGN KEY ("annualObservationKey") REFERENCES "course_annual_observations"("key") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "course_annual_observation_sources" ADD CONSTRAINT "course_annual_observation_sources_EqTFSHoepjFl_fkey" FOREIGN KEY ("sourceRecordVersionId") REFERENCES "source_record_versions"("id");--> statement-breakpoint
ALTER TABLE "course_annual_observations" ADD CONSTRAINT "course_annual_observations_6ZWnRluby9UW_fkey" FOREIGN KEY ("courseOfferingId") REFERENCES "course_offerings"("id");--> statement-breakpoint
ALTER TABLE "course_annual_observations" ADD CONSTRAINT "course_annual_observations_F0yxOTVxMdW6_fkey" FOREIGN KEY ("firstProjectedInRunId") REFERENCES "course_projection_runs"("id");--> statement-breakpoint
ALTER TABLE "course_annual_observations" ADD CONSTRAINT "course_annual_observations_3I7xPJkWeN4O_fkey" FOREIGN KEY ("lastProjectedInRunId") REFERENCES "course_projection_runs"("id");--> statement-breakpoint
ALTER TABLE "course_annual_observations" ADD CONSTRAINT "course_annual_observations_dSpRGzHze6AW_fkey" FOREIGN KEY ("resolvedInRunId") REFERENCES "course_projection_runs"("id");--> statement-breakpoint
ALTER TABLE "course_identity_decisions" ADD CONSTRAINT "course_identity_decisions_vsH4AdSni8VR_fkey" FOREIGN KEY ("leftObservationKey") REFERENCES "course_annual_observations"("key");--> statement-breakpoint
ALTER TABLE "course_identity_decisions" ADD CONSTRAINT "course_identity_decisions_eBvJg3BcULAe_fkey" FOREIGN KEY ("rightObservationKey") REFERENCES "course_annual_observations"("key");--> statement-breakpoint
ALTER TABLE "course_identity_decisions" ADD CONSTRAINT "course_identity_decisions_gDRGnZnZozyS_fkey" FOREIGN KEY ("firstEvaluatedInRunId") REFERENCES "course_projection_runs"("id");--> statement-breakpoint
ALTER TABLE "course_identity_decisions" ADD CONSTRAINT "course_identity_decisions_klUsNHbUvUQW_fkey" FOREIGN KEY ("lastEvaluatedInRunId") REFERENCES "course_projection_runs"("id");--> statement-breakpoint
ALTER TABLE "course_occurrence_assignments" ADD CONSTRAINT "course_occurrence_assignments_bIYyliF9bUSR_fkey" FOREIGN KEY ("courseOfferingId") REFERENCES "course_offerings"("id");--> statement-breakpoint
ALTER TABLE "course_occurrence_assignments" ADD CONSTRAINT "course_occurrence_assignments_5mqrtLDX9j3b_fkey" FOREIGN KEY ("annualObservationKey") REFERENCES "course_annual_observations"("key");--> statement-breakpoint
ALTER TABLE "course_occurrence_assignments" ADD CONSTRAINT "course_occurrence_assignments_bjYstDNo33Zd_fkey" FOREIGN KEY ("assignedInRunId") REFERENCES "course_projection_runs"("id");--> statement-breakpoint
ALTER TABLE "course_offering_academic_years" ADD CONSTRAINT "course_offering_academic_years_XOfr2wwOCjFw_fkey" FOREIGN KEY ("courseOfferingId") REFERENCES "course_offerings"("id");--> statement-breakpoint
ALTER TABLE "course_offering_academic_years" ADD CONSTRAINT "course_offering_academic_years_bDFKce9SsVVP_fkey" FOREIGN KEY ("updatedInRunId") REFERENCES "course_projection_runs"("id");--> statement-breakpoint
ALTER TABLE "course_offerings" ADD CONSTRAINT "course_offerings_createdInRunId_course_projection_runs_id_fkey" FOREIGN KEY ("createdInRunId") REFERENCES "course_projection_runs"("id");--> statement-breakpoint
ALTER TABLE "course_projection_run_sources" ADD CONSTRAINT "course_projection_run_sources_t2wMO9vCimoL_fkey" FOREIGN KEY ("projectionRunId") REFERENCES "course_projection_runs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "course_projection_run_sources" ADD CONSTRAINT "course_projection_run_sources_hWmw7wfNePFf_fkey" FOREIGN KEY ("sourceRunId") REFERENCES "source_import_runs"("id");