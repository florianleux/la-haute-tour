# ADR 0006 — Le combat de boss réutilise la tentative d'ascension

**Date** : 2026-09-12
**Statut** : acceptée

## Contexte

Chaque étage se termine désormais par un boss (voir `boss.md`, en cours
d'intégration à `specs/`) : jusqu'à 6 combats (`bossAttempt`), en 3 paliers de
difficulté dégressive, avec attente et rattrapage entre deux échecs sur le Pool
Échecs de l'étage.

Le doc décrit ce cycle en des termes qui recopient l'ascension presque mot pour
mot : le joueur entre en 1er combat avec les vies qu'il lui restait à la fin de
l'ascension, entre en combat suivant à vies pleines, perd une vie sur une
épreuve fausse, et une défaite ouvre la même attente (12h par défaut) suivie du
même rattrapage sur le Pool Échecs — « le même mécanisme qu'en ascension, avec
la même boucle en cas d'échec ».

Deux lectures possibles : soit le combat de boss est une **tentative
d'ascension de plus**, dont le contenu est un mini-jeu plutôt que le deck de
l'étage ; soit c'est une **entité séparée** qui imite le même comportement
vies/attente avec son propre compteur.

## Décision

**Un `bossAttempt` est un `attempt` réutilisé, pas une entité parallèle.** Même
table `attempts`, même colonne `lives`, même `openAttempt`/`closeAttempt`, même
`cooldown`/`recovery`. La seule chose qui change entre une tentative
d'ascension et un combat de boss est **la source du contenu** : le deck de
l'étage d'un côté, les épreuves curatées du boss de l'autre.

Ce que le combat de boss ajoute, en propre :

- `bossAttemptNumber` — lequel des 6 combats maximum est en cours, ce qui
  détermine la difficulté. Stocké, remis à zéro à `crossFloor` comme
  `floorCursor`.
- `bossHp` — points de vie du boss du combat en cours (7 par défaut), remis à
  ce plein à l'ouverture de chaque nouveau combat.
- Un marqueur sur la ligne `attempts` distinguant un combat de boss d'une
  tentative d'ascension — nécessaire parce que `attempts.seen` (questions
  vues) reste à 0 pour un combat de boss : aucune épreuve n'incrémente `seen`,
  et le profil doit pouvoir dire « combat de boss » plutôt que montrer une
  tentative d'ascension à zéro question.

## Conséquences

Zéro nouvelle machine à états vies/attente : le combat de boss traverse
`openAttempt`, `closeAttempt`, `cooldown`, `recovery` sans les toucher. Tout ce
qui s'ancre sur `attemptStartedAt` — les Sorts, leur budget de lancers, les
effets qui attendent la tentative suivante — s'applique donc aussi, gratuitement
et sans code dédié, à un combat de boss.

**Amendé le 2026-10-18** : les Sorts n'agissent pas en combat de boss, pour que
10 épreuves suffisent à décider un combat (7 PV + 3 vies). Cette exception
demande du code dédié ; l'attente et le rattrapage entre deux combats restent
ceux de l'ascension. Voir `boss.md`.

**Amendé le 2026-10-29** (#143) : plus de rattrapage au boss. Une défaite
ouvre l'attente seule, qui rend les vies à son échéance ; la dernière vie
perdue sur la dernière question de l'étage n'ouvre même pas d'attente. Le
combat reste une tentative. Voir `boss.md#cas-à-0-vie`.

Le prix : `attempts.seen` devient trompeur sans le marqueur (ADR non résolue
côté schéma — le marqueur exact, champ ou table, reste à choisir à
l'implémentation). Et parce que le combat de boss est un `attempt` comme un
autre, une mort dans un combat de boss ferme la tentative comme n'importe
quelle mort d'ascension — voir ADR 0007 pour ce que ça change (ou pas) aux
succès qui se gagnent au franchissement d'un étage.
