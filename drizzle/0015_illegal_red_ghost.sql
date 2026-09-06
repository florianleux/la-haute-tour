CREATE TABLE `deck_floors` (
	`floor` integer PRIMARY KEY NOT NULL,
	`total` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE `users` ADD `floor_seen` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `attempt_seen` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Les trois compteurs partent de ce que la base contient déjà : sans ce
-- remplissage, un étage vaudrait zéro question et tout le monde se retrouverait
-- au palier à la première lecture.
INSERT INTO `deck_floors` (`floor`, `total`)
SELECT `floor`, count(*) FROM `questions` GROUP BY `floor`;--> statement-breakpoint
UPDATE `users` SET `floor_seen` = (
	SELECT count(*) FROM `seen_questions`
	WHERE `seen_questions`.`user_id` = `users`.`id`
		AND `seen_questions`.`floor` = `users`.`current_floor`
);--> statement-breakpoint
UPDATE `users` SET `attempt_seen` = (
	SELECT count(*) FROM `seen_questions`
	WHERE `seen_questions`.`user_id` = `users`.`id`
		AND `seen_questions`.`seen_at` >= `users`.`attempt_started_at`
);
