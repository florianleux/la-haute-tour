# Administration

## Qui est admin

- **Flag `is_admin` en base**, set manuellement (toi au lancement).
- Pas de système de rôles Discord pour l'instant. Plus tard, on peut ajouter un système de rôles serveur Discord.

## Interface admin

- **Route `/admin`** dans la même app Nuxt 3, protégée par le flag `is_admin`.
- Pas d'app séparée.

## Whitelist Discord

- Seuls les **Discord IDs whitelistés en base** peuvent s'inscrire.
- L'admin ajoute manuellement les Discord IDs autorisés (via `/admin` ou directement en base).
- Pas de whitelist → pas d'inscription possible.
- Voir [`anti-triche.md`](./anti-triche.md).

## File de contestation

- **Vue minimale** : pour chaque contestation, l'admin voit la réponse du joueur + les réponses acceptées de la question.
- **Actions** : accepter / rejeter.
- Accepter → la réponse est ajoutée aux réponses acceptées pour tous les joueurs + effet sur les vies du joueur (voir [`validation.md`](./validation.md)).

## Notification des contestations

- **Dashboard au login** : l'admin voit les contestations en attente sur `/admin`.
- Pas de webhook ni email pour l'instant. (Envisageable plus tard : webhook Discord, mais pas requis.)

## Gestion des questions

- **CRUD complet** : l'admin peut lire, éditer, créer, supprimer des questions et leurs réponses acceptées directement depuis `/admin`.
- **Pas d'UI d'import en masse** : le chargement du deck se fait via un **script CLI** qui écrit directement en base. Voir [`architecture.md`](./architecture.md).
- **Répartition en étages** : c'est le script d'import qui affecte chaque question à un étage, à partir de sa difficulté. L'admin peut éditer le contenu (questions, réponses acceptées) mais pas la structure en 6 étages.
