CREATE TABLE `sync_sealed_row` (
	`space` text NOT NULL,
	`id` text NOT NULL,
	`version` integer NOT NULL,
	`tbl` text,
	`envelope` text,
	`ct` blob,
	CONSTRAINT `sync_sealed_row_pk` PRIMARY KEY(`space`, `id`)
);
--> statement-breakpoint
CREATE TABLE `sync_space_key` (
	`space` text NOT NULL,
	`key_epoch` integer NOT NULL,
	`key` blob NOT NULL,
	CONSTRAINT `sync_space_key_pk` PRIMARY KEY(`space`, `key_epoch`)
);
--> statement-breakpoint
ALTER TABLE `sync_meta` ADD `key_generation` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sync_outbox` ADD `writes` text;--> statement-breakpoint
ALTER TABLE `sync_outbox` ADD `failure` text;