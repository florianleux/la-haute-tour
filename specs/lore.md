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
- Noms : les **Méridiens** (`MIDI`) et les **Fauteuillistes** (`TLM`).
- Chacune défend une émission dont elle veut le retour : les Méridiens, *Les 12 coups de midi* ; les Fauteuillistes, *Tout le monde veut prendre sa place*.
- Elles sont **rivales** : c'est à qui atteindra le premier le sommet de la Tour.
- Le joueur ne choisit pas sa guilde : il la porte déjà, sur sa bannière, quand il arrive. L'Inconnu la lui lit à l'introduction (voir [`equipes.md`](./equipes.md)).

## Étages

- Chaque étage (1 à 6) porte un **nom d'objet céleste**, en gradation d'échelle.
- Sa **porte** porte le nom de l'étage suivant (ex. la porte de l'étage 1 s'appelle la Porte de la Lune). C'est la porte du boss de [`boss.md`](./boss.md#porte-à-deux-clés) (`bossDoor`, à deux clés) : le boss de l'étage se tient derrière, et le battre ouvre l'étage suivant (l'étage 2, Lune).
- La porte du dernier étage (6), la **Porte de l'Univers**, ne mène pas à un étage 7 (le jeu a 6 étages fixes, voir `spec.md`) : derrière elle, le boss de l'étage 6, puis le **super boss final** (un 7ème boss, sans porte ni étage propre), puis la sortie de la Tour — fin du jeu.

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

- Personnage mystérieux, encapuchonné. C'est lui qui accueille le joueur à sa première connexion : l'introduction (`/intro`) est sa rencontre.
- Donne au joueur des informations sur la prophétie, la Tour, etc.
- À l'introduction, il révèle, à la demande du joueur : le Grand Événement, le déclin de la culture, la Tour et ses six étages (sans leurs noms), la prophétie — et les règles de base (questions, temps, vies, attente, rattrapage). La magie n'y est qu'évoquée. Texte : `pages/intro.vue`.
- Dès que le joueur a dit son nom et ce qu'il est, et avant ses questions, il lit la bannière du joueur : sa guilde, ce qu'elle défend, la guilde rivale et ce qu'elle défend. La course des deux guildes au sommet, il la raconte avec la Tour, quand le joueur la demande. Sautée pour qui n'a pas d'équipe (l'admin).
- À la fin de l'introduction, il donne au joueur un bout de **fromage**, sans dire pourquoi. C'est ce fromage qui attire Michel au camp.
- Aide le joueur par condescendance, pas par bonté : il pense, comme pour tous les aventuriers avant lui, qu'il échouera — donc lui donner des infos ne représente aucun risque à ses yeux.
- **Twist final** : L'Inconnu est en réalité **Samuel Étienne** (référence au vrai présentateur de *Questions pour un champion*). C'est lui, le boss final, **Le Présentateur**.
- **Antagoniste principal** du jeu : il ne veut pas que la prophétie s'accomplisse (que QPUC revienne), car il préfère sa vie actuelle de **streamer sur Twitch**.

### Michel

- Une petite **souris**, qui vit au camp : on le voit déjà dans le décor avant qu'il ne parle.
- Absent de l'introduction. Il arrive à la première visite du camp, attiré par l'odeur du fromage de L'Inconnu, et se le fait donner.
- Compagnon de voyage du joueur : c'est lui qui lui explique le camp et ses objets, chacun au moment où il apparaît (voir [`ecrans.md`](./ecrans.md#leçons-de-michel)). L'Inconnu, lui, garde les règles de base.
- Ses répliques restent à écrire. Michel se dit au masculin, bien que souris.

## Boss

- [`boss.md`](./boss.md) prévoit déjà un boss par étage (6 au total), avec un modèle PV/vies par défaut et 3 paliers de difficulté par boss. Le boss d'un étage se tient **derrière** la porte de cet étage — modèle inchangé, y compris pour l'étage 6.
- Un **7ème boss**, le **super boss final**, vient s'ajouter **après** la Porte de l'Univers (étage 6). C'est **Le Présentateur** — voir section Personnages. Il n'a pas de porte ni d'étage propre.
- Séquence complète de fin de jeu : étage 6 (Amas de la Vierge), toutes ses questions vues (`floorEnd`) → Porte de l'Univers (`bossDoor`) → boss de l'étage 6 → super boss final → sortie de la Tour (`gameOver`). Le super boss est **à venir** : d'ici là, `gameOver` suit le boss de l'étage 6 (voir [`mecanique.md`](./mecanique.md#fin-de-partie)).
- Design du super boss final non fait — pas le même combat que les 6 boss d'étage, à spécifier séparément.

## Points encore à spécifier

- Détails du déclin de la culture (volontairement laissé flou).
- Raison profonde de la rivalité entre les deux guildes, au-delà de la course au sommet (volontairement laissé flou).
- Le super boss final (Le Présentateur) : lieu narratif propre pour le combat, ou "hors lieu" (après l'Univers, sans étage associé) ? Design du combat non fait.
- Comment et quand le twist (L'Inconnu = Samuel Étienne) se révèle en jeu.
- Tout flavor text par écran (intro, palier, gameOver, etc.).
- Impact mécanique du 7ème boss sur [`boss.md`](./boss.md) (actuellement "un boss par étage, 6 au total") et sur la machine à états (`gameOver` après ce boss, pas après celui de l'étage 6).
- Michel : son caractère, sa façon de parler, et ce qui le lie (ou non) à L'Inconnu et à son fromage.

---

*Document de travail. Amende potentiellement `equipes.md` (noms des guildes), `spec.md` (glossaire — Grand Événement, prophétie, guildes), `boss.md` (statut de boss final), et les futurs textes d'écran.*
