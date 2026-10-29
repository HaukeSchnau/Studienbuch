CREATE TABLE `sync_settled_command` (
	`mutation_id` integer PRIMARY KEY,
	`name` text NOT NULL,
	`version` integer NOT NULL,
	`args` text NOT NULL,
	`at` integer NOT NULL,
	`mode` text NOT NULL,
	`settled_at` integer NOT NULL
);
