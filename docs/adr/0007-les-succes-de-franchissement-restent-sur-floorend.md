# ADR 0007 — Les succès de franchissement restent gagnés à `floorEnd`, pas à `crossFloor`

**Date** : 2026-09-12
**Statut** : acceptée

## Contexte

Avant le boss, `crossFloor` (l'action qui incrémente l'étage) se déclenchait à
`floorEnd` (toutes les questions de l'étage vues) : les deux étaient le même
instant. Le boss les sépare — `floorEnd` devient le prélude du combat, et
`crossFloor` ne se déclenche plus qu'après la victoire sur le boss ou le
passage automatique (6 échecs consécutifs).

Deux succès (`specs/succes.md`) se gagnent aujourd'hui **dans** `crossFloor` :
`FIRST_ASCENT` (« premier joueur à franchir l'étage 1 ») et
`REACHED_FLOOR_2`..`REACHED_FLOOR_6` (un succès par étage atteint pour la
première fois). Les laisser où ils sont revient à exiger, en plus de voir
toutes les questions de l'étage, de battre son boss (ou d'y passer 6 échecs) —
un joueur qui plafonne devant un boss ne serait donc plus « arrivé » à l'étage
suivant tant qu'il ne l'a pas franchi.

## Décision

`FIRST_ASCENT` et `REACHED_FLOOR_n` se gagnent **à `floorEnd`**, pas à
`crossFloor`. « Atteindre un étage », au sens des succès, veut dire en avoir
vu toutes les questions — comme avant le boss. Le combat de boss est une porte
supplémentaire vers l'étage suivant, il ne redéfinit pas ce que ces succès
mesurent.

## Conséquences

`earnedByCrossing` et `claimFirstAscent`, aujourd'hui appelés depuis
`crossFloor`, doivent se déplacer vers le point où `floorEnd` se constate — la
résolution de la dernière question de l'étage, la même instant qui gagne déjà
`FLAWLESS_FLOOR_n` (`earnedByFloorDone`). Les trois logiques de succès de fin
d'étage se retrouvent donc au même endroit, ce qu'elles n'étaient pas avant.

Le catalogue de succès (`succes.md`) reste inchangé dans ses conditions ;
seul le point de déclenchement dans le code se déplace.
