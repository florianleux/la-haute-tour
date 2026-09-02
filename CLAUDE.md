# La Tour — conventions de code

Projet greenfield, aucun code encore écrit. Specs fonctionnelles dans [`specs/`](specs/spec.md).

## Stack

- Nuxt 3 (Vue 3 + Nitro) — un seul codebase TypeScript, un seul process.
- Turso (SQLite/libSQL) via Drizzle ORM.
- Netlify (déploiement git push, serverless).
- Discord OAuth2 (seule méthode d'auth).

Voir [`specs/architecture.md`](specs/architecture.md) pour le détail.

## Structure de fichiers

```
la-tour/
├── app.vue
├── pages/              # routes Nuxt (file-based routing)
├── components/         # composants Vue, PascalCase
├── composables/        # logique réutilisable côté client (useXxx.ts)
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

Le glossaire de [`specs/spec.md`](specs/spec.md) (étage, ascension, tirage, vies, Pool Échecs, rattrapage, contestation) est le **vocabulaire du code**, pas juste de la doc. Nommer variables/fonctions/tables avec ces termes tels quels (`etage`, `tirage`, `viesRestantes`, `poolEchecs`, `rattrapage`), sans les traduire en anglais.

Pourquoi : évite la dérive entre le nom en base/code et le terme dans les specs — un `etage` en base doit rester un `etage` partout, pas devenir `floor` puis re-traduit en tête au moment de lire une spec.

Le reste du code (structure technique, noms de fichiers, helpers génériques) reste en anglais.

## TypeScript

- Strict mode activé, pas de `any`.
- Types de retour explicites sur les fonctions exportées et les handlers d'API.
- Validation runtime des bodies/query d'API avec Zod (les types TS seuls ne suffisent pas à la frontière réseau).

## Composants Vue

- Composition API uniquement, `<script setup lang="ts">`. Pas d'Options API.
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

## Git

- Conventional commits (`feat:`, `fix:`, `refactor:`, etc.).

---

*Défauts raisonnables posés faute de décision explicite (Zod, Vitest si besoin de tests, conventional commits) — à corriger si tu veux autre chose.*
