ALTER TABLE "users" ADD COLUMN "notification_keys" text[];--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "notification_key";