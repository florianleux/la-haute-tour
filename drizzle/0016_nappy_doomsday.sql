ALTER TABLE `active_effects` ADD `cast_cooldown_started_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `cooldown_started_at` integer;--> statement-breakpoint
-- L'attente était désignée par son échéance ; elle l'est maintenant par son
-- début, que Répit ne déplace pas. Les effets déjà posés reprennent leur
-- ancienne valeur : elle ne sert qu'à distinguer deux lancers d'un même
-- lanceur, et une valeur d'avant ne peut heurter aucune attente d'après.
UPDATE `active_effects` SET `cast_cooldown_started_at` = `cast_cooldown_until`;--> statement-breakpoint
-- Une attente en cours n'a pas de début enregistré : on le déduit de son
-- échéance et de la durée d'attente ordinaire (12 h). Aucun Répit n'a encore pu
-- la raccourcir — le sort n'était pas lançable — donc la seule imprécision
-- possible est l'attente plus courte qui suit un rattrapage manqué. Aucun
-- joueur n'en tenait une au moment de la migration.
UPDATE `users` SET `cooldown_started_at` = `cooldown_until` - (12 * 60 * 60)
	WHERE `cooldown_until` IS NOT NULL;
