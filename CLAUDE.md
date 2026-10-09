# La Haute Tour — conventions de code

Projet greenfield, aucun code encore écrit. Specs fonctionnelles dans [`specs/`](specs/spec.md).

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

---

*Défauts raisonnables posés faute de décision explicite (Zod, Vitest si besoin de tests, conventional commits) — à corriger si tu veux autre chose.*
