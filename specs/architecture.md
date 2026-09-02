# Architecture technique

## Stack

- **Nuxt 3** (Vue 3 + Nitro server routes) — un seul codebase TypeScript, un seul process.
- **Turso** (SQLite hébergé, libSQL) — base de données SQL, compatible SQLite, free tier généreux.
- **Netlify** — hébergement serverless, déploiement par git push.
- **Discord OAuth2** — authentification uniquement.

Zéro gestion serveur, zéro infrastructure externe (sauf Discord et Turso).

## Authentification

- **Discord OAuth2** uniquement. Pas d'email/mot de passe, pas de magic link.
- On stocke : `discord_id`, `username` (pseudo = username Discord), `email` (si disponible).
- Le pseudo est le **username Discord**. Sync au login si le pseudo Discord change.
- **Whitelist Discord** : seuls les Discord IDs whitelistés en base peuvent s'inscrire. Voir [`anti-triche.md`](./anti-triche.md).

## Données

### Structure d'une question

Champs minimaux :
- `enonce` (texte) — l'énoncé de la question.
- `reponse` (texte) — la réponse stricte.
- `variantes` (tableau de textes) — réponses acceptées à 100%.
- `etage` (entier 1-6) — l'étage auquel appartient la question.

Pas de thème, pas de sous-niveau de difficulté, pas de source/référence au lancement. Ajoutable plus tard.

### Import des questions

- **Script CLI** (Node.js) qui charge les questions directement en base.
- **Format JSON** : `[{ "enonce": "...", "reponse": "...", "variantes": [...] }, ...]` par étage.
- Pas d'UI d'import dans l'admin — le script suffit pour un import one-shot des 6 étages × 1000.

## Hébergement

- **Netlify** pour l'app (déploiement git push).
- **Turso** pour la base (SQLite hébergé, free tier). Le code SQL est inchangé par rapport à un SQLite local — on utilise Drizzle ORM.
- Pas de VPS, pas de gestion serveur, pas de SSL/Nginx.

## État de jeu (server-side)

- L'état du joueur (étage courant, position dans le tirage, vies, Pool Échecs) est **stocké en base**, pas en session client.
- Chaque request lit l'état courant. Pas de gestion de sessions WebSocket.
- Multi-appareil : les appareils se sync au prochain request. Pas de verrouillage de session.
