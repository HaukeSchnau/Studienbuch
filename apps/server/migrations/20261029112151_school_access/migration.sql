CREATE TABLE "school_access" (
	"account_id" text,
	"school_id" text,
	"notebook_id" text NOT NULL CONSTRAINT "school_access_notebook" UNIQUE,
	"admitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "school_access_pkey" PRIMARY KEY("account_id","school_id")
);
--> statement-breakpoint
ALTER TABLE "school_access" ADD CONSTRAINT "school_access_account_id_auth_user_id_fkey" FOREIGN KEY ("account_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "school_access" ADD CONSTRAINT "school_access_school_id_space_id_fkey" FOREIGN KEY ("school_id") REFERENCES "space"("id");--> statement-breakpoint
ALTER TABLE "school_access" ADD CONSTRAINT "school_access_notebook_id_space_id_fkey" FOREIGN KEY ("notebook_id") REFERENCES "space"("id");