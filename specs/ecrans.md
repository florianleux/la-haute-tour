# Écrans

## Principes

- **Ni barre, ni menu.** Rien n'est permanent à l'écran : pas de barre d'icônes, pas de bandeau, pas de menu déroulant. Chaque écran porte les seules actions qui ont un sens à cet endroit. Le profil et l'administration ne s'atteignent que par leur adresse. Seul le sélecteur d'incarnation, visible du seul admin, reste sur toutes les pages (voir [`admin.md`](./admin.md#incarnation)).
- **Le jeu est la page d'accueil.** `/` est la partie : c'est là qu'on atterrit en se connectant, là qu'on retombe en rechargeant, et il n'existe pas de vestibule devant. Hors ascension, on y trouve le **camp**, d'où l'on part ; en pleine ascension, l'écran en cours — question, verdict, coffre. Rien à traverser pour jouer. Seule exception : l'**écran de chargement** (voir [`spec.md`](./spec.md#glossaire)), au premier affichage du jeu ou de l'introduction dans un onglet. Il attend que les images du jeu soient téléchargées, au plus 10 s, pour que les animations d'entrée — le cadre de jeu qui tombe, le Grimoire qui monte — ne se jouent pas sur une case vide.
- **Une seule route de jeu.** Tout ce qui se joue — question, verdict, attente, rattrapage, palier, porte de boss, combat de boss, fin — vit sur cette page, qui affiche la phase renvoyée par le serveur. Le joueur ne choisit jamais son écran et ne peut pas en atteindre un par l'URL.
- **Étage et vies ne s'affichent que pendant le jeu**, là où ils bougent. Nulle part ailleurs.
- **Pendant une question, aucune action à part répondre.** Pas de lien, pas de sortie : rien à surveiller — en ascension, en rattrapage, comme pendant une épreuve de combat de boss. C'est la frontière que le jeu connaît déjà, celle de la perte de focus : pendant une question, partir soumettrait la réponse en l'état.
- **Une attente montre la forme de ce qui arrive**, pas le mot « chargement » : les fiches joueurs et les questions gardent leur silhouette pendant la lecture, donc rien ne saute quand elle revient. Une relecture qui suit une action, elle, laisse la liste en place — c'est le bouton cliqué qui porte le loader, à la place de son libellé et sans changer de largeur. Exception nommée : les deux gestes d'une question, **Valider** et **Suivante**, en ascension comme en rattrapage. L'aller-retour avec le serveur y prend un tiers de seconde, à chaque question : un écran figé pendant ce temps se lit comme du lag. L'attente devient donc un moment du jeu. Sur Valider, le contenu de la carte pâlit et remonte vers le médaillon, qui tremble jusqu'au verdict, et le cadre entier monte un peu avec lui puis retombe quand le verdict arrive ; l'animation dure au moins 0,3 s, ce qui ne coûte rien au joueur puisque sa réponse est déjà partie. Sur Suivante, le verdict glisse et s'efface, et la question s'affiche dès qu'elle arrive, sans durée minimale : son chrono court déjà côté serveur. Le bouton cliqué porte aussi son loader, dès le clic. Si l'envoi échoue, la carte revient à l'état d'avant le clic. Avec « réduire les animations », il ne reste que le loader, sans durée minimale. Exception nommée : l'**écran de chargement**, qui dit « Chargement » parce qu'il attend des fichiers, pas une lecture de données — il n'a pas de silhouette à montrer.
- **Un déblocage de Succès s'annonce par un toast**, et c'est la seule chose du jeu qui flotte par-dessus un écran. Il passe seul, sans rien demander : un succès n'appelle aucune décision, donc il ne doit rien interrompre. Il s'efface **de lui-même** au bout de quelques secondes et ne se ferme pas à la main : un bouton pour le congédier serait exactement la décision qu'un succès n'appelle pas. Il se pose en haut de l'écran, sous le sélecteur d'incarnation de l'admin, et ne le recouvre jamais — ni au regard, ni au clic. Il n'apparaît que sur les déblocages qui arrivent pendant la partie — ceux que le joueur n'était pas là pour voir se découvrent dans les Haut-faits. Voir [`succes.md`](./succes.md#affichage).
- **Le camp ouvre des boîtes, pas des pages** (les **boîtes du camp**). Le Grimoire, le Volumen, les Haut-faits et l'Inventaire s'ouvrent par-dessus lui, et là seulement, où aucun chrono ne tourne et où il n'y a donc rien à détourner. Ils n'ont pas d'URL : seuls les objets du camp les ouvrent — le grimoire, le parchemin, la bannière, le sac. La page de jeu reste la seule route de jeu.

## Liste des écrans

| Écran | Accès | Ouvert sans compte |
|---|---|---|
| Connexion | `/login` | oui |
| Accès refusé | `/refus` | oui |
| Introduction | `/intro` — imposée tant qu'elle n'est pas finie, fermée ensuite (sauf à un admin) | non |
| Jeu | `/` — 7 phases, page d'accueil (5 aujourd'hui : les phases de boss ne sont pas encore implémentées) | non |
| Profil | `/profil` — par son adresse seulement | non |
| Grimoire (les Sorts) | boîte sur le camp, sans URL — par le grimoire du camp | non |
| Haut-faits (les Succès) | boîte sur le camp, sans URL — avec une équipe, par la bannière du camp | non |
| Volumen (les questions vues) | boîte sur le camp, sans URL — par le parchemin du camp | non |
| Inventaire (les Objets) | boîte sur le camp, sans URL — par le sac | non |
| Dashboard admin | `/admin` — par son adresse seulement | non, réservé admin |
| File de contestation | `/admin` | non, réservé admin |
| Questions | `/admin` | non, réservé admin |
| Whitelist | `/admin` | non, réservé admin |

Toute page non listée comme ouverte redirige vers la connexion.

**Une URL inconnue ne montre pas d'erreur** : elle ramène au jeu. Il n'y a pas d'écran 404 — se tromper d'adresse renvoie là où l'on joue, et un visiteur non connecté y trouve la connexion comme partout ailleurs.

## Connexion et accès refusé

- **Connexion** : titre du jeu, une phrase disant que l'accès se fait par Discord sur invitation, un bouton de connexion Discord. Un joueur déjà connecté est renvoyé vers le jeu.
- **Accès refusé** : le compte Discord n'est pas sur la whitelist, aucun compte n'a été créé, il faut demander l'accès à l'administrateur. Un retour vers la connexion.

## Profil

Pseudo Discord, date d'inscription, **parcours**, bouton de déconnexion.

Le parcours dit le chemin déjà fait, jamais l'état de l'instant :

- **Étage** atteint sur les 6, et questions vues dans cet étage sur ce qu'il contient.
- **Questions vues** depuis le début, **bonnes réponses**, et le taux qui en découle.
- **Meilleure série** de bonnes réponses d'affilée. Elle traverse les étages : un palier n'interrompt rien.
- **Tentatives achevées**, avec la **plus longue** et la **plus courte**.

Une tentative se mesure en **questions vues**, l'unité de progression du jeu, et non en heures — une soirée entrecoupée de pauses ne vaut pas une longue ascension. Elle ne s'inscrit qu'une fois **achevée**, c'est-à-dire au moment où la suivante s'ouvre : entre la perte de la dernière vie et la reprise, une contestation acceptée peut rendre une vie et faire repartir la même tentative. Les tentatives closes avant que le profil existe ne sont pas reconstituées : le décompte part de zéro.

S'y ajoute, en une phrase, le nombre de **contestations acceptées** sur celles ouvertes.

Ce que le profil ne montre toujours pas : ni phase, ni vies, ni attente — l'état de l'instant vit dans le jeu — et **jamais** de donnée de triche, les flags étant réservés à l'administration.

## Jeu

Une page, sept phases. Le serveur décide, la page affiche.

### Camp au repos

L'ascension **au repos** (voir [`spec.md`](./spec.md#glossaire)) s'affiche au camp, et non sur une carte de départ : c'est là qu'arrive le joueur qui sort de l'introduction, et celui qui revient d'une attente échue sans rattrapage possible. Le camp est le même que pendant l'attente, sans délai à afficher : la bannière du poster reste vide, son parchemin dit « Bienvenue au camp de base », la corde est déroulée, et un clic sur elle ou sur le bouton « Commencer » du poster tire la première question. Objets et Sorts s'y ouvrent comme pendant l'attente.

**Les objets du camp apparaissent avec leur contenu**, puis restent :

| Objet | Apparaît |
|---|---|
| La corde (Ascension) | toujours |
| Le sac (Inventaire) | toujours |
| La bannière (Haut-faits) | toujours, pour un joueur qui a une équipe |
| Le parchemin (Volumen) | dès la première question vue — en pratique, au retour de la première chute |
| Le grimoire (Sorts) | dès le premier sort obtenu, même une fois tous lancés |
| Michel | dès sa première arrivée, à la leçon du camp |

### `ascent` — question

Étage et vies, l'énoncé, un champ de réponse libre, et le **compte à rebours**. Le décompte n'est qu'un affichage de l'échéance fixée par le serveur ; le modifier ne change rien à l'arbitrage.

Une **icône par effet actif**, sur les questions concernées. Un joueur dont le timer démarre à 30 s trois jours après avoir lu l'avertissement doit pouvoir comprendre pourquoi plutôt que de croire à un bug. C'est un état, comme les vies — pas une action.

Un **indicateur de question loot** avant de répondre, quand le passage en est une.

Aucune autre action que répondre.

**Entrée envoie la réponse, puis enchaîne.** Sur le verdict, le palier, la fin de rattrapage, la même touche passe à la suite : on joue au clavier sans en sortir. Elle est rendue à l'élément qui a le focus quand il en fait déjà quelque chose — un champ de saisie, un bouton, un lien —, sinon un seul appui déclencherait deux choses. **Une réponse vide se confirme** : le premier envoi d'un champ vide ou blanc, à Entrée comme au clic sur Valider, ne part pas ; la carte dit « Réponse vide. Appuie encore sur Entrée pour l'envoyer quand même. » (ou « Clique encore sur Valider »), et le second geste, quel qu'il soit, l'envoie. Une réponse vide coûte une vie, et Entrée vient de passer le verdict : un double appui un peu rapide grillerait la question qui s'affiche. Taper dans le champ efface l'avertissement. La fin du chrono et le départ de la page envoient sans demander.

### `ascent` — verdict

Après résolution, l'écran montre le résultat : juste ou faux, la **réponse affichée** de la question, la réponse saisie par le joueur, et la vie perdue le cas échéant.

Sur une question loot réussie, un **coffre** est annoncé. « Suivant » mène à l'écran du coffre, que le joueur doit ouvrir par un clic distinct avant de pouvoir continuer. Son résultat, sort obtenu ou Mimic, s'affiche sur cet écran. Rien ne force l'ouverture : le joueur qui ne clique jamais reste là, et ne joue plus.

Deux actions : **contester** cette question, et passer à la suivante. Cet écran n'est pas chronométré.

Le verdict est conservé par le serveur : recharger, ou revenir depuis un autre appareil, le retrouve intact. La bonne réponse ne peut pas être escamotée par un rafraîchissement.

### `cooldown` — attente

- Le **temps restant** avant reprise ou rattrapage.
- L'accès au **Volumen**, par le parchemin du camp : c'est là que se relisent les erreurs de l'étage, et que se contestent celles qui peuvent l'être. Voir [Volumen](#volumen).
- Le **récapitulatif des effets** qui attendent la prochaine tentative — positifs et négatifs, chacun avec le nom de son lanceur au survol — et ceux qui frappent l'attente elle-même (Répit, Indulgence et Purge agissent dès le lancer). Le joueur a tout lu avant de reprendre. Chaque sort s'écrit en toutes lettres et ouvre son infobulle, voir [`bonus.md`](./bonus.md#linfobulle-dun-sort).
- L'accès au **Grimoire**, par le grimoire du camp.
- Le **camp** lui-même, posé sur le décor : la corde (« Ascension »), roulée pendant l'attente, déroulée quand elle est échue — un clic lance alors la suite, comme le bouton « Commencer » ; la bannière de la guilde du joueur, qui mène aux Haut-faits (pas de bannière sans équipe, voir [`equipes.md`](./equipes.md)) ; le parchemin du Volumen ; le grimoire ; le sac de l'Inventaire ; Michel. Chaque objet dit son nom au survol, et n'est là qu'une fois apparu (voir [Camp au repos](#camp-au-repos)).

### `recovery` — rattrapage

Même présentation que l'ascension : une question à la fois, un champ libre, un compte à rebours, puis un verdict avec la bonne réponse. Le rattrapage s'arrête dès que le verdict est scellé — quota atteint (succès) ou quota mathématiquement impossible (échec).

Le verdict du rattrapage s'annonce sur l'écran de la question qui le scelle : « Rattrapage réussi » + bouton « Reprendre » qui enchaîne sur l'ascension, ou « Rattrapage raté » + bouton « Terminer » qui enchaîne sur l'attente.

Deux écarts assumés avec l'ascension, que l'illustration du camp impose. Le parchemin ne dessine pas de rubans : **ni étage, ni vies** sur cet écran — l'étage ne bouge pas d'un rattrapage à l'autre, les vies y valent zéro d'un bout à l'autre, et c'est le message de reprise qui annonce leur retour. À leur place, **le décompte du tirage** — « Question n/total · x réponses justes sur y requises » — affiché **sur la question seulement** : le verdict, lui, dit déjà ce qu'il advient.

### `floorEnd` — palier

L'étage est terminé. Le verdict de la dernière question s'y lit — c'est cet écran qui suit la question, l'étage n'ayant plus rien à servir — puis une action pour continuer vers la porte du boss. Version sobre ; le reste du contenu est encore à spécifier.

> **Pas encore implémenté (#34 à #44)** : en attendant le boss, l'action franchit le palier et sert la première question de l'étage suivant, et `gameOver` suit directement le palier du dernier étage. Les deux sections suivantes décrivent la cible.

### `bossDoor` — porte du boss

Un seul champ distingue les deux écrans, pas deux phases (voir [`boss.md`](./boss.md#porte-à-deux-clés)) :

- **Porte fermée** (moins de deux clés posées côté équipe) : qui a déjà posé sa clé, qui manque encore. Un joueur sans équipe ne voit jamais cet écran, il tombe direct sur la porte ouverte. Contenu exact encore à spécifier.
- **Porte ouverte** : une action pour engager le combat. Le joueur qui a sa clé la pose ici, par un bouton dédié — pas automatique à l'arrivée.

Introduction du boss (apparition, nom, dialogue) jouée ici, une seule fois par boss.

### `bossFight` — combat de boss

PV du boss, vies du joueur, l'épreuve en cours — format propre à chaque boss, hors périmètre de ce document. Une épreuve juste anime la barre de vie du boss (elle perd 1/7 et le boss vibre) ; une épreuve fausse retire une vie sans animation particulière pour l'instant.

Le combat s'arrête au boss à 0 PV (victoire) ou au joueur à 0 vie (défaite), chacun avec sa propre animation. Un combat relancé après échec va direct au combat, sans rejouer l'introduction. Voir [`boss.md`](./boss.md).

### `gameOver` — fin de partie

Message de félicitations, précédé du verdict de la dernière question. Phase terminale, sans classement : plus rien n'avance.

## Leçons de Michel

Michel, la souris du camp (voir [`lore.md`](./lore.md#michel)), explique l'interface au moment où le joueur la découvre. Une **leçon** se joue une fois, ne se passe pas, et chaque réplique avance au clic, à Entrée ou aux flèches bas et droite. Sa forme : le buste de Michel monte du coin bas-droit de l'écran, au camp comme ailleurs, et une **bulle** sort de lui ; ce dont il parle **s'éclaire** et le reste s'assombrit ; quand il demande un geste, seul ce qu'il montre se clique. Quand une boîte du camp est ouverte (l'Inventaire, à la leçon du camp), il parle depuis la boîte. Hors leçon, il reste dans le décor, sur son rocher, et un clic sur lui propose de rejouer une leçon déjà vue : rejouée, elle garde ses répliques et son éclairage, mais chaque geste demandé devient un clic pour avancer — rien ne s'ouvre, rien ne se donne.

Chaque leçon jouée d'elle-même s'ouvre sur la même entrée, comique de répétition : Michel se fait attendre (2 s, le camp ne répond pas), puis une bulle seule, qui éclot en tremblant comme un cri, l'annonce (« HÉ ! ») — le camp s'assombrit dès ce cri — avant qu'il ne surgisse.

La leçon du camp est datée au clic sur l'au revoir de Michel, qui lance l'ascension. Rechargée avant, elle reprend au début tant que le Fromage est dans le sac, juste après le don sinon. Les autres sont datées au clic sur leur dernière réplique ; rechargées avant, elles reprennent au début.

Les textes sont à écrire ; seul leur contenu est fixé ici.

| Leçon | Quand | Ce que Michel montre |
|---|---|---|
| **Camp** | première arrivée au camp, à la sortie de l'introduction | Après l'entrée, il surgit attiré par l'odeur (« Je sens du fromage, non ?? »). 1. Le camp : c'est là qu'on revient entre deux tentatives, quand les vies tombent à zéro. 2. Le sac : l'ouvrir ; dans l'Inventaire, ce qu'il contient (les Objets, dont certains s'utilisent), puis choisir le Fromage et le lui donner. 3. La guilde du joueur, qu'il nomme ; ouvrir la bannière, ce que montrent les Haut-faits, la refermer (sautée sans équipe). 4. La corde : un clic, et Michel dit au revoir ; un clic sur sa bulle lance l'ascension. 5. La **question d'essai** : les rubans (étage, vies, série) et le chrono, figé tant qu'il parle. 6. Son verdict, comme un vrai : « Contester » (visible, sans effet sur cette question), et ce qu'une erreur coûte. « Suivant » tire la première vraie question. |
| **Chute** | premier retour au camp après la dernière vie, tant que le rattrapage n'a pas commencé (l'attente, puis le rattrapage avant « Commencer ») | 1. L'attente et son délai : la bannière du poster, seule éclairée. 2. Le parchemin du Volumen, qui vient d'apparaître : l'ouvrir ; il garde toutes les questions vues, les erreurs dans « À revoir » ; le refermer. 3. Au revoir : on se revoit l'attente finie, pour la suite. |
| **Rattrapage** | la première attente échue, au camp, avant que « Commencer » n'apparaisse — juste après la leçon de la chute si le joueur n'est revenu qu'après l'échéance. « Commencer » reste caché tant qu'elle n'est pas vue | Le rattrapage qui suit, avec ses chiffres lus dans les règles jouées, Indulgence comprise : combien de questions tirées d'« À revoir », combien de bonnes réponses exigées. À sa première question, le décompte « Question n/total · x réponses justes sur y requises » (pas encore implémenté). |
| **Grimoire** | première visite du camp après le premier sort obtenu | Le grimoire, qui vient d'apparaître ; lancer sur soi, un allié ou un ennemi. |

La **question d'essai** (voir [`spec.md`](./spec.md#glossaire)) a l'écran d'une question d'ascension, mais ne compte pas : le serveur la juge comme une autre, sans rien écrire de la partie.

## Inventaire

Nommé **Inventaire** côté joueur, ouvert par le sac du camp. Il montre les **Objets** du joueur — le Fromage, tant qu'il ne l'a pas donné à Michel — et rien des sorts, qui vivent au Grimoire. Vide, il le dit dans l'univers du jeu.

Il s'ouvre **par-dessus le camp**, comme le Grimoire : un sac vu de face qui jaillit du bas et rebondit en se posant, son titre « Inventaire » au-dessus. Échap, la croix ou un clic à côté le referment. Tout se passe dans son volet ouvert, au-dessus du nœud, en deux parties :

- La **grille**, à gauche — 5 cases de large sur 20 de haut, qui défile verticalement. Un Objet par case ; les cases sans Objet restent dessinées, vides.
- La **page de détail**, à droite — une invite d'une ligne tant qu'aucun Objet n'est choisi. Un clic sur un Objet de la grille l'y montre : son image, sa description, et un bouton « Utiliser » s'il s'utilise.

## Sorts

Nommé **Grimoire** côté joueur. Atteignable **au camp seulement** (l'attente, le rattrapage tant qu'il n'a pas commencé, et l'ascension au repos), par le grimoire du camp. Il s'ouvre **par-dessus le camp**, qui reste affiché dessous : un livre ouvert qui jaillit du bas, grossit et rebondit en se posant, couvert d'étincelles, son titre « Grimoire » au-dessus. Échap, la croix ou un clic à côté le referment. Pas de version mobile pour l'instant. Trois choses :

- Le **pentacle**, page gauche — un rond par sort du catalogue. Un sort jamais obtenu y garde un point d'interrogation et ne se choisit pas ; un sort **découvert** — encore en poche ou déjà lancé — y montre son médaillon, même sans exemplaire, avec en pastille dorée ses exemplaires en poche — grise à zéro. Un clic le choisit, et la page droite le montre.
- Le **lancer**, page droite, en haut — tant que rien n'est choisi, une invite à choisir au pentacle. Le sort choisi y montre son nom, puis trois ronds dessinés qui portent ses médaillons — le sort en haut, sa magie blanche à gauche, sa magie noire à droite — et, sous chaque face, ce qu'elle fait (les définitions de son infobulle) ; ses exemplaires en poche sont écrits sous son nom ; puis un bouton par catégorie de cible (soi, allié, ennemi ; soi seulement sans équipe), éteints sans exemplaire ; « Sur moi » s'éteint aussi quand le joueur porte déjà ses deux effets positifs, et le Grimoire dit pourquoi ; « Sur un allié » et « Sur un ennemi » s'éteignent quand personne n'y est à portée, et le Grimoire le dit sans nommer personne (voir [`bonus.md`](./bonus.md#tirage-de-la-cible)). La cible réelle n'est pas annoncée avant : le tirage est pondéré mais imprévisible. Elle l'est après, au retour du lancer : le médaillon de la face lancée quitte son rond pour le centre de l'écran, s'y charge en tournant, éclate sous la foudre et s'envole, puis « Sort lancé sur … ! » jaillit au même endroit dans la couleur de sa magie (or pour la blanche, violet pour la noire) avant que le résultat s'écrive sous les boutons. Un lancer qui échoue fait retomber le médaillon, éteint. Aucun budget de lancers : le joueur lance autant de sorts qu'il en a en poche.
- L'**historique**, dessous — les cinq derniers lancers du sort choisi, une ligne chacun : sa cible, et le jour (« Aujourd'hui », « Hier », « Il y a 3 jours », puis la date passé une semaine). Rien tant qu'aucun sort n'est choisi. C'est là que le lanceur apprend qui il a touché.

Hors du camp, le grimoire du camp n'est pas là pour l'ouvrir : les sorts en poche ne sont donc pas consultables. Si la partie quitte le camp pendant qu'il est ouvert, le Grimoire se ferme de lui-même. Le joueur voit passer son objet sur l'écran verdict, puis le retrouve à sa prochaine mort.

## Haut-faits

Le mur des Succès (voir [`succes.md`](./succes.md#affichage)). Atteignable **au camp seulement** (l'attente, puis le rattrapage tant qu'il n'a pas commencé), et **avec une équipe seulement**, par la bannière du camp. Il s'ouvre **par-dessus le camp**, qui reste affiché dessous : la bannière de la guilde du joueur (bleue pour les Méridiens, rouge pour les Fauteuillistes) tombe du haut de l'écran, s'étire au bout de sa course, remonte en se tassant et rebondit en se balançant, de moins en moins, avant de s'arrêter. Son titre « Haut-faits » et le compteur des succès obtenus sur le catalogue s'y posent en haut ; dessous, une tuile par succès. Échap, la croix ou un clic à côté la referment : elle remonte hors de l'écran.

Hors du camp, ou sans équipe, la bannière du camp n'est pas là pour l'ouvrir. Si la partie quitte le camp pendant qu'elle est ouverte, la bannière se ferme d'elle-même.

## Volumen

Le journal des questions vues. Atteignable **au camp seulement**, par le parchemin du camp. Tant que le joueur n'a vu aucune question depuis sa dernière remise à zéro, le parchemin n'est pas posé au camp : le Volumen n'aurait rien à relire. Il s'ouvre **par-dessus le camp**, qui reste affiché dessous : un parchemin qui se déroule de gauche à droite. Échap, la croix ou un clic à côté le referment. Deux usages à la fois : **réviser** avant le rattrapage, et **garder trace** de la culture récoltée.

Trois onglets :

- **À revoir** — le **Pool Échecs de l'étage**, avec les réponses : c'est une fiche de révision, pas une punition. Il n'y a ni classement ni score à défendre ; réviser pendant l'attente fait exactement ce que le jeu cherche à produire, et c'est ce qui rend le seuil de sortie du pool atteignable. Trié par **dernier échec**, du plus récent au plus ancien : une question ratée à nouveau en rattrapage remonte en tête, ce qui résiste est ce qu'on veut relire. C'est l'onglet ouvert à l'arrivée.
- **Connues** — les questions vues justes, **tous étages confondus**, depuis la dernière remise à zéro. Une contestation acceptée y fait entrer la question.
- **Toutes** — toutes les questions vues, justes et fausses, tous étages confondus, depuis la dernière remise à zéro.

Dans **Connues** et **Toutes**, la vue la plus récente en tête.

La liste occupe la **gauche** du parchemin, sous les onglets, et défile : chaque ligne montre l'**énoncé** et le **verdict** (✓ ou ✗). Un clic sur une ligne l'ouvre à **droite**, dans les lignes du verdict de la Tour, en plus petit et sans animation : **Connue** ou **À revoir** (vert ou rouge), l'**énoncé**, la **réponse affichée**, et la **saisie du joueur** sur une question à revoir — une question connue n'a rien à corriger. Une question encore au Pool Échecs montre en plus ses **Réussites** sur le seuil de sortie — ce qui reste à faire pour qu'elle quitte le pool. Sur un écran étroit, la question ouverte passe au-dessus de la liste. Chaque onglet garde sa question ouverte.

**Un lien de contestation**, sous la question ouverte, sur chaque erreur contestable, quel que soit l'onglet où elle se lit. La règle de ce qui est contestable ne change pas : voir [`validation.md`](./validation.md#quand). Une contestation en cours, ou refusée, se lit à la place du bouton.

**Vingt questions par page**, et une pagination — précédent, numéros, suivant. Chaque onglet a la sienne.

**Hors du camp, le Volumen ne s'ouvre pas** — le parchemin du camp n'est pas là — et le serveur refuse de le lire. Ce n'est pas qu'une question de moment, comme pour les Sorts : le rattrapage tire ses questions dans le Pool Échecs, et lire leurs réponses pendant qu'il tourne serait tricher. Dès que le rattrapage est tiré, le Volumen se ferme ; il rouvre à l'attente suivante.

## Maintenance

Quand l'administration ferme le jeu, un joueur non-admin voit un écran qui le dit et
n'offre rien d'autre : ni question, ni attente, ni pool.

Il ne remplace pas une question en cours ni le verdict qui la suit — voir
[`admin.md`](./admin.md#maintenance). Il prend leur place au clic suivant.

## Écrans d'administration

Réservés au flag admin, sous `/admin`. Voir [`admin.md`](./admin.md).

- **Dashboard** : les contestations en attente, visibles dès la connexion.
- **File de contestation** : pour chaque contestation, la réponse du joueur face aux réponses acceptées de la question ; accepter ou rejeter.
- **Questions** : liste filtrable par étage, création, édition, suppression, avec leurs réponses acceptées.
- **Whitelist** : liste des Discord IDs autorisés, et ajout.

## Ce qu'aucun écran joueur ne montre

- **Aucun classement**, nulle part. Le serveur classe bien les joueurs par progression pour pondérer le tirage des Sorts, mais ce classement ne sort jamais du serveur et n'est montré à personne.
- **Ni sorts ni Objets hors du camp** : le Grimoire et l'Inventaire n'existent qu'au camp.
- **Aucune réponse hors camp** : le Volumen, seul écran qui relit les réponses des questions vues, ne s'ouvre qu'au camp — le rattrapage tire dans ce qu'il montre.
- **Aucune cible avant le lancer** : le joueur choisit une catégorie, jamais une personne.
- **Aucun compteur de triche** : les flags existent, ils sont réservés à l'administration.
- **Aucun état de jeu sur le profil** : il y montre son parcours, pas sa phase, ses vies ni son attente — celles-là vivent dans le jeu.
- **Aucune question à venir** : rien n'annonce jamais l'énoncé suivant avant qu'il soit servi.
