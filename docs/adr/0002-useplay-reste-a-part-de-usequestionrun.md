# ADR 0002 — `usePlay` reste à part de `useQuestionRun`

**Date** : 2026-09-06
**Statut** : acceptée

## Contexte

`usePlay` est court, et son seul appelant hors tests est `useQuestionRun`, qui
ré-exporte `skipCooldown`, `openChest` et `pending` tels quels et renomme
`failed` en `actionFailed`. Une revue d'architecture le lit comme un module
shallow — une interface presque aussi large que ce qu'elle cache — et propose de
le fondre dans son appelant.

Il l'est d'autant plus depuis que `useWriteThenReplace` a absorbé le try/catch et
les drapeaux qui faisaient l'essentiel de son corps.

## Décision

On le garde séparé.

## Conséquences

Ce qui reste dans `usePlay` n'est pas du remplissage : c'est **le catalogue des
coups du joueur** — les quatre routes qui font avancer une partie, nommées, et le
fait qu'elles rendent toutes l'état entier. C'est une phrase du domaine, pas un
détail de transport.

`useQuestionRun` parle d'autre chose : le temps. Décompte, envoi automatique à
zéro, détection du départ de page, relecture quand l'attente s'achève. Y verser
quatre URLs mélange deux sujets dans un composable qui fait déjà 240 lignes, et
fait perdre le seam où `tests/app/play.test.ts` vérifie qu'un coup remplace bien
l'état en cache — trois tests qui n'auraient plus d'interface où se poser.

Le module est court parce qu'un autre porte sa mécanique. C'est le résultat
recherché, pas un défaut à corriger.
