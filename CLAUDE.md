# La Haute Tour — conventions de code

Specs fonctionnelles dans [`specs/`](specs/spec.md), carte du code dans [`CONTEXT.md`](CONTEXT.md), décisions dans [`docs/adr/`](docs/adr/).

## Stack

- Nuxt 3 (Vue 3 + Nitro) — un seul codebase TypeScript, un seul process.
- Turso (SQLite/libSQL) via Drizzle ORM.
- Netlify (déploiement git push, serverless).
- Discord OAuth2 (seule méthode d'auth ; en dev local seulement, `/api/auth/dev` connecte un admin sans Discord — voir [`architecture.md`](specs/architecture.md#authentification)).

Voir [`specs/architecture.md`](specs/architecture.md) pour le détail.

## Structure de fichiers

```
la-haute-tour/
├── app.vue
├── layouts/            # layouts Nuxt (défaut, admin)
├── middleware/         # gardes de route (auth, camp)
├── pages/              # routes Nuxt (file-based routing)
├── components/         # composants Vue, PascalCase
├── composables/        # logique réutilisable côté client (useXxx.ts)
├── utils/              # helpers client auto-importés (dates, libellés, styles)
├── shared/utils/       # le peu qui doit être identique des deux côtés (forme de la tour)
├── server/
│   ├── api/            # routes Nitro, un fichier par endpoint
│   ├── db/
│   │   ├── schema.ts   # source unique du schéma Drizzle
│   │   └── client.ts   # instance Drizzle/Turso
│   └── utils/          # helpers serveur (auth, validation)
├── drizzle/            # migrations générées par drizzle-kit
├── scripts/            # scripts CLI (import questions, etc.)
├── tests/              # Vitest : tests/server (handlers, utils), tests/app (client)
├── docs/adr/           # décisions d'architecture
└── specs/              # specs fonctionnelles, source de vérité du domaine
```

## Vocabulaire du domaine

**Specs en français, code en anglais.** Le glossaire de [`specs/spec.md`](specs/spec.md) porte une colonne **Nom en code** : c'est la seule traduction autorisée de chaque terme du domaine (`étage` → `floor`, `Pool Échecs` → `missedPool`, `rattrapage` → `recovery`, `blocage` → `cooldown`...).

Un terme du domaine ne s'invente pas au moment de coder : on le lit dans le glossaire. Un concept qui n'y est pas encore s'y ajoute **d'abord**, puis se code.

Pourquoi : sans cette table, chacun retraduit à sa façon et le même concept finit sous trois noms (`retry`, `makeup`, `secondChance`) selon le fichier. Une seule traduction, écrite une fois, à l'endroit où le concept est déjà défini.

## TypeScript

- Strict mode activé, pas de `any`.
- Types de retour explicites sur les fonctions exportées et les handlers d'API.
- Validation runtime des bodies/query d'API avec Zod (les types TS seuls ne suffisent pas à la frontière réseau).

## Composants Vue

- Composition API uniquement, `<script setup lang="ts">`. Pas d'Options API.
- **`<template>` en premier, `<script setup>` dessous.** On ouvre un composant pour voir ce qu'il affiche ; sa mécanique se lit ensuite, quand on sait de quoi elle parle.
- Props et emits typés via `defineProps<T>()` / `defineEmits<T>()`.
- Fichiers de composants en PascalCase (`QuestionCard.vue`), composables en camelCase préfixé `use` (`useAscension.ts`).

### Composants globaux

- Maximiser la componentisation : tout élément d'UI qui se répète (bouton, input, card, modal, badge...) devient un composant partagé avant d'être dupliqué une 2e fois — jamais de markup/style copié-collé entre deux pages.
- Composants génériques sous `components/ui/` (`BaseButton.vue`, `BaseInput.vue`, `BaseModal.vue`...), préfixés `Base`, auto-importés par Nuxt.
- Composants métier (`QuestionCard.vue`, `VieCounter.vue`) composent ces primitives `Base*`, n'écrivent jamais un `<button>`/`<input>` brut directement.

## Styling

- Tailwind CSS uniquement — pas de CSS custom/scoped sauf cas impossible en utility classes.
- Les classes Tailwind répétées (bouton, input, card...) vivent **dans** les composants `Base*`, jamais recopiées en inline dans les composants métier.
- **Pas de `drop-shadow`** (classe `drop-shadow-*` ou `filter:drop-shadow`) quand un équivalent sans filtre existe :
  - médaillon de sort : `shadowClass` de `SpellMedallion` (une `box-shadow` sur un disque, mêmes valeurs) ;
  - étincelle : `glow` de `SparkleStar` / `SparkleField` / `SparkleSpray` (un disque en dégradé, 1,5 fois l'étoile : sa taille suit l'étoile, pas un flou réglé en px) ;
  - texte : `text-shadow` ; forme ronde ou anneau : `box-shadow` (+ `inset`).
- Pourquoi : sur iPad, Safari peint le filtre d'un élément qui grossit (animation, `scale`) sur toute sa boîte — un carré noir dans la transparence autour du médaillon jailli du coffre.
- Le `drop-shadow` reste pour ce qui n'a pas d'équivalent : suivre le contour détouré d'une image ou d'un tracé SVG (survol des objets du camp, boss, éclairs du lancer, croix de fermeture, icône de succès dont le dessin peut être détouré). Un tel élément qui grossit se vérifie sur iPad.

## Images

- Toute image fournie passe d'abord par `cleanimage` (alias de [`scripts/img-trim-webp.sh`](scripts/img-trim-webp.sh)) : rognage de la marge transparente, conversion en webp lossless. Jamais un PNG brut dans `public/`. Une image du camp arrive sur un calque 1920×1080 : la position se lit sur la boîte rognée (`magick <img> -format '%@' info:`), puis se vérifie sur le décor.
- Un décor plein écran (camp, cadre de jeu, porte de boss) est en **20:9** (ex. 2000×900 ou 2400×1080) : une scène 16:9 au centre, élargie sur les côtés. Ce qui compte tient dans les 72 % du centre (ce qu'un écran 16:10 garde) ; les côtés sont du décor qu'on peut perdre, jamais le haut ni le bas. Un objet posé dessus se place en % de la scène 16:9 du centre (`BACKDROP_SCENE`, `utils/backdrop.ts`), aux coordonnées relevées sur son calque 1920×1080, sans conversion.
- Exception au lossless : les **décors plein écran** (camp, portes de boss...) sont en webp **avec perte, qualité 95** (`magick <img> -quality 95 <out>.webp`, sans `cleanimage` : rien à rogner sur un décor 20:9). Une transparence (l'arche vide d'une porte) reste nette : webp garde l'alpha sans perte. La porte de la Lune passe ainsi de 1,22 Mo à 430 Ko, sans différence visible sur un décor peint. La version floue du camp, `blurry-cooldown-bg.webp`, se tire de `cooldown-bg.webp` : même source, `-blur 0x4.8` (en 2400×1080), qualité 95. Un objet détouré, posé par-dessus, reste lossless.
- Une image du jeu courant va sous `public/`, à même `public/images/` (un sous-dossier d'`images/` est à un seul écran, qui l'attend lui-même) : l'**écran de chargement** (`assetsLoadingScreen`, voir le glossaire de [`specs/spec.md`](specs/spec.md)) l'attend d'office, rien à déclarer.
- Une image de la seule page de connexion va dans `public/images/login/` : hors de l'écran de chargement, la page l'attend elle-même avant d'animer (`LoginTitle`).
- Une image qui ne s'affiche que dans les phases d'un boss (porte, introduction, combat, épreuves) va dans le dossier de son étage, `public/images/boss/<étage>/` : l'écran du jeu ne l'attend pas, l'**écran de chargement du boss** (`bossAssetsLoadingScreen`) l'attend d'office à l'arrivée devant sa porte.
- Pourquoi : sans préchargement, les animations d'entrée (`drop-in` du cadre de jeu, `camp-rise` du Grimoire) se jouent avant que leur image arrive. Et chaque image ajoutée allonge l'écran à la première visite.
- Le test de budget (`tests/app/assets-loading-screen.test.ts`, 15 Mo) tient la règle : il échoue si les fichiers attendus dépassent ce poids.

## API (Nitro) et base (Drizzle/Turso)

- Un fichier par endpoint sous `server/api/`, nommé par ressource (`server/api/questions/[id].ts`).
- État de jeu **toujours dérivé du serveur** (cf. [`architecture.md`](specs/architecture.md#état-de-jeu-server-side)) : le client ne fait jamais confiance à un état local pour vies/étage/pool, il réaffiche ce que l'API renvoie.
- Auth/admin vérifiés via un helper partagé (`requireAuth`, `requireAdmin`) en tête de handler, jamais dupliqué inline.
- Toutes les requêtes DB passent par le query builder Drizzle — jamais de SQL en concaténation de string.
- Schéma unique dans `server/db/schema.ts` ; migrations via `drizzle-kit`, committées dans `drizzle/`.

## Erreurs

- Erreurs API via `createError({ statusCode, statusMessage })` de Nitro — pas de `throw` de string brute.
- Pas de try/catch défensif sur des cas qui ne peuvent pas arriver (ex. pas besoin de vérifier qu'une question existe après l'avoir déjà chargée dans le même handler).

## Tests

- Vitest + `@nuxt/test-utils` — unit/intégration sur les handlers Nitro et les composants.
- Pas d'E2E (Playwright) pour l'instant — solo dev, poids pas justifié tant qu'il n'y a pas de régression réelle à couvrir.

## Base de données — local vs prod

- Turso (libSQL) en prod, un fichier SQLite local (`file:./local.db`) en dev — même client Drizzle/libSQL des deux côtés, donc même dialecte SQL, zéro divergence.
- Schema Drizzle unique, migrations (`drizzle-kit generate` puis `migrate`) appliquées identiquement en local et en prod.
- Env vars : `DATABASE_URL=file:./local.db` en local ; `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` en prod (Netlify env vars). Les deux peuvent cohabiter dans le `.env` du poste : `DATABASE_URL` gagne, donc `pnpm dev` reste toujours sur la base locale.
- `pnpm db:migrate` migre le local, `pnpm db:migrate:prod` la prod (il vide `DATABASE_URL` pour laisser passer Turso). Viser la prod est un geste nommé, jamais un défaut.
- Migrations prod lancées manuellement, dans la foulée du push, tant que le projet est solo — à automatiser (hook de build Netlify) seulement si ça devient pénible.

## CI/CD

- GitHub Actions sur push/PR : install → typecheck (`nuxi typecheck`) → lint → `vitest run` → `nuxt build`. Pas de deploy dans Actions.
- Le build est dans la CI parce qu'il attrape ce que les trois autres ne voient pas : un composant Vue vide passe typecheck **et** lint, une page renommée ne casse aucun test, et une route attrape-tout qui avale `/api/**` ne se voit qu'à l'exécution. Netlify construit de son côté, mais trop tard — l'erreur est déjà sur `main`.
- Netlify branché directement sur le repo GitHub (pas via Actions) : push sur `main` → prod, PR → deploy preview auto.
- Ces deux éléments (workflow CI, lien Netlify↔repo) dépendent du scaffold Nuxt (package.json, scripts, build command) — à mettre en place dans le ticket qui scaffold le projet, pas avant.

## Setup manuel requis (comptes/credentials tiers, personne d'autre ne peut le faire)

- App Discord OAuth (Discord Developer Portal) → client ID/secret + redirect URI.
- Base Turso (compte + `turso db create`) → `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN`.
- Site Netlify lié au repo GitHub `florianleux/la-haute-tour` avec les env vars ci-dessus.

## Git

- Conventional commits (`feat:`, `fix:`, `refactor:`, etc.).
- Une fois le travail validé : merge dans `main` et push direct, sans PR. Une PR seulement si je la demande explicitement.

---

*Défauts raisonnables posés faute de décision explicite (Zod, Vitest si besoin de tests, conventional commits) — à corriger si tu veux autre chose.*
