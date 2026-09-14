ALTER TABLE `users` ADD `achievements_held` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
-- Le palmarès porté double une table qui existe déjà : il part de ce qu'elle
-- contient, sinon tout joueur déjà là repasserait pour neuf et réécrirait ses
-- succès un par un pour rien.
UPDATE `users` SET `achievements_held` = coalesce(
  (SELECT json_group_array(`achievement`) FROM `achievements` WHERE `user_id` = `users`.`id`),
  '[]'
);
