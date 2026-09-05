CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`maintenance_since` integer,
	CONSTRAINT "settings_single_row" CHECK("settings"."id" = 1)
);
