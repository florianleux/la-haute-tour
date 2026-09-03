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

- `statement` (texte) — l'énoncé de la question.
- `answerLabel` (texte) — la réponse affichée au joueur sur échec. Ne sert pas au matching.
- `acceptedAnswers` (tableau de textes) — toutes les formulations qui valident la question.
- `floor` (entier 1-6) — l'étage auquel appartient la question. La difficulté s'en dérive (`ceil(floor / 2)`), elle n'est pas stockée.
- `categories` (relation) — thèmes de la question, zéro ou plusieurs.

Pas de source/référence au lancement. Ajoutable plus tard.

### Import des questions

- **Script CLI** (Node.js) qui charge le deck directement en base. Un seul run, avant le lancement.
- **Format JSON** en entrée : `[{ "statement", "answer", "answerLabel", "variants": [...], "categories": [...], "difficulty": 1|2|3 }, ...]` — le deck complet dans un fichier, pas un fichier par étage.
- Le script fusionne `answer` + `variants` en réponses acceptées, et répartit chaque difficulté sur ses deux étages.
- Lignes invalides **ignorées**, jamais bloquantes : le script les rapporte en fin de run avec les compteurs par étage.
- Pas d'UI d'import dans l'admin — le script suffit.

## Hébergement

- **Netlify** pour l'app (déploiement git push).
- **Turso** pour la base (SQLite hébergé, free tier). Le code SQL est inchangé par rapport à un SQLite local — on utilise Drizzle ORM.
- Pas de VPS, pas de gestion serveur, pas de SSL/Nginx.

## État de jeu (server-side)

- L'état du joueur (étage courant, questions déjà vues, vies, Pool Échecs) est **stocké en base**, pas en session client.
- Chaque request lit l'état courant. Pas de gestion de sessions WebSocket.
- Multi-appareil : les appareils se sync au prochain request. Pas de verrouillage de session.
