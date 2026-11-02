ALTER TABLE `achievements` ADD `announced_at` integer;--> statement-breakpoint
ALTER TABLE `active_effects` ADD `noticed_at` integer;--> statement-breakpoint
ALTER TABLE `disputes` ADD `noticed_at` integer;--> statement-breakpoint
-- Ce qui précède les nouvelles est déjà connu du joueur, ou trop ancien pour
-- en être une : tout l'existant part lu et annoncé.
UPDATE `disputes` SET `noticed_at` = `settled_at` WHERE `settled_at` IS NOT NULL;--> statement-breakpoint
UPDATE `active_effects` SET `noticed_at` = `cast_at`;--> statement-breakpoint
UPDATE `achievements` SET `announced_at` = `unlocked_at`;
