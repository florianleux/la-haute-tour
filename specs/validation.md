# Validation des réponses

## Format de réponse

**Réponse libre** (saisie texte). Pas de QCM.

## Tolérance aux fautes

La comparaison se fait **à l'oreille, pas à la lettre**. Ce que le joueur sait, c'est une réponse ; l'orthographe d'un nom propre n'en fait pas partie. Compter les caractères ne sait pas faire la différence entre une graphie et une erreur : « Sarkosy » est à une lettre de « Sarkozy » et se prononce pareil, « Rose » est à une lettre de « Rome » et n'a rien à voir.

- **Normalisation** d'abord : trimming, lowercase, suppression des accents, des articles et de la ponctuation.
- **Chiffres identiques**, sans aucune tolérance. Se tromper d'un chiffre dans une année, ce n'est pas mal l'écrire, c'est répondre autre chose : « 1880 » ne vaut pas « 1889 ».
- **Chiffres romains identiques**, pour la même raison : « Louis IX » n'est pas « Louis II ».
- **Même son** pour le reste. Chaque mot est réduit à un code phonétique français — `ph` = f, `s` entre deux voyelles = z, doubles repliées, nasales, finales muettes — et deux réponses se valent si leurs codes coïncident.

Un mot contenant `ch` produit **deux lectures**, /ʃ/ comme dans « Michel » et /k/ comme dans « orchestre » ; il suffit qu'une coïncide.

Ce que cela accepte : « Bordo » pour Bordeaux, « Flemming » pour Fleming, « Vanesa » pour Vanessa, « Escargots » pour Escargot, « Nabukodonosor » pour Nabuchodonosor.

Ce que cela refuse, et qui passait avant : « Rose » pour Rome, « Manet » pour Monet, toute année fausse d'un chiffre. Et, assumé, **la faute de frappe qui change le son** — « Berloiz » pour Berlioz. C'est la contrepartie du principe : si c'est l'oreille qui tranche, une inversion de doigts qui change la prononciation est une autre réponse. À rouvrir seulement si ça mord en jeu, et jamais par une tolérance au caractère près, qui ramènerait « Rose » pour « Rome » par la même porte.

Un choix de conception à connaître : replier les doubles avant de traiter le `s` intervocalique fait passer « Vanesa », au prix de confondre « poisson » et « poison ». Arbitré en faveur du premier — le deck répond surtout des noms propres.

## Prénom et nom

Un tiers du deck répond un nom de personne. **Le nom de famille seul suffit, et c'est ce qu'on attend** : les questions sont posées pour ça, et ne donner que le nom de famille est la bonne façon de répondre. Le prénom seul, lui, ne vaut rien — il n'identifie personne.

Le prénom est donc **facultatif, mais engageant** : rien n'oblige à le donner, et le donner faux rend la réponse fausse. « Ian Fleming » n'est pas « Alexander Fleming », c'est quelqu'un d'autre.

Restent les cas où le prénom est **juste mais autrement écrit** — « Yann » pour « Ian », « Alexandre » pour « Alexander », ou réduit à son initiale. Donc, sur une réponse d'**au moins deux mots** : un seul mot peut être à un son près, les autres doivent s'entendre exactement. Le nom de famille ancre la réponse, le prénom a le jeu. Une **initiale** vaut le mot qu'elle ouvre.

Trois garde-fous :

- Une réponse d'**un seul mot** n'a aucun jeu — « Rose » ne vaudra jamais « Rome ».
- Un mot qui porte une **valeur** n'en a aucun non plus — « Charles II » ne vaut pas « Charles III ».
- **Un seul** mot peut flotter. Deux, et c'est refusé.

Aligner plusieurs noms pour ratisser ne marche pas non plus : le nombre de mots doit correspondre.

Un piège à connaître : **sept initiales courantes sont aussi des chiffres romains** — C, D, I, L, M, V, X, soit Claude, Daniel, Ian, Louis, Michel, Victor, Xavier. Une lettre seule vaut donc l'initiale du mot qu'elle ouvre, sauf en face d'un vrai chiffre romain, où « Louis I » ne doit pas valoir « Louis II ».

## Réponses acceptées

- Chaque question porte une ou plusieurs **réponses acceptées**. Aucune n'est privilégiée : la tolérance typo s'applique à chacune, un seul cas à traiter.
- Ex. réponses acceptées « Bordeaux » et « la ville de Bordeaux » → « Bordaux » (Levenshtein 1 sur la première) validé, « la ville de Bordeaux » validé, « la ville de Bordaux » (Levenshtein 1 sur la seconde) validé.
- La **réponse affichée** est montrée au joueur sur échec. Elle ne sert jamais au matching : elle peut être plus riche que ce qu'on attend en saisie.

## Réponse vide

Une réponse vide est fausse. Elle survient de deux façons : le timer expire sans saisie, ou le joueur quitte la page alors qu'il n'a rien tapé (voir [`anti-triche.md`](./anti-triche.md)).

Une réponse vide n'est **pas contestable** : accepter une telle contestation ajouterait la chaîne vide aux réponses acceptées de la question, et toute réponse vide serait dès lors validée pour tous les joueurs.

## Contestation

### Quand

- Une **erreur contestable** est une erreur encore au **Pool Échecs de l'étage courant**, quelle que soit la tentative où elle a été commise, et pas encore contestée — une seule contestation par question. Ne se contestent pas : une réponse vide (voir plus haut), ni la réponse soumise par un départ de page (voir [`anti-triche.md`](./anti-triche.md#perte-de-focus)) — un échec de rattrapage sur la même question n'y change rien. Vue de nouveau après une remise à zéro (voir [`admin.md`](./admin.md#gestion-des-joueurs)) et ratée sur une vraie réponse, la question redevient contestable.
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
