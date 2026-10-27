CREATE TABLE `flags` (
	`slug` text PRIMARY KEY NOT NULL,
	`image` text NOT NULL,
	`boss_attempt_number` integer NOT NULL,
	`answer_label` text NOT NULL,
	`accepted_answers` text NOT NULL,
	CONSTRAINT "flags_boss_attempt_range" CHECK("flags"."boss_attempt_number" BETWEEN 1 AND 6)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `flags_image_unique` ON `flags` (`image`);--> statement-breakpoint
CREATE INDEX `flags_boss_attempt_idx` ON `flags` (`boss_attempt_number`);