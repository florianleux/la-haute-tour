CREATE TABLE `boss_trials` (
	`user_id` integer NOT NULL,
	`flag_slug` text NOT NULL,
	`position` integer NOT NULL,
	`expires_at` integer,
	`resolved_at` integer,
	`correct` integer,
	`submitted_answer` text,
	PRIMARY KEY(`user_id`, `position`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`flag_slug`) REFERENCES `flags`(`slug`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `users` ADD `boss_hp` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `boss_attempt_number` integer DEFAULT 0 NOT NULL;