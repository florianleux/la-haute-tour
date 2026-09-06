PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_active_effects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`caster_id` integer NOT NULL,
	`spell` text NOT NULL,
	`face` text NOT NULL,
	`cast_at` integer NOT NULL,
	`cast_cooldown_started_at` integer DEFAULT 0 NOT NULL,
	`target_cooldown_started_at` integer,
	`anchored_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`caster_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- Tout ce qui existe a été lancé sur soi : l'attente de la cible est celle du
-- lancer. La colonne se remplit donc de l'autre, plutôt que de rester nulle et
-- de faire disparaître des effets déjà posés.
INSERT INTO `__new_active_effects`("id", "user_id", "caster_id", "spell", "face", "cast_at", "cast_cooldown_started_at", "target_cooldown_started_at", "anchored_at") SELECT "id", "user_id", "caster_id", "spell", "face", "cast_at", "cast_cooldown_started_at", "cast_cooldown_started_at", "anchored_at" FROM `active_effects`;--> statement-breakpoint
DROP TABLE `active_effects`;--> statement-breakpoint
ALTER TABLE `__new_active_effects` RENAME TO `active_effects`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `active_effects_user_idx` ON `active_effects` (`user_id`,`anchored_at`);--> statement-breakpoint
CREATE INDEX `active_effects_caster_idx` ON `active_effects` (`caster_id`,`cast_at`);--> statement-breakpoint
CREATE INDEX `active_effects_caster_cooldown_idx` ON `active_effects` (`caster_id`,`cast_cooldown_started_at`);