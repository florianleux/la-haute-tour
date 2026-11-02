# ADR 0013 — « Atteindre un étage » se gagne à sa première question

**Date** : 2026-11-02
**Statut** : acceptée — remplace en partie [ADR 0007](./0007-les-succes-de-franchissement-restent-sur-floorend.md)

## Contexte

L'ADR 0007 avait laissé `REACHED_FLOOR_n` à `floorEnd` : voir toutes les
questions d'un étage suffisait à « atteindre » le suivant, boss ou pas.

Le succès « Un peu plus près des étoiles » (atteindre la Porte de la Lune, celle
de l'étage 1) se gagne justement à `floorEnd`. Laissé là, « Étage 2 » tomberait
au même instant que lui, et les deux annonceraient la même chose.

## Décision

`REACHED_FLOOR_n` se gagne à `crossFloor`, quand la première question de
l'étage n est servie — après le boss battu ou passé. La porte du boss se gagne,
elle, à `floorEnd`, avec le sans-faute et la fin de partie.

`FIRST_ASCENT` ne bouge pas : il reste à `floorEnd`, comme l'ADR 0007 le
décidait.

## Conséquences

Un joueur qui plafonne devant un boss n'a pas le succès de l'étage suivant.
C'est voulu : la porte a désormais son propre succès, l'étage d'après se mérite.

Les joueurs qui ont gagné « Étage 2 » à `floorEnd` avant ce changement le
gardent : un succès ne se reperd jamais.
