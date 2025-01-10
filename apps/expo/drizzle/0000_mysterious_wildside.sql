CREATE TABLE `persons` (
	`id` text PRIMARY KEY NOT NULL,
	`first_name` text,
	`last_name` text,
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
CREATE TABLE `schools` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`state_code` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `holidays` (
	`name` text NOT NULL,
	`start` integer NOT NULL,
	`end` integer NOT NULL,
	`state` text NOT NULL,
	`year` integer NOT NULL,
	PRIMARY KEY(`name`, `start`, `end`, `state`, `year`)
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
	`date` integer PRIMARY KEY NOT NULL,
	`reason` text NOT NULL,
	`parent_signature` text
);
--> statement-breakpoint
CREATE TABLE `course_absences` (
	`date` integer NOT NULL,
	`course` text NOT NULL,
	`teacher_signature` text,
	PRIMARY KEY(`date`, `course`),
	FOREIGN KEY (`course`) REFERENCES `courses`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`date`) REFERENCES `absence_days`(`date`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `grades` (
	`date` integer NOT NULL,
	`result` real NOT NULL,
	`type` text NOT NULL,
	`teacher_signature` text,
	`parent_signature` text,
	`course` text NOT NULL,
	PRIMARY KEY(`date`, `course`, `type`),
	FOREIGN KEY (`course`) REFERENCES `courses`(`id`) ON UPDATE cascade ON DELETE restrict
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
	`updatedAt` integer NOT NULL
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
CREATE TABLE `entities` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`order` integer PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`type` text NOT NULL,
	`data` text NOT NULL,
	`timestamp` integer NOT NULL,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_id_unique` ON `events` (`id`);--> statement-breakpoint
CREATE INDEX `id_idx` ON `events` (`id`);--> statement-breakpoint
CREATE TABLE `events_to_entities` (
	`event` text NOT NULL,
	`entity` text NOT NULL,
	PRIMARY KEY(`entity`, `event`),
	FOREIGN KEY (`event`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`entity`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE no action
);
