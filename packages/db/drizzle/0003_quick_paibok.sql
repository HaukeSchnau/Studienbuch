ALTER TABLE "substitutions" ALTER COLUMN "date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "timetable_entries" ALTER COLUMN "date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "public"."courses" ALTER COLUMN "subject" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."subject";--> statement-breakpoint
CREATE TYPE "public"."subject" AS ENUM('de', 'en', 'ma', 'ph', 'ch', 'bi', 'if', 'ge', 'pw', 'mu', 'sp', 'ku', 're', 'wn', 'fr', 'la', 'sn', 'sport-theorie', 'sf', 'tutorium', 'ds', 'ek', 'nw', 'gsl', 'theo', 'awt', 'sw', 'swb', 'lp', 'kr', 'wpk', 'wal', 'bläser_k', 'nachhaltigkeit');--> statement-breakpoint
ALTER TABLE "public"."courses" ALTER COLUMN "subject" SET DATA TYPE "public"."subject" USING "subject"::"public"."subject";