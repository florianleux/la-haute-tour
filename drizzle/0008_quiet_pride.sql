DROP INDEX `questions_floor_idx`;--> statement-breakpoint
ALTER TABLE `questions` ADD `rank` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `questions` SET `rank` = (
  SELECT COUNT(*) FROM `questions` AS `earlier`
  WHERE `earlier`.`floor` = `questions`.`floor`
    AND `earlier`.`rowid` <= `questions`.`rowid`
);--> statement-breakpoint
CREATE UNIQUE INDEX `questions_floor_rank` ON `questions` (`floor`,`rank`);--> statement-breakpoint
ALTER TABLE `users` ADD `floor_cursor` integer DEFAULT 0 NOT NULL;
