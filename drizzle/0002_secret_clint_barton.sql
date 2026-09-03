CREATE TABLE `missed_pool` (
	`user_id` integer NOT NULL,
	`question_id` text NOT NULL,
	`floor` integer NOT NULL,
	`pool_successes` integer DEFAULT 0 NOT NULL,
	`last_failed_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `question_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `missed_pool_user_floor_idx` ON `missed_pool` (`user_id`,`floor`,`last_failed_at`);--> statement-breakpoint
CREATE TABLE `reservations` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`resolved_at` integer,
	`correct` integer,
	`submitted_answer` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `seen_questions` (
	`user_id` integer NOT NULL,
	`question_id` text NOT NULL,
	`floor` integer NOT NULL,
	`correct` integer NOT NULL,
	`seen_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`user_id`, `question_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `seen_questions_user_floor_idx` ON `seen_questions` (`user_id`,`floor`);--> statement-breakpoint
ALTER TABLE `users` ADD `cooldown_until` integer;