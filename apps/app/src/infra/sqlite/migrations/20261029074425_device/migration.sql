CREATE TABLE `base_row` (
	`space` text NOT NULL,
	`tbl` text NOT NULL,
	`id` text NOT NULL,
	`version` integer NOT NULL,
	`data` text NOT NULL,
	CONSTRAINT `base_row_pk` PRIMARY KEY(`space`, `tbl`, `id`)
);
--> statement-breakpoint
CREATE TABLE `pending_row` (
	`space` text NOT NULL,
	`tbl` text NOT NULL,
	`id` text NOT NULL,
	`data` text,
	CONSTRAINT `pending_row_pk` PRIMARY KEY(`space`, `tbl`, `id`)
);
--> statement-breakpoint
CREATE TABLE `sync_meta` (
	`id` integer PRIMARY KEY,
	`client_id` text NOT NULL,
	`sync_epoch` text,
	`last_mutation_id` integer NOT NULL,
	`settled_mutation_id` integer NOT NULL,
	`replay_due` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_outbox` (
	`mutation_id` integer PRIMARY KEY,
	`name` text NOT NULL,
	`version` integer NOT NULL,
	`args` text NOT NULL,
	`at` integer NOT NULL,
	`mode` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_rejected_command` (
	`client_id` text NOT NULL,
	`mutation_id` integer NOT NULL,
	`name` text NOT NULL,
	`version` integer NOT NULL,
	`args` text NOT NULL,
	`at` integer NOT NULL,
	`reason` text NOT NULL,
	CONSTRAINT `sync_rejected_command_pk` PRIMARY KEY(`client_id`, `mutation_id`)
);
--> statement-breakpoint
CREATE TABLE `sync_settled_command` (
	`mutation_id` integer PRIMARY KEY,
	`name` text NOT NULL,
	`version` integer NOT NULL,
	`args` text NOT NULL,
	`at` integer NOT NULL,
	`mode` text NOT NULL,
	`settled_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_space` (
	`id` text PRIMARY KEY,
	`kind` text NOT NULL,
	`role` text NOT NULL,
	`version` integer,
	`key_epoch` integer,
	`synced_at` integer
);
--> statement-breakpoint
CREATE INDEX `base_row_SchoolClass_schoolYearId` ON `base_row` (space,data ->> '$."schoolYearId"',id) WHERE tbl = 'SchoolClass';--> statement-breakpoint
CREATE INDEX `base_row_CourseOffering_termId` ON `base_row` (space,data ->> '$."termId"',id) WHERE tbl = 'CourseOffering';--> statement-breakpoint
CREATE INDEX `base_row_Homework_dueOn` ON `base_row` (space,data ->> '$."dueOn"',id) WHERE tbl = 'Homework';--> statement-breakpoint
CREATE INDEX `base_row_Homework_courseId` ON `base_row` (space,data ->> '$."courseId"',id) WHERE tbl = 'Homework';--> statement-breakpoint
CREATE INDEX `pending_row_SchoolClass_schoolYearId` ON `pending_row` (space,data ->> '$."schoolYearId"',id) WHERE tbl = 'SchoolClass';--> statement-breakpoint
CREATE INDEX `pending_row_CourseOffering_termId` ON `pending_row` (space,data ->> '$."termId"',id) WHERE tbl = 'CourseOffering';--> statement-breakpoint
CREATE INDEX `pending_row_Homework_dueOn` ON `pending_row` (space,data ->> '$."dueOn"',id) WHERE tbl = 'Homework';--> statement-breakpoint
CREATE INDEX `pending_row_Homework_courseId` ON `pending_row` (space,data ->> '$."courseId"',id) WHERE tbl = 'Homework';--> statement-breakpoint
CREATE VIEW `Course` AS select space, id, data ->> '$."name"' as "name", data ->> '$."subjectId"' as "subjectId" from sync_row_view where tbl = 'Course';--> statement-breakpoint
CREATE VIEW `CourseOffering` AS select space, id, data ->> '$."courseId"' as "courseId", data ->> '$."termId"' as "termId", data -> '$."gradeLevels"' as "gradeLevels", data -> '$."classIds"' as "classIds", data ->> '$."groupKey"' as "groupKey" from sync_row_view where tbl = 'CourseOffering';--> statement-breakpoint
CREATE VIEW `Enrollment` AS select space, id, data ->> '$."termId"' as "termId", data ->> '$."gradeLevel"' as "gradeLevel", data ->> '$."classId"' as "classId", data -> '$."courseIds"' as "courseIds" from sync_row_view where tbl = 'Enrollment';--> statement-breakpoint
CREATE VIEW `Homework` AS select space, id, data ->> '$."courseId"' as "courseId", data ->> '$."title"' as "title", data ->> '$."description"' as "description", data ->> '$."dueOn"' as "dueOn", data ->> '$."doneOn"' as "doneOn" from sync_row_view where tbl = 'Homework';--> statement-breakpoint
CREATE VIEW `Notebook` AS select space, id, data ->> '$."schoolId"' as "schoolId" from sync_row_view where tbl = 'Notebook';--> statement-breakpoint
CREATE VIEW `NotebookProfile` AS select space, id, data ->> '$."displayName"' as "displayName" from sync_row_view where tbl = 'NotebookProfile';--> statement-breakpoint
CREATE VIEW `School` AS select space, id, data ->> '$."name"' as "name", data ->> '$."timeZone"' as "timeZone" from sync_row_view where tbl = 'School';--> statement-breakpoint
CREATE VIEW `SchoolClass` AS select space, id, data ->> '$."schoolYearId"' as "schoolYearId", data ->> '$."name"' as "name", data ->> '$."gradeLevel"' as "gradeLevel" from sync_row_view where tbl = 'SchoolClass';--> statement-breakpoint
CREATE VIEW `SchoolYear` AS select space, id, data ->> '$."name"' as "name", data -> '$."dates"' as "dates" from sync_row_view where tbl = 'SchoolYear';--> statement-breakpoint
CREATE VIEW `Subject` AS select space, id, data ->> '$."name"' as "name", data ->> '$."shortName"' as "shortName" from sync_row_view where tbl = 'Subject';--> statement-breakpoint
CREATE VIEW `Term` AS select space, id, data ->> '$."schoolYearId"' as "schoolYearId", data ->> '$."name"' as "name", data -> '$."dates"' as "dates" from sync_row_view where tbl = 'Term';--> statement-breakpoint
CREATE VIEW `sync_row_view` AS select space, tbl, id, data from pending_row where data is not null
      union all
      select space, tbl, id, data from base_row as base
      where not exists (
        select 1 from pending_row as pending
        where pending.space = base.space and pending.tbl = base.tbl and pending.id = base.id
      );