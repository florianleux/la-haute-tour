# La Tour — Spécification fonctionnelle

## Principe général

Jeu web de culture générale avec inscription Discord. Stack : **Nuxt 3** (Vue 3 + Nitro) + **Turso** (SQLite hébergé) sur **Netlify**. Zéro gestion serveur, zéro infrastructure externe (sauf Discord).

Base de contenu : deck commun de **6000 questions** de culture générale, partagé par tous les joueurs, réparti en **6 étages** de 1000 questions par niveau de difficulté (étage 1 = le plus facile, étage 6 = le plus difficile).

## Glossaire

| Terme | Définition |
|-------|------------|
| **Étage** | Groupe de 1000 questions par niveau de difficulté. Étage 1 = le plus facile, étage 6 = le plus difficile (sommet). |
| **Ascension** | Progression du joueur à travers les questions de l'étage courant. |
| **Tirage** | Ordre aléatoire personnel des 1000 questions d'un étage, propre à chaque joueur, généré à l'entrée dans l'étage. |
| **Vies** | 3 unités perdues sur erreur, restaurées à chaque cycle. |
| **Pool Échecs** | Liste des questions ratées de l'étage courant, en attente de rattrapage. |
| **Rattrapage** | Mécanisme de retest de 5 questions du Pool Échecs pour se débloquer après un blocage. |
| **Contestation** | Arbitrage par l'admin d'une réponse jugée fausse à tort. |

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
