CREATE TABLE `achievements` (
	`user_id` integer NOT NULL,
	`achievement` text NOT NULL,
	`unlocked_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `achievement`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `settings` ADD `first_ascension_user_id` integer REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `users` ADD `streak` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `seen_total` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `last_played_day` text;--> statement-breakpoint
ALTER TABLE `users` ADD `days_played` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `play_streak` integer DEFAULT 0 NOT NULL;