CREATE TABLE `boards` (
	`owner_email` text PRIMARY KEY NOT NULL,
	`tasks_json` text NOT NULL,
	`password_json` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL
);
