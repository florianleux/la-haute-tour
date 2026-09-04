# Mécanique de jeu

## Ascension

- Progression **linéaire stricte** : le joueur doit avoir vu toutes les questions de l'étage 1 avant de passer à l'étage 2, etc.
- La question suivante est **tirée au hasard** parmi celles que le joueur n'a pas encore vues dans l'étage. L'ordre est propre à chaque joueur et se décide question par question — il n'est pas calculé à l'avance.
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
| `floorEnd` | Toutes les questions de l'étage vues, étage non final | Le palier atteint |
| `gameOver` | Toutes les questions du dernier étage vues | Message de fin. Phase terminale |

### Transitions

- La phase est **dérivée à chaque lecture**, jamais stockée : elle se déduit des vies, de la réservation, de la fin d'attente et du décompte des questions vues. Une attente échue devient donc `recovery` (ou `ascent`) sans qu'aucune tâche de fond ne s'exécute.
- **Aucune lecture ne réserve de question.** Le tirage naît d'une action explicite du joueur : commencer, passer à la question suivante, franchir un palier. Une lecture ne fait que rendre ce qui existe — réservation vivante, réservation expirée résolue en échec, ou verdict en attente.
- `floorEnd` et `gameOver` ne coûtent aucun stockage : elles se déduisent du nombre de questions vues à l'étage courant. Franchir le palier est l'action qui incrémente l'étage.
- **L'étage épuisé prime sur les vies** : perdre sa dernière vie sur la dernière question de l'étage mène au palier, pas à l'attente. Le Pool Échecs de cet étage est sur le point d'être abandonné — il n'y a plus rien à y rattraper. L'attente due, elle, reste due : elle attend le joueur à l'étage suivant. Au dernier étage, c'est la fin de partie qui prime, sans attente ni rattrapage.
- Un **verdict** ne retient pas le joueur à sa phase : il se lit sur l'écran de celle qui suit — palier, attente ou fin. Seule une question **non résolue** maintient l'ascension.

## Tentative, attente et rattrapage

1. Dernière vie perdue → **attente**.
2. À l'échéance de l'attente :
   - Pool Échecs **plus petit que le nombre de questions à tirer** → vies restaurées, reprise immédiate, nouvelle tentative.
   - Pool Échecs **assez fourni** → **rattrapage** : des questions distinctes tirées au hasard du Pool Échecs de l'étage courant.
     - **Au moins une bonne réponse** → vies restaurées, reprise immédiate, nouvelle tentative.
     - **Aucune bonne réponse** → l'attente repart pour une durée réduite, puis le rattrapage se rejoue. Sans limite.

### Déroulement du rattrapage

- **Feedback immédiat après chaque question** : le joueur sait tout de suite s'il a bon ou faux et voit la bonne réponse, puis passe à la suivante. Même mécanique qu'en ascension.
- **Toutes les questions se jouent**, même une fois le seuil de réussite atteint : c'est le seul endroit du jeu où une question du Pool Échecs peut progresser vers sa sortie. S'arrêter plus tôt priverait le joueur de ce progrès.
- Le résultat s'annonce à la fin.
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

- Le joueur atteint le palier quand toutes les questions de l'étage courant sont vues. Le Pool Échecs peut être non vide : les ratées non rattrapées sont abandonnées.
- Franchir le palier incrémente l'étage et réserve la première question du suivant.
- La **dernière question restante de l'étage n'est jamais une question loot**. Sans cette règle, un Mimic sur cette question opposerait le palier à l'attente, alors que la règle « l'étage épuisé prime sur les vies » a déjà tranché. Voir [`bonus.md`](./bonus.md#question-loot).

## Fin de partie

- Toutes les questions du dernier étage vues → message de félicitations, phase terminale.
- Pas de classement.
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
| Questions résolues entre deux coffres | 20 |
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
multiplicatifs. Les vies, elles, s'additionnent, mais la limite de deux effets
négatifs garantit qu'une tentative démarre toujours avec au moins une vie.
