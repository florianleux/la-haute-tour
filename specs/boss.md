# Boss

> **Pas encore implémenté.** Tout ce document décrit la cible, découpée en tickets #34 à #44. Aujourd'hui, le palier franchit l'étage au clic et le dernier palier mène directement à `gameOver`.

Chaque étage se termine par un boss. Battu, il ouvre le suivant. Contrairement
aux questions du deck, chaque boss est un mini-jeu propre — le cadre ci-dessous
(PV, vies, tentatives) est commun à tous ; le contenu d'une épreuve ne l'est
pas.

## Cadre général

- **Un boss par étage**, 6 au total.
- Le boss a **7 PV** (`bossHp`). Une épreuve juste lui retire 1 PV, une
  épreuve fausse retire 1 vie au joueur. **C'est le modèle par défaut** : un
  boss peut le remplacer entièrement par sa propre logique de victoire/défaite
  (par exemple sans PV ni vies ; aucun boss de ce genre n'est encore
  spécifié — `boss-etage2-tacautac.md`, cité ici, n'existe pas).
- **12 épreuves maximum** par combat sous le modèle par défaut — ce plafond
  découle du calcul PV/vies et ne s'applique pas aux boss qui s'en écartent.
  Le combat s'arrête dès que le boss est à 0 PV (victoire) ou le joueur à 0
  vie (défaite) — jamais par épuisement du pool : à 12 épreuves et un maximum
  théorique de 5 vies, le pire cas (4 échecs tolérés + 7 réussites) se résout
  en 11 épreuves au plus.
- **Combat individuel** : chaque joueur affronte son propre boss, ses propres
  PV, ses propres épreuves — même une fois la porte ouverte pour l'équipe
  (voir plus bas).
- Format d'une épreuve (saisie, timer, anti-triche) : propre à chaque boss,
  hors périmètre de ce document — mais **un seul format par boss**, partagé par
  ses 72 épreuves curatées. Un boss ne mélange pas les types de mini-jeu d'une
  épreuve à l'autre dans un même combat.

## Le combat de boss est une tentative d'ascension

**Un combat de boss (`bossAttempt`) n'est pas une entité à part : c'est une
tentative (`attempt`) de plus, dont le contenu est les épreuves du boss plutôt
que le deck de l'étage.** Même table `attempts`, mêmes vies, même
`cooldown`/`recovery` — voir [ADR 0006](../docs/adr/0006-le-combat-de-boss-reutilise-la-tentative.md).
Rien à dupliquer : les Sorts, leurs plafonds d'effets et tout ce qui s'ancre sur
le début d'une tentative s'appliquent donc aussi, sans code dédié, à un combat
de boss.

Ce que le combat de boss ajoute, en propre, à l'état de joueur (voir
[`architecture.md`](./architecture.md#état-de-jeu)) :

- **`bossHp`** — PV du boss pour le combat en cours, remis à 7 (ou au plein du
  boss) à l'ouverture de chaque nouveau combat.
- **`bossAttemptNumber`** — lequel des 6 combats maximum est en cours, ce qui
  détermine la difficulté. Remis à zéro au franchissement du palier, comme
  `floorCursor`.
- Une **table dédiée** liant une ligne `attempts` à son combat de boss (quel
  boss, quel `bossAttemptNumber`) — nécessaire parce que `attempts.seen`
  (questions vues) reste à 0 pour un combat de boss : aucune épreuve n'y
  incrémente `seen`, et le profil doit pouvoir dire « combat de boss » plutôt
  que montrer une tentative d'ascension à zéro question. Une ligne `attempts`
  sans entrée dans cette table est une tentative d'ascension ordinaire.

## Tentatives et difficulté

- **6 combats maximum**, en 3 paliers dégressifs : difficile (combats 1-2),
  moyen (combats 3-4), facile (combats 5-6). La difficulté joue sur le
  **contenu des épreuves lui-même** — pas sur le timer ni une autre règle
  transversale — donc elle est propre à chaque boss : c'est le curateur qui
  place ses épreuves les plus dures dans les tranches 1-2 en construisant les
  72.
- **6 échecs consécutifs → passage automatique** à l'étage suivant.
- **1er combat** : le joueur entre avec les vies qu'il lui restait à la fin
  de l'ascension — sauf si elles sont à 0, voir « Cas à 0 vie » plus bas.
- **Combats suivants** : vies pleines standard (3), comme une tentative
  d'ascension normale.
- **Entre deux combats** : attente (12h par défaut) puis rattrapage, sur le
  **Pool Échecs de l'étage** — le même mécanisme qu'en ascension, avec la
  même boucle en cas d'échec du rattrapage (attente réduite, rejoué sans
  limite). Le Pool Échecs de l'étage reste donc vivant tant que le boss n'est
  pas réglé.

## Cas à 0 vie

Si le joueur atteint `floorEnd` à 0 vie (dernière vie perdue sur la dernière
question de l'étage), l'écran de palier s'affiche normalement, mais il part en
attente/rattrapage sur le Pool Échecs de l'étage **avant** le premier combat
de boss. Une fois les vies restaurées, il entre en 1er combat à vies pleines —
comme les combats suivants, pas de vies héritées dans ce cas.

## Porte à deux clés

Le boss est derrière une porte (`bossDoor`) à deux clés, à l'échelle de
l'**équipe** (`team`) : il faut que deux membres de la même équipe l'atteignent,
chacun posant sa clé, pour l'ouvrir.

- **Toujours 2 clés**, quelle que soit la taille de l'équipe.
- Une fois ouverte, la porte reste ouverte **définitivement** pour toute
  l'équipe — les membres qui arrivent après n'ont plus besoin de clé.
- **Joueur sans équipe** (dont l'admin) : pas de porte, il affronte le boss
  seul dès qu'il l'atteint.
- **Porte fermée et porte ouverte-mais-pas-encore-engagée sont une seule et
  même phase**, `bossDoor` : un champ (nombre de clés posées / porte ouverte)
  distingue les deux écrans, pas deux phases — même précédent que le coffre,
  porté comme champ dans le verdict plutôt que comme phase à part.

### Obtention de la clé

- À partir de **50 % de l'étage parcouru**, chaque coffre de loot ouvert avec
  succès est **forcé** de donner la clé — le tirage normal (95 % sort / 5 %
  Mimic) ne s'applique plus. Ça continue coffre après coffre jusqu'à ce que le
  joueur obtienne sa clé, ou que l'étage se termine.
- Une fois la clé obtenue, les coffres suivants reviennent au tirage normal.
- Si le joueur ne réussit aucun coffre de loot après 50 % avant la fin de
  l'étage, il n'a pas de clé cette ascension — il compte alors sur deux
  coéquipiers qui en ont une.
- Une clé obtenue alors que la porte est déjà ouverte **reste en inventaire,
  inutile — mais se stocke quand même**, dans une **table dédiée**, à part de
  l'inventaire de Sorts (`inventory.spell` est un enum strict qui ne l'accepte
  pas).

### Poser la clé

- **Action manuelle** : un bouton dédié sur l'écran de porte, pas automatique
  à l'arrivée.
- Un joueur ayant fini l'étage mais dont la porte n'est pas encore ouverte
  (moins de 2 clés posées) est bloqué sur un **écran d'attente dédié** — rien
  d'autre à y faire.
- **Cet écran nomme qui a déjà posé sa clé.** Nouvelle exception à l'anonymat
  des coéquipiers (`equipes.md`), au même titre que le journal des Sorts : la
  porte est une action coopérative, le joueur doit savoir qui il attend, pas
  seulement combien. Voir [ADR 0008](../docs/adr/0008-la-porte-du-boss-nomme-qui-a-pose-sa-cle.md).

## Contenu des épreuves — pas d'aléatoire

Le contenu d'un combat de boss n'est **jamais tiré au hasard** : les 12
épreuves d'un combat sont choisies à la main, une fois, en base. Seul leur
**ordre de présentation** est mélangé à chaque combat. Ça vaut pour les 6
combats de chaque boss — 72 épreuves curatées par boss au total (12 × 6).

## Introduction et animations

- **Première rencontre d'un boss** : introduction (apparition, nom, dialogue),
  jouée une seule fois.
- **Chaque épreuve juste** anime la barre de vie du boss : elle perd 1/7 et le
  boss vibre. Une épreuve fausse retire une vie au joueur sans animation
  particulière pour l'instant — juste l'affichage qui baisse.
- **Chaque combat** se termine par une animation de victoire ou de défaite —
  phase `bossFight`, active jusqu'à ce que le boss soit à 0 PV ou le joueur à
  0 vie.
- **Un combat relancé** (retry après échec) va directement au combat, sans
  rejouer l'introduction.

## Franchissement d'étage

- `crossFloor` (incrément d'étage, abandon du Pool Échecs, réservation de la
  première question du suivant) se déclenche **après la victoire sur le boss
  ou le passage automatique** — plus à `floorEnd`.
- `floorEnd` reste déclenché par « toutes les questions de l'étage vues »,
  mais devient le prélude du boss plutôt que le palier lui-même.
- **Étage 6** : même système. Battre le boss (ou passer automatiquement) mène
  à `gameOver` au lieu de `crossFloor`.
- **Les succès de franchissement (`FIRST_ASCENT`, `REACHED_FLOOR_2`..`6`,
  `GAME_COMPLETED`, voir [`succes.md`](./succes.md)) restent gagnés à
  `floorEnd`, pas à `crossFloor`/`gameOver`.** « Atteindre un étage » ou
  « terminer le jeu », au sens des succès, veut dire en avoir vu toutes les
  questions — le boss est une porte supplémentaire vers l'étage suivant (ou la
  fin), il ne redéfinit pas ce que ces succès mesurent. Voir
  [ADR 0007](../docs/adr/0007-les-succes-de-franchissement-restent-sur-floorend.md).

## Récompense

Battre un boss (vraie victoire ou passage automatique après 6 échecs) laisse
une **relique** — objet cosmétique, sans effet, une par boss (6 au total).

**Même patron que les Succès** (`succes.md`) : catalogue fixe écrit dans le
code, jamais administrable, débloqué en jouant, acquis à vie. Page dédiée
listant les 6 reliques, obtenues et à obtenir — le mur de tuiles grisées qui
fait déjà ses preuves pour les Succès. Contenu exact des tuiles (nom, image,
flaveur) à écrire au moment de l'intégration, comme le catalogue des Succès
l'a été.

## Points encore à spécifier

- **Le 7e boss**, Le Présentateur, que le lore place entre le boss de l'étage 6
  et `gameOver` (voir [`lore.md`](./lore.md#boss)). À venir : d'ici là,
  `gameOver` suit le boss de l'étage 6.

Le reste est réglé par le grillage — voir les sections ci-dessus. Reste aussi, propre à
chaque boss et hors périmètre de ce document : le contenu exact d'une épreuve
(saisie, timer, anti-triche) et celui des 72 par boss (quelles épreuves dans
quelle tranche de difficulté).

## Amendements requis

Tous faits :

- **`spec.md`** (glossaire) : `boss`, `bossDoor`, `key`, `bossAttempt`,
  `bossAttemptNumber`, `bossFight`, `bossHp`, `relic`.
- **`mecanique.md`** (machine à états) : `floorEnd` ne déclenche plus
  `crossFloor` ; phases post-`floorEnd` (`bossDoor`, `bossFight`) et leurs
  transitions.
- **`ecrans.md`** : nouveaux écrans (porte, introduction/dialogue de boss,
  combat).
- **`equipes.md`** : la porte à deux clés comme nouvel usage de l'équipe, en
  plus du ciblage des Sorts.
- **`bonus.md`** (coffre de loot) : le tirage forcé de la clé à partir de 50 %
  de l'étage comme exception au tableau sort 95 % / Mimic 5 %.
- **`succes.md`** : `FIRST_ASCENT`/`REACHED_FLOOR_n`/`GAME_COMPLETED` restent
  déclenchés à `floorEnd` malgré le nouveau `crossFloor`/`gameOver` plus
  tardifs — voir ADR 0007.

---

*Document de travail, issu du grillage (voir [ADR 0006](../docs/adr/0006-le-combat-de-boss-reutilise-la-tentative.md),
[ADR 0007](../docs/adr/0007-les-succes-de-franchissement-restent-sur-floorend.md)
et [ADR 0008](../docs/adr/0008-la-porte-du-boss-nomme-qui-a-pose-sa-cle.md)).
Amende `spec.md`, `mecanique.md`, `ecrans.md`, `equipes.md`, `bonus.md` et
`succes.md`.*
