# Objets bonus

Le jeu était solo. Il ne l'est plus : les Sorts permettent d'agir sur les autres
joueurs, en bien comme en mal. C'est le seul système du projet qui fasse
communiquer deux parties entre elles.

Deux systèmes distincts, non hiérarchiques :

- **Sorts** — le seul objet qu'on obtient en jouant. Se lancent sur soi, sur un allié ou sur un ennemi.
- **Talismans** — passifs équipés en continu. **Hors périmètre**, voir la fin du document.

Les équipes sont traitées à part, dans [`equipes.md`](./equipes.md).

## Sorts

### Où et quand

Un Sort **se lance uniquement au camp** — l'attente, puis le rattrapage tant
qu'il n'a pas commencé ; jamais en ascension, ni en rattrapage en cours, ni sur
le profil. L'écran d'attente porte un accès vers
une **page Sorts** dédiée, où le lancer se fait réellement.

**Aucun budget de lancers** : un joueur lance pendant son attente autant de
sorts qu'il en a en poche, deux fois le même y compris. Ce qui borne
l'empilement, c'est ce que la cible **porte** — deux effets négatifs au plus,
deux positifs au plus (voir [Limite d'effets négatifs](#limite-deffets-négatifs)
et [Limite d'effets positifs](#limite-deffets-positifs)). Un joueur peut donc
empiler deux Répit sur sa propre attente et la diviser par quatre, sans attendre
les équipes — pas trois.

L'exemplaire se consomme **côté serveur, en condition d'écriture** : deux
requêtes visant le même exemplaire ne peuvent pas le dépenser toutes les deux.
C'est le seul cas de double envoi qui compte — le clic répété sur **le même**
bouton — et le bouton s'éteint de toute façon pendant l'envoi.

Un sort lancé est **consommé**, qu'il produise un effet ou non.

### Catégories de cible

Le joueur choisit une **catégorie**, jamais une personne.

| Catégorie | Cible réelle | Face appliquée |
|---|---|---|
| **Soi** | le joueur lui-même | magie blanche |
| **Allié** | un membre de sa propre équipe | magie blanche |
| **Ennemi** | un membre de l'équipe adverse | magie noire |

Chaque sort n'a que **deux faces** : Soi et Allié partagent toujours la magie
blanche, Ennemi reçoit systématiquement le miroir noir.

### Tirage de la cible

Le tirage est **aléatoire mais pondéré par la progression**. Il ne désigne pas le
meilleur à coup sûr : il le rend simplement plus probable.

1. **Filtrer les éligibles.** Sont écartés les joueurs en `gameOver` (ils n'auront
   jamais de prochaine tentative, tout effet posé sur eux serait mort-né), ceux qui
   n'ont jamais commencé, et les **saturés** : pour la magie noire, ceux qui portent
   déjà deux effets négatifs, pour la magie blanche, ceux qui en portent deux
   positifs. Les **joueurs test** forment un monde scellé : un vrai
   lanceur ne les voit jamais, et eux ne voient que leurs semblables. Voir
   [`admin.md`](./admin.md#joueurs-test).
2. **Classer les éligibles** par progression croissante : étage, puis nombre de
   questions vues à l'étage, puis ancienneté du compte pour que l'ordre soit total
   et stable.
3. **Pondérer par le rang**, pas par la progression réelle. Le poids est la position
   dans ce classement, ce qui borne le biais quel que soit l'écart : le premier est
   *n* fois plus probable que le dernier, jamais cinquante fois.

Sur quatre cibles éligibles :

| Rang (du plus bas au plus haut) | Poids ennemi | Poids allié |
|---|---|---|
| 1er — le plus bas | 1 → 10 % | 4 → 40 % |
| 2e | 2 → 20 % | 3 → 30 % |
| 3e | 3 → 30 % | 2 → 20 % |
| 4e — le plus haut | 4 → 40 % | 1 → 10 % |

**On tape le plus fort, on soutient le plus faible.** Une seule fonction, lue dans
un sens ou dans l'autre.

Le filtre des saturés s'applique **avant** le classement : un joueur retiré du pool
ne pèse plus dans la distribution.

Si le pool éligible est **vide**, le sort part quand même et ne fait rien. Gaspillé,
même logique que Purge sur un Pool Échecs vide. Le lancer est bel et bien dépensé :
l'exemplaire quitte l'inventaire, et le journal porte la ligne — sans nom en
face.

Le tirage restant imprévisible, la cible n'est **pas affichée avant le lancer**.
Elle l'est après : le nom revient avec la réponse du lancer, sur l'écran d'où le
sort est parti, et reste au journal.

**Un sort lié à l'attente vise l'attente de la cible**, pas celle du lanceur — ce
ne sont plus les mêmes dès qu'on lance sur quelqu'un d'autre. Une cible qui n'en
vit pas n'a rien à lui donner à mordre : Répit sur un allié en pleine ascension
est gaspillé, comme sur un pool vide. Purge, elle, ne dépend pas de l'attente :
le Pool Échecs de la cible existe quelle que soit sa phase, et la question en
sort.

### Limite d'effets négatifs

- Un joueur ne porte jamais **plus de deux effets négatifs actifs**.
- « Porté » se lit exactement comme sur son écran : ce qui attend sa prochaine
  tentative, ce qui court sur celle en cours, et — pour les sorts liés à
  l'attente — ce qui vise l'attente où il se tient. Un effet mort avec la
  tentative qu'il a servie ne compte plus.
- Au-delà, il est **retiré du tirage**, silencieusement, côté serveur. Le lanceur n'a
  rien à voir : le ciblage étant déjà aléatoire, il n'y a aucune UI à prévoir.
- Tous les ennemis éligibles étant saturés, le pool est vide comme s'il n'y avait
  personne : le sort part, l'exemplaire est dépensé, et rien n'est touché.
- La limite se tient **au tirage**, donc par une lecture : deux lanceurs qui
  frappent la même cible au même instant peuvent lui en poser une de trop. C'est
  assumé — un timer divisé une fois de plus ne casse rien, et le multiplicatif
  ne descend jamais à zéro. La seule conséquence qui ne se rattrape pas, une
  tentative à zéro vie, est fermée par un plancher à une vie.

### Limite d'effets positifs

- Un joueur ne porte jamais **plus de deux effets positifs actifs**, qu'il se les
  soit lancés ou qu'un allié les lui ait posés.
- « Actif » se lit **plus étroitement que pour les négatifs** : une magie blanche
  occupe une place tant qu'elle n'a pas encore agi — elle attend la prochaine
  tentative — ou qu'elle agit sur l'attente où le joueur se tient (Répit,
  Indulgence, Purge). Une magie blanche déjà ancrée a donné à sa tentative ce
  qu'elle avait à donner : elle court encore jusqu'au bout de celle-ci, rattrapage
  compris, mais rend sa place. Lue comme une malédiction, elle bloquerait toute
  l'attente d'après ; pour les négatifs, cette lecture large protège la cible,
  pour les positifs elle la pénaliserait.
- Répit, Indulgence et Purge occupent donc leur place **pendant toute l'attente**
  où elles ont été lancées, même Purge, qui agit à l'instant. C'est voulu : c'est
  ce qui empêche d'effacer son attente ou de vider son Pool Échecs d'un coup.
- Sans budget de lancers, c'est **la seule borne des magies blanches** : sans elle,
  un joueur qui a fait des réserves empilerait Répit jusqu'à effacer son attente,
  Chronomancie jusqu'à laisser le temps de chercher les réponses, ou Vitalité
  jusqu'à rendre sa tentative imperdable.
- Un **allié** saturé sort du tirage, silencieusement, comme un ennemi saturé :
  tous les alliés éligibles saturés, le sort part, l'exemplaire est dépensé, et
  rien n'est touché.
- **Sur soi**, la cible est connue d'avance : un joueur saturé ne peut plus se
  lancer de sort. Le bouton « Sur moi » s'éteint et le Grimoire dit pourquoi ;
  l'exemplaire reste en poche plutôt que d'être dépensé pour rien.
- Même conséquence que pour les négatifs : qui ne meurt pas garde ses effets
  positifs en attente, occupe ses deux places, et ne peut plus en recevoir ni
  s'en lancer tant que sa prochaine tentative ne les a pas ancrés.
- La limite se tient **par une lecture**, comme celle des négatifs : des lancers
  envoyés au même instant — de deux onglets, ou par deux alliés sur la même
  cible — peuvent tous passer et poser un effet de trop. Assumé : le Grimoire
  n'envoie qu'un lancer à la fois, et le dépassement reste d'un ou deux effets,
  pas un empilement sans fin.
- Reste une porte : une Purge blanche sur un allié **hors attente** mord son Pool
  Échecs sans qu'il la porte (faute d'attente à laquelle la rattacher, voir
  [Tirage de la cible](#tirage-de-la-cible)). Elle ne compte donc pas dans son
  plafond.

### Ancrage et durée de vie

Un effet s'ancre sur la **prochaine tentative de la cible** et meurt avec elle,
consommé ou non. Un effet posé sur un joueur en pleine ascension attend donc sa
prochaine mort.

Conséquence assumée : le joueur qui ne meurt pas ne subit rien, et occupe ses deux
slots négatifs sans les consommer — ce qui le retire du tirage et le protège. La
magie noire mord surtout ceux qui meurent souvent. Le tirage pondéré compense
partiellement, en visant en priorité les mieux classés.

**Le déclencheur en cours compte** quand il existe :

| Sort | Déclencheur | Attente en cours ? |
|---|---|---|
| Vitalité | démarrage de la tentative | non, différé |
| Chronomancie | chaque question de la tentative | non, différé |
| Indulgence | le prochain rattrapage | **oui** — celui qui clôt l'attente en cours |
| Purge | le Pool Échecs | **oui** — immédiat |
| Répit | l'attente en cours | **oui** — l'échéance en cours est recalculée |

C'est ce qui donne son sens au fait de lancer depuis l'écran d'attente : la cible
étant elle-même en attente la plupart du temps, l'effet se voit tout de suite.

### Catalogue

| Sort | Magie blanche | Magie noire |
|---|---|---|
| **Vitalité** | +1 vie à la tentative | −1 vie à la tentative |
| **Chronomancie** | timer ×2 sur toute la tentative | timer ÷2 sur toute la tentative |
| **Indulgence** | deux fois plus de questions tirées au prochain rattrapage | le prochain rattrapage exige un perfect |
| **Purge** | une question au hasard sort du Pool Échecs de la cible | remet à zéro le compteur de réussites d'une question au hasard de son Pool Échecs |
| **Répit** | attente en cours ÷2 | attente en cours ×2 |

Chronomancie porte sur **toute la tentative**, pas sur une seule question.

« Perfect exigé » veut dire : autant de bonnes réponses que de questions tirées.
Le seuil suit donc l'Indulgence blanche quand les deux se posent — deux fois plus
de questions, toutes à réussir.

Purge blanche peut faire descendre le Pool Échecs sous le seuil de déclenchement du
rattrapage, et donc **annuler le rattrapage**. C'est assumé : vider son pool est un
objectif de jeu légitime, et le plafond de deux effets positifs portés empêche de
le vider d'un coup sur soi.

**Les libellés sont provisoires.** Les identifiants de code, eux, sont figés
(`VITALITY`, `CHRONOMANCY`, `INDULGENCE`, `PURGE`, `RESPITE`) et le libellé affiché
est une donnée séparée : le passage de naming ne coûtera ni migration ni refactor.

### Cumul

Un même sort peut se poser deux fois sur la même cible — par le même lanceur ou
par deux lanceurs —, jusqu'au plafond de ce qu'elle porte : deux effets négatifs,
deux positifs. **Le mode de cumul est propre à chaque sort**, il n'y a pas de règle
globale.

| Sort | Mode | Empilé ×2 |
|---|---|---|
| **Vitalité** | additif | −2 vies → tentative démarrée à 1 vie |
| **Chronomancie** | multiplicatif | ÷4 → 15 s. N'atteint jamais zéro, aucun plancher nécessaire |
| **Indulgence** | multiplicatif (blanc) / booléen (noir) | ×4 questions, borné par la taille du pool ; deux « perfect exigé » valent un |
| **Purge** | ponctuel | deux lancers = deux questions, aucune interaction |
| **Répit** | multiplicatif | ÷4 ou ×4. N'atteint jamais zéro |

Les faces blanche et noire d'un même sort **ne s'annulent pas, elles se composent**.
Indulgence reçue des deux côtés donne six questions *et* un perfect exigé : le sort
de l'allié aggrave la situation. Toutes les combinaisons sont acceptables.

Le multiplicatif garantit qu'aucun empilement ne peut réduire une attente ou un
timer à zéro — la mécanique centrale du jeu reste toujours debout.

### Ce que voit la cible, et ce que voit le lanceur

**Tout est révélé, nominativement, des deux côtés.** L'anonymat vaut au moment du
lancer, pour empêcher qu'on choisisse toujours la même victime ; il n'a plus de
raison d'être une fois le sort parti. Sans cette révélation, personne ne saurait
jamais que le système existe : il n'y a ni classement ni score à gagner, la seule
récompense du PvP est sociale.

Trois lieux d'affichage :

- **L'écran d'attente** porte le récapitulatif de ce qui attend la prochaine
  tentative — effets actifs, positifs et négatifs, chacun avec le nom de son
  lanceur au survol — ainsi que ce qui frappe l'attente elle-même : Répit,
  Indulgence et Purge agissent dès le lancer, les autres attendent la tentative
  suivante. Le joueur a tout lu avant de reprendre.
- **Le Grimoire** porte l'historique du sort choisi : ses cinq derniers
  lancers, sur qui — ou sur personne quand le pool était vide — et quel jour. C'est là que le
  lanceur lit que son sort a touché quelqu'un. La cible, elle, lit qui l'a
  soutenue sur l'effet actif (« Lancé par »), pas dans un journal.
- **L'ascension** affiche une **icône par effet actif**, pendant les questions
  concernées. Un joueur dont le timer démarre à 30 s trois jours après avoir lu
  l'avertissement doit pouvoir comprendre pourquoi plutôt que de croire à un bug.

### L'infobulle d'un sort

Partout où un effet se montre — médaillon des rubans en ascension, sort écrit en
toutes lettres sur l'attente — son survol ouvre une infobulle. Le rattrapage ne
liste pas encore les sorts qui agissent sur lui (issue #55).
Elle dit, dans l'ordre :

- le **médaillon** du sort dans la face de l'effet, son **nom**, sa **face** et
  son **lanceur** ;
- la **définition** de la face (le texte du catalogue) ;
- la **valeur réelle** que l'effet change : « Temps de réponse : 1 min → 2 min ».
  La valeur de départ est celle de l'étage, celle d'arrivée les règles jouées —
  **tous les effets cumulés**, pas la part de celui-ci. Deux Chronomancies
  montrent donc la même ligne : c'est le timer que le joueur a vraiment. Rien à
  chiffrer pour un effet qui n'agit pas encore, ni pour Purge ;
- **jusqu'à quand** il agit, ancré sur ce que le joueur peut compter plutôt que
  sur une date qui n'existe pas :

| Durée de vie | Sorts | Ce que dit l'infobulle |
|---|---|---|
| la tentative | Vitalité, Chronomancie | « Jusqu'à ta dernière vie perdue (encore N ♥) » ; à zéro vie, « Jusqu'à la fin de ton rattrapage » ; en attente d'ancrage, « S'active à ta prochaine tentative » |
| l'attente | Répit | « Jusqu'à la fin de ton attente (HH:MM) » |
| le rattrapage | Indulgence | « Jusqu'à la fin de ton prochain rattrapage » |
| l'instant | Purge | « Effet immédiat, déjà appliqué » |

Un sort lié à l'attente agit dès le lancer : il n'est jamais « à venir ».

Sur le parchemin, le sort s'écrit comme un mot de la phrase, **souligné en
pointillés** et suivi de son médaillon : le pointillé annonce qu'un survol en dit
plus. Le nom du lanceur ne tient pas dans la phrase ; il se lit dans l'infobulle,
et par la synthèse vocale dans le texte de l'icône.

Le **résultat d'un coffre** nomme le sort de la même façon. Un sort en poche n'a
pas encore de face — elle dépendra de la cible : son infobulle montre son
médaillon mixte et ses **deux faces**, chacune sous son étiquette, sans valeur ni
durée.

L'infobulle n'existe qu'**au survol, sur desktop**. Le mobile est hors périmètre
pour l'instant.

## Question loot

- La question servie est **loot** quand elle sera la 50e, 100e, 150e… question résolue
  de l'étage. Le seuil est une règle chiffrée, surchargeable par étage.
- **Rien n'est stocké.** Le statut se dérive du nombre de questions vues à l'étage,
  qui est déjà la seule unité de progression du jeu. Il n'existe pas de second
  compteur : ce serait le même nombre sous un autre nom, avec une désynchronisation
  possible en prime.
- « Résolue » veut dire **juste ou fausse**, comme une vue.
- Le statut est attaché au **passage**, pas à la question. Repêchée plus tard, elle ne
  redonne rien.
- **Jamais de loot sur la dernière question restante de l'étage.** Sans cette règle,
  un Mimic sur cette question opposerait le palier à l'attente, alors que la mécanique
  a déjà tranché que l'étage épuisé prime. Un coffre est perdu si le compteur tombe
  pile dessus : assumé.
- **Indicateur visible avant de répondre.**

L'étage compte 166 questions aujourd'hui, 1000 à terme — dans les deux cas très
au-dessus du seuil, aucune règle de repli n'est nécessaire.

### Rareté assumée

**Le nombre de coffres d'un étage ne dépend pas du joueur, il dépend du deck** :
c'est la taille de l'étage divisée par le seuil. Trois coffres sur un étage de 166
questions, vingt sur les 1000 visés — pour tout le monde, du meilleur au pire. Ce
que le niveau change, c'est le *rythme* : en combien de tentatives on les ramasse,
et combien d'attentes on traverse entre deux.

Et ce rythme est bien plus rapide qu'on ne le croit de loin. Mesuré sur les
premières parties réelles : **97 % de bonnes réponses**, soit trois vies perdues en
une centaine de questions. Une tentative dure donc à peu près 110 questions et
rapporte **deux coffres**, là où un raisonnement de coin de table sur un taux
d'échec de 30 % en annonçait un pour cinq attentes.

Deux conséquences à garder en tête, et la seconde est la plus importante :

- Il n'y a plus de plafond de lancers par attente (ADR 0011) : à deux coffres par
  tentative, il aurait mordu rarement. Ce qui borne l'empilement, ce sont les
  plafonds d'effets portés par la cible — et ils mordent surtout sur les réserves
  qu'un joueur accumule entre deux morts.
- **Les chiffres du jeu ont été posés en imaginant un joueur qui se trompe souvent.**
  Le vrai se trompe rarement. Tout ce qui se déclenche à la mort — l'attente, le
  Pool Échecs, le rattrapage, et l'ancrage des Sorts sur la tentative suivante — se
  déclenche donc bien plus rarement que prévu. Reste un plafond : la mesure a été
  prise sur un étage 1 qui tenait alors le tiers le plus facile du deck. Les étages
  étant désormais tirés au hasard, chacun mêle tout le spectre — le taux réel sera
  plus bas, et le même partout. À reprendre sur des parties jouées sur le deck
  réparti au hasard.

## Coffre et Mimic

- Question loot **répondue juste** → un **coffre** est annoncé sur l'écran verdict.
  Le joueur doit l'**ouvrir explicitement**, sur un écran à part atteint par
  « suivant », avant de passer à la question suivante.
- Question loot **ratée** → échec ordinaire, pas de coffre.
- **Coffre normal (95 %)** → un Sort tiré au hasard dans le catalogue rejoint
  l'inventaire. Doublons illimités.
- **Mimic (5 %)** → aucun objet : **toutes les vies de la tentative en cours sont
  retirées d'un coup**, traité comme une perte de dernière vie ordinaire.
- **Exception, à partir de 50 % de l'étage parcouru et tant que le joueur n'a
  pas sa clé de boss** : le tirage 95/5 ne s'applique plus, le coffre est
  **forcé** de donner la clé — ni Sort, ni Mimic. Voir
  [`boss.md`](./boss.md#obtention-de-la-clé).
- Le résultat d'un sort s'affiche sur l'écran de coffre. Un Mimic bascule
  aussitôt en attente, et le poster d'attente ne le rappelle pas.

**Le tirage a lieu au clic, côté serveur, et son résultat est persisté sur le
verdict.** Le verdict porte donc trois états : *pas de coffre*, *coffre fermé*,
*coffre ouvert avec son résultat*. Tiré à la réservation, le joueur pourrait
apprendre le contenu avant de répondre ; non persisté, un rechargement relancerait
le dé.

Deux conséquences assumées :

- **Le Mimic ne coûte pas la même chose à tout le monde.** Le loot n'apparaît que sur
  bonne réponse, donc la cible a au moins une vie — mais « au moins une » peut valoir
  exactement une, et le Mimic ne lui prend alors pas plus qu'une erreur ordinaire. Le
  joueur ne choisit pas quand le loot tombe : l'asymétrie se subit, elle ne se joue pas.
- **Le joueur qui n'ouvre jamais reste bloqué.** Rien ne le force. Ce n'est pas un
  exploit — il ne progresse plus, ne loote plus, ne joue plus. Mettre un timer sur
  l'écran de verdict contredirait la mécanique existante, et ouvrir d'office
  retirerait la seule mise en scène de la feature.

## Contestation

Une contestation acceptée **répare le joueur, elle ne rembobine pas les Sorts.**

- Les sorts lancés pendant une attente ensuite annulée **restent lancés**. Leurs
  effets sont chez d'autres joueurs ; les défaire créerait des états inexplicables
  pour les victimes. Et les rendre ferait de la contestation un moyen de récupérer
  ses sorts.
- Répit lancé sur une attente qui n'existe plus est **gaspillé**, comme un sort sur
  pool vide.
- Le **coffre d'une question loot ratée puis contestée est perdu**. Le statut loot est
  attaché au passage, le passage est fini.

## Écrans

- **Icône baguette magique**, deuxième de la barre permanente. Visible partout,
  **cliquable au camp seulement** — le seul moment où le lancer existe. Ailleurs
  elle est désactivée, comme toute la barre l'est tant qu'un chrono tourne.
- **Page Sorts**, le **Grimoire** côté joueur : pentacle, lancer, journaux — voir
  [`ecrans.md`](./ecrans.md#sorts). Le lancer et le nombre d'exemplaires sont
  absents tant que #76 n'est pas livré. Accessible au camp uniquement.
  L'inventaire n'est donc pas consultable hors du camp — le joueur voit passer son
  objet sur l'écran de coffre, puis le retrouve à sa prochaine mort.
  Chaque sort porte un bouton **par catégorie de cible** — jamais un nom, et jamais
  une liste de joueurs. La catégorie Allié n'apparaît qu'à qui a une équipe : sans
  elle, elle ne désignerait aucun pool. Voir [`equipes.md`](./equipes.md#le-joueur-sans-équipe).
- **Écran d'attente** : récapitulatif des effets qui attendent la prochaine tentative,
  en plus du Pool Échecs et des contestations qu'il porte déjà.
- **Écran verdict d'ascension** : l'annonce du coffre. **Écran de coffre** : son
  résultat une fois ouvert.
- **Ascension** : une icône par effet actif, sur les questions concernées.
- **Partout où un effet ou un sort se nomme** : une infobulle au survol, voir
  [L'infobulle d'un sort](#linfobulle-dun-sort).

## Talismans — hors périmètre

Passifs, un emplacement unique, changement soumis à un long délai. Un talisman
n'agit pas seul : c'est une **toile de fond qui module les Sorts**. Chacun porte un
aspect positif et un négatif, pour rester un choix à peser.

**Ils ne sont pas dans le périmètre**, et deux des trois pistes ci-dessous sont déjà
périmées par les décisions prises plus haut. Ils ont besoin que les Sorts existent
et aient tourné — c'est leur définition même.

| Piste | Positif | Négatif | État |
|---|---|---|---|
| **Double lancer** | les deux faces partent ensemble, vers deux cibles distinctes | un seul lancer toutes les 24 h | périmé : avec la rareté du loot, le malus ne coûte rien |
| **Coffres fréquents** | seuil du coffre divisé par deux | Mimic à 30 % | périmé : deviendrait le seul moyen d'atteindre un rythme vivable, donc obligatoire |
| **Attente écourtée** | attente réduite de 30 % | le Pool Échecs n'est plus affiché en attente | tient — vrai arbitrage |

## Livraison

**T1 — la boucle solo, bout en bout.** Question loot dérivée, coffre, Mimic,
inventaire, icône baguette, page Sorts, lancer sur **Soi** uniquement, catalogue
réduit à **Vitalité et Répit** — les deux seuls dont l'effet ne touche ni le timer,
ni le pool, ni le rattrapage. Valide seul les trois points risqués : le loot sans
compteur, la persistance du coffre, l'ancrage des effets sur la tentative suivante.
Jouable et testable avant que les équipes existent.

**T2 — le catalogue complet.** Chronomancie, Indulgence, Purge. Chacun touche une
mécanique existante différente ; les brancher un par un sur une boucle qui tourne
déjà est plus sûr que tout d'un coup.

**T3 — le PvP.** Livré : l'équipe sur le joueur, les catégories **Allié** et
**Ennemi**, le tirage pondéré par rang dans les deux sens, la magie noire des
cinq sorts, la limite de deux effets négatifs et le journal nominatif des deux
côtés. Voir [`equipes.md`](./equipes.md).

## Points encore à spécifier

- Le multiplicateur noir de Répit est posé à ×2 par symétrie avec Chronomancie ;
  le catalogue d'origine disait +50 %. À confirmer.
- Les libellés des cinq sorts. Les identifiants étant figés, ça ne bloque rien.
- UI précise de l'historique par sort (#77, qui supprimera le journal des
  sorts reçus côté serveur).

---

*Document de travail, issu du grillage. Amende [`spec.md`](./spec.md),
[`mecanique.md`](./mecanique.md), [`architecture.md`](./architecture.md) et
[`ecrans.md`](./ecrans.md). Amendé par [`boss.md`](./boss.md) (exception au
tirage du coffre passé 50 % de l'étage).*
