ALTER TABLE `inventory` RENAME TO `pocket_spells`;--> statement-breakpoint
DROP INDEX `inventory_user_idx`;--> statement-breakpoint
CREATE INDEX `pocket_spells_user_idx` ON `pocket_spells` (`user_id`,`obtained_at`);
