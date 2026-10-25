# ADR 0008 — La porte du boss nomme qui a posé sa clé

**Date** : 2026-09-12
**Statut** : acceptée

## Contexte

`equipes.md` pose une règle stricte : « Aucune progression d'autrui affichée »
et « rien de plus que deux boutons » pour ce que la page Sorts révèle d'une
équipe — pas de liste de coéquipiers, pas d'effectif. La seule fissure
existante est le journal des Sorts, qui nomme un joueur **après** qu'il a
lancé un sort sur vous ou reçu le vôtre — jamais avant, jamais en dehors d'une
action déjà accomplie.

La porte à deux clés d'un boss (`boss.md`) est une action coopérative : deux
membres d'une même équipe doivent chacun poser leur clé pour l'ouvrir. Un
joueur qui a fini l'étage et attend sur l'écran de porte doit savoir s'il
attend quelqu'un — et si oui, combien lui manque.

## Décision

L'écran de porte fermée **nomme** qui a déjà posé sa clé, pas seulement un
compte (0/1/2). C'est une deuxième fissure dans l'anonymat des coéquipiers, du
même type que le journal des Sorts : elle révèle une **action accomplie**
(poser sa clé), jamais une progression (où en est ce coéquipier dans son
étage, ses vies, son combat de boss).

## Conséquences

`equipes.md` gagne une deuxième exception nommée à « aucune liste de
coéquipiers », à côté du journal des Sorts. Un joueur sans équipe ne voit
jamais cet écran (pas de porte), donc la question ne se pose pas pour lui.

Le principe qui borne les deux exceptions : on nomme une action que quelqu'un
a choisi de faire et qui vous concerne directement, jamais un état qu'il
n'a pas choisi de montrer.

## Amendement — 2026-10-23

Le joueur n'attend plus devant la porte fermée : il redescend au camp (voir
`boss.md#attendre-au-camp`). Le camp **nomme aussi** qui a posé sa clé,
avec la même règle : une action accomplie, jamais une progression. Sans ça,
le joueur devrait remonter pour savoir qui il attend. Le joueur sans équipe,
lui, voit désormais la porte, déjà ouverte : il n'y a personne à nommer.
Cette dernière phrase remplace celle des Conséquences (« pas de porte »).

## Amendement — 2026-10-25

La décision tient, mais les noms ne s'affichent pas encore : la porte et le
camp ne montrent que les serrures allumées, choix de design. L'état de jeu
les servira (#139) ; les afficher ne demandera alors que l'écran.
