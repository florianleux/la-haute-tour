# Architecture technique

## Stack

- **Nuxt 3** (Vue 3 + Nitro server routes) — un seul codebase TypeScript, un seul process.
- **Turso** (SQLite hébergé, libSQL) — base de données SQL, free tier généreux.
- **Netlify** — hébergement serverless, déploiement par git push.
- **Discord OAuth2** — authentification uniquement.

Zéro gestion serveur, zéro infrastructure externe hors Discord et Turso.

## Authentification

- **Discord OAuth2** uniquement. Pas d'email/mot de passe, pas de magic link.
- Une seule exception, **en développement local** : `/api/auth/dev` connecte un admin de développement (`Admin local`, créé dans `local.db` à la première visite) sans passer par Discord, pour regarder les pages de test (`/test/*`, admin seulement) sans application Discord configurée. Le bouton « Connexion locale » de `/login` n'existe qu'en dev. Hors `nuxt dev`, `import.meta.dev` est faux au build : l'endpoint répond 404, la branche qui connecte n'est pas dans le bundle (`tests/server/dev-login.test.ts`).
- On stocke le Discord ID, le pseudo (username Discord) et l'email s'il est disponible.
- Le pseudo est synchronisé au login si le pseudo Discord change.
- **Whitelist Discord** : seuls les Discord IDs whitelistés en base peuvent s'inscrire. Voir [`anti-triche.md`](./anti-triche.md).
- La session d'authentification est un cookie signé. C'est le seul emploi du mot « session » dans le projet.
- Ce cookie est `Secure`, `HttpOnly` et `SameSite=Lax` — sans quoi un site tiers ferait écrire l'API avec le cookie du joueur. `Lax` et non `Strict` : le retour OAuth arrive de Discord en navigation cross-site et doit pouvoir relire son état, sinon plus personne ne se connecte. `Lax` suffit, aucune écriture du jeu ne pendant à un GET.

## Données

### Question

- **Énoncé** — le texte posé au joueur.
- **Réponse affichée** — montrée sur échec, ne sert jamais au matching.
- **Réponses acceptées** — toutes les formulations qui valident la question.
- **Étage** (1 à 6) — tiré au hasard à l'import.
- **Catégories** — zéro, une ou plusieurs, désignées par leur code (`GEOGRAPHIE`). Le libellé se lit dans `shared/utils/categories.ts`.

Pas de source ni de référence au lancement. Ajoutable plus tard.

### État de jeu

Tout l'état vit en base, jamais côté client :

- **Vies** et **étage courant** du joueur.
- **Questions vues** — une entrée par question résolue en ascension, avec son verdict. C'est la progression.
- **Réservation** — la question servie et non encore résolue, avec son échéance. Au plus une par joueur.
- **Pool Échecs** — une entrée par question ratée, portant l'étage, un **compteur de réussites consécutives** et la **date du dernier échec**. Ce n'est pas une simple appartenance : c'est ce compteur qui décide de la sortie, et cette date qui ordonne l'onglet À revoir du Volumen.
- **Attente en cours** — l'échéance à partir de laquelle le joueur peut reprendre ou rattraper.
- **Contestations** — la question, la réponse du joueur, le statut d'arbitrage.
- **Flags de triche** — les soumissions déclenchées par une perte de focus.
- **Sorts en poche** — les sorts possédés et non encore lancés. Doublons illimités.
- **Objets** — ce que le sac de l'Inventaire contient et qui n'est pas un sort (le Fromage), un par ligne, jusqu'à ce qu'il soit donné.
- **Effets actifs** — un effet posé sur un joueur, portant son sort, sa face, son lanceur et la date du lancer. Ancré sur la prochaine tentative de la cible, il meurt avec elle — sauf un sort lié à l'attente, qui meurt avec l'attente visée.
- **Lancers** — ce qui est parti de chez qui, vers qui, et quand. C'est le journal, et c'est aussi lui qui dit ce qu'un joueur porte, donc qui fait respecter les plafonds d'effets négatifs et positifs.
- **Coffre** — un état porté par le verdict : *pas de coffre*, *fermé*, *ouvert avec son résultat*. Le tirage a lieu au clic et son résultat est persisté, sinon un rechargement relancerait le dé.
- **Succès débloqués** — une entrée par succès acquis, avec sa date. Lus avec l'état du joueur plutôt qu'à part : c'est en les connaissant qu'on sait lesquels sont neufs, et un aller-retour de plus se paierait à chaque question. Voir [`succes.md`](./succes.md).
- **Compteurs de succès**, portés par le joueur — la **série** en cours, les **vues totales**, et les **jours joués** (le dernier jour joué, leur nombre, et combien se suivent). Portés plutôt que comptés, pour la raison qui vaut déjà aux questions vues : les recompter lirait une ligne par fait à chaque question.
- **Premier arrivé en haut** — un champ unique des réglages, réclamé une seule fois pour tout le jeu. Un classement dirait la même chose en le montrant à tout le monde, ce qu'aucun écran ne doit faire.

Il n'existe **aucun compteur de loot**. Le statut de question loot se dérive du nombre de questions vues à l'étage, déjà stocké : un second compteur dirait le même nombre sous un autre nom, avec une désynchronisation possible en prime. Voir [`bonus.md`](./bonus.md#question-loot).

### Import des questions

- **Script CLI** (Node.js) qui charge le deck directement en base. Un seul run, avant le lancement.
- **Format JSON** en entrée : un fichier pour le deck complet, chaque entrée portant énoncé, réponse, réponse affichée, variantes et catégories.
- Le script fusionne réponse et variantes en réponses acceptées, puis **répartit les questions au hasard sur les 6 étages**, en tranches de tailles égales à une question près. Aucun critère de difficulté n'entre dans cette répartition ; l'équilibre, lui, est garanti par construction plutôt que laissé à six tirages indépendants, sinon un étage pourrait se dégarnir.
- Les catégories arrivent en code. Un code absent de `shared/utils/categories.ts` rend la ligne invalide.
- Lignes invalides **ignorées**, jamais bloquantes : rapportées en fin de run avec les compteurs par étage.
- **L'import remplace le deck entier** : il efface les questions, et avec elles, par cascade, ce que les joueurs en avaient vu ou raté. Il remet donc à zéro les décomptes que les joueurs portent (`floorSeen`, `attemptSeen`, `floorCursor`, `seenTotal`). Le reste de leur partie (étage, vies, sorts, palmarès) ne bouge pas : repartir de zéro, c'est la remise à zéro admin.
- Pas d'UI d'import dans l'admin — le script suffit.

## Forme de l'API de jeu

L'état de jeu est servi par un seul endpoint de lecture, qui renvoie la **phase** courante et ce qu'elle contient. La liste des phases et leurs transitions sont définies dans [`mecanique.md`](./mecanique.md#machine-à-états) — ce document ne les redit pas.

Deux règles gouvernent cette API :

1. **La lecture n'a aucun effet.** Elle ne tire jamais de question, ne démarre aucun chrono. Elle rend la réservation vivante, ou résout une réservation expirée en échec, ou rend le verdict en attente. Un rendu serveur de Nuxt, un préchargement de lien ou un double montage en développement sont donc sans conséquence.
2. **Chaque action du joueur sert immédiatement la suite.** Commencer réserve la première question ; répondre résout et rend le verdict ; passer à la suivante résout le verdict et réserve la question suivante ; franchir un palier incrémente l'étage et réserve. Il n'existe donc jamais d'état « rien en cours » à combler par une lecture.

Une action portant sur une réservation déjà résolue est **ignorée** : l'API renvoie l'état courant, sans erreur. L'appareil qui l'a envoyée n'est pas fautif, il est périmé.

Les vies et l'étage affichés pendant le jeu viennent de ce même endpoint : il n'existe qu'une définition de « où en est le joueur ». L'endpoint d'identité ne sert qu'à l'identité.

## Multi-appareil

- Les appareils se synchronisent à la requête suivante. Pas de WebSocket, pas de verrou de session.
- Reprendre depuis un autre appareil fonctionne : la réservation attend, son échéance a couru.
- Jouer sur deux écrans simultanément n'est pas supporté — voir [`mecanique.md`](./mecanique.md#multi-appareil).

## Hébergement

- **Netlify** pour l'app, déploiement par git push.
- **Turso** pour la base. Le SQL est identique à un SQLite local ; le projet passe par Drizzle ORM des deux côtés.
- Pas de VPS, pas de gestion serveur, pas de SSL ni de Nginx à opérer.
