DROP INDEX `active_effects_one_per_cooldown`;--> statement-breakpoint
CREATE INDEX `active_effects_caster_cooldown_idx` ON `active_effects` (`caster_id`,`cast_cooldown_started_at`);