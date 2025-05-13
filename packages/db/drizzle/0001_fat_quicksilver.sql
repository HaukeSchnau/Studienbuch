ALTER TABLE "events" DROP CONSTRAINT "events_initiator_users_id_fk";
--> statement-breakpoint
DELETE FROM "users" WHERE "id" = '00000000-0000-0000-0000-000000000000';--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_id_persons_id_fk" FOREIGN KEY ("id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public"."courses" ALTER COLUMN "subject" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."subject";--> statement-breakpoint
CREATE TYPE "public"."subject" AS ENUM('de', 'en', 'ma', 'ph', 'ch', 'bi', 'if', 'ge', 'pw', 'mu', 'sp', 'ku', 're', 'wn', 'fr', 'la', 'sn', 'sport-theorie', 'sf', 'tutorium', 'ds', 'ek', 'nw', 'gsl', 'theo', 'awt', 'igl', 'sw', 'swb', 'lp', 'kr', 'wpk', 'wal', 'bläser_k', 'nachhaltigkeit');--> statement-breakpoint
ALTER TABLE "public"."courses" ALTER COLUMN "subject" SET DATA TYPE "public"."subject" USING "subject"::"public"."subject";