-- Every access code gets a limit (D97). A code minted without one keeps 200 more admissions, more
-- than a year group needs, and its operator can mint a new one with the right count.
UPDATE "access_code" SET "max_uses" = "uses" + 200 WHERE "max_uses" IS NULL;--> statement-breakpoint
ALTER TABLE "access_code" ALTER COLUMN "max_uses" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_account_provider_account" ON "auth_account" ("providerId","accountId");
