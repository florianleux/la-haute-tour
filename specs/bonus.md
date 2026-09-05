# Objets bonus

Le jeu était solo. Il ne l'est plus : les Sorts permettent d'agir sur les autres
joueurs, en bien comme en mal. C'est le seul système du projet qui fasse
communiquer deux parties entre elles.

Deux systèmes distincts, non hiérarchiques :

- **Sorts** — le seul objet qu'on obtient en jouant. Se lancent sur soi, sur un allié ou sur un ennemi.
- **Talismans** — passifs équipés en continu. **Hors périmètre**, voir la fin du document.

Les équipes sont traitées à part, dans `equipes.md`, qui reste à écrire.

## Sorts

### Où et quand

Un Sort **se lance uniquement pendant l'attente** — jamais en ascension, ni en
rattrapage, ni sur le profil. L'écran d'attente porte un accès vers
une **page Sorts** dédiée, où le lancer se fait réellement.

**Un seul exemplaire d'un même sort par attente**, par lanceur. Le catalogue en
comptant cinq, une attente permet donc au plus cinq lancers. Cette règle donne
aussi l'idempotence gratuitement : un double-clic, un second onglet ou une requête
rejouée tombent sur elle et sont refusés, sans qu'aucun mécanisme dédié n'existe.

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
   n'ont jamais commencé, et — pour la magie noire seulement — ceux qui portent déjà
   deux effets négatifs.
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
même logique que Purge sur un Pool Échecs vide.

Le tirage restant imprévisible, la cible n'est **pas affichée avant le lancer**.
Elle l'est après.

### Limite d'effets négatifs

- Un joueur ne porte jamais **plus de deux effets négatifs actifs**.
- Au-delà, il est **retiré du tirage**, silencieusement, côté serveur. Le lanceur n'a
  rien à voir : le ciblage étant déjà aléatoire, il n'y a aucune UI à prévoir.
- **Aucune limite sur les effets positifs.** Ils sont bornés de fait par le nombre
  d'alliés et par la règle « un exemplaire par attente ».

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
| Répit | la prochaine attente | **oui** — l'échéance en cours est recalculée |

C'est ce qui donne son sens au fait de lancer depuis l'écran d'attente : la cible
étant elle-même en attente la plupart du temps, l'effet se voit tout de suite.

### Catalogue

| Sort | Magie blanche | Magie noire |
|---|---|---|
| **Vitalité** | +1 vie à la tentative | −1 vie à la tentative |
| **Chronomancie** | timer ×2 sur toute la tentative | timer ÷2 sur toute la tentative |
| **Indulgence** | deux fois plus de questions tirées au prochain rattrapage | le prochain rattrapage exige un perfect |
| **Purge** | une question au hasard sort du Pool Échecs de la cible | remet à zéro le compteur de réussites d'une question au hasard de son Pool Échecs |
| **Répit** | prochaine attente ÷2 | prochaine attente ×2 |

Chronomancie porte sur **toute la tentative**, pas sur une seule question.

Purge blanche peut faire descendre le Pool Échecs sous le seuil de déclenchement du
rattrapage, et donc **annuler le rattrapage**. C'est assumé : vider son pool est un
objectif de jeu légitime, et la règle « un exemplaire par attente » empêche de le
vider d'un coup.

**Les libellés sont provisoires.** Les identifiants de code, eux, sont figés
(`VITALITY`, `CHRONOMANCY`, `INDULGENCE`, `PURGE`, `RESPITE`) et le libellé affiché
est une donnée séparée : le passage de naming ne coûtera ni migration ni refactor.

### Cumul

Deux lanceurs peuvent poser le même sort sur la même cible — la limite d'un
exemplaire par attente est par lanceur. **Le mode de cumul est propre à chaque
sort**, il n'y a pas de règle globale.

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
  lanceur — ainsi que ce qui frappe l'attente elle-même. Comme tous les effets
  s'ancrent sur la tentative suivante, le joueur a tout lu avant de reprendre.
- **La page Sorts** porte le journal complet, reçus et lancés, horodaté. C'est là que
  le lanceur lit que son sort a touché quelqu'un.
- **L'ascension** affiche une **icône par effet actif**, pendant les questions
  concernées. Un joueur dont le timer démarre à 30 s trois jours après avoir lu
  l'avertissement doit pouvoir comprendre pourquoi plutôt que de croire à un bug.

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

Avec trois vies et un taux d'erreur plausible, un joueur meurt toutes les dix
questions environ et loote toutes les cinquante : **il traverse quatre ou cinq
attentes les mains vides avant d'en trouver une avec quelque chose à lancer**, et la
règle « un exemplaire par sort et par attente » ne mordra jamais. C'est accepté, et
c'est même le but : un sort est un événement rare, pas une routine. Sur un étage de
166 questions, cela fait trois coffres ; sur les 1000 visés, vingt.

## Coffre et Mimic

- Question loot **répondue juste** → un **coffre** apparaît sur l'écran verdict. Le
  joueur doit l'**ouvrir explicitement**, par un clic distinct de « suivant », avant
  de passer à la question suivante.
- Question loot **ratée** → échec ordinaire, pas de coffre.
- **Coffre normal (95 %)** → un Sort tiré au hasard dans le catalogue rejoint
  l'inventaire. Doublons illimités.
- **Mimic (5 %)** → aucun objet : **toutes les vies de la tentative en cours sont
  retirées d'un coup**, traité comme une perte de dernière vie ordinaire.
- Le résultat s'affiche en bas de l'écran verdict.

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

- **Icône baguette magique**, quatrième de la barre permanente. Visible partout,
  **cliquable en attente seulement** — la seule phase où le lancer existe. Ailleurs
  elle est désactivée, comme toute la barre l'est tant qu'un chrono tourne.
- **Page Sorts** : inventaire, lancer, journal. Accessible en attente uniquement.
  L'inventaire n'est donc pas consultable hors attente — le joueur voit passer son
  objet sur l'écran verdict, puis le retrouve à sa prochaine mort.
- **Écran d'attente** : récapitulatif des effets qui attendent la prochaine tentative,
  en plus du Pool Échecs et des contestations qu'il porte déjà.
- **Écran verdict d'ascension** : le coffre, et son résultat une fois ouvert.
- **Ascension** : une icône par effet actif, sur les questions concernées.

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

**T3 — le PvP.** `equipes.md` écrit d'abord, puis équipe sur le joueur, catégories
Allié et Ennemi, magie noire, limite de deux effets négatifs, tirage pondéré par
rang, journal nominatif.

## Points encore à spécifier

- `equipes.md` n'existe pas. Bloquant pour T3, pour rien avant.
- Le multiplicateur noir de Répit est posé à ×2 par symétrie avec Chronomancie ;
  le catalogue d'origine disait +50 %. À confirmer.
- Les libellés des cinq sorts. Les identifiants étant figés, ça ne bloque rien.
- UI précise de la page Sorts et du journal.

---

*Document de travail, issu du grillage. Amende [`spec.md`](./spec.md),
[`mecanique.md`](./mecanique.md), [`architecture.md`](./architecture.md) et
[`ecrans.md`](./ecrans.md).*
