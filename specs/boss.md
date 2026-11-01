# Boss

> **En partie implémenté.** Le combat (#34) existe : épreuves tirées et jugées par le serveur, victoire qui franchit le palier, défaite qui mène à l'attente, sans rattrapage. Les paliers de difficulté et le passage automatique aussi (#35) : le combat N sert les 10 drapeaux du combat N, et le 6e combat perdu franchit le palier. La porte retenue (#137) aussi, et les clés : l'admin en donne une (#138), le joueur la pose, deux clés déverrouillent la porte pour l'équipe (#139), « Redescendre » au camp, position retenue (#140), le camp en attente de porte, qui compte les clés et offre « Remonter » (#141), et la défaite qui attend au camp avant de remonter, comme la dernière vie perdue sur la dernière question qui mène droit à la porte (#143). Les reliques aussi (#40), Objets de l'Inventaire, et l'introduction jouée une seule fois (#39). Pas encore : la relecture (#142), le loot forcé de la clé (#38), le profil qui distingue un combat (#36 : une tentative de combat, sans question vue, ne s'écrit pas). Les étages 2 à 6 rejouent Julien Le Perse en attendant leur boss.

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
- **10 épreuves par combat** sous le modèle par défaut — ce nombre découle
  du calcul PV/vies (7 PV + 3 vies) et ne s'applique pas aux boss qui s'en
  écartent. Le combat s'arrête dès que le boss est à 0 PV (victoire) ou le
  joueur à 0 vie (défaite) — jamais par épuisement du pool : à 3 vies, le
  pire cas (2 échecs tolérés + 7 réussites) se résout en 9 épreuves au plus,
  la 10e est une marge. Le compte tient parce que les Sorts n'agissent pas en
  combat de boss (voir plus bas).
- **Combat individuel** : chaque joueur affronte son propre boss, ses propres
  PV, ses propres épreuves — même une fois la porte déverrouillée pour l'équipe
  (voir plus bas).
- Format d'une épreuve (saisie, timer, anti-triche) : propre à chaque boss,
  hors périmètre de ce document — mais **un seul format par boss**, partagé par
  ses 60 épreuves curatées. Un boss ne mélange pas les types de mini-jeu d'une
  épreuve à l'autre dans un même combat.

## Le combat de boss est une tentative d'ascension

**Un combat de boss (`bossAttempt`) n'est pas une entité à part : c'est une
tentative (`attempt`) de plus, dont le contenu est les épreuves du boss plutôt
que le deck de l'étage.** Même table `attempts`, mêmes vies, même
`cooldown`/`recovery` — voir [ADR 0006](../docs/adr/0006-le-combat-de-boss-reutilise-la-tentative.md).
Une exception : **les Sorts n'agissent pas en combat de boss.** Le combat se
joue avec les vies standard et le timer de son boss, sans Vitalité ni
Chronomancie — sinon une vie de plus ferait déborder les 10 épreuves d'un
combat. Un effet qui attendait la prochaine tentative de sa cible n'est pas
consommé par un combat de boss : il est gardé pour la tentative d'ascension
suivante. L'attente entre deux combats, elle, reste celle de l'ascension :
Répit y agit comme d'habitude. Il n'y a pas de rattrapage au boss.

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
  60.
- **6 échecs consécutifs → passage automatique** (`passed`) à l'étage suivant :
  pas d'outro de défaite ni d'attente, « Le boss te laisse passer » se lit sur
  l'arène, puis « Continuer » franchit le palier, comme après une victoire.
- **1er combat** : le joueur entre avec les vies qu'il lui restait à la fin
  de l'ascension, **3 au plus** — une vie gagnée par Vitalité ne passe pas la
  porte du boss. Sauf si elles sont à 0, voir « Cas à 0 vie » plus bas.
- **Combats suivants** : vies pleines standard (3), comme une tentative
  d'ascension normale.
- **Entre deux combats** : attente (12h par défaut) au camp, **sans
  rattrapage** — l'attente échue rend les vies, quel que soit le Pool Échecs
  de l'étage. Le joueur remonte alors à la porte (« Remonter »).

## Cas à 0 vie

Si le joueur perd sa dernière vie sur la dernière question de l'étage, ce
n'est pas une chute : **ni attente ni rattrapage**, et pas de succès de
première mort. Il lit son verdict au palier, puis arrive devant la porte
comme tout le monde : poser sa clé, ouvrir, entrer. Il entre en 1er combat à
vies pleines — comme les combats suivants, pas de vies héritées dans ce cas.

## Porte à deux clés

Le boss est derrière une porte (`bossDoor`) à deux clés, à l'échelle de
l'**équipe** (`team`) : il faut que deux membres de la même équipe l'atteignent,
chacun posant sa clé, pour la déverrouiller.

- **Toujours 2 clés**, quelle que soit la taille de l'équipe.
- Une fois déverrouillée, la porte le reste **définitivement** pour toute
  l'équipe — les membres qui arrivent après n'ont plus besoin de clé.
- **Joueur sans équipe** (dont l'admin) : il trouve la porte **déjà
  déverrouillée**. Un seul parcours pour tous les joueurs.
- **Déverrouillée n'est pas ouverte.** Devant une porte déverrouillée, chaque
  joueur l'**ouvre** lui-même (`openDoor`, bouton « Ouvrir ») : les battants
  pivotent vers lui, puis « Entrer » paraît. Ouvrir est **par joueur** et
  **retenu par le serveur** : qui a déjà ouvert retrouve la porte ouverte, sans
  rejouer l'animation ; ses coéquipiers ouvrent chacun la leur.
- **Porte verrouillée, déverrouillée et ouverte sont une seule et même phase**,
  `bossDoor` : des champs (nombre de clés posées / porte déverrouillée / porte
  ouverte par le joueur) distinguent les écrans, pas des phases — même
  précédent que le coffre, porté comme champ dans le verdict plutôt que comme
  phase à part.

### Obtention de la clé

- À partir de **50 % de l'étage parcouru**, chaque coffre de loot ouvert avec
  succès est **forcé** de donner la clé — le tirage normal (95 % sort / 5 %
  Mimic) ne s'applique plus. Ça continue coffre après coffre jusqu'à ce que le
  joueur obtienne sa clé, ou que l'étage se termine.
- Une fois la clé obtenue, les coffres suivants reviennent au tirage normal.
  La clé arme le Mimic comme un sort : le coffre d'après peut en être un.
- La clé passe avant Vitalité : un joueur sans sort découvert dont le premier
  coffre tombe passé 50 % reçoit la clé, et Vitalité au coffre suivant.
- « 50 % » se lit sur les questions vues de l'étage, celle du coffre comprise :
  le coffre du rang *n* donne la clé quand *2n* atteint le total de l'étage.
- Le coffre qui donne la clé la montre, comme un sort (« Le coffre contenait la
  clé de la Lune. Elle rejoint ton Inventaire. »), et l'Inventaire la montre
  tant qu'elle n'est pas posée. Son image et son nom d'Objet vivent au
  catalogue des portes (`keyItem`).
- Si le joueur ne réussit aucun coffre de loot après 50 % avant la fin de
  l'étage, il n'a pas de clé cette ascension — il compte alors sur deux
  coéquipiers qui en ont une.
- Une clé obtenue alors que la porte est déjà déverrouillée **reste acquise,
  inutile — mais se stocke quand même**, dans une **table dédiée**, à part des
  sorts en poche (`pocketSpells.spell` est un enum strict qui ne l'accepte
  pas).

### Poser la clé

- **Action manuelle** (`placeKey`) : un choix de la fenêtre de dialogue de la porte,
  « Utiliser la clé de la Lune » (le nom de la clé suit celui de la porte),
  pas automatique à l'arrivée.
- **Cet écran nomme qui a déjà posé sa clé.** Nouvelle exception à l'anonymat
  des coéquipiers (`equipes.md`), au même titre que le journal des Sorts : la
  porte est une action coopérative, le joueur doit savoir qui il attend, pas
  seulement combien. Voir [ADR 0008](../docs/adr/0008-la-porte-du-boss-nomme-qui-a-pose-sa-cle.md).
  **Pas encore affiché** : l'état de jeu sert les noms (`keyHolders`), mais la porte et le
  camp ne montrent pour l'instant que les clés posées dans leurs serrures (choix de design
  du 2026-10-25). La règle reste, l'affichage viendra.

### Arriver devant la porte

Le joueur qui finit l'étage arrive devant la porte. Ce qu'il y trouve :

| Porte à son arrivée | Il a une clé | Ce qu'il fait |
|---|---|---|
| Verrouillée, 0 clé posée | oui | Pose sa clé (1 sur 2), puis **Redescendre** |
| Verrouillée, 0 ou 1 clé posée | non | Voit combien de clés sont posées, puis **Redescendre** |
| Verrouillée, 1 clé posée | oui | Pose sa clé, la porte se déverrouille : **Ouvrir**, puis **Entrer** |
| Déverrouillée | oui ou non | **Ouvrir**, puis **Entrer**. Sa clé reste stockée, sans effet |
| Déjà ouverte par lui | — | **Entrer** |
| Sans équipe | — | Porte déjà déverrouillée : **Ouvrir**, puis **Entrer** |

« Ouvrir » écarte les battants, qui s'effacent avant la fin du mouvement ;
« Entrer » paraît en fondu une fois qu'ils ont disparu et engage le combat de boss du joueur (`bossFight`), seul.

### Attendre au camp

- Porte verrouillée, le joueur **redescend** au camp (`descendToCamp`). Il n'y a
  pas d'écran d'attente devant la porte.
- Le camp dit l'état de la porte, nommée (« La Porte de la Lune attend
  toujours sa deuxième clé. », « … ses deux clés. », « … est déverrouillée,
  tu peux maintenant l'ouvrir. »), et **qui** a posé les clés (le camp
  nomme comme la porte, voir ADR 0008 — pas encore affiché, comme sur la
  porte).
- Le bouton **« Remonter »** (`climbToDoor`) du camp ne s'active que porte
  déverrouillée. Il ramène devant la porte, où « Ouvrir » (ou « Entrer », s'il
  l'a déjà ouverte) attend.
- **Position retenue** (`doorSpot`) : le joueur retombe là où il était, porte
  ou camp, à chaque connexion. Le serveur la stocke, et la remet à zéro à
  `crossFloor`.
- **Porte et camp relisent l'état** environ toutes les 30 s : la porte qui
  se déverrouille pendant que le joueur la regarde lui offre « Ouvrir », sans
  recharger. La relecture ne court que porte verrouillée, et s'arrête quand le
  joueur quitte la fenêtre ; au retour, celle qui était due part aussitôt.
- **Entre deux combats** : défaite, attente au camp, puis « Remonter » face à
  la porte qu'il a déjà ouverte, et « Entrer ». Pas de rattrapage : l'attente
  échue le laisse au camp, vies rendues.
- **Une guilde qui n'aura jamais deux clés** : cas accepté, aucun geste admin
  pour déverrouiller une porte.

### Les portes de tous les étages

Un seul écran de porte sert les 6 étages. Ce qui change d'une porte à
l'autre vit au **catalogue des portes** (`bossDoors`, dans
`utils/bossDoors.ts`) : nom, nom de la clé, illustration (sous `public/images/boss/<étage>/`),
position des deux serrures. Les hublots, chaînes et autres détails de
l'illustration sont du décor. Banc de design : `/test/door/<étage>`, avec 0,
1 ou 2 clés déjà posées.

## Contenu des épreuves — pas d'aléatoire

Le contenu d'un combat de boss n'est **jamais tiré au hasard** : les 10
épreuves d'un combat sont choisies à la main, une fois, en base. Seul leur
**ordre de présentation** est mélangé à chaque combat. Ça vaut pour les 6
combats de chaque boss — 60 épreuves curatées par boss au total (10 × 6).

## Introduction et animations

Les images des phases de boss (porte, introduction, combat, épreuves) vont
dans `public/images/boss/<étage>/`, le dossier de leur boss : l'écran de
chargement du jeu ne les attend pas, celui du boss
(`bossAssetsLoadingScreen`) les attend toutes, à l'arrivée devant sa porte.
Une relique montrée hors des phases de boss — dans l'Inventaire, par exemple —
n'y va pas : elle reste préchargée avec le jeu. Voir la section « Images » de
[`CLAUDE.md`](../CLAUDE.md#images).

- **Trois phases** à chaque boss : la porte, l'introduction, le combat.
- **Première rencontre d'un boss** : introduction (`bossIntro`), jouée une
  seule fois : dès qu'un combat contre ce boss est ouvert (`bossAttemptNumber`
  au-dessus de zéro), « Entrer » ne joue plus que sa réplique de relance
  (`retryLines`). Elle part du fond uni de l'arche où « Entrer » vient de plonger,
  et déroule ses temps : répliques du joueur (fenêtre de la porte) ou du boss
  (fenêtre à ses couleurs), qui avancent seules ou au clic, et des effets
  déclenchés au début d'un temps — une nuée d'objets qui traverse l'écran
  par vagues, l'apparition du boss (derrière la nuée), son cri, son nom en
  grand titre. Le boss y est une **figure** (`bossFigure`) : un corps par
  pose, une tête par expression, que chaque temps peut changer (Julien paraît
  bras écartés, sérieux ; il crie, puis redevient sérieux ; sa fenêtre
  s'efface sous son titre). Quand il parle, sa tête hoche autour du
  menton. Au combat, sa tête réagit, et hoche le temps du coup : en colère
  quand il encaisse, rieuse quand le joueur encaisse. Chaque boss a les siens au
  catalogue des introductions (`bossIntros`) ; un étage sans entrée passe
  directement au combat. La séquence de chaque boss est décrite dans sa spec.
- **Le combat** se joue dans l'**arène** (`bossArena`), la même pour tous
  les boss : figure, joueur, barres de vie et coups. Seule l'épreuve au
  milieu change d'un boss à l'autre ; le nom et la figure viennent du
  catalogue des boss (`bosses`).
- **Chaque épreuve juste** anime la barre de vie du boss : elle perd 1/7 et le
  boss vibre. Une épreuve fausse retire une vie au joueur sans animation
  particulière pour l'instant — juste l'affichage qui baisse.
- **Chaque combat** se termine par une animation de victoire ou de défaite —
  l'outro de victoire (`bossVictory`) ou celle de défaite (`bossOutro`), voir
  [`ecrans.md`](./ecrans.md) —
  phase `bossFight`, active jusqu'à ce que le boss soit à 0 PV ou le joueur à
  0 vie.
- **Un combat relancé** (retry après échec) ne rejoue pas l'introduction : le
  boss paraît sur le fond de l'arche, sans nuée ni titre, dit sa réplique de
  relance pour ce combat (`retryLines`, une par combat, du 2e au 6e), et le
  clic ouvre le combat. Un boss sans réplique pour ce combat mène droit au
  combat.

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
une **relique** — une par boss (6 au total).

- **Un Objet de l'Inventaire**, comme le Fromage : rien qu'un Objet de plus
  dans le sac, avec son image, son nom et sa description. Pas de page dédiée,
  pas de section à part ; une relique pas encore obtenue ne se montre nulle
  part.
- **Laissée au verdict qui achève le combat** — la dernière épreuve juste, ou
  la dernière vie du 6e combat —, une seule fois, même si deux réponses
  partent ensemble. Ce moment vaut pour le dernier étage aussi, qui finit la
  partie sans franchir de palier.
- **Montrée** par le geste de l'outro de victoire : l'écran d'objet obtenu,
  celui du Fromage et des sorts du coffre, titré « Relique obtenue » ; son OK
  franchit le palier.
- **Inutilisable pour l'instant**, et sans effet de jeu : ni vie, ni règle
  modulée.
- **Catalogue fixe** dans le code (`BOSS_RELICS`, `shared/utils/items.ts`) :
  la relique de chaque étage. Seule celle de Julien Le Perse existe, la
  **Fiche carbonisée** (`JULIEN_CARD`, ses fiches d'animateur, voir
  [`lore.md`](./lore.md)) ; un étage sans relique au catalogue n'en laisse
  pas. Chaque relique arrive avec son boss.

## Points encore à spécifier

- **Le 7e boss**, Le Présentateur, que le lore place entre le boss de l'étage 6
  et `gameOver` (voir [`lore.md`](./lore.md#boss)). À venir : d'ici là,
  `gameOver` suit le boss de l'étage 6.

Le reste est réglé par le grillage — voir les sections ci-dessus. Reste aussi, propre à
chaque boss et hors périmètre de ce document : le contenu exact d'une épreuve
(saisie, timer, anti-triche) et celui des 60 par boss (quelles épreuves dans
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
