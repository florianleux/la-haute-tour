# La Haute Tour — Spécification fonctionnelle

## Principe général

Jeu web de culture générale avec inscription Discord. Stack : **Nuxt 3** (Vue 3 + Nitro) + **Turso** (SQLite hébergé) sur **Netlify**. Zéro gestion serveur, zéro infrastructure externe (sauf Discord).

Base de contenu : deck commun de questions de culture générale, partagé par tous les joueurs, réparti en **6 étages**. La répartition est **purement aléatoire** : les 6 étages sont équivalents, aucun n'est plus difficile qu'un autre. Le volume du deck n'est pas fixé — la mécanique ne dépend d'aucun nombre de questions.

## Glossaire

Les specs sont en français, le code en anglais. La colonne **Nom en code** est la
seule traduction autorisée : un terme du domaine ne s'invente pas au moment de coder,
il se lit ici. Tout nouveau terme s'ajoute d'abord à ce tableau.

| Terme | Nom en code | Définition |
|-------|-------------|------------|
| **Étage** | `floor` | Un des 6 groupes de questions traversés dans l'ordre. Les questions y sont réparties au hasard à l'import : les 6 étages sont équivalents, monter n'est pas monter en difficulté. |
| **Ascension** | `ascent` | Progression du joueur à travers les questions de l'étage courant. |
| **Tentative** | `attempt` | Période de jeu qui va des vies pleines jusqu'à la perte de la dernière vie. S'achève en attente, ou se poursuit si une contestation rend une vie. Sa longueur se compte en questions vues, et n'est inscrite qu'au moment où la suivante s'ouvre. |
| **Vies** | `lives` | Unités perdues sur erreur. Restaurées au nombre plein à chaque reprise après attente. |
| **Début de partie** | `startOfGame` | Étage 1, vies pleines selon le jeu de règles : l'état d'un compte neuf — réel, test ou de dev — comme d'un joueur remis à zéro. |
| **Vue** | `seen` | Question résolue en ascension, juste ou fausse. Seule unité de progression : c'est le nombre de vues qui fait passer d'étage et termine la partie. |
| **Réservation** | `reservation` | La question servie au joueur, horodatée, en attente de résolution. Une seule à la fois. Se résout par une réponse ou par l'expiration du timer. |
| **État de jeu** | `gameState` | Ce que le serveur répond à « où en est le joueur » : phase, étage, vies, et ce que la phase contient. Servi par un seul endpoint de lecture, sans effet. |
| **Phase** | `phase` | État de jeu déterminé par le serveur, qui décide seul de l'écran affiché : `ascent`, `cooldown`, `recovery`, `floorEnd`, `bossDoor`, `bossFight`, `gameOver`. Voir [`mecanique.md`](./mecanique.md). |
| **Verdict** | `verdict` | Résultat d'une question résolue — juste ou faux, réponse affichée, vie perdue — conservé côté serveur jusqu'à ce que le joueur passe à la suite. |
| **Pool Échecs** | `missedPool` | Questions ratées de l'étage courant, en attente de rattrapage. Persistant, jamais remis à zéro tant qu'on reste à l'étage. |
| **Réussites** | `poolSuccesses` | Nombre de bonnes réponses consécutives obtenues en rattrapage sur une question du Pool Échecs. Une mauvaise réponse le remet à zéro ; le seuil atteint fait sortir la question du pool. |
| **Rattrapage** | `recovery` | Retest de quelques questions du Pool Échecs, à l'issue de l'attente, pour retrouver ses vies. Le bouton qui l'ouvre porte « Commencer » — les boutons des écrans illustrés tiennent en un mot, et « Reprendre » est déjà pris par la sortie du rattrapage réussi. |
| **Scellé** | `sealed` | Le verdict du rattrapage est scellé : le quota de bonnes réponses est atteint (succès) ou mathématiquement impossible à atteindre avec les questions restantes (échec). Le rattrapage s'arrête — les questions non jouées restent dans le Pool Échecs sans progression de leur compteur. |
| **Attente** | `cooldown` | Délai forcé après la perte de la dernière vie, avant de pouvoir reprendre ou rattraper. |
| **Camp** | `camp` | L'attente, prolongée jusqu'au tirage du rattrapage : tant que le joueur n'a pas cliqué « Commencer », il reste au camp. C'est là, et là seulement, que les Sorts se consultent et se lancent. |
| **Chute** | `fall` | Le verdict de la question qui vient de prendre la dernière vie, lu avant le poster d'attente. Le serveur est déjà en attente : l'écran le retient le temps d'un clic sur « Redescendre ». Un rechargement va droit au poster. Vit côté client seulement. |
| **Début d'attente** | `cooldownStartedAt` | L'instant où l'attente en cours a commencé. C'est de lui que Répit la recalcule, et c'est lui qui l'identifie auprès des effets — son échéance, elle, se déplace. |
| **Durée d'attente** | `cooldownBaseMs` | Ce que l'attente en cours dure avant qu'aucun sort ne la touche. Portée par le joueur : elles ne durent pas toutes pareil, celle d'un rattrapage manqué étant plus courte. |
| **Palier** | `floorEnd` | Fin d'étage : toutes les questions de l'étage sont vues, le joueur s'apprête à monter au suivant. |
| **Franchir le palier** | `crossFloor` | L'action qui fait monter d'un étage : elle incrémente l'étage, abandonne le Pool Échecs de celui qu'on quitte et réserve la première question du suivant. Se déclenche après la victoire sur le boss de l'étage, ou son passage automatique — plus à `floorEnd`. Voir [`boss.md`](./boss.md) et [ADR 0007](../docs/adr/0007-les-succes-de-franchissement-restent-sur-floorend.md). |
| **Boss** | `boss` | Mini-jeu propre à chaque étage, à franchir après son `floorEnd` pour que `crossFloor` se déclenche. Un par étage, 6 au total. Voir [`boss.md`](./boss.md). |
| **Porte du boss** | `bossDoor` | Phase d'attente devant le boss, à l'échelle de l'équipe : fermée tant que deux clés n'ont pas été posées, ouverte sinon — les deux se lisent sur un même champ, pas deux phases. Un joueur sans équipe n'y passe pas, il affronte le boss directement. |
| **Clé** | `key` | Ce qui ouvre la porte du boss, posée manuellement par deux membres d'une même équipe. Obtenue en loot forcé passé 50 % de l'étage parcouru. Une clé obtenue porte déjà ouverte reste acquise mais inutile — et se stocke quand même, à part de l'inventaire de Sorts. |
| **Combat de boss** | `bossAttempt` | Une tentative (`attempt`) dont le contenu est les épreuves du boss plutôt que le deck de l'étage — mêmes vies, même attente, même rattrapage sur le Pool Échecs de l'étage, seul le contenu diffère. Jusqu'à 6 par boss, en 3 paliers de difficulté dégressive ; 6 échecs consécutifs font passer l'étage automatiquement. Voir [ADR 0006](../docs/adr/0006-le-combat-de-boss-reutilise-la-tentative.md). |
| **Numéro de combat** | `bossAttemptNumber` | Lequel des 6 combats de boss maximum le joueur dispute — ce qui détermine sa difficulté. Remis à zéro au franchissement du palier, comme `floorCursor`. |
| **Combat** | `bossFight` | Phase active d'un combat de boss : épreuves posées une à une jusqu'à ce que le boss soit à 0 PV (victoire) ou le joueur à 0 vie (défaite). |
| **PV du boss** | `bossHp` | Points de vie du boss pour le combat en cours — 7 par défaut, remis à ce plein à l'ouverture de chaque nouveau combat. Une épreuve juste en retire un. |
| **Relique** | `relic` | Objet cosmétique laissé par un boss battu — vraie victoire ou passage automatique après 6 échecs. Sans effet pour le moment. |
| **Dialogue** | `dialogue` | Une suite de répliques jouée sur un décor, devant un ou deux interlocuteurs. Écrit en code, jamais en base, et joué entièrement côté client : rien n'y avance la partie, seul son terme rend la main à l'écran qui l'a lancé (voir [ADR 0009](../docs/adr/0009-le-dialogue-s-ecrit-en-code.md)). Porte sa distribution et le rythme de son défilé. Premier usage : l'introduction d'un boss (voir [`boss.md`](./boss.md#introduction-et-animations)). |
| **Réplique** | `line` | Une prise de parole d'un dialogue : la place de celui qui parle, et son texte, qui sort caractère par caractère. Un geste du joueur la montre en entier, le suivant passe à celle d'après. |
| **Interlocuteur** | `speaker` | Qui parle dans un dialogue : un nom et un portrait, et parfois la couleur de ses répliques (`color`), reprise de son habit. Deux au plus, jamais trois — la forme d'un dialogue l'interdit plutôt que de l'écarter en silence (voir [ADR 0010](../docs/adr/0010-le-type-interdit-un-troisieme-interlocuteur.md)). Celui qui ne parle pas reste à l'affiche, en retrait — pas absent. |
| **Place** | `place` | Où un interlocuteur se tient sur la scène : `left` ou `right` quand ils sont deux, `center` quand il est seul. Ce n'est pas un côté : un interlocuteur seul se place au milieu. |
| **Affiche** | `lineup` | Qui se tient sur la scène pendant tout le dialogue, et à quelle place. Déclarée par le dialogue, jamais déduite de ses répliques — c'est elle qui interdit un troisième interlocuteur (voir [ADR 0010](../docs/adr/0010-le-type-interdit-un-troisieme-interlocuteur.md)). Celui qui ne parle pas y reste, en retrait. |
| **Retrait** | `retreat` | Ce que fait le portrait de l'interlocuteur qui ne parle pas : il recule, se délave et s'assombrit, sans quitter l'affiche. Un interlocuteur peut en être dispensé (`retreats: false`) quand son portrait ne se lirait plus en retrait — la silhouette du joueur à l'introduction, déjà délavée : elle garde alors l'allure de celui qui parle, du début à la fin. |
| **Déroulé** | `playback` | Un dialogue en train d'être joué : la réplique en cours, ce qui en est sorti, et le geste qui fait avancer les deux. Vit côté client seulement, le temps de la scène. |
| **Drapeau** | `flag` | Le contenu d'une épreuve du boss de l'étage 1 (Julien le perse) : une image de drapeau, ses réponses acceptées, sa réponse affichée. Table dédiée, distincte du deck de questions. Voir [`boss-etage1-drapeaux.md`](./boss-etage1-drapeaux.md). |
| **Geste** | `gesture` | Ce qu'un clic, une tape ou Entrée fait d'un dialogue : révéler la réplique en entier si elle défile encore, passer à la suivante sinon, rendre la main après la dernière. Sans effet (`wait`) tant qu'une invite attend une saisie valable, ou qu'un choix attend d'être cliqué. Un seul geste du début à la fin — le joueur pressé n'attend jamais le défilé, celui qui lit n'a rien de plus à apprendre. |
| **Nom d'aventurier** | `adventurerName` | Le nom que le joueur se donne à l'introduction, et sous lequel le jeu le montre partout. Il prime sur le pseudo Discord (`username`), que la connexion continue de resynchroniser sans jamais l'écraser : l'affichage lit `adventurerName ?? username`. Entre 1 et 15 caractères, espaces de bout coupés. Pas encore implémenté — l'introduction le demande, mais ne le garde nulle part. |
| **Invite** | `prompt` | Ce qu'une réplique demande à écrire au joueur : un libellé (« Votre nom ») et les bornes de ce qui est accepté. Le champ paraît dans la boîte une fois la réplique sortie, et le dialogue n'avance pas tant que la saisie n'entre pas dans ces bornes. Sa valeur est rendue à l'écran qui a lancé le dialogue, comme son terme : le dialogue ne l'enregistre nulle part. |
| **Saisie** | `answer` | Ce que le joueur a écrit dans l'invite en cours. Vit le temps de la réplique — passer à la suivante la vide. |
| **Choix** | `choices` | Les réponses qu'une réplique propose au joueur, une ligne chacune, sous le texte une fois sorti — comme dans un point & click. Le joueur en clique une, et le dialogue passe à la suite ; le rang de celle qu'il a cliquée est rendu à l'écran qui a lancé le dialogue, comme la saisie d'une invite. Une réplique porte une invite ou des choix, jamais les deux. Ils se lisent dans la couleur de l'interlocuteur qui ne parle pas : c'est lui qui les dit. |
| **Genre** | `gender` | Ce que le joueur répond à L'Inconnu, à l'introduction, quand celui-ci lui demande ce qu'il est : un aventurier (`MALE`), une aventurière (`FEMALE`), ou « C'est pas tes oignons », qui lui donne un genre neutre (`NEUTRAL`). Gardé sur son compte, null tant qu'il n'a pas répondu. Servira plus tard ; rien ne le lit encore. Réécrit à chaque réponse : l'introduction se rejoue. |
| **Introduction** | `intro` | La scène où L'Inconnu accueille le joueur, lui demande son nom et ce qu'il est, puis lui raconte la Tour et comment y monter (`/intro`). Jouée à la première connexion, et à chaque connexion suivante tant qu'elle n'est pas finie : toute autre page y ramène. Finie quand le joueur clique « Commencer l'ascension » (`introDoneAt`), qui l'envoie au jeu. Rejouable ensuite, sans rien changer à sa partie. |
| **Défilé** | `reveal` | La sortie d'une réplique, caractère par caractère. Son rythme (`revealMs`) est celui du jeu, sauf quand un dialogue en demande un autre. |
| **Contestation** | `dispute` | Arbitrage par l'admin d'une réponse jugée fausse à tort. |
| **Erreur contestable** | `disputableError` (`isDisputable`) | Une erreur que le joueur peut encore contester. Les conditions vivent dans [`validation.md`](./validation.md#quand). |
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
| **Succès** | `achievement` | Une distinction débloquée en jouant, acquise à vie, sans aucun effet sur la partie. Côté joueur, leur écran s'appelle **Haut-faits**. Le catalogue est fixe, écrit dans le code, jamais administrable. À ne pas confondre avec les **Réussites** (`poolSuccesses`) du rattrapage, qui portent le même mot français sans rien partager d'autre. Voir [`succes.md`](./succes.md). |
| **Palmarès** | `achievementsHeld` | Les succès qu'un joueur a déjà acquis, portés par sa ligne comme il porte ses compteurs. La table des succès reste la source — elle seule les date, et c'est elle que la page Succès lit ; le palmarès n'existe que pour ne pas la relire à chaque requête. |
| **Série** | `streak` | Bonnes réponses d'affilée dans la tentative en cours, sans qu'aucune vie ait été perdue. Toute erreur la casse, toute nouvelle tentative la remet à zéro — c'est ce qui fait qu'atteindre la taille d'un étage prouve qu'on l'a passé sans faute. |
| **Vues totales** | `seenTotal` | Questions vues depuis la dernière remise à zéro du joueur, tous étages et toutes tentatives confondus. Ne redescend jamais d'ici là. |
| **Jour joué** | `playedDay` | Un jour où le joueur a résolu au moins une question, daté en Europe/Paris. Ouvrir le jeu sans jouer n'en fait pas un : c'est la partie qui compte, pas la visite. Le rattrapage en est une : on y répond à des questions. |
| **Assiduité** | `playStreak` | Jours joués qui se suivent, le dernier compris. Un jour sauté la ramène à un. À ne pas confondre avec la **Série** (`streak`), qui compte des réponses et non des jours. |
| **Premier arrivé** | `firstAscension` | Le premier joueur à avoir franchi l'étage 1, pour tout le jeu. Réclamé une seule fois et jamais repris. Ni les joueurs test ni l'admin ne le réclament. Aucun classement n'existe pour le désigner : la place se prend à l'écriture, tant qu'elle est libre. |
| **Rendre une vie** | `grantLife` | Rendre une vie à un joueur — contestation acceptée, ou geste d'admin. Sans plafond : c'est une réparation, pas une récompense. S'il n'en avait plus, l'attente et le rattrapage en cours sont annulés et la tentative se poursuit. |
| **Passer l'attente** | `skipCooldown` | Geste d'admin qui fait échoir immédiatement l'attente d'un joueur. La suite se déroule comme si le délai s'était écoulé : rattrapage si le Pool Échecs le permet, reprise sinon. Son bouton porte « Passer » sur les écrans illustrés, où le libellé tient en un mot ; le geste garde son nom entier partout ailleurs. |
| **Maintenance** | `maintenance` | Interrupteur d'administration qui ferme le jeu à tous sauf aux admins. Les joueurs se connectent toujours, mais n'obtiennent plus de nouvelle question. |
| **Fiche joueur** | `playerCard` | Ce que l'admin voit d'un joueur d'un seul coup d'œil : identité, étage, progression, phase, vies, attente en cours et contestations en attente. Lecture pure, sans effet sur la partie. |
| **Joueur test** | `testPlayer` | Un joueur créé par l'admin pour éprouver le jeu, sans compte Discord derrière. Il joue une vraie partie, mais dans un monde scellé : jamais de contact avec un vrai joueur. |
| **Incarnation** | `impersonation` | L'admin joue à la place d'un joueur test. Le jeu le prend pour lui ; les pouvoirs d'admin, eux, restent attachés au vrai compte. Réservée aux joueurs test. |
| **Sort** | `spell` | Le seul objet qu'on obtient en jouant. Se lance au **camp**, sur soi, un allié ou un ennemi. Voir [`bonus.md`](./bonus.md). |
| **Lancer** | `cast` | L'action de consommer un sort de son inventaire vers une catégorie de cible. |
| **Cible** | `target` | Le joueur que le tirage désigne. Jamais choisi nominativement. |
| **Catégorie de cible** | `targetKind` | Ce que le lanceur choisit, faute de choisir une personne : `self`, `ally` ou `foe`. |
| **Tirage de cible** | `drawTarget` | Le geste serveur qui change une catégorie en quelqu'un : filtrer les éligibles, les classer par progression, puis tirer en pondérant par le rang. Rend personne quand le pool est vide. |
| **Cible éligible** | `eligible` | Un joueur que le tirage garde : ni en fin de partie, ni jamais commencé, et lié au lanceur. Le filtre passe avant le classement, pour qu'un écarté ne pèse pas dans la distribution. |
| **Commencé** | `hasStarted` | Le joueur a vu au moins une question. Ce n'est pas une phase : un compte jamais ouvert est en ascension comme un autre, mais aucun effet ne l'atteindrait. |
| **Sort lié à l'attente** | `cooldownBound` | Un sort qui agit sur l'attente en cours de sa cible plutôt que sur sa prochaine tentative : Répit, Indulgence, Purge. Agit dès le lancer, et meurt avec l'attente visée. Voir [ADR 0004](../docs/adr/0004-les-sorts-lies-a-l-attente.md). |
| **Attente visée** | `targetCooldownStartedAt` | L'attente **de la cible** sur laquelle un sort lié à l'attente agit, par son début. Distincte de celle du lancer dès qu'on vise quelqu'un d'autre ; nulle quand la cible n'attend pas. |
| **Équipe** | `team` | L'une des deux appartenances, assignée par l'admin : les guildes, Méridiens (`MIDI`) ou Fauteuillistes (`TLM`). Elle ne sert qu'à dériver allié ou ennemi au moment d'un lancer. Facultative : l'admin n'en a pas. Voir [`equipes.md`](./equipes.md). |
| **Magie blanche** | `boon` | La face positive d'un sort, appliquée sur soi ou un allié. |
| **Magie noire** | `curse` | La face négative, appliquée sur un ennemi. Miroir systématique de la face blanche. |
| **Effet actif** | `activeEffect` | Un effet posé sur un joueur, en attente de son déclencheur. Ancré sur la prochaine tentative de la cible, il meurt avec elle, consommé ou non — sauf un sort lié à l'attente (Répit, Indulgence, Purge), qui agit dès le lancer et meurt avec l'attente visée. |
| **Effet porté** | `isBorneBy` | Un effet qu'un joueur subit encore : en attente de sa prochaine tentative, courant sur celle en cours, ou visant l'attente où il se tient. Ce que son écran montre, et ce que le tirage compte. |
| **Règles jouées** | `playedRules` | Les règles de l'étage telles que le joueur les subit : celles de l'étage, modulées par tous les effets qu'il porte et qui agissent déjà, cumul compris. |
| **Durée de vie** | `lifetime` | Jusqu'à quand un effet agit, une fois qu'il agit : toute la tentative (Vitalité, Chronomancie), l'attente où il est parti (Répit), le rattrapage qui la clôt (Indulgence), ou l'instant du lancer (Purge). Propre au sort. Voir [`bonus.md`](./bonus.md#ancrage-et-durée-de-vie). |
| **Enjeu** | `stake` | Ce qu'un effet change, en chiffres : la règle que sa face touche, de la valeur de l'étage à celle des règles jouées. Chiffré par le serveur, montré dans l'infobulle du sort ; aucun pour un effet qui n'agit pas encore. |
| **Plafond d'effets négatifs** | `maxCurses` | Combien de magies noires un joueur porte au plus. Au-delà il sort du tirage des ennemis, silencieusement. Aucun plafond en face pour les positives. |
| **Perfect exigé** | `perfectRequired` | Ce que l'Indulgence noire fait du rattrapage : autant de bonnes réponses que de questions tirées. Booléen, donc idempotent — deux noires valent une. Il ne remplace pas le seuil, il le porte à ce nombre. |
| **Viser autrui** | `canTargetOthers` | Le joueur a une équipe, donc les catégories Allié et Ennemi lui sont proposées. Une seule et même condition pour les deux : sans équipe, aucune ne désigne de pool. |
| **Face** | `face` | Laquelle des deux magies un effet porte : blanche (`boon`) sur soi ou un allié, noire (`curse`) sur un ennemi. Gravée au lancer, jamais redéduite de la cible. |
| **Ancrage** | `anchor` | Le moment où un effet en attente se fixe sur une tentative — celle qui s'ouvre. Il vaut alors le début de cette tentative, et meurt quand elle finit. |
| **Inventaire** | `inventory` | Les sorts que le joueur possède et n'a pas encore lancés. Consultable au camp seulement. |
| **Grimoire** | `spellbook` | Côté joueur, le nom de l'écran des Sorts (`/sorts`). Côté code, le module qui possède ce que fait chaque sort : sa modulation des règles, son action instantanée, sa durée de vie et la règle qu'il chiffre. Un sort = une entrée. Voir [`server/utils/spellbook.ts`](../server/utils/spellbook.ts). |
| **Sort découvert** | `discovered` | Un sort que le joueur a obtenu au moins une fois : il l'a encore en inventaire, ou il l'a déjà lancé. Le reste jusqu'à la prochaine remise à zéro, même sans exemplaire en poche. Limite connue : remettre à zéro — ou supprimer — la **cible** d'un lancer efface ce lancer aussi ; un sort qui n'était découvert que par lui redevient inconnu pour son lanceur. |
| **Pentacle** | `pentacle` | Le dessin de la page gauche du Grimoire : un rond par sort du catalogue. Un sort pas encore découvert y montre un point d'interrogation ; découvert, son médaillon. Un clic sur un rond découvert choisit le sort que la page droite montre. |
| **Volumen** | `questionLog` | Côté joueur, le nom de l'écran des questions vues (`/volumen`), ouvert par le parchemin du camp. Trois onglets : le Pool Échecs de l'étage à revoir, les questions sues, et toutes les vues depuis la dernière remise à zéro. Consultable au camp seulement. Voir [`ecrans.md`](./ecrans.md#volumen). |
| **Question loot** | `lootQuestion` | Statut d'un passage, non d'une question : la 50e question résolue de l'étage ouvre un coffre si elle est juste. |
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
- [`equipes.md`](./equipes.md) — Les deux équipes, leur assignation, et la dérivation allié/ennemi dont la magie noire dépend.
- [`succes.md`](./succes.md) — Le catalogue des Succès, ce qui les déclenche, et comment ils se montrent.

## Règles chiffrées

Aucune valeur numérique du jeu (vies, timers, nombre de questions de rattrapage, seuils, durées d'attente) n'est écrite en dur dans le code : elles vivent toutes dans un jeu de règles unique, consultable par étage. Voir [`mecanique.md`](./mecanique.md#règles-chiffrées). Les specs citent les valeurs par défaut à titre indicatif ; le jeu de règles fait foi.

## Points encore à spécifier

- Contenu de l'écran de palier (`floorEnd`) : texte et mise en scène du passage d'étage.
- Statistiques du profil joueur — la page existe, son contenu chiffré reste à définir.
- Règles propres à un étage : la surcharge par étage est prévue, aucune valeur divergente n'est décidée.
- Pondération du tirage de rattrapage : aujourd'hui au hasard dans le Pool Échecs, sans favoriser les questions proches de la sortie.

---
*Document de travail — v3, après grilling sur les écrans et le modèle à phases.*
