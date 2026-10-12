-- Les équipes prennent les identifiants de leurs guildes : CRIMSON devient TLM
-- (les Fauteuillistes), AZURE devient MIDI (les Méridiens). Voir specs/equipes.md.
UPDATE `users` SET `team` = 'TLM' WHERE `team` = 'CRIMSON';--> statement-breakpoint
UPDATE `users` SET `team` = 'MIDI' WHERE `team` = 'AZURE';--> statement-breakpoint
UPDATE `whitelist` SET `team` = 'TLM' WHERE `team` = 'CRIMSON';--> statement-breakpoint
UPDATE `whitelist` SET `team` = 'MIDI' WHERE `team` = 'AZURE';
