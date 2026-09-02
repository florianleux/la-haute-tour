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

- **Vue minimale** : pour chaque contestation, l'admin voit la réponse du joueur + la réponse stricte.
- **Actions** : accepter / rejeter.
- Accepter → la réponse est ajoutée aux variantes pour tous les joueurs + effet sur les vies du joueur (voir [`validation.md`](./validation.md)).

## Notification des contestations

- **Dashboard au login** : l'admin voit les contestations en attente sur `/admin`.
- Pas de webhook ni email pour l'instant. (Envisageable plus tard : webhook Discord, mais pas requis.)

## Gestion des questions

- **CRUD complet** : l'admin peut lire, éditer, créer, supprimer des questions et variantes directement depuis `/admin`.
- **Pas d'UI d'import en masse** : l'import des 6000 questions (6 étages × 1000) se fait via un **script CLI** qui charge les données directement en base. Voir [`architecture.md`](./architecture.md).
- **Création d'étages** : les étages sont créés via le script d'import. L'admin peut éditer le contenu des étages (questions, variantes) mais la structure (6 étages × 1000) est fixée par le script.
