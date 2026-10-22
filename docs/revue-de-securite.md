# Revue de sécurité avant lancement

Ticket #112, 22 octobre 2026. Revue de **tout** le code au commit `1ecb0b2`, et de la prod (`https://la-haute-tour.netlify.app`) interrogée de l'extérieur, sans compte.

Ce qui a été fait : lecture des 55 handlers de `server/api/**`, des utilitaires serveur qu'ils appellent, du middleware et de la config Nuxt/Netlify ; requêtes `curl` sur la prod (en-têtes, cookie, route de dev, chunks JS) ; `pnpm audit` ; recherche de secrets dans tout l'historique git.

## Synthèse

| Point | Verdict |
|---|---|
| Authentification | Tient. Déconnexion forcée possible par lien (#130, basse) ; email collecté sans usage (#129). |
| Autorisations | Tient. Chaque handler protégé, incarnation et bancs bornés aux joueurs test. |
| CSRF | Tient. |
| Entrées | Tient. Zod partout, aucun SQL concaténé. |
| Triche | **Faille corrigée** : deux requêtes simultanées jouaient deux fois le même coup (#124). |
| Données exposées | **Deux failles corrigées** : réponses du Pool Échecs lisibles pendant le rattrapage (#125), réponses du boss dans le JS public (#126). Reste les noms d'images du boss (#131). |
| Secrets et dépendances | Aucun secret exposé. Deux dépendances runtime vulnérables mises à jour (#127) ; le reste de l'audit ne part pas en prod, justifié plus bas. |
| En-têtes HTTP | HSTS et `nosniff` présents ; CSP, `frame-ancestors`, `Referrer-Policy` absents (#128, non bloquant). |

Les quatre failles qui bloquaient #103 (#124 à #127) sont corrigées par les commits de cette revue. Les quatre autres (#128 à #131) ne bloquent pas le lancement ; #131 bloque l'ouverture du combat de boss.

## Authentification

**Regardé** : `server/utils/auth.ts`, `server/utils/discord.ts`, `server/api/auth/**`, `server/plugins/check-config.ts`, le cookie posé par la prod.

- **OAuth Discord.** Le `state` est un `randomUUID()` gardé dans la session scellée, comparé strictement au retour ; il tombe à la connexion. La redirect URI vient de la config, et Discord la vérifie contre celles déclarées. Pas de PKCE : client confidentiel, le secret ne quitte pas le serveur.
- **Retour `?error=`** : il vide toute la session sans regarder le `state`. Un lien suffit à déconnecter un joueur. Nuisance seulement → #130.
- **Scope `identify email`** : l'email est stocké à chaque connexion et jamais lu → #129.
- **Cookie `lht_session`** : session h3 scellée (iron, `Fe26.2`). En prod : `HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`. h3 pose `HttpOnly` et `Secure` par défaut, le code ajoute `Lax` et la durée, en config **et** dans le cookie : h3 refuse de desceller au-delà d'un an.
- **Pas de révocation côté serveur** : la déconnexion efface le cookie du navigateur, pas les copies. Un cookie volé vaut jusqu'à un an. La whitelist et le drapeau admin sont relus en base à chaque requête (`loadUser`), ce qui borne la casse. Levier d'urgence : changer `NUXT_SESSION_PASSWORD` invalide toutes les sessions. Risque accepté.
- **Secret de session** : `check-config.ts` refuse la valeur d'exemple et moins de 32 caractères au démarrage.
- **`/api/auth/dev`** : la branche qui connecte est sous `import.meta.dev`, éliminée au build. La prod répond 404, et la chaîne `dev-local-admin` est absente du bundle serveur.

## Autorisations

**Regardé** : la première instruction de chacun des 55 handlers, `requireAuth`, `requireAdmin`, `getCurrentUser`, `server/utils/testPlayers.ts`.

- Chaque handler commence par `requireAuth` ou `requireAdmin`. Exceptions voulues : `auth/discord` et son retour, `auth/me` (rend `null` sans session), `auth/logout`, `auth/dev` (404 hors dev), l'attrape-tout `api/[...]` (404).
- Les droits se lisent sur le compte connecté (`getSessionUser`), jamais sur l'identité incarnée. Aucun endpoint n'accorde le drapeau admin.
- **Incarnation** (`/api/admin/impersonate`) : la cible doit être un joueur test, et `getCurrentUser` le revérifie à chaque requête, avec le drapeau admin du porteur.
- Les gestes sur joueur test portent leur garde dans la fonction qui écrit (`assertTestPlayer`), pas seulement dans la route.
- **Bancs d'essai** : `/api/admin/camp-lesson` exige l'admin, puis un joueur test incarné hors développement (403 sinon). `/api/game/skip-cooldown` exige l'admin.
- Les deux mondes restent scellés : le tirage des cibles filtre `isTest` sur celui du lanceur.

## CSRF

**Regardé** : `server/middleware/origin.ts`, `server/utils/origin.ts`, les GET qui écrivent.

- Deux couches : `SameSite=Lax`, puis le middleware qui refuse toute écriture dont l'`Origin` désigne un autre hôte. `Origin: null` est refusé ; une requête sans `Origin` passe, faute de navigateur derrière.
- L'hôte se lit avec `X-Forwarded-Host` (proxy Netlify). Un site tiers ne peut pas le forger : une requête cross-site simple n'a pas d'en-tête personnalisé, et une autre exige un preflight que rien n'accepte.
- GET qui écrivent : `/api/game/state` (solde une question expirée, rend les vies d'une attente échue — ce que le temps a déjà décidé), `/api/auth/discord` (pose un `state`), le retour `?error=` (#130).
- Aucun en-tête `Access-Control-*` : aucune lecture cross-origin possible.

## Entrées

**Regardé** : chaque `readValidatedBody`, `getValidatedQuery`, `getRouterParam`, chaque `sql\`…\``, les sorties Vue.

- Chaque body et chaque query passe par un schéma Zod. Les identifiants de route numériques passent par `numericRouteId` (entier positif) ; les autres ne servent qu'en valeur dans `eq()`.
- Tout le SQL passe par Drizzle. Les `sql\`…\`` interpolent des valeurs paramétrées ; aucun `sql.raw`. Le seul identifiant dynamique, `LESSON_COLUMNS[lesson]`, sort d'un enum Zod.
- La recherche admin (`LIKE '%…%'`) n'échappe pas `%` et `_` : admin seulement, sans effet.
- Aucun `v-html` ni `innerHTML` : Vue échappe tout ce qu'un joueur écrit (nom d'aventurier, réponses).

## Triche

**Regardé** : `server/utils/game.ts`, `mechanics.ts`, `journey.ts`, `effects.ts`, `targets.ts`, `items.ts`, `practice.ts`, et ce qui se passe quand deux requêtes partent ensemble.

- **Chrono** : l'échéance est fixée à la réservation, côté serveur ; une réponse au-delà (plus 1 s de latence) est fausse.
- **Vies, coffres, sorts, Objets** : dérivés du serveur. Le coffre se réclame par une écriture conditionnelle, l'exemplaire de sort et l'Objet se retirent en une écriture atomique, la cible d'un sort est tirée côté serveur.
- **Question d'essai** : jugée côté serveur, n'écrit rien ; sa réponse n'est jamais envoyée avant le verdict.
- **Faille, corrigée (#124)** : sans transaction interactive, deux requêtes simultanées lisaient le même état et écrivaient deux fois. Une réponse envoyée deux fois comptait la question vue deux fois — étage fini à moitié joué. Une tentative ouverte deux fois effaçait une Vitalité noire, et pouvait sauter une question au point de bloquer l'étage. Un rattrapage tiré deux fois doublait ses questions. Chaque lot se garde désormais sur l'état qu'il a lu, et l'écriture qui le change part en dernier.
- **Limites connues, acceptées** :
  - La perte de focus est déclarée par le client : un client modifié peut se taire. C'est un drapeau d'administration, pas une protection (`specs/anti-triche.md`).
  - Le plafond d'effets positifs sur soi se lit avant l'écriture : deux lancers simultanés depuis deux onglets peuvent le dépasser d'un. Déjà assumé dans `server/utils/effects.ts`.

## Données exposées

**Regardé** : chaque type de réponse d'API joueur, le JS public de la prod.

- **Autres joueurs** : seul leur nom affiché sort, dans les effets et les journaux de sorts — voulu (`specs/bonus.md`). Le classement de progression ne quitte jamais le serveur. Identifiants Discord, avatars et pseudos ne vont qu'à l'admin.
- **Réponses** : une question servie n'en porte aucune, la réponse arrive avec le verdict, le Volumen se ferme hors du camp.
- **Faille, corrigée (#125)** : `/api/game/disputable-errors` rendait énoncés et réponses du Pool Échecs à tout moment, rattrapage compris. Il ne rend plus que les identifiants.
- **Faille, corrigée (#126)** : la page du banc du boss importait `scripts/flags.json`, et le chunk `/_nuxt/DQcZNxOV.js` servait les 60 drapeaux, réponses comprises, à n'importe qui depuis le déploiement du 21 octobre. Les drapeaux passent maintenant par `/api/admin/boss-flags`, admin seul ; un build vérifié n'en contient plus aucun dans `.output/public`.
- **Reste (#131)** : les images des drapeaux portent leur réponse dans leur nom. À régler avant d'ouvrir le combat.
- Nitro en prod ne renvoie aucune pile d'erreur.

## Secrets et dépendances

**Regardé** : `.gitignore`, `git log -p` sur tout l'historique, `runtimeConfig`, le JS public d'un build, `pnpm audit`.

- `.env`, `local.db`, `backups/` et `.mcp.json` sont ignorés ; seul `.env.example` est suivi. L'historique ne contient qu'une constante de test (`TEST_SESSION_PASSWORD`).
- Les secrets vivent dans le `runtimeConfig` privé, lus au démarrage depuis `NUXT_*`. Le `runtimeConfig.public` ne porte que la liste des images de l'écran de chargement. Aucun nom de secret dans `.output/public`.
- **Variables Netlify** : vérifiées par Flo le 22 octobre 2026, la revue n'ayant pas accès au tableau de bord. Les variables de prod sont restreintes au contexte *Production* : une deploy preview ne tourne pas contre la base de prod. Le secret de session est fort.
- **Dépendances runtime (#127)** : drizzle-orm 0.44.7 (injection par identifiants, GHSA-gpj5-g38j-94v9, non exploitable ici) passe en 0.45.4 ; devalue 5.9.2 (quatre advisories hautes) passe en 5.9.4.

### `pnpm audit`

Avant : 6 critiques, 20 hautes. Après mise à jour : 4 critiques, 4 hautes, aucune dans ce qui part en prod — ni la fonction Netlify, ni le bundle client.

| Paquet | Gravité | Chemin | Pourquoi l'exception |
|---|---|---|---|
| `simple-git` 3.36.0, `@simple-git/argv-parser` 1.1.1 | 2 critiques, 2 hautes | `nuxt > @nuxt/devtools` | Devtools ne tourne qu'avec `nuxt dev`. Corrigé en simple-git 4, que devtools n'accepte pas encore. L'exploitation suppose des arguments git contrôlés par un attaquant sur le poste. |
| `tinypool` 1.1.1 | 2 critiques | `vitest` | Lanceur de tests. Corrigé avec vitest 4 (version majeure). L'exploitation suppose des options de worker contrôlées par un attaquant. |
| `node-forge` 1.4.0 | haute | `nuxt > @nuxt/cli > listhen` | Certificats HTTPS du serveur de dev. Aucune version corrigée. |
| `braces` 3.0.3 | haute | `nitropack > globby > micromatch` | Motifs de fichiers au build, écrits par nous. Aucune version corrigée. |

À reprendre à la prochaine montée de Nuxt et de Vitest.

## En-têtes HTTP

**Regardé** : `curl -I` sur `/login`, `/api/auth/me` et `/favicon.svg` en prod, `netlify.toml`, `nuxt.config.ts`.

| En-tête | État |
|---|---|
| `Strict-Transport-Security` | Posé par Netlify : `max-age=31536000; includeSubDomains; preload`. |
| `X-Content-Type-Options` | `nosniff` sur les réponses de la fonction, absent sur les fichiers statiques. |
| `Content-Security-Policy` | Absent. |
| `X-Frame-Options` / `frame-ancestors` | Absents. |
| `Referrer-Policy`, `Permissions-Policy` | Absents. |

Impact limité : un site qui encadre le jeu n'emporte pas le cookie (`Lax` ne part pas dans une iframe tierce), et aucun sink XSS n'existe. Défense en profondeur → #128.

## Hors périmètre

- Le portail développeur Discord (redirect URIs déclarées) et la portée du jeton Turso côté Turso : pas d'accès. Le tableau de bord Netlify, lui, a été vérifié par Flo (voir plus haut).
- Le déni de service : aucune limite de débit. Accepté pour un jeu sur invitation, derrière Netlify.
