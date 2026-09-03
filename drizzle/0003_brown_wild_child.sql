CREATE TABLE `recovery_questions` (
	`user_id` integer NOT NULL,
	`question_id` text NOT NULL,
	`position` integer NOT NULL,
	`correct` integer,
	PRIMARY KEY(`user_id`, `question_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recovery_questions_user_position_idx` ON `recovery_questions` (`user_id`,`position`);--> statement-breakpoint
ALTER TABLE `reservations` ADD `mode` text DEFAULT 'ascent' NOT NULL;