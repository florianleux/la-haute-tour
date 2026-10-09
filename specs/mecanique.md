# Mécanique de jeu

## Ascension

- Progression **linéaire stricte** : le joueur doit avoir vu toutes les questions de l'étage 1 avant de passer à l'étage 2, etc.
- Le deck a un **ordre fixe**, le même pour tous : chaque question porte un **rang** dans son étage, écrit une fois à l'import. Le joueur avance dans cet ordre, et la question suivante est simplement la première de rang supérieur à celle qu'il vient de voir.
- La progression, elle, est **propre à chaque joueur** : c'est son curseur qui avance, pas le deck qui change. Deux joueurs voient la même séquence, à des moments différents.
- Un ordre partagé se lit sans rien parcourir — la question suivante est un saut dans l'index, quel que soit le nombre de questions de l'étage. Un tirage au hasard obligeait à parcourir puis trier tout l'étage à chaque question, pour un coût qui grandissait avec le deck.
- Le joueur dispose de 3 vies par **tentative**. Chaque mauvaise réponse en consomme une.
- La **bonne réponse est affichée sur échec** (apprentissage immédiat), puis le joueur passe à la suivante par un bouton.
- À la perte de la dernière vie → **attente**. La position est conservée.
- Le jeu n'est pas limité dans le temps : le joueur enchaîne tant qu'il lui reste des vies. Pas de palier de durée, pas de quota quotidien.
- **Timer par question**, arbitré par le serveur. Le timeout est une erreur ordinaire : vie perdue, bonne réponse affichée, question versée au Pool Échecs. Voir [`anti-triche.md`](./anti-triche.md).

### Réservation

La question servie est **réservée** : horodatée et conservée côté serveur jusqu'à sa résolution.

- Une seule réservation à la fois.
- Recharger la page retrouve **la même question**, avec la même échéance : le temps continue de courir.
- La réservation se résout par une réponse, ou par l'expiration du timer — auquel cas elle est comptée fausse.
- Fuir une question coûte donc exactement ce que coûte une mauvaise réponse. Il n'y a rien à gagner à recharger.

Une question ne devient **vue** qu'à la résolution de sa réservation.

### Multi-appareil

L'état de jeu vit en base : le joueur peut fermer un appareil et reprendre sur un autre, sa réservation l'attend, timer compris.

Jouer sur deux écrans **en même temps** n'est pas supporté : la perte de focus soumet la réponse en l'état (voir [`anti-triche.md`](./anti-triche.md)), donc ouvrir un second onglet résout la question du premier. Une soumission portant sur une réservation déjà résolue est ignorée : le serveur renvoie l'état courant sans erreur — l'appareil en retard n'est pas fautif, il est périmé.

## Machine à états

Le serveur détermine seul la phase du joueur. Le client ne choisit jamais son écran : il affiche celui que la phase désigne. C'est la seule définition de « où en est le joueur » dans tout le projet — aucun autre document ne la reformule.

| Phase | Quand | Contenu servi |
|---|---|---|
| `ascent` | Vies restantes, questions restantes à l'étage | La réservation en cours (énoncé + échéance), **ou** le verdict de la question qui vient d'être résolue |
| `cooldown` | Plus de vies, délai d'attente non écoulé | Fin de l'attente, Pool Échecs de l'étage, erreurs contestables de la tentative |
| `recovery` | Plus de vies, attente écoulée, Pool Échecs assez fourni | Les questions de rattrapage, une à une, avec le même mécanisme de réservation et de verdict qu'en ascension |
| `floorEnd` | Toutes les questions de l'étage vues | Le palier atteint — prélude du boss de l'étage, plus la fin elle-même. Voir [`boss.md`](./boss.md) |
| `bossDoor` | `floorEnd` franchi, boss pas encore battu | La porte du boss — fermée (moins de deux clés posées côté équipe) ou ouverte, sur le même champ. Voir [`boss.md`](./boss.md#porte-à-deux-clés) |
| `bossFight` | Porte ouverte (ou pas d'équipe), combat en cours | Le combat de boss actif — PV du boss, vies du joueur, épreuve en cours. Voir [`boss.md`](./boss.md) |
| `gameOver` | Boss du dernier étage battu, ou passé automatiquement | Message de fin. Phase terminale |

### Transitions

- La phase est **dérivée à chaque lecture**, jamais stockée : elle se déduit des vies, de la réservation, de la fin d'attente et du décompte des questions vues. Une attente échue devient donc `recovery` (ou `ascent`) sans qu'aucune tâche de fond ne s'exécute.
- **Aucune lecture ne réserve de question.** Le tirage naît d'une action explicite du joueur : commencer, passer à la question suivante, franchir un palier. Une lecture ne fait que rendre ce qui existe — réservation vivante, réservation expirée résolue en échec, ou verdict en attente.
- `floorEnd` ne coûte aucun stockage : elle se déduit du nombre de questions vues à l'étage courant. `bossDoor` et `bossFight` suivent `floorEnd` jusqu'à ce que le boss soit battu (ou passé automatiquement) — c'est cet instant-là, pas `floorEnd`, qui déclenche `crossFloor`, l'action qui incrémente l'étage. Voir [`boss.md`](./boss.md#franchissement-détage).
- **L'étage épuisé prime sur les vies** : perdre sa dernière vie sur la dernière question de l'étage mène au palier, pas à l'attente. Le Pool Échecs de cet étage est sur le point d'être abandonné — il n'y a plus rien à y rattraper. L'attente due, elle, reste due : elle attend le joueur à l'étage suivant. Au dernier étage, c'est la fin de partie qui prime, sans attente ni rattrapage.
- Un **verdict** ne retient pas le joueur à sa phase : il se lit sur l'écran de celle qui suit — palier, attente ou fin. Seule une question **non résolue** maintient l'ascension.

## Tentative, attente et rattrapage

1. Dernière vie perdue → **attente**.
2. À l'échéance de l'attente :
   - Pool Échecs **plus petit que le nombre de questions à tirer** → vies restaurées, reprise immédiate, nouvelle tentative.
    - Pool Échecs **assez fourni** → **rattrapage** : des questions distinctes tirées au hasard du Pool Échecs de l'étage courant.
      - Le rattrapage s'arrête dès que le verdict est **scellé** (voir ci-dessous). Succès → vies restaurées, reprise immédiate, nouvelle tentative. Échec → l'attente repart pour une durée réduite, puis le rattrapage se rejoue. Sans limite.

### Déroulement du rattrapage

- **Feedback immédiat après chaque question** : le joueur sait tout de suite s'il a bon ou faux et voit la bonne réponse, puis passe à la suivante. Même mécanique qu'en ascension.
- **Le rattrapage s'arrête dès que le verdict est scellé** — succès (quota de bonnes réponses atteint) ou échec (quota mathématiquement impossible à atteindre avec les questions restantes). Les questions non jouées restent dans le Pool Échecs sans que leur compteur de réussites progresse : c'est le tradeoff assumé d'un arrêt précoce, le joueur récupère ses vies plus vite mais le pool dégonfle moins vite.
- Le verdict du rattrapage s'annonce sur l'écran de la question qui le scelle : « Rattrapage réussi » + bouton « Reprendre » qui enchaîne sur l'ascension, ou « Rattrapage raté » + bouton « Terminer » qui enchaîne sur l'attente.
- Les questions de rattrapage sont déjà vues : elles ne font pas avancer la progression, seulement les compteurs du Pool Échecs.
- **Timer par question** plus généreux qu'en ascension. Voir [`anti-triche.md`](./anti-triche.md).

## Pool Échecs

- **Par étage**, **persistant** : jamais remis à zéro tant que le joueur reste à l'étage.
- Toute question ratée — en ascension comme en rattrapage — appartient au Pool Échecs de son étage.
- Chaque question du pool porte un compteur de **réussites** consécutives obtenues en rattrapage :
  - bonne réponse → compteur incrémenté ;
  - mauvaise réponse → compteur **remis à zéro** ;
  - seuil atteint → la question **sort** du pool.
- Une contestation acceptée fait aussi sortir la question, immédiatement : l'admin vient d'établir que la réponse était bonne. Voir [`validation.md`](./validation.md).
- Le sort **Purge** en fait sortir une au hasard, sans qu'elle ait jamais été rejouée. C'est le seul moyen de quitter le pool sans y répondre, et il peut faire passer le pool sous le seuil de déclenchement du rattrapage. Voir [`bonus.md`](./bonus.md#catalogue).
- Conséquence assumée du retour à zéro : le pool dégonfle lentement, donc le rattrapage devient la norme passé les premières attentes. C'est pourquoi l'écran d'attente sert de fiche de révision (voir [`ecrans.md`](./ecrans.md)).
- Les Pools Échecs des étages précédents sont **abandonnés** quand le joueur monte.

## Fin d'étage

- Le joueur atteint le palier quand toutes les questions de l'étage courant sont vues. Le Pool Échecs n'est pas abandonné pour autant : il reste vivant tant que le boss de l'étage n'est pas réglé, voir [`boss.md`](./boss.md).
- Le palier n'incrémente plus l'étage lui-même : il ouvre la porte du boss (`bossDoor`), puis le combat (`bossFight`). Franchir le palier (`crossFloor`) — qui incrémente l'étage, abandonne le Pool Échecs et réserve la première question du suivant — se déclenche à la victoire sur le boss ou à son passage automatique, pas à `floorEnd`. Voir [`boss.md`](./boss.md#franchissement-détage).
- La **dernière question restante de l'étage n'est jamais une question loot**. Sans cette règle, un Mimic sur cette question opposerait le palier à l'attente, alors que la règle « l'étage épuisé prime sur les vies » a déjà tranché. Voir [`bonus.md`](./bonus.md#question-loot).

## Fin de partie

- Toutes les questions du dernier étage vues → même système que les autres étages : porte, combat de boss. Battre le boss du dernier étage (ou le passer automatiquement) mène à `gameOver`, au lieu de `crossFloor`. Voir [`boss.md`](./boss.md#franchissement-détage).
- Message de félicitations, phase terminale, pas de classement.
- Le Pool Échecs du dernier étage peut rester non vide sans empêcher la fin.

## Règles chiffrées

Vies, timers, nombre de questions de rattrapage, seuil du Pool Échecs, réussites nécessaires pour en sortir, durées d'attente : **aucune de ces valeurs n'est écrite en dur dans le code**. Elles forment un jeu de règles unique, consultable par étage, et rien d'autre ne les connaît — un appelant demande les règles de l'étage, jamais une constante isolée.

Valeurs par défaut, identiques aux 6 étages :

| Règle | Défaut |
|---|---|
| Vies par tentative | 3 |
| Timer d'une question d'ascension | 60 s |
| Timer d'une question de rattrapage | 60 s |
| Questions tirées au rattrapage | 3 |
| Bonnes réponses pour se débloquer | 1 |
| Taille minimale du pool pour déclencher un rattrapage | 3 |
| Réussites consécutives pour sortir du pool | 2 |
| Attente après la dernière vie perdue | 12 h |
| Attente après un rattrapage entièrement manqué | 4 h |
| Tolérance de perte de focus | 1 s |
| Lancers de sorts par attente | 2 |
| Questions résolues entre deux coffres | 50 |
| Chance de Mimic à l'ouverture d'un coffre | 5 % |
| Effets négatifs simultanés par joueur | 2 |
| Vitalité — vies ajoutées ou retirées | 1 |
| Chronomancie — facteur sur le timer | 2 |
| Indulgence — facteur sur les questions tirées au rattrapage | 2 |
| Répit — facteur sur la durée d'attente | 2 |

Faire diverger un étage revient à surcharger une de ces valeurs pour cet étage ; aucun autre code ne change. Aucune divergence n'est décidée aujourd'hui.

### Ce que les Sorts modifient

Les quatre dernières valeurs ne sont pas des constantes de jeu mais des **facteurs
appliqués à celles du dessus** : un effet actif ne remplace jamais une règle, il la
module. Un timer de 60 s frappé de deux Chronomancie noires vaut 15 s, une attente
de 12 h allégée par deux Répit blancs vaut 3 h. Les modes de cumul diffèrent d'un
sort à l'autre — voir [`bonus.md`](./bonus.md#cumul).

Aucun de ces facteurs ne peut réduire un timer ou une attente à zéro : ils sont
multiplicatifs. Les vies, elles, s'additionnent, et c'est la limite de deux
effets négatifs qui les tient au-dessus de zéro. Cette limite se lisant au
tirage, un plancher à **une vie** ferme le cas où deux lanceurs simultanés en
poseraient une de trop — il ne remplace pas la règle, il en garantit la seule
conséquence qu'on ne peut pas rattraper.
Voir [`bonus.md`](./bonus.md#limite-deffets-négatifs).
