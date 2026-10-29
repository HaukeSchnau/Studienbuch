CREATE TABLE "command_log" (
	"client_id" text collate "C",
	"mutation_id" bigint,
	"account_id" text collate "C" NOT NULL,
	"kind" text collate "C" NOT NULL,
	"name" text collate "C",
	"version" integer,
	"detail" jsonb NOT NULL,
	"applied" boolean NOT NULL,
	"reason" jsonb,
	"at" timestamp with time zone NOT NULL,
	"processed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "command_log_pkey" PRIMARY KEY("client_id","mutation_id")
);
--> statement-breakpoint
CREATE TABLE "space" (
	"id" text collate "C" PRIMARY KEY,
	"kind" text collate "C" NOT NULL,
	"parent_id" text collate "C",
	"key" text collate "C",
	"version" bigint DEFAULT 0 NOT NULL,
	"key_epoch" integer
);
--> statement-breakpoint
CREATE TABLE "space_member" (
	"space_id" text collate "C",
	"account_id" text collate "C",
	"role" text collate "C" NOT NULL,
	"granted_by" text collate "C",
	CONSTRAINT "space_member_pkey" PRIMARY KEY("space_id","account_id")
);
--> statement-breakpoint
CREATE TABLE "sync_client" (
	"id" text collate "C" PRIMARY KEY,
	"account_id" text collate "C" NOT NULL,
	"last_mutation_id" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_row" (
	"space_id" text collate "C",
	"tbl" text collate "C",
	"id" text collate "C",
	"version" bigint NOT NULL,
	"data" jsonb,
	"envelope" jsonb,
	"ct" bytea,
	"written_by_client" text collate "C",
	"written_by_mutation" bigint,
	CONSTRAINT "sync_row_pkey" PRIMARY KEY("space_id","tbl","id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "space_parent_kind_key" ON "space" ("parent_id","kind","key");--> statement-breakpoint
CREATE INDEX "space_member_account" ON "space_member" ("account_id");--> statement-breakpoint
CREATE INDEX "space_member_granted_by" ON "space_member" ("granted_by");--> statement-breakpoint
CREATE INDEX "sync_client_account" ON "sync_client" ("account_id");--> statement-breakpoint
CREATE INDEX "sync_row_space_version" ON "sync_row" ("space_id","version");--> statement-breakpoint
ALTER TABLE "command_log" ADD CONSTRAINT "command_log_client_id_sync_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "sync_client"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "space" ADD CONSTRAINT "space_parent_id_space_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "space"("id");--> statement-breakpoint
ALTER TABLE "space_member" ADD CONSTRAINT "space_member_space_id_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "space"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sync_row" ADD CONSTRAINT "sync_row_space_id_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "space"("id") ON DELETE CASCADE;