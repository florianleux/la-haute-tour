ALTER TABLE `seen_questions` ADD `recovery_failures` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `seen_questions_user_leech_idx` ON `seen_questions` (`user_id`,`recovery_failures`,`seen_at`,`question_id`) WHERE "seen_questions"."recovery_failures" > 0;--> statement-breakpoint
ALTER TABLE `users` ADD `leech_net_lesson_at` integer;