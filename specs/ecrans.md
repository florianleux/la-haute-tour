# Écrans

## Principes

- **Une barre d'icônes, pas un menu.** En haut à droite de chaque écran, la même barre, toujours présente : une tour vers le jeu, une baguette vers les Sorts, un buste vers le profil, et un bouclier vers l'administration pour l'admin seulement — les autres ne le voient pas du tout. Rien d'autre n'est permanent : pas de bandeau, pas de menu déroulant, et chaque écran porte pour le reste les seules actions qui ont un sens à cet endroit.
- **Chaque icône a trois états.** **Lien** quand la page est atteignable d'ici. **Actif** quand c'est la page qu'on regarde : elle est mise en avant et ne mène nulle part, comme dans un en-tête ordinaire — on ne clique pas vers là où on est déjà. **Désactivé** quand on ne peut pas y aller maintenant : éteinte et inerte. La barre ne disparaît jamais ; ce sont ses liens qui s'éteignent.
- **Le jeu est la page d'accueil.** `/` est la partie : c'est là qu'on atterrit en se connectant, là qu'on retombe en rechargeant, et il n'existe pas de vestibule devant. Un joueur qui n'a jamais commencé y trouve l'invitation à le faire ; les autres, leur phase. Rien à traverser pour jouer.
- **Une seule route de jeu.** Tout ce qui se joue — question, verdict, attente, rattrapage, palier, fin — vit sur cette page, qui affiche la phase renvoyée par le serveur. Le joueur ne choisit jamais son écran et ne peut pas en atteindre un par l'URL.
- **Étage et vies ne s'affichent que pendant le jeu**, là où ils bougent. Nulle part ailleurs.
- **Pendant une question, aucune action à part répondre.** Pas de lien, pas de sortie : rien à surveiller. Toute la barre est donc désactivée **tant qu'un chrono tourne** — en ascension comme en rattrapage — et seulement là. C'est la frontière que le jeu connaît déjà, celle de la perte de focus : pendant une question, partir soumettrait la réponse en l'état, donc le lien désactivé retire un piège plutôt qu'il n'enferme. Sur le verdict, l'attente ou le palier, rien ne tourne et la barre redevient vivante.
- **Une attente montre la forme de ce qui arrive**, pas le mot « chargement » : les fiches joueurs et les questions gardent leur silhouette pendant la lecture, donc rien ne saute quand elle revient. Une relecture qui suit une action, elle, laisse la liste en place — c'est le bouton cliqué qui porte le loader, à la place de son libellé et sans changer de largeur.
- **Une seule exception à « une seule route de jeu » : les Sorts.** Ils ne se lancent qu'en attente, où aucun chrono ne tourne et où il n'y a donc rien à détourner. La baguette est donc **désactivée hors attente** — visible partout, cliquable là seulement. Elle annonce ainsi une page qui existe, à un moment qui viendra.

## Inventaire

| Écran | Accès | Ouvert sans compte |
|---|---|---|
| Connexion | `/login` | oui |
| Accès refusé | `/refus` | oui |
| Jeu | `/` — 5 phases, page d'accueil | non |
| Profil | `/profil` | non |
| Sorts | `/sorts` — en attente seulement | non |
| Dashboard admin | `/admin` | non, réservé admin |
| File de contestation | `/admin` | non, réservé admin |
| Questions | `/admin` | non, réservé admin |
| Whitelist | `/admin` | non, réservé admin |

Toute page non listée comme ouverte redirige vers la connexion.

## Connexion et accès refusé

- **Connexion** : titre du jeu, une phrase disant que l'accès se fait par Discord sur invitation, un bouton de connexion Discord. Un joueur déjà connecté est renvoyé vers le jeu.
- **Accès refusé** : le compte Discord n'est pas sur la whitelist, aucun compte n'a été créé, il faut demander l'accès à l'administrateur. Un retour vers la connexion.

## Profil

Pseudo Discord, date d'inscription, **parcours**, bouton de déconnexion. Le retour au jeu se fait par la barre, comme partout ailleurs.

Le parcours dit le chemin déjà fait, jamais l'état de l'instant :

- **Étage** atteint sur les 6, et questions vues dans cet étage sur ce qu'il contient.
- **Questions vues** depuis le début, **bonnes réponses**, et le taux qui en découle.
- **Meilleure série** de bonnes réponses d'affilée. Elle traverse les étages : un palier n'interrompt rien.
- **Tentatives achevées**, avec la **plus longue** et la **plus courte**.

Une tentative se mesure en **questions vues**, l'unité de progression du jeu, et non en heures — une soirée entrecoupée de pauses ne vaut pas une longue ascension. Elle ne s'inscrit qu'une fois **achevée**, c'est-à-dire au moment où la suivante s'ouvre : entre la perte de la dernière vie et la reprise, une contestation acceptée peut rendre une vie et faire repartir la même tentative. Les tentatives closes avant que le profil existe ne sont pas reconstituées : le décompte part de zéro.

S'y ajoute, en une phrase, le nombre de **contestations acceptées** sur celles ouvertes.

Ce que le profil ne montre toujours pas : ni phase, ni vies, ni attente — l'état de l'instant vit dans le jeu — et **jamais** de donnée de triche, les flags étant réservés à l'administration.

## Jeu

Une page, cinq phases. Le serveur décide, la page affiche.

### `ascent` — question

Étage et vies, l'énoncé, un champ de réponse libre, et le **compte à rebours**. Le décompte n'est qu'un affichage de l'échéance fixée par le serveur ; le modifier ne change rien à l'arbitrage.

Une **icône par effet actif**, sur les questions concernées. Un joueur dont le timer démarre à 30 s trois jours après avoir lu l'avertissement doit pouvoir comprendre pourquoi plutôt que de croire à un bug. C'est un état, comme les vies — pas une action.

Un **indicateur de question loot** avant de répondre, quand le passage en est une.

Aucune autre action que répondre.

**Entrée envoie la réponse, puis enchaîne.** Sur le verdict, le palier, la fin de rattrapage, la même touche passe à la suite : on joue au clavier sans en sortir. Elle est rendue à l'élément qui a le focus quand il en fait déjà quelque chose — un champ de saisie, un bouton, un lien —, sinon un seul appui déclencherait deux choses.

### `ascent` — verdict

Après résolution, l'écran montre le résultat : juste ou faux, la **réponse affichée** de la question, la réponse saisie par le joueur, et la vie perdue le cas échéant.

Sur une question loot réussie, un **coffre** — que le joueur doit ouvrir par un clic distinct de « suivant » avant de pouvoir continuer. Son résultat, sort obtenu ou Mimic, s'affiche en bas de l'écran. Rien ne force l'ouverture : le joueur qui ne clique jamais reste là, et ne joue plus.

Deux actions : **contester** cette question, et passer à la suivante. Cet écran n'est pas chronométré.

Le verdict est conservé par le serveur : recharger, ou revenir depuis un autre appareil, le retrouve intact. La bonne réponse ne peut pas être escamotée par un rafraîchissement.

### `cooldown` — attente

- Le **temps restant** avant reprise ou rattrapage.
- Le **Pool Échecs de l'étage**, avec les réponses : c'est une fiche de révision, pas une punition. Il n'y a ni classement ni score à défendre ; réviser pendant l'attente fait exactement ce que le jeu cherche à produire, et c'est ce qui rend le seuil de sortie du pool atteignable.
  - Affichage par pages de dix, chargées à la demande en faisant défiler.
  - Trié par **dernier échec**, du plus récent au plus ancien par défaut, inversable. Une question ratée à nouveau en rattrapage remonte en tête : ce qui résiste est ce qu'on veut relire.
- Les **erreurs de la tentative** qui vient de s'achever, chacune avec un bouton de contestation, sauf celles déjà contestées.
- Le **récapitulatif des effets** qui attendent la prochaine tentative — positifs et négatifs, chacun avec le nom de son lanceur — et ceux qui frappent l'attente elle-même. Tous les effets s'ancrant sur la tentative suivante, le joueur a tout lu avant de reprendre.
- L'accès à la page **Sorts**, par l'icône baguette.

### `recovery` — rattrapage

Même présentation que l'ascension : une question à la fois, un champ libre, un compte à rebours, puis un verdict avec la bonne réponse. Toutes les questions se jouent, même une fois le seuil de réussite atteint.

Le résultat s'annonce à la fin : vies restaurées et reprise, ou nouvelle attente puis nouveau rattrapage.

### `floorEnd` — palier

L'étage est terminé. Le verdict de la dernière question s'y lit — c'est cet écran qui suit la question, l'étage n'ayant plus rien à servir — puis une action pour continuer vers le suivant. Version sobre ; le reste du contenu est encore à spécifier.

### `gameOver` — fin de partie

Message de félicitations, précédé du verdict de la dernière question. Phase terminale, sans classement : plus rien n'avance, et la barre est la seule sortie.

## Sorts

Atteignable **en attente seulement**, par l'icône baguette. Trois choses :

- L'**inventaire** — ce que le joueur possède, avec les doublons.
- Le **lancer** — un sort, une catégorie de cible (soi, allié, ennemi). La cible réelle n'est pas annoncée avant : le tirage est pondéré mais imprévisible. Elle l'est après. Un même sort ne se lance qu'une fois par attente.
- Le **journal** — les sorts reçus et lancés, horodatés, nominatifs des deux côtés. C'est là que le lanceur apprend qui il a touché.

Hors attente, la baguette est désactivée et la page n'est pas atteignable, URL comprise : l'inventaire n'est donc pas consultable. Le joueur voit passer son objet sur l'écran verdict, puis le retrouve à sa prochaine mort.

## Écrans d'administration

Réservés au flag admin, sous `/admin`. Voir [`admin.md`](./admin.md).

- **Dashboard** : les contestations en attente, visibles dès la connexion.
- **File de contestation** : pour chaque contestation, la réponse du joueur face aux réponses acceptées de la question ; accepter ou rejeter.
- **Questions** : liste filtrable par étage, création, édition, suppression, avec leurs réponses acceptées.
- **Whitelist** : liste des Discord IDs autorisés, et ajout.

## Ce qu'aucun écran joueur ne montre

- **Aucun classement**, nulle part. Le serveur classe bien les joueurs par progression pour pondérer le tirage des Sorts, mais ce classement ne sort jamais du serveur et n'est montré à personne.
- **Aucun inventaire hors attente** : la page Sorts n'existe que pendant l'attente.
- **Aucune cible avant le lancer** : le joueur choisit une catégorie, jamais une personne.
- **Aucun compteur de triche** : les flags existent, ils sont réservés à l'administration.
- **Aucun état de jeu sur le profil** : il y montre son parcours, pas sa phase, ses vies ni son attente — celles-là vivent dans le jeu.
- **Aucune question à venir** : rien n'annonce jamais l'énoncé suivant avant qu'il soit servi.
