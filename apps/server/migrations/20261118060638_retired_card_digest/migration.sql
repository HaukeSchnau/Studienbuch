ALTER TABLE "retired_card" ADD COLUMN "digest" bytea;--> statement-breakpoint
UPDATE "retired_card" SET "digest" = sha256(decode("public_key", 'hex'));--> statement-breakpoint
ALTER TABLE "retired_card" DROP COLUMN "public_key";--> statement-breakpoint
ALTER TABLE "retired_card" ADD PRIMARY KEY ("account_id","digest");