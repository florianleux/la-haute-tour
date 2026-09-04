CREATE TABLE `disputes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`question_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`settled_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `disputes_status_idx` ON `disputes` (`status`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `disputes_user_question_unique` ON `disputes` (`user_id`,`question_id`);--> statement-breakpoint
ALTER TABLE `seen_questions` ADD `submitted_answer` text;--> statement-breakpoint
ALTER TABLE `users` ADD `attempt_started_at` integer DEFAULT (unixepoch()) NOT NULL;