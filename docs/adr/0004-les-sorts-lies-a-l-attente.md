# ADR 0004 — Les sorts liés à l'attente, dits par le catalogue

**Date** : 2026-09-06
**Statut** : acceptée

## Contexte

Le catalogue se partage en deux familles, que
[`specs/bonus.md`](../../specs/bonus.md#ancrage-et-durée-de-vie) énonce sous le
titre « Le déclencheur en cours compte » :

| Sort | Déclencheur | Attente en cours ? |
|---|---|---|
| Vitalité | démarrage de la tentative | non, différé |
| Chronomancie | chaque question de la tentative | non, différé |
| Indulgence | le prochain rattrapage | **oui** |
| Purge | le Pool Échecs | **oui**, immédiat |
| Répit | la prochaine attente | **oui** |

Répit, livré le premier des trois, avait posé cette distinction en dur :

```ts
if (row.spell !== 'RESPITE') {
  return true
}
```

Indulgence, puis Purge, allaient chacun ajouter leur branche — et le catalogue
n'est pas fini.

## Décision

La famille est une propriété du catalogue, pas une suite de cas particuliers :
`COOLDOWN_BOUND_SPELL_IDS` dans [`shared/utils/spells.ts`](../../shared/utils/spells.ts),
lue par `isCooldownBound()`.

## Conséquences

Deux endroits du jeu l'interrogent, et deux seulement — un troisième, d'écran,
s'y est ajouté depuis (voir plus bas).

`actsOnCurrentCooldown()` borne ces effets à l'attente pendant laquelle ils sont
partis : passée celle-ci, ils ne sont plus servis. C'est ce qui rend Indulgence
et Purge **ponctuelles sans code de consommation** — aucun champ « dépensé »,
aucune suppression de ligne. L'attente qui s'achève emporte l'effet, qu'un
rattrapage l'ait consommé, qu'une vie rendue l'ait annulé, ou qu'un rattrapage
entièrement manqué en ait ouvert une nouvelle. Le journal du lanceur, lui,
survit : il lit les mêmes lignes sans ce filtre.

`playedRules()` les joint aux effets ancrés pour moduler les règles, parce que
leur déclencheur est maintenant — là où Vitalité et Chronomancie attendent la
tentative suivante.

Ce qui suit du choix, et qu'il faut savoir : l'identité d'une attente est son
**début** (`cooldownStartedAt`), jamais son échéance — Répit déplace celle-ci.
C'est ce qui a motivé le renommage de `cast_cooldown_until` en
`cast_cooldown_started_at`, sans quoi un second Répit du même lanceur aurait vu
une autre attente et serait passé à travers la limite de lancers par attente.

Un sort ajouté au catalogue n'a donc qu'une question à se poser : son
déclencheur est-il l'attente, ou la tentative suivante ? Le reste suit.

## Depuis

L'infobulle d'un sort (voir [`specs/bonus.md`](../../specs/bonus.md#linfobulle-dun-sort))
a suivi la même règle, et l'a étendue au grimoire :

- `stakeOf()` (`server/utils/game.ts`) interroge `isCooldownBound()` pour chiffrer
  un effet qui n'est pas encore ancré mais agit déjà — le troisième lecteur, le
  même tri que `playedRules()`.
- **La durée de vie** d'un effet (`lifetime` : tentative, attente, rattrapage,
  instant) et **la règle qu'il chiffre** (`stakes`) sont des propriétés de
  l'entrée du grimoire (`server/utils/spellbook.ts`), pas des branches d'écran.
  L'écran choisit son texte sur la durée de vie, jamais sur le nom du sort.

Ajouter un sort reste donc ajouter une entrée — le déclencheur dans le catalogue
partagé, le reste dans le grimoire.
