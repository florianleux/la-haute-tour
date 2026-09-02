# La Haute Tour — Spécification fonctionnelle

## Principe général

Jeu web de culture générale avec inscription Discord. Stack : **Nuxt 3** (Vue 3 + Nitro) + **Turso** (SQLite hébergé) sur **Netlify**. Zéro gestion serveur, zéro infrastructure externe (sauf Discord).

Base de contenu : deck commun de **6000 questions** de culture générale, partagé par tous les joueurs, réparti en **6 étages** de 1000 questions par niveau de difficulté (étage 1 = le plus facile, étage 6 = le plus difficile).

## Glossaire

Les specs sont en français, le code en anglais. La colonne **Nom en code** est la
seule traduction autorisée : un terme du domaine ne s'invente pas au moment de coder,
il se lit ici. Tout nouveau terme s'ajoute d'abord à ce tableau.

| Terme | Nom en code | Définition |
|-------|-------------|------------|
| **Étage** | `floor` | Groupe de 1000 questions par niveau de difficulté. Étage 1 = le plus facile, étage 6 = le plus difficile (sommet). |
| **Ascension** | `ascent` | Progression du joueur à travers les questions de l'étage courant. |
| **Tirage** | `shuffle` | Ordre aléatoire personnel des 1000 questions d'un étage, propre à chaque joueur, généré à l'entrée dans l'étage. |
| **Vies** | `lives` | 3 unités perdues sur erreur, restaurées à chaque cycle. |
| **Pool Échecs** | `missedPool` | Liste des questions ratées de l'étage courant, en attente de rattrapage. |
| **Rattrapage** | `recovery` | Mécanisme de retest de 5 questions du Pool Échecs pour se débloquer après un blocage. |
| **Blocage** | `cooldown` | Attente forcée après la perte de la 3e vie : 12h, puis 4h par rattrapage manqué. |
| **Contestation** | `dispute` | Arbitrage par l'admin d'une réponse jugée fausse à tort. |
| **Whitelist** | `whitelist` | Discord IDs autorisés à s'inscrire, alimentée manuellement. |
| **Énoncé** | `statement` | Le texte de la question posée au joueur. |
| **Réponse** | `answer` | La réponse stricte attendue. |
| **Variantes** | `variants` | Réponses alternatives acceptées à 100%. |

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
