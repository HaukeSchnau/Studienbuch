CREATE TABLE `persons` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`salutation` text,
	`abbrv` text,
	`email` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `persons_abbrv_unique` ON `persons` (`abbrv`);--> statement-breakpoint
CREATE UNIQUE INDEX `persons_email_unique` ON `persons` (`email`);--> statement-breakpoint
CREATE TABLE `classes` (
	`identifier_in_year` text NOT NULL,
	`start_year` integer NOT NULL,
	`school` text NOT NULL,
	PRIMARY KEY(`identifier_in_year`, `start_year`, `school`),
	FOREIGN KEY (`start_year`,`school`) REFERENCES `years`(`start_year`,`school`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `teachers_to_classes` (
	`teacher` text NOT NULL,
	`class_identifier` text NOT NULL,
	`class_start_year` integer NOT NULL,
	`school` text NOT NULL,
	PRIMARY KEY(`teacher`, `class_identifier`, `class_start_year`, `school`),
	FOREIGN KEY (`teacher`) REFERENCES `persons`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`class_identifier`,`class_start_year`,`school`) REFERENCES `classes`(`identifier_in_year`,`start_year`,`school`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `courses` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`long_name` text NOT NULL,
	`subject` text NOT NULL,
	`school` text NOT NULL,
	`semester_type` text NOT NULL,
	`semester_year` integer NOT NULL,
	`is_mandatory` integer DEFAULT false NOT NULL,
	`is_member` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`semester_type`,`semester_year`,`school`) REFERENCES `semesters`(`type`,`year`,`school`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `courses_to_classes` (
	`course` text NOT NULL,
	`school` text NOT NULL,
	`class_identifier` text NOT NULL,
	`class_start_year` integer NOT NULL,
	PRIMARY KEY(`course`, `class_identifier`, `class_start_year`, `school`),
	FOREIGN KEY (`course`) REFERENCES `courses`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`class_identifier`,`class_start_year`,`school`) REFERENCES `classes`(`identifier_in_year`,`start_year`,`school`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `courses_to_teachers` (
	`course` text NOT NULL,
	`teacher` text NOT NULL,
	PRIMARY KEY(`course`, `teacher`),
	FOREIGN KEY (`course`) REFERENCES `courses`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`teacher`) REFERENCES `persons`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`room_number` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `schools` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`image` text NOT NULL,
	`theme` text NOT NULL,
	`state_code` text NOT NULL,
	`kadmos_name` text NOT NULL,
	`kadmos_username` text NOT NULL,
	`kadmos_password` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `semesters` (
	`name` text NOT NULL,
	`start` integer NOT NULL,
	`end` integer NOT NULL,
	`school` text NOT NULL,
	`type` text NOT NULL,
	`year` integer NOT NULL,
	PRIMARY KEY(`school`, `type`, `year`),
	FOREIGN KEY (`school`) REFERENCES `schools`(`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `years` (
	`name` text NOT NULL,
	`start_year` integer NOT NULL,
	`graduation_year` integer NOT NULL,
	`school` text NOT NULL,
	PRIMARY KEY(`start_year`, `school`),
	FOREIGN KEY (`school`) REFERENCES `schools`(`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `absence_days` (
	`date` integer NOT NULL,
	`student` text NOT NULL,
	`reason` text NOT NULL,
	`parent_signature` text,
	PRIMARY KEY(`date`, `student`),
	FOREIGN KEY (`student`) REFERENCES `persons`(`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `course_absences` (
	`date` integer NOT NULL,
	`student` text NOT NULL,
	`course` text NOT NULL,
	`teacher_signature` text,
	PRIMARY KEY(`date`, `course`, `student`),
	FOREIGN KEY (`student`) REFERENCES `persons`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`course`) REFERENCES `courses`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`date`,`student`) REFERENCES `absence_days`(`date`,`student`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `grades` (
	`date` integer NOT NULL,
	`result` real NOT NULL,
	`type` text NOT NULL,
	`teacher_signature` text,
	`parent_signature` text,
	`course` text NOT NULL,
	`student` text NOT NULL,
	PRIMARY KEY(`date`, `course`, `student`, `type`),
	FOREIGN KEY (`course`) REFERENCES `courses`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`student`) REFERENCES `persons`(`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`due_date` integer NOT NULL,
	`course` text NOT NULL,
	`assignee` text NOT NULL,
	`images` text DEFAULT '[]' NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`course`) REFERENCES `courses`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`assignee`) REFERENCES `persons`(`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `room_changes` (
	`date` integer NOT NULL,
	`course` text NOT NULL,
	`room` text NOT NULL,
	`createdAt` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`room`) REFERENCES `rooms`(`room_number`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `substitutions` (
	`date` integer NOT NULL,
	`course` text NOT NULL,
	`type` text,
	`substitute` text,
	PRIMARY KEY(`date`, `course`),
	FOREIGN KEY (`substitute`) REFERENCES `persons`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`date`,`course`) REFERENCES `timetable_entries`(`date`,`course`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `timetable_entries` (
	`date` integer NOT NULL,
	`duration` integer NOT NULL,
	`course` text NOT NULL,
	PRIMARY KEY(`date`, `course`),
	FOREIGN KEY (`course`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `timetable_entry_rooms` (
	`start` integer NOT NULL,
	`course` text NOT NULL,
	`room` text NOT NULL,
	PRIMARY KEY(`start`, `course`, `room`),
	FOREIGN KEY (`room`) REFERENCES `rooms`(`room_number`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`start`,`course`) REFERENCES `timetable_entries`(`date`,`course`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `recurring_timetable_entries` (
	`weekday` integer NOT NULL,
	`start` integer NOT NULL,
	`duration` integer NOT NULL,
	`weeks` text DEFAULT 'ALL' NOT NULL,
	`room` text,
	`course` text NOT NULL,
	PRIMARY KEY(`weekday`, `start`, `course`),
	FOREIGN KEY (`course`) REFERENCES `courses`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `mutations` (
	`timestamp` integer PRIMARY KEY NOT NULL,
	`path` text NOT NULL,
	`input` text NOT NULL,
	`mutation_status` text NOT NULL
);
