# Écrans

## Principes

- **Trois icônes, pas un menu.** En haut à droite de chaque écran : une tour vers le jeu, un bouclier vers l'administration — pour l'admin seulement —, un buste vers le profil. Rien d'autre n'est permanent : pas de bandeau, pas de menu déroulant, et chaque écran porte pour le reste les seules actions qui ont un sens à cet endroit.
- **L'accueil reste le hub.** C'est la page d'atterrissage par défaut, celle qu'on retrouve en rechargeant, et le point de départ que suit un joueur qui ne cherche rien de précis. Les trois icônes ne le remplacent pas : elles évitent d'y repasser pour aller ailleurs.
- **Une seule route de jeu.** Tout ce qui se joue — question, verdict, attente, rattrapage, palier, fin — vit sur la même page, qui affiche la phase renvoyée par le serveur. Le joueur ne choisit jamais son écran et ne peut pas en atteindre un par l'URL.
- **Étage et vies s'affichent à deux endroits seulement** : sur l'accueil, pour savoir où l'on en est avant de reprendre, et pendant le jeu, là où ils bougent. Nulle part ailleurs.
- **Pendant une question, aucune action à part répondre.** Pas de lien, pas de sortie : rien à surveiller. Les trois icônes disparaissent sur `/jouer`, phases d'attente comprises.
- **Une attente montre la forme de ce qui arrive**, pas le mot « chargement » : les fiches joueurs et les questions gardent leur silhouette pendant la lecture, donc rien ne saute quand elle revient. Une relecture qui suit une action, elle, laisse la liste en place — c'est le bouton cliqué qui porte le loader, à la place de son libellé et sans changer de largeur.

## Inventaire

| Écran | Accès | Ouvert sans compte |
|---|---|---|
| Connexion | `/login` | oui |
| Accès refusé | `/refus` | oui |
| Accueil | `/` | non |
| Profil | `/profil` | non |
| Jeu | `/jouer` — 5 phases | non |
| Dashboard admin | `/admin` | non, réservé admin |
| File de contestation | `/admin` | non, réservé admin |
| Questions | `/admin` | non, réservé admin |
| Whitelist | `/admin` | non, réservé admin |

Toute page non listée comme ouverte redirige vers la connexion.

## Connexion et accès refusé

- **Connexion** : titre du jeu, une phrase disant que l'accès se fait par Discord sur invitation, un bouton de connexion Discord. Un joueur déjà connecté est renvoyé vers l'accueil.
- **Accès refusé** : le compte Discord n'est pas sur la whitelist, aucun compte n'a été créé, il faut demander l'accès à l'administrateur. Un retour vers la connexion.

## Accueil

Le joueur y voit son pseudo, son **étage** et ses **vies**, une action principale, et un lien vers son profil.

L'action principale dépend de la phase renvoyée par le serveur — l'accueil lit le même état de jeu que la page de jeu, sans jamais rien réserver :

| Phase | Action proposée |
|---|---|
| jamais commencé | Commencer l'ascension |
| `ascent` | Reprendre l'ascension |
| `cooldown` | Voir l'attente, avec le temps restant |
| `recovery` | Aller au rattrapage |
| `floorEnd` | Continuer vers l'étage suivant |
| `gameOver` | Revoir la fin |

Toutes mènent à la page de jeu. Le libellé annonce ce qu'on va y trouver — un joueur en attente n'a pas à cliquer pour l'apprendre.

## Profil

Pseudo Discord, date d'inscription, **parcours**, bouton de déconnexion, retour à l'accueil.

Le parcours dit le chemin déjà fait, jamais l'état de l'instant :

- **Étage** atteint sur les 6, et questions vues dans cet étage sur ce qu'il contient.
- **Questions vues** depuis le début, **bonnes réponses**, et le taux qui en découle.
- **Meilleure série** de bonnes réponses d'affilée. Elle traverse les étages : un palier n'interrompt rien.
- **Tentatives achevées**, avec la **plus longue** et la **plus courte**.

Une tentative se mesure en **questions vues**, l'unité de progression du jeu, et non en heures — une soirée entrecoupée de pauses ne vaut pas une longue ascension. Elle ne s'inscrit qu'une fois **achevée**, c'est-à-dire au moment où la suivante s'ouvre : entre la perte de la dernière vie et la reprise, une contestation acceptée peut rendre une vie et faire repartir la même tentative. Les tentatives closes avant que le profil existe ne sont pas reconstituées : le décompte part de zéro.

S'y ajoute, en une phrase, le nombre de **contestations acceptées** sur celles ouvertes.

Ce que le profil ne montre toujours pas : ni phase, ni vies, ni attente — l'état de l'instant vit sur l'accueil et dans le jeu — et **jamais** de donnée de triche, les flags étant réservés à l'administration.

## Jeu

Une page, cinq phases. Le serveur décide, la page affiche.

### `ascent` — question

Étage et vies, l'énoncé, un champ de réponse libre, et le **compte à rebours**. Le décompte n'est qu'un affichage de l'échéance fixée par le serveur ; le modifier ne change rien à l'arbitrage.

Aucune autre action que répondre.

**Entrée envoie la réponse, puis enchaîne.** Sur le verdict, le palier, la fin de rattrapage, la même touche passe à la suite : on joue au clavier sans en sortir. Elle est rendue à l'élément qui a le focus quand il en fait déjà quelque chose — un champ de saisie, un bouton, un lien —, sinon un seul appui déclencherait deux choses.

### `ascent` — verdict

Après résolution, l'écran montre le résultat : juste ou faux, la **réponse affichée** de la question, la réponse saisie par le joueur, et la vie perdue le cas échéant.

Deux actions : **contester** cette question, et passer à la suivante. Cet écran n'est pas chronométré.

Le verdict est conservé par le serveur : recharger, ou revenir depuis un autre appareil, le retrouve intact. La bonne réponse ne peut pas être escamotée par un rafraîchissement.

### `cooldown` — attente

- Le **temps restant** avant reprise ou rattrapage.
- Le **Pool Échecs de l'étage**, avec les réponses : c'est une fiche de révision, pas une punition. Le jeu est solo et sans classement ; réviser pendant l'attente fait exactement ce que le jeu cherche à produire, et c'est ce qui rend le seuil de sortie du pool atteignable.
  - Affichage par pages de dix, chargées à la demande en faisant défiler.
  - Trié par **dernier échec**, du plus récent au plus ancien par défaut, inversable. Une question ratée à nouveau en rattrapage remonte en tête : ce qui résiste est ce qu'on veut relire.
- Les **erreurs de la tentative** qui vient de s'achever, chacune avec un bouton de contestation, sauf celles déjà contestées.

### `recovery` — rattrapage

Même présentation que l'ascension : une question à la fois, un champ libre, un compte à rebours, puis un verdict avec la bonne réponse. Toutes les questions se jouent, même une fois le seuil de réussite atteint.

Le résultat s'annonce à la fin : vies restaurées et reprise, ou nouvelle attente puis nouveau rattrapage.

### `floorEnd` — palier

L'étage est terminé. Le verdict de la dernière question s'y lit — c'est cet écran qui suit la question, l'étage n'ayant plus rien à servir — puis une action pour continuer vers le suivant. Version sobre ; le reste du contenu est encore à spécifier.

### `gameOver` — fin de partie

Message de félicitations, précédé du verdict de la dernière question. Phase terminale, sans classement : la seule sortie est l'accueil.

## Écrans d'administration

Réservés au flag admin, sous `/admin`. Voir [`admin.md`](./admin.md).

- **Dashboard** : les contestations en attente, visibles dès la connexion.
- **File de contestation** : pour chaque contestation, la réponse du joueur face aux réponses acceptées de la question ; accepter ou rejeter.
- **Questions** : liste filtrable par étage, création, édition, suppression, avec leurs réponses acceptées.
- **Whitelist** : liste des Discord IDs autorisés, et ajout.

## Ce qu'aucun écran joueur ne montre

- **Aucun classement**, nulle part — le jeu n'en a pas.
- **Aucun compteur de triche** : les flags existent, ils sont réservés à l'administration.
- **Aucun état de jeu sur le profil** : il y montre son parcours, pas sa phase, ses vies ni son attente — celles-là vivent sur l'accueil et dans le jeu.
- **Aucune question à venir** : l'accueil n'annonce jamais l'énoncé suivant.
