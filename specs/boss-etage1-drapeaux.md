# Boss — Étage 1 : Julien le perse

Mini-jeu : **Drapeaux**. Le joueur voit un drapeau, doit donner le lieu
associé en saisie libre.

Suit le cadre général défini dans [`boss.md`](./boss.md) : 7 PV, 10 épreuves
curatées par combat de boss (pas d'aléatoire sur le contenu, seul l'ordre est
mélangé), 6 combats en 3 paliers de difficulté dégressive.

## Introduction

Sur le fond sombre de l'arche, après « Entrer » :

1. Le joueur, dans sa fenêtre : « ... ».
2. Une carte de *Questions pour un champion* fend l'air devant lui, très
   vite. Puis 2, 4, 12, 24, 48 : chaque vague plus nombreuse et plus
   rapprochée, comme une nuée de chauves-souris. Elles volent de côté, de
   haut en bas, de bas en haut, en oblique, et se croisent là où Julien va
   paraître, jusqu'à couvrir la zone.
3. Le joueur, pendant la montée : « Qu'est-ce que c'était ??? ».
4. Pendant que la nuée cache la zone, Julien y paraît en fondu, sans bouger.
   Les cartes s'écartent : il est là.
5. Julien crie, et tremble avec ses cartes, dans sa fenêtre (fond jaune pâle, bordure et
   texte dorés) : « OUI OUI OUI ». Sa fenêtre tremble aussi, à un autre
   rythme.
6. Son nom en grand titre au-dessus de lui, façon *Dark Souls* : un or qui se
   révèle de gauche à droite, balayé d'un reflet.
7. Son monologue (texte à écrire), puis le combat. Dès qu'il paraît, et
   jusqu'à la fin, une carte flotte au-dessus de chacun de ses poings, et des
   cartes passent derrière lui, trois ou quatre à la fois, plus petites :
   plus loin que lui.

## Déroulement d'une épreuve

- Le drapeau s'affiche, avec un **timer de 30 secondes**.
- **Saisie libre**, même tolérance de fautes que les questions classiques
  (Levenshtein ≤ 2).
- **Verdict immédiat** après chaque drapeau — juste ou faux, réponse affichée
  — avant de passer au suivant. Même mécanique qu'en ascension.

## Contenu

- Chaque drapeau (`flag`) porte, comme une question classique, plusieurs
  **réponses acceptées** et une **réponse affichée** séparée (plus riche),
  montrée sur échec.
- Table dédiée, distincte du deck de questions : image du drapeau, réponses
  acceptées, réponse affichée, combat de boss associé (`bossAttemptNumber`,
  1 à 6).

## Progression de la difficulté

Le degré de difficulté suit les 3 paliers du cadre général :

| Palier | Combats | Contenu |
|---|---|---|
| Difficile | 1-2 | Drapeaux hors pays : régions, départements français, États américains, anciens drapeaux… |
| Moyen | 3-4 | Drapeaux de pays peu connus |
| Facile | 5-6 | Drapeaux de pays connus |

## Points encore à spécifier

- Liste exacte des 60 drapeaux curatés (10 par combat × 6).
- Gestion des images en base (format, stockage, admin).

---

*Suit [`boss.md`](./boss.md). Amende [`spec.md`](./spec.md) (glossaire :
`flag`).*
