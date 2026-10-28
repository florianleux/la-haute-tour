# Succès

Le jeu ne gardait trace de rien. On montait, on mourait, on rattrapait, et il ne
restait de tout ça qu'un étage et un compteur de questions vues. Les Succès sont
la mémoire de ce qui a été accompli — et rien d'autre : ils ne donnent aucune
vie, n'ouvrent aucune porte, ne pèsent sur aucune règle.

## Principe

- **Catalogue fixe, écrit dans le code.** Aucune administration : on n'ajoute pas
  un succès depuis un écran, on le code. Un catalogue administrable supposerait
  des conditions exprimables en données, alors qu'un déclencheur est une ligne de
  la mécanique.
- **Acquis à vie.** Un succès débloqué ne se reperd jamais, et n'est jamais
  attribué deux fois.
- **Sans effet.** Cosmétique et informatif. Le jour où un succès donnerait
  quelque chose, il cesserait d'être une distinction pour devenir une règle.

Attention au mot : « succès » désigne déjà, dans [`mecanique.md`](./mecanique.md),
les bonnes réponses consécutives d'une question du Pool Échecs. Les deux notions
ne partagent que le mot français — en code, l'une est `achievement`, l'autre
`poolSuccesses`. Voir le glossaire de [`spec.md`](./spec.md#glossaire).

## Catalogue

**Cinquante et un succès**, répartis en onze familles.

### Premières fois — 4

Un déblocage unique, au premier événement rencontré.

| Succès | Déclencheur |
|---|---|
| Première bonne réponse | Première question juste, tous étages confondus |
| Première mauvaise réponse | Première question fausse |
| Première mort | Première perte de la dernière vie d'une tentative — sauf sur la dernière question de l'étage, qui mène au palier ([`boss.md`](./boss.md#cas-à-0-vie)) |
| Premier rattrapage | Première entrée en phase `recovery` |

La mort par Mimic compte comme une mort : elle retire toutes les vies d'un coup et
ouvre une attente, c'est la même chose vue d'ailleurs. Voir
[`bonus.md`](./bonus.md#coffre-et-mimic).

### Série sans faute — 20

Bonnes réponses consécutives dans une même tentative, sans aucune vie perdue.
Paliers : **5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200, 300, 400, 500, 600,
700, 800, 900, 1000**.

- La série repart de zéro à chaque nouvelle tentative.
- Toute vie perdue la casse immédiatement, même si la tentative se poursuit.
- Chaque palier atteint débloque le sien ; les paliers déjà franchis ne se
  reperdent pas si la série continue au-delà.
- Les réponses de rattrapage n'y entrent pas : elles ne coûtent aucune vie et ne
  font avancer aucune progression.

Le palier 1000 est **hors de portée du deck actuel** : six étages de 166 questions
font 996 questions en tout, et une question ne se voit qu'une fois. Il est calé
sur la cible de 1000 questions par étage, pas sur le deck d'aujourd'hui. Ce n'est
pas un oubli et il n'y a rien à y corriger.

### Étage sans faute — 6

Terminer un étage complet en une seule tentative, sans perdre aucune vie du début
à la fin de l'étage. Un succès par étage.

Distinct de la série : celle-ci compte des réponses, celui-là couvre un étage
entier. Les deux se lisent pourtant du même compteur — une série qui atteint la
taille de l'étage au moment du palier ne peut avoir été obtenue que d'une seule
traite et sans faute, puisque toute erreur et toute nouvelle tentative la
remettent à zéro.

Conséquence assumée : reprendre un étage après une attente ne permet plus d'y
gagner ce succès.

### Progression — 6

- Un succès par étage atteint pour la première fois : **étages 2 à 6**, soit cinq
  franchissements. Atteindre l'étage 1 n'est pas un accomplissement, c'est le
  point de départ.
- Terminer le jeu — avoir vu toutes les questions du dernier étage.

Depuis le boss (voir [`boss.md`](./boss.md)), « atteindre un étage » et
« terminer le jeu » se gagnent à `floorEnd` — toutes les questions de l'étage
vues — et non à `crossFloor`/`gameOver`, désormais plus tardifs, gagnés
seulement après avoir battu le boss (ou l'avoir passé automatiquement). Le
boss est une porte supplémentaire vers l'étage suivant, il ne redéfinit pas ce
que ces succès mesurent. Voir
[ADR 0007](../docs/adr/0007-les-succes-de-franchissement-restent-sur-floorend.md).

### Rattrapage — 2

- Faire sortir une question du Pool Échecs.
- **Rattrapage parfait** : le tirage joué en entier, et toutes les questions
  bonnes. Depuis que le rattrapage s'arrête au verdict scellé, cela ne se produit
  que lorsque le quota exige l'intégralité du tirage — sous Indulgence noire. Le
  succès est rare, et c'est voulu.

### Contestations — 3

Première contestation demandée, première acceptée, première refusée.

### Assiduité — 4

Nombre de **jours joués** distincts : paliers 7, 30 et 100 jours. Plus un succès
pour deux jours de jeu consécutifs, la première fois.

Un jour joué est un jour où le joueur a résolu au moins une question, daté en
Europe/Paris. Ouvrir le jeu pendant une attente de douze heures, sans pouvoir
jouer, n'en fait pas un — c'est la partie qu'on compte, pas la visite.

### Positions notables — 3

Atteindre un numéro précis sur le compteur de questions vues — toutes
tentatives, tous étages confondus, un compteur qui ne redescend qu'à la remise à
zéro du joueur.

Question n°**67**, n°**666**, n°**1312**.

Comme le palier 1000 de la série, le 1312 est hors de portée du deck actuel.
Même raison, même absence de correctif.

### Premier sur le serveur — 1

Premier joueur à franchir l'étage 1. Un seul succès pour tout le jeu, réclamé une
fois. Il ne se réattribue que si son détenteur est remis à zéro (voir
[Remise à zéro](#remise-à-zéro)). Gagné à `floorEnd` (voir « Progression » plus haut) :
pas besoin d'avoir battu le boss de l'étage 1.

**Les joueurs test en sont exclus**, comme de tout ce qui touche aux vrais
joueurs — leur monde est scellé, voir [`admin.md`](./admin.md#joueurs-test).
**L'admin aussi**, et pour la raison qui vaut déjà aux équipes : il arbitre les
parties, il n'a pas à y peser (voir [`equipes.md`](./equipes.md)). Sans cette
exclusion le succès serait brûlé au premier test qui suit l'ouverture, et plus
personne ne pourrait l'obtenir.

Vérifié côté serveur au moment du franchissement, sans qu'aucun classement
n'existe ni ne soit montré — cohérent avec
[`ecrans.md`](./ecrans.md#ce-quaucun-écran-joueur-ne-montre).

### Réponse vide — 1

Ne rien répondre. Se déclenche sur toute réponse vide, quelle qu'en soit la cause —
délai écoulé, perte de focus, ou champ soumis vide volontairement. Le système ne
distingue pas ces cas, et n'a pas à le faire.

### Michel — 1

**HÉ !** — donner le Fromage à Michel, à la leçon du camp. Gagné au don, quand le
Fromage quitte le sac. C'est le premier succès du mur, en haut à gauche : le
premier qu'on gagne, avant toute question.

Le Fromage ne se donne qu'une fois par partie. Après une remise à zéro, les
succès s'effacent avec le reste (voir [Remise à zéro](#remise-à-zéro)) : le
joueur le regagne.

## Ce qui porte les succès

Rien ne se recompte au moment de décider : le joueur porte ses compteurs, comme il
porte déjà ses questions vues. Voir
[`architecture.md`](./architecture.md#état-de-jeu-server-side).

| Ce qu'il faut savoir | Ce qui le porte |
|---|---|
| La série en cours | `streak`, remis à zéro à toute vie perdue et à toute tentative neuve |
| Les questions vues depuis la dernière remise à zéro | `seenTotal` |
| Les jours joués | `lastPlayedDay`, `daysPlayed`, `playStreak` |
| Le premier arrivé en haut | Un champ unique des réglages, réclamé une seule fois |
| Ce qui est déjà acquis | Le **palmarès** (`achievementsHeld`), porté par le joueur. La table des succès reste la source — elle seule les date ; le palmarès la double pour qu'aucune requête de jeu n'ait à la relire |

## Affichage

- **La page Succès** — un mur de tuiles, une par succès, avec sous le titre le
  compteur des succès obtenus sur le catalogue. Le mur défile quand il dépasse l'étoffe.
  La page est une bannière aux couleurs de la guilde du joueur, ouverte
  par-dessus le camp. Voir [`ecrans.md`](./ecrans.md#haut-faits).
- **Tous les succès sont secrets.** Chacun a sa tuile sur le mur, obtenu ou
  non — on voit combien il en reste. Mais tant qu'il n'est pas obtenu, sa tuile
  ne montre qu'un point d'interrogation, et son nom comme sa condition se lisent
  « ??? ». On découvre ce qu'il fallait faire en le faisant.
- **Le nom et la condition** d'un succès obtenu se lisent au survol, avec son
  dessin. Un clic sur une tuile ne fait rien.
- **Le toast** — au moment du déblocage, pendant la partie.
- **Accès** : au camp seulement, et avec une équipe, par la bannière du camp :
  les Haut-faits sont la bannière de la guilde, posée au camp.

Deux familles n'ont pas de toast : les **contestations** et l'**assiduité** hors
jeu. Une contestation s'arbitre des heures après avoir été demandée, souvent
pendant que le joueur n'est pas là ; un toast surgirait alors sans rapport avec ce
qu'il est en train de faire. Ces succès se découvrent sur la page.

« HÉ ! » a son toast, bien que gagné au camp : il tombe au geste même du joueur,
le don du Fromage.

## Contestation

Une contestation acceptée corrige le verdict d'une question — faux devient juste,
voir [`validation.md`](./validation.md#contestation) — mais n'a **aucun effet
rétroactif sur les succès**. Une série déjà cassée ne se recolle pas, un « étage
sans faute » déjà manqué ne se rattrape pas.

C'est le prix de la règle qui dit qu'un succès ne se reperd jamais : si l'histoire
pouvait être réécrite dans un sens, elle devrait pouvoir l'être dans l'autre.

## Remise à zéro

Remettre un joueur à zéro efface sa partie **et son palmarès** : ses compteurs —
série, questions vues, jours joués — repartent de zéro, ses succès aussi. Vrai
joueur comme joueur test : une partie neuve se regagne entière, et une « première
fois » se rejoue. Voir [`admin.md`](./admin.md#gestion-des-joueurs).

« Premier sur le serveur » tombe aussi, et sa place se libère : le prochain
joueur à quitter l'étage 1, le joueur remis à zéro compris, le gagne.

## Ce que les Succès n'apportent pas

- **Aucun effet de jeu** : ni vie, ni sort, ni règle modulée.
- **Aucun classement**, ni comparaison, ni palmarès d'autrui. « Premier sur le
  serveur » compare les joueurs à l'intérieur du serveur sans jamais rien afficher
  de cette comparaison.
- **Aucune notification à quiconque d'autre** que celui qui débloque.

## Portée future

Le catalogue pourra référencer les Sorts et les Équipes une fois ces systèmes
éprouvés — des succès liés au lancer, par exemple. Rien n'en est spécifié ici : ce
sera à traiter au moment de l'intégration, en ajoutant au catalogue plutôt qu'en le
rouvrant.

---

*Amende [`spec.md`](./spec.md) (glossaire), [`architecture.md`](./architecture.md)
(état de jeu) et [`ecrans.md`](./ecrans.md) (inventaire des écrans, toast).
Amendé par [`boss.md`](./boss.md) (succès de franchissement restent sur
`floorEnd`).*
