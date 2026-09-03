# La Haute Tour — Spécification fonctionnelle

## Principe général

Jeu web de culture générale avec inscription Discord. Stack : **Nuxt 3** (Vue 3 + Nitro) + **Turso** (SQLite hébergé) sur **Netlify**. Zéro gestion serveur, zéro infrastructure externe (sauf Discord).

Base de contenu : deck commun de questions de culture générale, partagé par tous les joueurs, réparti en **6 étages**. Le deck porte **3 niveaux de difficulté**, chacun réparti sur 2 étages : difficulté 1 → étages 1-2, difficulté 2 → étages 3-4, difficulté 3 → étages 5-6. Le volume du deck n'est pas fixé — la mécanique ne dépend d'aucun nombre de questions.

## Glossaire

Les specs sont en français, le code en anglais. La colonne **Nom en code** est la
seule traduction autorisée : un terme du domaine ne s'invente pas au moment de coder,
il se lit ici. Tout nouveau terme s'ajoute d'abord à ce tableau.

| Terme | Nom en code | Définition |
|-------|-------------|------------|
| **Étage** | `floor` | Un des 6 groupes de questions traversés dans l'ordre. Étages 1-2 = difficulté 1, 3-4 = difficulté 2, 5-6 = difficulté 3. Les deux étages d'une même difficulté sont équivalents. |
| **Difficulté** | `difficulty` | Niveau de difficulté du deck, de 1 (le plus facile) à 3. Dérivée de l'étage (`ceil(floor / 2)`), jamais stockée séparément. |
| **Ascension** | `ascent` | Progression du joueur à travers les questions de l'étage courant. |
| **Tirage** | `shuffle` | Ordre de découverte personnel des questions d'un étage. Chaque question suivante est tirée au hasard parmi celles que le joueur n'a pas encore vues dans l'étage — l'ordre est donc propre à chaque joueur, sans être pré-calculé. |
| **Vies** | `lives` | 3 unités perdues sur erreur, restaurées à chaque cycle. |
| **Pool Échecs** | `missedPool` | Liste des questions ratées de l'étage courant, en attente de rattrapage. |
| **Rattrapage** | `recovery` | Mécanisme de retest de 5 questions du Pool Échecs pour se débloquer après un blocage. |
| **Blocage** | `cooldown` | Attente forcée après la perte de la 3e vie : 12h, puis 4h par rattrapage manqué. |
| **Contestation** | `dispute` | Arbitrage par l'admin d'une réponse jugée fausse à tort. |
| **Whitelist** | `whitelist` | Discord IDs autorisés à s'inscrire, alimentée manuellement. |
| **Énoncé** | `statement` | Le texte de la question posée au joueur. |
| **Réponses acceptées** | `acceptedAnswers` | Toutes les formulations qui valident la question. Aucune n'est privilégiée : la tolérance typo s'applique à chacune. L'admin en ajoute une quand il accepte une contestation. |
| **Réponse affichée** | `answerLabel` | La formulation montrée au joueur quand il échoue. Souvent plus riche que ce qu'on lui demande de saisir (« FLEMING (Alexander) » pour une réponse acceptée « Fleming »). Ne sert jamais au matching. |
| **Catégorie** | `category` | Thème d'une question (Histoire, Musique, Sport…). Une question en porte zéro, une ou plusieurs. |

## Documents

- [`mecanique.md`](./mecanique.md) — Mécanique de jeu : ascension, cycle de blocage, Pool Échecs, rattrapage, fin d'étage, fin de partie.
- [`validation.md`](./validation.md) — Validation des réponses : tolérance aux fautes, variantes, contestation.
- [`anti-triche.md`](./anti-triche.md) — Timer, perte de focus, whitelist Discord, profil admin triche.
- [`admin.md`](./admin.md) — Administration : flag admin, dashboard, CRUD questions, import.
- [`architecture.md`](./architecture.md) — Stack technique, données, authentification, hébergement.

## Points encore à spécifier

- Interface et profil joueur (à préciser dans les UIs).

---
*Document de travail — v2 consolidée après grilling.*
