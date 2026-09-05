# La Haute Tour — Spécification fonctionnelle

## Principe général

Jeu web de culture générale avec inscription Discord. Stack : **Nuxt 3** (Vue 3 + Nitro) + **Turso** (SQLite hébergé) sur **Netlify**. Zéro gestion serveur, zéro infrastructure externe (sauf Discord).

Base de contenu : deck commun de questions de culture générale, partagé par tous les joueurs, réparti en **6 étages**. Le deck porte **3 niveaux de difficulté**, chacun réparti sur 2 étages : difficulté 1 → étages 1-2, difficulté 2 → étages 3-4, difficulté 3 → étages 5-6. Le volume du deck n'est pas fixé — la mécanique ne dépend d'aucun nombre de questions.

## Glossaire

Les specs sont en français, le code en anglais. La colonne **Nom en code** est la
seule traduction autorisée : un terme du domaine ne s'invente pas au moment de coder,
il se lit ici. Tout nouveau terme s'ajoute d'abord à ce tableau.

| Terme | Nom en code | Définition |
|-------|-------------|------------|
| **Étage** | `floor` | Un des 6 groupes de questions traversés dans l'ordre. Étages 1-2 = difficulté 1, 3-4 = difficulté 2, 5-6 = difficulté 3. Les deux étages d'une même difficulté sont équivalents. |
| **Difficulté** | `difficulty` | Niveau de difficulté du deck, de 1 (le plus facile) à 3. Dérivée de l'étage (`ceil(floor / 2)`), jamais stockée séparément. |
| **Ascension** | `ascent` | Progression du joueur à travers les questions de l'étage courant. |
| **Tentative** | `attempt` | Période de jeu qui va des vies pleines jusqu'à la perte de la dernière vie. S'achève en attente, ou se poursuit si une contestation rend une vie. Sa longueur se compte en questions vues, et n'est inscrite qu'au moment où la suivante s'ouvre. |
| **Vies** | `lives` | Unités perdues sur erreur. Restaurées au nombre plein à chaque reprise après attente. |
| **Vue** | `seen` | Question résolue en ascension, juste ou fausse. Seule unité de progression : c'est le nombre de vues qui fait passer d'étage et termine la partie. |
| **Réservation** | `reservation` | La question servie au joueur, horodatée, en attente de résolution. Une seule à la fois. Se résout par une réponse ou par l'expiration du timer. |
| **État de jeu** | `gameState` | Ce que le serveur répond à « où en est le joueur » : phase, étage, vies, et ce que la phase contient. Servi par un seul endpoint de lecture, sans effet. |
| **Phase** | `phase` | État de jeu déterminé par le serveur, qui décide seul de l'écran affiché : `ascent`, `cooldown`, `recovery`, `floorEnd`, `gameOver`. Voir [`mecanique.md`](./mecanique.md). |
| **Verdict** | `verdict` | Résultat d'une question résolue — juste ou faux, réponse affichée, vie perdue — conservé côté serveur jusqu'à ce que le joueur passe à la suite. |
| **Pool Échecs** | `missedPool` | Questions ratées de l'étage courant, en attente de rattrapage. Persistant, jamais remis à zéro tant qu'on reste à l'étage. |
| **Réussites** | `poolSuccesses` | Nombre de bonnes réponses consécutives obtenues en rattrapage sur une question du Pool Échecs. Une mauvaise réponse le remet à zéro ; le seuil atteint fait sortir la question du pool. |
| **Rattrapage** | `recovery` | Retest de quelques questions du Pool Échecs, à l'issue de l'attente, pour retrouver ses vies. |
| **Attente** | `cooldown` | Délai forcé après la perte de la dernière vie, avant de pouvoir reprendre ou rattraper. |
| **Palier** | `floorEnd` | Fin d'étage : toutes les questions de l'étage sont vues, le joueur s'apprête à monter au suivant. |
| **Franchir le palier** | `crossFloor` | L'action qui fait monter d'un étage : elle incrémente l'étage, abandonne le Pool Échecs de celui qu'on quitte et réserve la première question du suivant. |
| **Contestation** | `dispute` | Arbitrage par l'admin d'une réponse jugée fausse à tort. |
| **Perte de focus** | `focusLoss` | Le joueur quitte la page pendant qu'un timer tourne : sa réponse est soumise en l'état et la soumission est marquée. Visible de l'administration seulement, et non contestable. |
| **Whitelist** | `whitelist` | Discord IDs autorisés à s'inscrire, alimentée manuellement. |
| **Énoncé** | `statement` | Le texte de la question posée au joueur. |
| **Réponses acceptées** | `acceptedAnswers` | Toutes les formulations qui valident la question. Aucune n'est privilégiée : la tolérance typo s'applique à chacune. L'admin en ajoute une quand il accepte une contestation. |
| **Réponse affichée** | `answerLabel` | La formulation montrée au joueur quand il échoue. Souvent plus riche que ce qu'on lui demande de saisir (« FLEMING (Alexander) » pour une réponse acceptée « Fleming »). Ne sert jamais au matching. |
| **Rang** | `rank` | La place d'une question dans l'ordre de son étage. Fixé une fois à l'import, identique pour tous les joueurs : le deck a un ordre, chacun le parcourt à son rythme. |
| **Curseur d'étage** | `floorCursor` | Le rang de la dernière question servie au joueur à son étage. C'est lui qui dit où il en est du deck ; remis à zéro au franchissement du palier. |
| **Catégorie** | `category` | Thème d'une question (Histoire, Musique, Sport…). Une question en porte zéro, une ou plusieurs. |
| **Profil** | `profile` | Page d'identité du joueur : pseudo, ancienneté, déconnexion. Ne porte ni état de jeu ni donnée de triche. |
| **Parcours** | `journey` | Ce que le profil montre du chemin déjà fait : étage atteint, questions vues, meilleure série, tentatives achevées. Jamais l'état de l'instant. |
| **Rendre une vie** | `grantLife` | Rendre une vie à un joueur — contestation acceptée, ou geste d'admin. Sans plafond : c'est une réparation, pas une récompense. S'il n'en avait plus, l'attente et le rattrapage en cours sont annulés et la tentative se poursuit. |
| **Passer l'attente** | `skipCooldown` | Geste d'admin qui fait échoir immédiatement l'attente d'un joueur. La suite se déroule comme si le délai s'était écoulé : rattrapage si le Pool Échecs le permet, reprise sinon. |
| **Fiche joueur** | `playerCard` | Ce que l'admin voit d'un joueur d'un seul coup d'œil : identité, étage, progression, phase, vies, attente en cours et contestations en attente. Lecture pure, sans effet sur la partie. |
| **Sort** | `spell` | Le seul objet qu'on obtient en jouant. Se lance pendant l'attente, sur soi, un allié ou un ennemi. Voir [`bonus.md`](./bonus.md). |
| **Lancer** | `cast` | L'action de consommer un sort de son inventaire vers une catégorie de cible. |
| **Cible** | `target` | Le joueur que le tirage désigne. Jamais choisi nominativement. |
| **Catégorie de cible** | `targetKind` | Ce que le lanceur choisit, faute de choisir une personne : `self`, `ally` ou `foe`. |
| **Magie blanche** | `boon` | La face positive d'un sort, appliquée sur soi ou un allié. |
| **Magie noire** | `curse` | La face négative, appliquée sur un ennemi. Miroir systématique de la face blanche. |
| **Effet actif** | `activeEffect` | Un effet posé sur un joueur, en attente de son déclencheur. Ancré sur la prochaine tentative de la cible, il meurt avec elle, consommé ou non. |
| **Inventaire** | `inventory` | Les sorts que le joueur possède et n'a pas encore lancés. Consultable en attente seulement. |
| **Question loot** | `lootQuestion` | Statut d'un passage, non d'une question : la 20e question résolue de l'étage ouvre un coffre si elle est juste. |
| **Coffre** | `chest` | Ce qui s'ouvre au verdict d'une question loot réussie. Donne un sort, ou un Mimic. |
| **Mimic** | `mimic` | Le coffre piégé : aucun objet, et toutes les vies de la tentative retirées d'un coup. |
| **Talisman** | `talisman` | Passif équipé en continu, qui module les Sorts. Hors périmètre. |

Le mot **session** n'appartient pas au vocabulaire du domaine : il désigne uniquement la session d'authentification (cookie signé, `SessionData`). La période de jeu qui finit en attente s'appelle une **tentative**.

## Documents

- [`ecrans.md`](./ecrans.md) — Les écrans : inventaire, correspondance phase → écran, contenu de chacun.
- [`mecanique.md`](./mecanique.md) — Mécanique de jeu : ascension, tentative, Pool Échecs, attente, rattrapage, et la machine à états des phases.
- [`validation.md`](./validation.md) — Validation des réponses : tolérance aux fautes, réponses acceptées, contestation.
- [`anti-triche.md`](./anti-triche.md) — Timer arbitré par le serveur, perte de focus, whitelist, flags admin.
- [`admin.md`](./admin.md) — Administration : flag admin, dashboard, file de contestation, CRUD questions.
- [`architecture.md`](./architecture.md) — Stack technique, données, authentification, forme de l'API, hébergement.
- [`bonus.md`](./bonus.md) — Sorts, question loot, coffres et Mimic. Le seul système qui fasse communiquer deux parties entre elles.

## Règles chiffrées

Aucune valeur numérique du jeu (vies, timers, nombre de questions de rattrapage, seuils, durées d'attente) n'est écrite en dur dans le code : elles vivent toutes dans un jeu de règles unique, consultable par étage. Voir [`mecanique.md`](./mecanique.md#règles-chiffrées). Les specs citent les valeurs par défaut à titre indicatif ; le jeu de règles fait foi.

## Points encore à spécifier

- Contenu de l'écran de palier (`floorEnd`) : texte et mise en scène du passage d'étage.
- Statistiques du profil joueur — la page existe, son contenu chiffré reste à définir.
- Règles propres à un étage : la surcharge par étage est prévue, aucune valeur divergente n'est décidée.
- Pondération du tirage de rattrapage : aujourd'hui au hasard dans le Pool Échecs, sans favoriser les questions proches de la sortie.

---
*Document de travail — v3, après grilling sur les écrans et le modèle à phases.*
