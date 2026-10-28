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
CREATE INDEX `base_row_Probe_group` ON `base_row` (space,data ->> '$."group"',id) WHERE tbl = 'Probe';--> statement-breakpoint
CREATE INDEX `base_row_Probe_key` ON `base_row` (space,data -> '$."key"',id) WHERE tbl = 'Probe';--> statement-breakpoint
CREATE INDEX `base_row_Probe_amount` ON `base_row` (space,data -> '$."amount"',id) WHERE tbl = 'Probe';--> statement-breakpoint
CREATE INDEX `pending_row_Probe_group` ON `pending_row` (space,data ->> '$."group"',id) WHERE tbl = 'Probe';--> statement-breakpoint
CREATE INDEX `pending_row_Probe_key` ON `pending_row` (space,data -> '$."key"',id) WHERE tbl = 'Probe';--> statement-breakpoint
CREATE INDEX `pending_row_Probe_amount` ON `pending_row` (space,data -> '$."amount"',id) WHERE tbl = 'Probe';--> statement-breakpoint
CREATE VIEW `Probe` AS select space, id, data ->> '$."text"' as "text", data -> '$."amount"' as "amount", data ->> '$."flag"' as "flag", data ->> '$."note"' as "note", data -> '$."nested"' as "nested", data ->> '$."group"' as "group", data -> '$."key"' as "key" from sync_row_view where tbl = 'Probe';--> statement-breakpoint
CREATE VIEW `sync_row_view` AS select space, tbl, id, data from pending_row where data is not null
      union all
      select space, tbl, id, data from base_row as base
      where not exists (
        select 1 from pending_row as pending
        where pending.space = base.space and pending.tbl = base.tbl and pending.id = base.id
      );