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

## Joueurs test

Le PvP ne se teste pas seul : un sort se lance sur quelqu'un, et il faut voir ce
que la cible reçoit. L'admin dispose donc de **joueurs test** — des joueurs
créés depuis l'interface, sans compte Discord derrière, qu'il peut incarner.

- **Autant qu'il en faut**, créés et supprimés depuis un onglet dédié. Supprimer
  un joueur test efface sa partie avec lui.
- **Un monde scellé** : un vrai joueur ne peut jamais cibler ni être ciblé par
  un joueur test, et réciproquement. Les joueurs test n'apparaissent ni dans les
  fiches joueurs, ni dans la file de contestation, ni dans les flags de triche —
  ces écrans servent à arbitrer de vraies parties. Voir [`bonus.md`](./bonus.md).
- **Ils jouent une vraie partie** : mêmes règles, mêmes phases, mêmes écrans.
  Rien n'est simulé, sans quoi ce qu'on y observe ne prouverait rien.

### Incarnation

Un sélecteur, à gauche de la barre d'icônes et visible du seul admin, dit qui
joue : lui-même, ou l'un des joueurs test. Il est présent sur toutes les pages,
et se teinte pendant l'incarnation — on ne doit jamais se demander de qui on
regarde la partie.

- **Le jeu prend l'admin pour le joueur test** : il n'est plus admin à ses yeux,
  subit la maintenance comme n'importe qui, et tout ce qu'il joue est écrit sous
  l'identité du joueur test. C'est ce qui rend le point de vue fidèle.
- **Les pouvoirs d'admin restent au vrai compte** : l'accès à `/admin` et le
  sélecteur ne disparaissent pas, sinon l'incarnation serait sans retour.
- **Réservée aux joueurs test.** Incarner un vrai joueur reviendrait à jouer sa
  partie à sa place — une question servie lui serait comptée, une erreur lui
  coûterait une vie, et il n'en saurait rien. Un vrai joueur bloqué se répare
  par sa fiche joueur, qui existe pour ça.

### Réglages d'un joueur test

Des gestes nommés, jamais des champs bruts : chacun laisse la base dans un état
que le jeu sait produire de lui-même.

- **Donner un sort**, choisi dans le catalogue.
- **Avancer de N questions**, justes ou fausses — les fausses remplissent le
  Pool Échecs, comme en jeu. C'est ce qui permet d'atteindre une question loot
  ou un palier sans jouer une heure.
- **Enlever N questions vues**, pour revenir en arrière dans l'étage.
- **Mettre en attente**, et **passer l'attente**.
- **Rendre une vie**, comme pour un vrai joueur.
- **Repartir de zéro** : la partie du joueur test est effacée, il retrouve
  l'étage 1 et ses vies pleines.

## Gestion des questions

- **CRUD complet** : lire, créer, éditer, supprimer des questions et leurs réponses acceptées depuis `/admin`, avec filtrage par étage.
- **Pas d'UI d'import en masse** : le chargement du deck se fait via un **script CLI** qui écrit directement en base. Voir [`architecture.md`](./architecture.md).
- **Répartition en étages** : c'est le script d'import qui affecte chaque question à un étage, à partir de sa difficulté. L'admin édite le contenu, pas la structure en 6 étages.

## Réglages du jeu

Vies, timers, taille du rattrapage, seuils, durées d'attente ne sont **pas** administrables depuis l'interface : ils vivent dans le code, en un seul endroit, et se modifient par déploiement. Voir [`mecanique.md`](./mecanique.md#règles-chiffrées).

## Maintenance

Un interrupteur, sous `/admin`, qui **ferme le jeu à tous les joueurs sauf aux
admins**. Il sert à travailler sur la partie — importer un deck, corriger des
données — sans qu'une partie avance sous les mains.

- Les joueurs **se connectent normalement** : rien n'est coupé à l'authentification.
- Ce qui se ferme est la porte qui ouvre la suite : **plus aucune question n'est
  servie**. Ni la suivante en ascension, ni le démarrage d'un rattrapage, ni la
  première question d'un nouvel étage.
- **Ce qui est commencé se finit.** Un joueur qui tient une question la répond, lit
  son verdict et ouvre son coffre : couper là lui volerait une réponse qu'il a
  payée d'un timer, et la bonne réponse ne doit jamais être escamotée (voir
  [`ecrans.md`](./ecrans.md#ascent--verdict)). C'est au clic suivant que la
  maintenance apparaît.
- Tous les autres — en attente, en rattrapage prêt à démarrer, ou n'ayant jamais
  commencé — voient l'écran de maintenance dès leur arrivée.
- **Les attentes ne sont pas suspendues.** Le délai continue de courir pendant la
  maintenance ; il s'achève, simplement le joueur ne peut rien en faire tant que le
  jeu est fermé. Suspendre demanderait de décaler chaque échéance à la réouverture,
  et de décider ce qu'on fait de celles déjà échues — pour un gain nul, l'attente
  étant faite pour s'écouler sans le joueur.
- L'admin, lui, joue normalement : c'est tout l'intérêt de l'interrupteur.
