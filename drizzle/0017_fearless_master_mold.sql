DROP INDEX `active_effects_one_per_cooldown`;--> statement-breakpoint
CREATE UNIQUE INDEX `active_effects_one_per_cooldown` ON `active_effects` (`caster_id`,`spell`,`cast_cooldown_started_at`);--> statement-breakpoint
ALTER TABLE `active_effects` DROP COLUMN `cast_cooldown_until`;