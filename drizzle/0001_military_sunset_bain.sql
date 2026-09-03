CREATE TABLE `accepted_answers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`question_id` text NOT NULL,
	`text` text NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `accepted_answers_question_idx` ON `accepted_answers` (`question_id`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_name_unique` ON `categories` (`name`);--> statement-breakpoint
CREATE TABLE `question_categories` (
	`question_id` text NOT NULL,
	`category_id` integer NOT NULL,
	PRIMARY KEY(`question_id`, `category_id`),
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `question_categories_category_idx` ON `question_categories` (`category_id`);--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`statement` text NOT NULL,
	`answer_label` text NOT NULL,
	`floor` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "questions_floor_range" CHECK("questions"."floor" BETWEEN 1 AND 6)
);
--> statement-breakpoint
CREATE INDEX `questions_floor_idx` ON `questions` (`floor`);