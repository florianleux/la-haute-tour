# Architecture technique

## Stack

- **Nuxt 3** (Vue 3 + Nitro server routes) — un seul codebase TypeScript, un seul process.
- **Turso** (SQLite hébergé, libSQL) — base de données SQL, free tier généreux.
- **Netlify** — hébergement serverless, déploiement par git push.
- **Discord OAuth2** — authentification uniquement.

Zéro gestion serveur, zéro infrastructure externe hors Discord et Turso.

## Authentification

- **Discord OAuth2** uniquement. Pas d'email/mot de passe, pas de magic link.
- On stocke le Discord ID, le pseudo (username Discord) et l'email s'il est disponible.
- Le pseudo est synchronisé au login si le pseudo Discord change.
- **Whitelist Discord** : seuls les Discord IDs whitelistés en base peuvent s'inscrire. Voir [`anti-triche.md`](./anti-triche.md).
- La session d'authentification est un cookie signé. C'est le seul emploi du mot « session » dans le projet.

## Données

### Question

- **Énoncé** — le texte posé au joueur.
- **Réponse affichée** — montrée sur échec, ne sert jamais au matching.
- **Réponses acceptées** — toutes les formulations qui valident la question.
- **Étage** (1 à 6) — la difficulté s'en dérive, elle n'est pas stockée.
- **Catégories** — zéro, une ou plusieurs.

Pas de source ni de référence au lancement. Ajoutable plus tard.

### État de jeu

Tout l'état vit en base, jamais côté client :

- **Vies** et **étage courant** du joueur.
- **Questions vues** — une entrée par question résolue en ascension, avec son verdict. C'est la progression.
- **Réservation** — la question servie et non encore résolue, avec son échéance. Au plus une par joueur.
- **Pool Échecs** — une entrée par question ratée, portant l'étage, un **compteur de réussites consécutives** et la **date du dernier échec**. Ce n'est pas une simple appartenance : c'est ce compteur qui décide de la sortie, et cette date qui ordonne l'écran d'attente.
- **Attente en cours** — l'échéance à partir de laquelle le joueur peut reprendre ou rattraper.
- **Contestations** — la question, la réponse du joueur, le statut d'arbitrage.
- **Flags de triche** — les soumissions déclenchées par une perte de focus.

### Import des questions

- **Script CLI** (Node.js) qui charge le deck directement en base. Un seul run, avant le lancement.
- **Format JSON** en entrée : un fichier pour le deck complet, chaque entrée portant énoncé, réponse, réponse affichée, variantes, catégories et difficulté.
- Le script fusionne réponse et variantes en réponses acceptées, et répartit chaque difficulté sur ses deux étages.
- Lignes invalides **ignorées**, jamais bloquantes : rapportées en fin de run avec les compteurs par étage.
- Pas d'UI d'import dans l'admin — le script suffit.

## Forme de l'API de jeu

L'état de jeu est servi par un seul endpoint de lecture, qui renvoie la **phase** courante et ce qu'elle contient. La liste des phases et leurs transitions sont définies dans [`mecanique.md`](./mecanique.md#machine-à-états) — ce document ne les redit pas.

Deux règles gouvernent cette API :

1. **La lecture n'a aucun effet.** Elle ne tire jamais de question, ne démarre aucun chrono. Elle rend la réservation vivante, ou résout une réservation expirée en échec, ou rend le verdict en attente. Un rendu serveur de Nuxt, un préchargement de lien ou un double montage en développement sont donc sans conséquence.
2. **Chaque action du joueur sert immédiatement la suite.** Commencer réserve la première question ; répondre résout et rend le verdict ; passer à la suivante résout le verdict et réserve la question suivante ; franchir un palier incrémente l'étage et réserve. Il n'existe donc jamais d'état « rien en cours » à combler par une lecture.

Une action portant sur une réservation déjà résolue est **ignorée** : l'API renvoie l'état courant, sans erreur. L'appareil qui l'a envoyée n'est pas fautif, il est périmé.

Les vies et l'étage affichés sur l'accueil viennent de ce même endpoint : il n'existe qu'une définition de « où en est le joueur ». L'endpoint d'identité ne sert qu'à l'identité.

## Multi-appareil

- Les appareils se synchronisent à la requête suivante. Pas de WebSocket, pas de verrou de session.
- Reprendre depuis un autre appareil fonctionne : la réservation attend, son échéance a couru.
- Jouer sur deux écrans simultanément n'est pas supporté — voir [`mecanique.md`](./mecanique.md#multi-appareil).

## Hébergement

- **Netlify** pour l'app, déploiement par git push.
- **Turso** pour la base. Le SQL est identique à un SQLite local ; le projet passe par Drizzle ORM des deux côtés.
- Pas de VPS, pas de gestion serveur, pas de SSL ni de Nginx à opérer.
