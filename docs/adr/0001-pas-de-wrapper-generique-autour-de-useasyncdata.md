# ADR 0001 — Pas de wrapper générique autour de `useAsyncData`

**Date** : 2026-09-03
**Statut** : acceptée

## Contexte

Trois composables de lecture — `useCurrentUser`, `useGameState`, `useWhitelist` —
répètent la même forme :

```ts
const { data, error, status, refresh } = await useAsyncData<T>(
  KEY,
  () => $fetch<T>(url, useApiFetchOptions()),
  { default: () => fallback },
)
```

La répétition saute aux yeux à chaque relecture, et la tentation d'un module
générique — `useApiData(key, url)` — revient avec elle. Elle a été tentée.

## Décision

On garde les trois lectures écrites en toutes lettres. Seule la partie qui ne
dépend pas du type de retour est partagée : `useApiFetchOptions()`, qui fait
suivre le cookie en rendu serveur.

## Conséquences

Un wrapper générique fait passer l'URL en paramètre de type `string`, ce qui
**tue l'inférence des routes typées de Nitro** : `$fetch<T>(url)` ne se résout
plus vers la route, et le typecheck casse avec une erreur illisible —
`Type 'unknown' is not assignable…` sur un appelant qui n'a rien fait de mal.
Ramené au concret : la tentative a produit une erreur `TS2769` de vingt lignes
sur `useAsyncData`, puis un `Excessive stack depth comparing types` sur la
résolution des routes.

Le prix payé : quatre lignes répétées par composable de lecture. Le prix évité :
des types faux à la frontière réseau, précisément là où [CLAUDE.md](../../CLAUDE.md)
demande une validation runtime parce que les types seuls ne suffisent pas.

Cette raison ne vivait que dans un commentaire de `composables/useCurrentUser.ts`.
Elle est ici pour que la prochaine revue d'architecture ne re-suggère pas le
wrapper.
