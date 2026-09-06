ALTER TABLE `users` ADD `cooldown_base_ms` integer;--> statement-breakpoint
-- Une attente en cours porte désormais sa propre durée. Celle qui court est
-- forcément la longue : la courte ne s'ouvre qu'après un rattrapage manqué, et
-- aucune n'a encore pu être touchée par un Répit — le sort n'était pas lançable.
UPDATE `users` SET `cooldown_base_ms` = 12 * 60 * 60 * 1000
	WHERE `cooldown_until` IS NOT NULL;
