CREATE TABLE `active_effects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`caster_id` integer NOT NULL,
	`spell` text NOT NULL,
	`face` text NOT NULL,
	`cast_at` integer NOT NULL,
	`cast_cooldown_until` integer NOT NULL,
	`anchored_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`caster_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `active_effects_user_idx` ON `active_effects` (`user_id`,`anchored_at`);--> statement-breakpoint
CREATE INDEX `active_effects_caster_idx` ON `active_effects` (`caster_id`,`cast_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `active_effects_one_per_cooldown` ON `active_effects` (`caster_id`,`spell`,`cast_cooldown_until`);