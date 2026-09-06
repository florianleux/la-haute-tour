# ADR 0003 — C'est l'ancre qui tue un effet, pas les vies

**Date** : 2026-09-06
**Statut** : acceptée

## Contexte

Un effet ancré vivait tant que deux conditions tenaient : son ancre désignait la
tentative en cours, **et** le joueur avait encore des vies.

```ts
function stillRunning(anchoredAt: Date, user: User): boolean {
  return anchoredAt.getTime() === user.attemptStartedAt.getTime() && user.lives > 0
}
```

Le commentaire qui l'accompagnait défendait la seconde condition : « sans elles la
tentative est finie, et l'effet avec, même si la suivante n'est pas encore ouverte
— entre les deux, il y a toute une attente. »

Chronomancie ([#26](https://github.com/florianleux/la-haute-tour/issues/26)) l'a
mise en défaut. Le ticket demande que le timer modulé s'applique « en ascension
comme en rattrapage ». Or **le rattrapage se joue à zéro vie** : l'effet y était
déclaré mort, et les questions de rattrapage se servaient au timer nu.

## Décision

L'ancre seule décide. La condition sur les vies est retirée.

## Conséquences

C'est la définition que le code portait déjà ailleurs. `closeAttempt()` inscrit
qu'« une tentative ne se clôt qu'au moment où la suivante s'ouvre : une attente
de plus prolonge celle qui court ». L'attente et le rattrapage qui suivent la
perte de la dernière vie appartiennent donc à la tentative en cours — les deux
définitions concordent maintenant.

Le glossaire, lui, dit qu'une tentative va « des vies pleines jusqu'à la perte de
la dernière vie ». C'est la vue du joueur, et elle reste juste pour ce qu'elle
décrit : une tentative *se joue* jusqu'à la dernière vie. Ce qui suit — l'attente,
le rattrapage — est la queue de cette tentative-là, pas le début de la suivante.
Aucun effet ne peut donc « sauter » d'une tentative à l'autre : il meurt quand
`openAttempt()` repousse `attemptStartedAt`.

Ce qui aurait pu casser n'a pas cassé : les tests de Vitalité tiennent
précisément la mort d'un effet, et ils passent inchangés — parce qu'ils la
vérifient **après** l'ouverture de la tentative suivante, donc par l'ancre.

Le prix : pendant l'attente, un effet consommé reste `active` au lieu de
disparaître. Invisible en pratique — l'écran d'attente n'affiche que les effets
`pending`, et l'ascension seule montre les actifs. Les sorts dont le déclencheur
est l'attente elle-même échappent de toute façon à cette question, par un autre
chemin : voir [ADR 0004](./0004-les-sorts-lies-a-l-attente.md).

Cette raison ne vivait que dans un message de commit. Elle est ici pour qu'une
revue future ne remette pas la condition sur les vies en croyant réparer un
oubli.
