# Administration

## Qui est admin

- **Flag en base**, positionné manuellement (toi au lancement).
- Pas de système de rôles Discord pour l'instant. Envisageable plus tard, via les rôles d'un serveur Discord.

## Interface admin

- **Route `/admin`** dans la même app Nuxt 3, protégée par le flag admin.
- Pas d'app séparée.

## Whitelist Discord

- Seuls les **Discord IDs whitelistés en base** peuvent s'inscrire.
- L'admin liste les Discord IDs autorisés et en ajoute, depuis `/admin` ou directement en base.
- Pas de whitelist → pas d'inscription possible.
- Voir [`anti-triche.md`](./anti-triche.md).

## File de contestation

- **Vue minimale** : pour chaque contestation, la réponse du joueur face aux réponses acceptées de la question.
- **Actions** : accepter ou rejeter.
- Accepter ajoute la réponse aux réponses acceptées pour tous les joueurs, corrige le verdict du joueur, sort la question de son Pool Échecs et lui rend une vie. Voir [`validation.md`](./validation.md) pour le détail des effets selon le moment.
- Les réponses vides n'arrivent jamais dans la file : elles ne sont pas contestables.

## Notification des contestations

- **Dashboard à la connexion** : l'admin voit les contestations en attente sur `/admin`.
- Pas de webhook ni d'email pour l'instant. Un webhook Discord reste envisageable, il n'est pas requis.

## Flags de triche

- L'admin voit les soumissions déclenchées par une perte de focus, joueur par joueur.
- Ces flags ne sont exposés nulle part côté joueur.
- Voir [`anti-triche.md`](./anti-triche.md).

## Gestion des joueurs

- **Fiches joueurs** : une par joueur, avec son avatar Discord, son pseudo, son étage et sa progression dedans (`4/8 vues`), sa phase, ses vies, le délai restant s'il attend, et le nombre de ses contestations en attente.
- **Lecture sans effet** : ouvrir l'onglet ne fait avancer aucune partie — ni réservation résolue, ni attente clôturée.
- **Deux gestes** : *passer l'attente* et *rendre une vie*. Ils appliquent exactement ce que le jeu ferait de lui-même — l'attente échue mène au rattrapage (ou à une reprise si le Pool Échecs est trop petit), la vie rendue relance la même tentative. Voir [`mecanique.md`](./mecanique.md) et [`validation.md`](./validation.md).
- L'avatar est le hash renvoyé par Discord à la connexion, resynchronisé à chaque login. Faute de hash, l'avatar par défaut du compte.

## Gestion des questions

- **CRUD complet** : lire, créer, éditer, supprimer des questions et leurs réponses acceptées depuis `/admin`, avec filtrage par étage.
- **Pas d'UI d'import en masse** : le chargement du deck se fait via un **script CLI** qui écrit directement en base. Voir [`architecture.md`](./architecture.md).
- **Répartition en étages** : c'est le script d'import qui affecte chaque question à un étage, à partir de sa difficulté. L'admin édite le contenu, pas la structure en 6 étages.

## Réglages du jeu

Vies, timers, taille du rattrapage, seuils, durées d'attente ne sont **pas** administrables depuis l'interface : ils vivent dans le code, en un seul endroit, et se modifient par déploiement. Voir [`mecanique.md`](./mecanique.md#règles-chiffrées).
