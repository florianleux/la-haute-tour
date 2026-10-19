-- Les joueurs qui ont fini l'introduction avant le Fromage n'en ont pas : on
-- les remet à zéro, pour qu'ils la rejouent et le reçoivent. Même geste que
-- resetPlayer() (server/utils/players.ts), écrit en SQL parce qu'une migration
-- ne passe pas par le serveur ; tests/server/reset-finished-intros.test.ts
-- tient l'équivalence. Voir specs/admin.md#gestion-des-joueurs.
DELETE FROM `seen_questions` WHERE `user_id` IN (SELECT `id` FROM `users` WHERE `intro_done_at` IS NOT NULL);--> statement-breakpoint
DELETE FROM `missed_pool` WHERE `user_id` IN (SELECT `id` FROM `users` WHERE `intro_done_at` IS NOT NULL);--> statement-breakpoint
DELETE FROM `pocket_spells` WHERE `user_id` IN (SELECT `id` FROM `users` WHERE `intro_done_at` IS NOT NULL);--> statement-breakpoint
DELETE FROM `items` WHERE `user_id` IN (SELECT `id` FROM `users` WHERE `intro_done_at` IS NOT NULL);--> statement-breakpoint
DELETE FROM `active_effects` WHERE `user_id` IN (SELECT `id` FROM `users` WHERE `intro_done_at` IS NOT NULL) OR `caster_id` IN (SELECT `id` FROM `users` WHERE `intro_done_at` IS NOT NULL);--> statement-breakpoint
DELETE FROM `recovery_questions` WHERE `user_id` IN (SELECT `id` FROM `users` WHERE `intro_done_at` IS NOT NULL);--> statement-breakpoint
DELETE FROM `reservations` WHERE `user_id` IN (SELECT `id` FROM `users` WHERE `intro_done_at` IS NOT NULL);--> statement-breakpoint
DELETE FROM `attempts` WHERE `user_id` IN (SELECT `id` FROM `users` WHERE `intro_done_at` IS NOT NULL);--> statement-breakpoint
DELETE FROM `disputes` WHERE `user_id` IN (SELECT `id` FROM `users` WHERE `intro_done_at` IS NOT NULL);--> statement-breakpoint
DELETE FROM `achievements` WHERE `user_id` IN (SELECT `id` FROM `users` WHERE `intro_done_at` IS NOT NULL AND `is_test` = 1);--> statement-breakpoint
UPDATE `users` SET
  `current_floor` = 1,
  `lives` = 3,
  `cooldown_until` = NULL,
  `cooldown_started_at` = NULL,
  `cooldown_base_ms` = NULL,
  `floor_cursor` = 0,
  `floor_seen` = 0,
  `attempt_seen` = 0,
  `attempt_started_at` = CAST(strftime('%s', 'now') AS INTEGER),
  `streak` = 0,
  `seen_total` = 0,
  `last_played_day` = NULL,
  `days_played` = 0,
  `play_streak` = 0,
  `last_chest` = NULL,
  `achievements_held` = CASE WHEN `is_test` = 1 THEN '[]' ELSE `achievements_held` END,
  `gender` = NULL,
  `intro_done_at` = NULL
WHERE `intro_done_at` IS NOT NULL;
