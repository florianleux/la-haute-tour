# Lore

Document de travail. Bribes posées par Flo, mises en forme et développées par questions — rien n'est inventé ici sans validation explicite.

## Contexte

- L'action se situe des années après le **Grand Événement**.
- Le monde du jeu accorde une grande importance à la culture générale.
- Le Grand Événement = la fin (fictive) de **QPUC**, émission culte de ce monde. (QPUC désigne ici la vraie émission « Questions pour un champion » ; sa fin dans ce lore est fictive.)
- Comme redouté, la fin de QPUC est arrivée peu après la fin des **quotidiennes** : l'émission n'a pas tenu longtemps sans elles.
- Sa fin a marqué un **déclin** : la culture est devenue de plus en plus rare. (Détails du déclin hors-scope — pas à développer.)
- La **Tour** est un repère de culture, que tous les aventuriers veulent gravir.
- Grimper la Tour motive par deux choses : **récolter la culture** et **accomplir la prophétie**.
- La **prophétie** : accomplir l'ascension de la Tour ramènerait QPUC.

## Guildes

- Le joueur incarne un **aventurier**, membre d'une des deux guildes.
- Les deux guildes = les deux équipes (`team`) d'`equipes.md`.
- Noms : les **Méridiens** et les **Fauteuilliens**.
- Elles sont **rivales** : chacune veut gravir la Tour en premier. (Raison de la rivalité hors-scope — pas à développer.)

## Étages

- Chaque étage (1 à 6) porte un **nom d'objet céleste**, en gradation d'échelle.
- Sa **porte** porte le nom de l'étage suivant (ex. la porte de l'étage 1 s'appelle la Porte de la Lune, et mène à l'étage 2, Lune).
- La porte du dernier étage (6), la **Porte de l'Univers**, ne mène pas à un étage 7 (le jeu a 6 étages fixes, voir `spec.md`) : elle mène directement au **super boss final** (un 7ème boss, sans porte ni étage propre), puis à la sortie de la Tour — fin du jeu.

| Étage | Nom | Type d'objet | Porte |
|---|---|---|---|
| 1 | Terre | Planète | Porte de la Lune |
| 2 | Lune | Satellite | Porte de Véga |
| 3 | Véga | Étoile | Porte de Cassiopée |
| 4 | Cassiopée | Constellation | Porte de la Voie lactée |
| 5 | Voie lactée | Galaxie | Porte de la Vierge |
| 6 | Amas de la Vierge | Amas de galaxies | Porte de l'Univers |

## Personnages

### L'Inconnu

- Personnage mystérieux, encapuchonné, que le joueur rencontre **avant même l'introduction du jeu** (l'intro elle-même reste à développer séparément).
- Donne au joueur des informations sur la prophétie, la Tour, etc.
- À l'introduction, il révèle, à la demande du joueur : le Grand Événement, le déclin de la culture, la Tour et ses six étages (sans leurs noms), la prophétie — et les règles de base (questions, temps, vies, attente, rattrapage). La magie n'y est qu'évoquée. Texte : `pages/intro.vue`.
- Aide le joueur par condescendance, pas par bonté : il pense, comme pour tous les aventuriers avant lui, qu'il échouera — donc lui donner des infos ne représente aucun risque à ses yeux.
- **Twist final** : L'Inconnu est en réalité **Samuel Étienne** (référence au vrai présentateur de *Questions pour un champion*). C'est lui, le boss final, **Le Présentateur**.
- **Antagoniste principal** du jeu : il ne veut pas que la prophétie s'accomplisse (que QPUC revienne), car il préfère sa vie actuelle de **streamer sur Twitch**.

## Boss

- `boss-1.md` prévoit déjà un boss par étage (6 au total), avec un modèle PV/vies par défaut et 3 paliers de difficulté par boss. Le boss d'un étage se combat **avant** la porte de cet étage — modèle inchangé, y compris pour l'étage 6.
- Un **7ème boss**, le **super boss final**, vient s'ajouter **après** la Porte de l'Univers (étage 6). C'est **Le Présentateur** — voir section Personnages. Il n'a pas de porte ni d'étage propre.
- Séquence complète de fin de jeu : étage 6 (Amas de la Vierge) → boss de l'étage 6 (`floorEnd`) → Porte de l'Univers → super boss final → sortie de la Tour (`gameOver`).
- Design du super boss final non fait — pas le même combat que les 6 boss d'étage, à spécifier séparément.

## Points encore à spécifier

- Détails du déclin de la culture (volontairement laissé flou).
- Raison de la rivalité entre les deux guildes (volontairement laissé flou).
- Le super boss final (Le Présentateur) : lieu narratif propre pour le combat, ou "hors lieu" (après l'Univers, sans étage associé) ? Design du combat non fait.
- À quel moment/comment le joueur rencontre L'Inconnu avant l'intro (écran dédié, dialogue, autre) ?
- Comment et quand le twist (L'Inconnu = Samuel Étienne) se révèle en jeu.
- Tout flavor text par écran (intro, palier, gameOver, etc.).
- Impact mécanique du 7ème boss sur `boss-1.md` (actuellement "un boss par étage, 6 au total") et sur la machine à états (`gameOver` après ce boss, pas après celui de l'étage 6).

---

*Document de travail. Amende potentiellement `equipes.md` (noms des guildes), `spec.md` (glossaire — Grand Événement, prophétie, guildes), `boss-1.md` / `boss-etage6-facettes.md` (statut de boss final), et les futurs textes d'écran.*
