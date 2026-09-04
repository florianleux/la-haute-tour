# Validation des réponses

## Format de réponse

**Réponse libre** (saisie texte). Pas de QCM.

## Tolérance aux fautes

- **Distance de Levenshtein ≤ 2** par rapport à une des réponses acceptées.
- **Normalisation** avant calcul : trimming, lowercase, suppression des accents, des articles et de la ponctuation.

## Réponses acceptées

- Chaque question porte une ou plusieurs **réponses acceptées**. Aucune n'est privilégiée : la tolérance typo s'applique à chacune, un seul cas à traiter.
- Ex. réponses acceptées « Bordeaux » et « la ville de Bordeaux » → « Bordaux » (Levenshtein 1 sur la première) validé, « la ville de Bordeaux » validé, « la ville de Bordaux » (Levenshtein 1 sur la seconde) validé.
- La **réponse affichée** est montrée au joueur sur échec. Elle ne sert jamais au matching : elle peut être plus riche que ce qu'on attend en saisie.

## Réponse vide

Une réponse vide est fausse. Elle survient de deux façons : le timer expire sans saisie, ou le joueur quitte la page alors qu'il n'a rien tapé (voir [`anti-triche.md`](./anti-triche.md)).

Une réponse vide n'est **pas contestable** : accepter une telle contestation ajouterait la chaîne vide aux réponses acceptées de la question, et toute réponse vide serait dès lors validée pour tous les joueurs.

## Contestation

### Quand

- Le joueur conteste les erreurs de sa **tentative en cours**, et celles de la tentative qui vient de s'achever tant qu'il est en attente.
- Deux endroits : sur l'écran de **verdict**, au moment où le désaccord naît — le joueur vient de lire « faux » et la bonne réponse — et sur l'écran d'**attente**, filet pour qui est passé trop vite à la question suivante.
- L'écran de verdict n'est pas chronométré : contester n'ouvre aucune brèche.
- **Bouton seul**, pas de message libre.

### Effet sur le joueur

- Acceptée **alors que le joueur n'a plus de vie** — en attente, ou dans le rattrapage que cette attente a ouvert → l'attente est annulée comme si elle n'avait jamais commencé et le rattrapage en cours est abandonné. Le joueur reprend **la même tentative** avec une vie ; les autres pertes de la tentative restent acquises.
  - Le rattrapage n'a pas lieu, ou s'arrête : il n'existait que pour rendre les vies que l'arbitrage vient de rendre. Les questions déjà jouées gardent ce qu'elles ont fait bouger dans le Pool Échecs.
- Acceptée **après** que le joueur a repris → une vie s'ajoute à la tentative en cours.
- **Aucun plafond** : une vie rendue par contestation peut porter le total au-delà du nombre de vies d'une tentative. Ce n'est pas une récompense, c'est une réparation — la plafonner l'annulerait précisément dans le cas où le joueur a le plus attendu.
- Rejetée → contestation clôturée, aucun effet.

### Effet sur la question

Accepter une contestation, c'est établir que le joueur avait raison. Par conséquent :

- la réponse contestée est **ajoutée aux réponses acceptées** de la question, pour **tous les joueurs** ;
- le **verdict du joueur est corrigé** : la question devient juste ;
- la question **sort du Pool Échecs**. La garder ferait payer deux fois une erreur d'arbitrage — une fois en vie, une fois en rattrapage ;
- la progression ne bouge pas : la question reste vue.

### Effet sur les Sorts — aucun

La contestation répare le joueur, elle ne rembobine pas les Sorts. Voir [`bonus.md`](./bonus.md#contestation).

- Les sorts lancés pendant une attente ensuite annulée **restent lancés**. Leurs effets sont déjà chez d'autres joueurs ; les défaire créerait des états inexplicables pour les victimes, et rendre les objets ferait de la contestation un moyen de récupérer ses sorts.
- Un Répit posé sur une attente qui n'existe plus est **gaspillé**.
- Le **coffre d'une question loot ratée puis contestée est perdu** : le statut loot est attaché au passage, et le passage est fini. C'est la seule entorse au principe « ne pas faire payer deux fois une erreur d'arbitrage », assumée pour ne pas avoir à rouvrir un coffre hors du flux d'ascension.
