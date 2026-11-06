# Champignon appétissant

Une quête secondaire : un champignon pousse au camp, le joueur le cueille, le mange quand il veut, et paie sa reprise immédiate d'une ascension sous hallucination.

## L'Objet

- **Champignon appétissant** : un Objet de l'Inventaire, comme la Plume de copiste ou le Filet à sangsues. Il s'utilise : son bouton dit **Manger**.
- **Un seul à la fois** dans le sac.

## Apparition et cueillette

- Le champignon apparaît **au camp, dans toutes ses phases** : attente, rattrapage avant « Commencer », ascension au repos, pied de la porte du boss. Une image posée sur le décor du camp, en version jour et en version nuit.
- **Première apparition dès le premier camp**, à la sortie de l'introduction.
- Rien au survol que le curseur : ni nom, ni lueur, ni grossissement.
- Chaque clic le fait **rebondir**, comme si on le tâtait. Un **triple clic rapide le cueille** : il quitte le décor et entre dans l'Inventaire. Au clavier, Entrée suffit.
- La cueillette joue la **scène d'obtention** (« Obtenu », comme le Fromage ou un objet de coffre) : le champignon saute du décor au centre de l'écran, jusqu'au OK.
- Il **réapparaît 7 jours glissants après sa consommation**. Tant que le joueur en a un au sac, aucun autre ne pousse.
- **Remise à zéro du joueur** : tout s'efface, champignon au sac compris et délai compris. Il repousse au premier camp, comme pour une partie neuve.

## Le manger

- **Manger**, depuis l'Inventaire, au camp, dans toutes ses phases.
- L'effet dépend de la phase :

| Phase du camp | Effet |
|---|---|
| Attente | L'attente échoit, **sans rattrapage** : vies pleines, reprise de l'ascension |
| Rattrapage avant « Commencer » | Le rattrapage est sauté : vies pleines, reprise de l'ascension |
| Ascension au repos, pied de la porte du boss | Aucun effet sur l'attente ni les vies : seule l'intoxication |

- Les Talismans et Sorts qui touchent l'attente ne l'empêchent pas : le champignon la fait échoir quoi qu'il arrive. Les sorts liés à l'attente (Répit, Indulgence, Purge) meurent avec elle, selon la règle existante (voir [ADR 0004](../docs/adr/0004-les-sorts-lies-a-l-attente.md)).

## L'ascension intoxiquée

**Du repas jusqu'au retour au camp** (chute, Mimic, défaite au boss, « Redescendre » depuis la porte du boss), le joueur est **intoxiqué**. La tour finie l'arrête aussi : la fin de partie ne ramène plus au camp. Trois effets :

- **Psychédélique** : couleurs et vagues qui déforment tout l'écran, dès le repas, une fois le sac fermé, en montant sur 2 secondes. Camp et boîtes du camp compris, et jusqu'à l'arrivée au camp : le verdict de la chute se lit encore dessous. Avec « réduire les animations » (réglage du système), les vagues tombent, les couleurs restent.
- **Michel en éléphant** : tant que l'écran est intoxiqué, un éléphant remplace l'illustration de Michel, quelle que soit la leçon. Déjà à l'écran quand l'intoxication monte, Michel se fond en éléphant sur les mêmes 2 secondes.
- **Clavier décalé** : dans les champs de réponse, aux questions d'ascension et aux épreuves d'un combat de boss, chaque lettre tapée devient la suivante dans l'alphabet, et **la réponse envoyée est réellement altérée**.
  - Minuscules : a→b … y→z, z→a.
  - Majuscules : A→B … Y→Z, Z→A.
  - Lettres accentuées, chiffres, espaces et ponctuation : intacts.
  - Appliqué **par l'écran**, à la frappe : le champ montre et envoie la saisie décalée, le serveur juge ce qu'il reçoit.
  - **Limite connue** : contournable par les outils de développement. Assumé.

Sur chaque question et chaque épreuve intoxiquée, une **icône d'effet actif**, comme pour les sorts (voir [`ecrans.md`](./ecrans.md#ascent--question)). Son infobulle a le dessin de celle d'un sort, avec l'image du champignon : « Intoxication alimentaire », « Ton écriture semble un peu... décalée. »

Les vies, le Pool Échecs, la série, les coffres et la progression fonctionnent normalement : l'intoxication a de vrais enjeux.

## Contestation

Une réponse fausse à cause du clavier décalé reste **contestable**, aux règles habituelles (voir [`validation.md`](./validation.md#quand)). L'admin voit la réponse décalée, comme une contestation ordinaire, sans mention de l'intoxication.

## Leçon de Michel

**Champignon** : au premier clic sur Manger, Michel surgit aussitôt (« HÉ ! ») et demande au joueur s'il est sûr de vouloir le manger.

- Il prévient d'abord : certains champignons permettent de se reposer plus vite, mais il ne le tenterait pas.
- **Oui** : le joueur le mange, l'Inventaire se ferme, Michel reste sans bouger et se tait pendant que l'intoxication monte, puis il parle sur le camp : il l'avait bien dit, le joueur peut repartir à l'ascension, mais il n'a pas l'air net.
- **Non** : le champignon reste au sac, et Michel s'en va.

**Champignon mangé** (`mushroomEaten`) : son commentaire se joue au premier repas, quelle qu'ait été la réponse. Après un Non suivi d'un repas, Michel arrive une fois l'intoxication montée, sans « HÉ ! » ni question. Le joueur qui recharge avant de l'avoir lu le revoit au retour sur le camp, tant qu'il est intoxiqué.

Dans les deux cas la leçon (`mushroom`) est datée : les champignons suivants se mangent directement.

## Succès

Famille **Champignon — 3** :

| Succès | Déclencheur |
|---|---|
| Chasseur-cueilleur | Cueillir son premier champignon |
| Aucun instinct de survie | Manger son premier champignon |
| Descente d'acide | Revenir au camp après une ascension intoxiquée |

Le troisième suit presque toujours le deuxième : toute ascension intoxiquée finit par un retour au camp, ou par la fin de la tour. Son toast attend le camp.

## Noms en code

| Terme | Nom en code |
|---|---|
| Champignon appétissant | `MUSHROOM` |
| Cueillir | `pick` |
| Intoxication | `intoxicated` |
| Leçon Champignon | `mushroom` |
