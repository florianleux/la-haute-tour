-- Les joueurs déjà inscrits n'ont jamais été invités avec une équipe : celle-ci
-- se décide désormais au moment de l'ajout en whitelist, ce qui ne peut pas
-- valoir rétroactivement. On les répartit donc au hasard, une fois.
--
-- Les admins restent hors équipe, comme la spec le dit, et les joueurs test
-- sont placés à la main depuis leur onglet : c'est justement en les opposant
-- qu'on éprouve le PvP. Voir specs/equipes.md.
--
-- `abs(random()) % 2` plutôt qu'un tirage équilibré : à cette échelle, un écart
-- d'un joueur entre les deux équipes ne change rien, et l'admin peut déplacer
-- qui il veut depuis sa fiche.
UPDATE `users`
SET `team` = CASE WHEN abs(random()) % 2 = 0 THEN 'CRIMSON' ELSE 'AZURE' END
WHERE `team` IS NULL
  AND `is_admin` = 0
  AND `is_test` = 0;
