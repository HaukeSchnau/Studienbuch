CREATE TYPE "public"."salutation" AS ENUM('Herr', 'Frau');--> statement-breakpoint
CREATE TYPE "public"."subject" AS ENUM('de', 'en', 'ma', 'ph', 'ch', 'bi', 'if', 'ge', 'pw', 'mu', 'sp', 'ku', 're', 'wn', 'fr', 'la', 'sn', 'sport-theorie', 'sf', 'tutorium', 'ds', 'ek', 'nw', 'gsl', 'theo', 'awt', 'igl', 'sw', 'swb', 'lp', 'kr', 'wpk', 'wal', 'will-an-lili', 'präsenz', 'bläser_k', 'nachhaltigkeit');--> statement-breakpoint
CREATE TYPE "public"."state_code" AS ENUM('BB', 'BE', 'BW', 'BY', 'HB', 'HE', 'HH', 'MV', 'NI', 'NW', 'RP', 'SH', 'SL', 'SN', 'ST', 'TH');--> statement-breakpoint
CREATE TYPE "public"."school_id" AS ENUM('igs-lil');--> statement-breakpoint
CREATE TYPE "public"."semester_type" AS ENUM('SUMMER', 'WINTER');--> statement-breakpoint
CREATE TYPE "public"."permission" AS ENUM('EDIT_INFO_PAGES', 'EDIT_USERS', 'EDIT_COURSES', 'EDIT_YEARS', 'EDIT_CLASSES', 'EDIT_SCHOOLS', 'VIEW_LOGS');--> statement-breakpoint
CREATE TYPE "public"."grade_type" AS ENUM('WRITTEN', 'ORAL', 'MASTER');--> statement-breakpoint
CREATE TYPE "public"."substitution_type" AS ENUM('FREISETZUNG', 'VERTRETUNG', 'BETREUUNG', 'ENTFALL', 'TROTZ_ABSENZ');--> statement-breakpoint
CREATE TYPE "public"."recurring_timetable_entry_weeks" AS ENUM('EVEN', 'ODD', 'ALL');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('absence.recorded', 'absence.parentApproved', 'absence.teacherApproved', 'absence.discarded', 'grades.currentGradeSet', 'grades.writtenGradeRecorded', 'grades.teacherApproved', 'grades.parentApproved', 'grades.discarded', 'grades.latestRestored', 'org.school.founded', 'org.year.started', 'org.teacher.joined', 'org.holiday.created', 'org.courses.created', 'org.timetable.entryCreated', 'org.timetable.substituted', 'org.timetable.canceled', 'org.timetable.discarded', 'auth.licenseGenerated', 'auth.licenseActivated', 'student.joined', 'student.courseAssigned');--> statement-breakpoint
CREATE TABLE "persons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"salutation" "salutation",
	"abbrv" text,
	"email" text,
	CONSTRAINT "persons_abbrv_unique" UNIQUE("abbrv"),
	CONSTRAINT "persons_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "students" (
	"person" uuid PRIMARY KEY NOT NULL,
	"is_of_age" boolean,
	"class_identifier" text NOT NULL,
	"start_year" smallint NOT NULL,
	"school" "school_id" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text,
	"password_hash" text,
	"is_super_user" boolean DEFAULT false NOT NULL,
	"notification_key" text
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"identifier_in_year" text NOT NULL,
	"start_year" smallint NOT NULL,
	"school" "school_id" NOT NULL,
	CONSTRAINT "classes_identifier_in_year_start_year_school_pk" PRIMARY KEY("identifier_in_year","start_year","school")
);
--> statement-breakpoint
CREATE TABLE "teachers_to_classes" (
	"teacher" uuid NOT NULL,
	"class_identifier" text NOT NULL,
	"class_start_year" smallint NOT NULL,
	"school" "school_id" NOT NULL,
	CONSTRAINT "teachers_to_classes_teacher_class_identifier_class_start_year_school_pk" PRIMARY KEY("teacher","class_identifier","class_start_year","school")
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"long_name" text NOT NULL,
	"subject" "subject" NOT NULL,
	"school" "school_id" NOT NULL,
	"semester_type" "semester_type" NOT NULL,
	"semester_year" smallint NOT NULL,
	"is_mandatory" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courses_to_classes" (
	"course" uuid NOT NULL,
	"school" "school_id" NOT NULL,
	"class_identifier" text NOT NULL,
	"class_start_year" smallint NOT NULL,
	CONSTRAINT "courses_to_classes_course_class_identifier_class_start_year_school_pk" PRIMARY KEY("course","class_identifier","class_start_year","school")
);
--> statement-breakpoint
CREATE TABLE "courses_to_teachers" (
	"course" uuid NOT NULL,
	"teacher" uuid NOT NULL,
	CONSTRAINT "courses_to_teachers_course_teacher_pk" PRIMARY KEY("course","teacher")
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"room_number" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" "school_id" PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"image" text NOT NULL,
	"theme" jsonb NOT NULL,
	"state_code" "state_code" NOT NULL,
	"kadmos_name" text NOT NULL,
	"kadmos_username" text NOT NULL,
	"kadmos_password" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "semesters" (
	"name" text NOT NULL,
	"start" date NOT NULL,
	"end" date NOT NULL,
	"school" "school_id" NOT NULL,
	"type" "semester_type" NOT NULL,
	"year" smallint NOT NULL,
	CONSTRAINT "semesters_school_type_year_pk" PRIMARY KEY("school","type","year")
);
--> statement-breakpoint
CREATE TABLE "holidays" (
	"name" text NOT NULL,
	"start" timestamp NOT NULL,
	"end" timestamp NOT NULL,
	"state" "state_code" NOT NULL,
	"year" integer NOT NULL,
	CONSTRAINT "holidays_name_state_year_pk" PRIMARY KEY("name","state","year")
);
--> statement-breakpoint
CREATE TABLE "years" (
	"name" text NOT NULL,
	"start_year" smallint NOT NULL,
	"graduation_year" smallint NOT NULL,
	"school" "school_id" NOT NULL,
	CONSTRAINT "years_start_year_school_pk" PRIMARY KEY("start_year","school")
);
--> statement-breakpoint
CREATE TABLE "license_keys" (
	"key" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"activated_at" timestamp,
	"expires_at" timestamp,
	"is_super_key" boolean DEFAULT false NOT NULL,
	"school_id" "school_id" NOT NULL,
	"activated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "permissions_to_roles" (
	"permission" "permission" NOT NULL,
	"role" uuid NOT NULL,
	"scope" jsonb,
	CONSTRAINT "permissions_to_roles_permission_role_pk" PRIMARY KEY("permission","role")
);
--> statement-breakpoint
CREATE TABLE "permissions_to_users" (
	"permission" "permission" NOT NULL,
	"user" uuid NOT NULL,
	"scope" jsonb,
	CONSTRAINT "permissions_to_users_permission_user_pk" PRIMARY KEY("permission","user")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"default_scope" jsonb,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "roles_to_users" (
	"role" uuid NOT NULL,
	"user" uuid NOT NULL,
	CONSTRAINT "roles_to_users_role_user_pk" PRIMARY KEY("role","user")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"user" uuid NOT NULL,
	"expires" timestamp (3) NOT NULL,
	"token" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "absence_days" (
	"date" date NOT NULL,
	"student" uuid NOT NULL,
	"reason" text NOT NULL,
	"parent_signature" text,
	CONSTRAINT "absence_days_date_student_pk" PRIMARY KEY("date","student")
);
--> statement-breakpoint
CREATE TABLE "course_absences" (
	"date" date NOT NULL,
	"student" uuid NOT NULL,
	"course" uuid NOT NULL,
	"teacher_signature" text,
	CONSTRAINT "course_absences_date_course_student_pk" PRIMARY KEY("date","course","student")
);
--> statement-breakpoint
CREATE TABLE "course_memberships" (
	"student" uuid NOT NULL,
	"course" uuid NOT NULL,
	CONSTRAINT "course_memberships_student_course_pk" PRIMARY KEY("student","course")
);
--> statement-breakpoint
CREATE TABLE "grades" (
	"date" date NOT NULL,
	"result" real NOT NULL,
	"type" "grade_type" NOT NULL,
	"teacher_signature" text,
	"parent_signature" text,
	"course" uuid NOT NULL,
	"student" uuid NOT NULL,
	CONSTRAINT "grades_date_course_student_type_pk" PRIMARY KEY("date","course","student","type")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"due_date" date NOT NULL,
	"course" uuid NOT NULL,
	"assignee" uuid NOT NULL,
	"images" text[] DEFAULT '{}' NOT NULL,
	"done" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_changes" (
	"date" timestamp NOT NULL,
	"course" uuid NOT NULL,
	"room" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "substitutions" (
	"date" timestamp NOT NULL,
	"course" uuid NOT NULL,
	"type" "substitution_type",
	"originalTeacher" uuid NOT NULL,
	"substitute" uuid,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	CONSTRAINT "substitutions_date_course_originalTeacher_pk" PRIMARY KEY("date","course","originalTeacher")
);
--> statement-breakpoint
CREATE TABLE "timetable_entries" (
	"date" timestamp NOT NULL,
	"duration" smallint NOT NULL,
	"rooms" text[] NOT NULL,
	"course" uuid NOT NULL,
	CONSTRAINT "timetable_entries_date_course_pk" PRIMARY KEY("date","course")
);
--> statement-breakpoint
CREATE TABLE "recurring_timetable_entries" (
	"weekday" smallint NOT NULL,
	"start" time NOT NULL,
	"duration" smallint NOT NULL,
	"weeks" "recurring_timetable_entry_weeks" DEFAULT 'ALL' NOT NULL,
	"room" text,
	"course" uuid NOT NULL,
	CONSTRAINT "recurring_timetable_entries_weekday_start_course_pk" PRIMARY KEY("weekday","start","course")
);
--> statement-breakpoint
CREATE TABLE "event_topics" (
	"event" uuid NOT NULL,
	"topic" text NOT NULL,
	CONSTRAINT "event_topics_event_topic_pk" PRIMARY KEY("event","topic")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"type" "event_type" NOT NULL,
	"data" jsonb NOT NULL,
	"timestamp" timestamp NOT NULL,
	"initiator" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events_sent_to_users" (
	"event" uuid,
	"user" uuid,
	CONSTRAINT "events_sent_to_users_event_user_pk" PRIMARY KEY("event","user")
);
--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_person_persons_id_fk" FOREIGN KEY ("person") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_class_identifier_start_year_school_classes_identifier_in_year_start_year_school_fk" FOREIGN KEY ("class_identifier","start_year","school") REFERENCES "public"."classes"("identifier_in_year","start_year","school") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_start_year_school_years_start_year_school_fk" FOREIGN KEY ("start_year","school") REFERENCES "public"."years"("start_year","school") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "teachers_to_classes" ADD CONSTRAINT "teachers_to_classes_teacher_persons_id_fk" FOREIGN KEY ("teacher") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "teachers_to_classes" ADD CONSTRAINT "teachers_to_classes_class_identifier_class_start_year_school_classes_identifier_in_year_start_year_school_fk" FOREIGN KEY ("class_identifier","class_start_year","school") REFERENCES "public"."classes"("identifier_in_year","start_year","school") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_semester_type_semester_year_school_semesters_type_year_school_fk" FOREIGN KEY ("semester_type","semester_year","school") REFERENCES "public"."semesters"("type","year","school") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "courses_to_classes" ADD CONSTRAINT "courses_to_classes_course_courses_id_fk" FOREIGN KEY ("course") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "courses_to_classes" ADD CONSTRAINT "courses_to_classes_class_identifier_class_start_year_school_classes_identifier_in_year_start_year_school_fk" FOREIGN KEY ("class_identifier","class_start_year","school") REFERENCES "public"."classes"("identifier_in_year","start_year","school") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "courses_to_teachers" ADD CONSTRAINT "courses_to_teachers_course_courses_id_fk" FOREIGN KEY ("course") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "courses_to_teachers" ADD CONSTRAINT "courses_to_teachers_teacher_persons_id_fk" FOREIGN KEY ("teacher") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "semesters" ADD CONSTRAINT "semesters_school_schools_id_fk" FOREIGN KEY ("school") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "years" ADD CONSTRAINT "years_school_schools_id_fk" FOREIGN KEY ("school") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "license_keys" ADD CONSTRAINT "license_keys_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "license_keys" ADD CONSTRAINT "license_keys_activated_by_users_id_fk" FOREIGN KEY ("activated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "permissions_to_roles" ADD CONSTRAINT "permissions_to_roles_role_roles_id_fk" FOREIGN KEY ("role") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "permissions_to_users" ADD CONSTRAINT "permissions_to_users_user_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "roles_to_users" ADD CONSTRAINT "roles_to_users_role_roles_id_fk" FOREIGN KEY ("role") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "roles_to_users" ADD CONSTRAINT "roles_to_users_user_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "absence_days" ADD CONSTRAINT "absence_days_student_persons_id_fk" FOREIGN KEY ("student") REFERENCES "public"."persons"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "course_absences" ADD CONSTRAINT "course_absences_student_persons_id_fk" FOREIGN KEY ("student") REFERENCES "public"."persons"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "course_absences" ADD CONSTRAINT "course_absences_course_courses_id_fk" FOREIGN KEY ("course") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "course_absences" ADD CONSTRAINT "course_absences_date_student_absence_days_date_student_fk" FOREIGN KEY ("date","student") REFERENCES "public"."absence_days"("date","student") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_memberships" ADD CONSTRAINT "course_memberships_student_students_person_fk" FOREIGN KEY ("student") REFERENCES "public"."students"("person") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "course_memberships" ADD CONSTRAINT "course_memberships_course_courses_id_fk" FOREIGN KEY ("course") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_course_courses_id_fk" FOREIGN KEY ("course") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_student_persons_id_fk" FOREIGN KEY ("student") REFERENCES "public"."persons"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_course_courses_id_fk" FOREIGN KEY ("course") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_persons_id_fk" FOREIGN KEY ("assignee") REFERENCES "public"."persons"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "room_changes" ADD CONSTRAINT "room_changes_room_rooms_room_number_fk" FOREIGN KEY ("room") REFERENCES "public"."rooms"("room_number") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "substitutions" ADD CONSTRAINT "substitutions_originalTeacher_persons_id_fk" FOREIGN KEY ("originalTeacher") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "substitutions" ADD CONSTRAINT "substitutions_substitute_persons_id_fk" FOREIGN KEY ("substitute") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "substitutions" ADD CONSTRAINT "substitutions_date_course_timetable_entries_date_course_fk" FOREIGN KEY ("date","course") REFERENCES "public"."timetable_entries"("date","course") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_course_courses_id_fk" FOREIGN KEY ("course") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_timetable_entries" ADD CONSTRAINT "recurring_timetable_entries_course_courses_id_fk" FOREIGN KEY ("course") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "event_topics" ADD CONSTRAINT "event_topics_event_events_id_fk" FOREIGN KEY ("event") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_initiator_users_id_fk" FOREIGN KEY ("initiator") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events_sent_to_users" ADD CONSTRAINT "events_sent_to_users_event_events_id_fk" FOREIGN KEY ("event") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events_sent_to_users" ADD CONSTRAINT "events_sent_to_users_user_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_topics_event_topic_index" ON "event_topics" USING btree ("event","topic");--> statement-breakpoint
CREATE INDEX "events_sent_to_users_event_user_index" ON "events_sent_to_users" USING btree ("event","user");