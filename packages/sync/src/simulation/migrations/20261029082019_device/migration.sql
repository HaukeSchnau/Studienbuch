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
CREATE INDEX `base_row_Note_course` ON `base_row` (space,data ->> '$."course"',id) WHERE tbl = 'Note';--> statement-breakpoint
CREATE INDEX `pending_row_Note_course` ON `pending_row` (space,data ->> '$."course"',id) WHERE tbl = 'Note';--> statement-breakpoint
CREATE VIEW `Choice` AS select space, id, data ->> '$."school"' as "school", data -> '$."courses"' as "courses" from sync_row_view where tbl = 'Choice';--> statement-breakpoint
CREATE VIEW `Note` AS select space, id, data ->> '$."course"' as "course", data ->> '$."title"' as "title", data ->> '$."done"' as "done" from sync_row_view where tbl = 'Note';--> statement-breakpoint
CREATE VIEW `Offer` AS select space, id, data ->> '$."name"' as "name" from sync_row_view where tbl = 'Offer';--> statement-breakpoint
CREATE VIEW `Topic` AS select space, id, data ->> '$."title"' as "title" from sync_row_view where tbl = 'Topic';--> statement-breakpoint
CREATE VIEW `sync_row_view` AS select space, tbl, id, data from pending_row where data is not null
      union all
      select space, tbl, id, data from base_row as base
      where not exists (
        select 1 from pending_row as pending
        where pending.space = base.space and pending.tbl = base.tbl and pending.id = base.id
      );