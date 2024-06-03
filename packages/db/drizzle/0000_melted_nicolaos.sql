-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
DO $$ BEGIN
 CREATE TYPE "public"."CourseTimeWeeks" AS ENUM('EVEN', 'ODD', 'BOTH');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."GradeType" AS ENUM('WRITTEN', 'ORAL', 'MASTER');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."Permission" AS ENUM('EDIT_INFO_PAGES', 'EDIT_USERS', 'EDIT_COURSES', 'EDIT_YEARS', 'EDIT_CLASSES', 'EDIT_SCHOOLS', 'VIEW_LOGS');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."SemesterType" AS ENUM('SUMMER', 'WINTER');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."StateCode" AS ENUM('BB', 'BE', 'BW', 'BY', 'HB', 'HE', 'HH', 'MV', 'NI', 'NW', 'RP', 'SH', 'SL', 'SN', 'ST', 'TH');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."StaticRole" AS ENUM('TEACHER', 'STUDENT');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."SubstitutionType" AS ENUM('FREISETZUNG', 'VERTRETUNG', 'BETREUUNG', 'ENTFALL', 'TROTZ_ABSENZ');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Course" (
	"id" serial PRIMARY KEY NOT NULL,
	"courseId" text NOT NULL,
	"name" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"room" text,
	"isChoosable" boolean DEFAULT false NOT NULL,
	"teacherId" integer NOT NULL,
	"classId" integer NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"semesterId" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "CourseTime" (
	"id" serial PRIMARY KEY NOT NULL,
	"weekday" integer NOT NULL,
	"start" integer NOT NULL,
	"duration" integer NOT NULL,
	"weeks" "CourseTimeWeeks" DEFAULT 'BOTH' NOT NULL,
	"courseId" integer,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Role" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"defaultScope" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "School" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"image" text NOT NULL,
	"theme" jsonb NOT NULL,
	"stateCode" "StateCode" DEFAULT 'NI' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Session" (
	"userId" integer,
	"expires" timestamp(3) NOT NULL,
	"token" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Substitution" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" timestamp(3) NOT NULL,
	"lessonStart" integer NOT NULL,
	"lessonEnd" integer NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"courseId" integer NOT NULL,
	"room" text,
	"type" "SubstitutionType",
	"substituteId" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Class" (
	"id" serial PRIMARY KEY NOT NULL,
	"identifierInYear" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"yearId" integer NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "_RoleToUser" (
	"A" integer NOT NULL,
	"B" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"checksum" varchar(64) NOT NULL,
	"finished_at" timestamp with time zone,
	"migration_name" varchar(255) NOT NULL,
	"logs" text,
	"rolled_back_at" timestamp with time zone,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_steps_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Year" (
	"id" serial PRIMARY KEY NOT NULL,
	"startYear" integer NOT NULL,
	"graduationYear" integer NOT NULL,
	"name" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"schoolId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "CourseSubscription" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"courseId" integer NOT NULL,
	"messagingToken" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "User" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text,
	"name" text NOT NULL,
	"title" text,
	"abbrv" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"passwordHash" text,
	"isSuperUser" boolean DEFAULT false NOT NULL,
	"role" "StaticRole",
	"notificationKey" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Semester" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"start" timestamp(3) NOT NULL,
	"end" timestamp(3) NOT NULL,
	"schoolId" integer NOT NULL,
	"type" "SemesterType" NOT NULL,
	"year" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "LicenseKey" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"activatedAt" timestamp(3),
	"expiresAt" timestamp(3),
	"isSuperKey" boolean DEFAULT false NOT NULL,
	"activatedById" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "_students" (
	"A" integer NOT NULL,
	"B" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Absence" (
	"id" text PRIMARY KEY NOT NULL,
	"date" timestamp(3) NOT NULL,
	"reason" text NOT NULL,
	"courseId" integer NOT NULL,
	"studentId" integer NOT NULL,
	"teacherSignature" text,
	"parentSignature" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Grade" (
	"id" text PRIMARY KEY NOT NULL,
	"date" timestamp(3) NOT NULL,
	"result" numeric(65, 30) NOT NULL,
	"type" "GradeType" NOT NULL,
	"teacherSignature" text,
	"parentSignature" text,
	"courseId" integer NOT NULL,
	"studentId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Task" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"dueDate" timestamp(3) NOT NULL,
	"courseId" integer NOT NULL,
	"ownerId" integer NOT NULL,
	"images" text[],
	"done" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "_ClassToCourse" (
	"A" integer NOT NULL,
	"B" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "PermissionOnUser" (
	"permission" "Permission" NOT NULL,
	"userId" integer NOT NULL,
	"scope" jsonb,
	CONSTRAINT "PermissionOnUser_pkey" PRIMARY KEY("permission","userId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "PermissionOnRole" (
	"permission" "Permission" NOT NULL,
	"roleId" integer NOT NULL,
	"scope" jsonb,
	CONSTRAINT "PermissionOnRole_pkey" PRIMARY KEY("permission","roleId")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Course" ADD CONSTRAINT "Course_classId_fkey" FOREIGN KEY ("classId") REFERENCES "public"."Class"("id") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Course" ADD CONSTRAINT "Course_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Course" ADD CONSTRAINT "Course_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "public"."Semester"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "CourseTime" ADD CONSTRAINT "CourseTime_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Substitution" ADD CONSTRAINT "Substitution_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Substitution" ADD CONSTRAINT "Substitution_substituteId_fkey" FOREIGN KEY ("substituteId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Class" ADD CONSTRAINT "Class_yearId_fkey" FOREIGN KEY ("yearId") REFERENCES "public"."Year"("id") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "_RoleToUser" ADD CONSTRAINT "_RoleToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Role"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "_RoleToUser" ADD CONSTRAINT "_RoleToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Year" ADD CONSTRAINT "Year_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "public"."School"("id") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "CourseSubscription" ADD CONSTRAINT "CourseSubscription_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Semester" ADD CONSTRAINT "Semester_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "public"."School"("id") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "LicenseKey" ADD CONSTRAINT "LicenseKey_activatedById_fkey" FOREIGN KEY ("activatedById") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "_students" ADD CONSTRAINT "_students_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Course"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "_students" ADD CONSTRAINT "_students_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Absence" ADD CONSTRAINT "Absence_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Absence" ADD CONSTRAINT "Absence_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Grade" ADD CONSTRAINT "Grade_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Grade" ADD CONSTRAINT "Grade_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Task" ADD CONSTRAINT "Task_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Task" ADD CONSTRAINT "Task_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "_ClassToCourse" ADD CONSTRAINT "_ClassToCourse_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Class"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "_ClassToCourse" ADD CONSTRAINT "_ClassToCourse_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Course"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "PermissionOnUser" ADD CONSTRAINT "PermissionOnUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "PermissionOnRole" ADD CONSTRAINT "PermissionOnRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."Role"("id") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Course_courseId_semesterId_room_key" ON "Course" ("courseId","room","semesterId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Role_name_key" ON "Role" ("name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "School_name_key" ON "School" ("name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Substitution_date_lessonStart_courseId_key" ON "Substitution" ("date","lessonStart","courseId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Class_identifierInYear_yearId_key" ON "Class" ("identifierInYear","yearId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "_RoleToUser_AB_unique" ON "_RoleToUser" ("A","B");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "_RoleToUser_B_index" ON "_RoleToUser" ("B");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Year_startYear_schoolId_key" ON "Year" ("startYear","schoolId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "CourseSubscription_courseId_messagingToken_key" ON "CourseSubscription" ("courseId","messagingToken");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "User_abbrv_key" ON "User" ("abbrv");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Semester_year_type_schoolId_key" ON "Semester" ("schoolId","type","year");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "LicenseKey_key_key" ON "LicenseKey" ("key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "_students_AB_unique" ON "_students" ("A","B");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "_students_B_index" ON "_students" ("B");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "_ClassToCourse_AB_unique" ON "_ClassToCourse" ("A","B");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "_ClassToCourse_B_index" ON "_ClassToCourse" ("B");
*/