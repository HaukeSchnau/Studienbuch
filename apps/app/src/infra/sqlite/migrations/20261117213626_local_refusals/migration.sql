CREATE TABLE `homework_local_refusal` (
	`kind` text NOT NULL,
	`homework` text NOT NULL,
	`refusal` text NOT NULL,
	CONSTRAINT `homework_local_refusal_pk` PRIMARY KEY(`kind`, `homework`)
);
