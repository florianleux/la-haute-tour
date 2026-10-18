# Boss — Étage 1 : Julien le perse

Mini-jeu : **Drapeaux**. Le joueur voit un drapeau, doit donner le lieu
associé en saisie libre.

Suit le cadre général défini dans [`boss.md`](./boss.md) : 7 PV, 10 épreuves
curatées par combat de boss (pas d'aléatoire sur le contenu, seul l'ordre est
mélangé), 6 combats en 3 paliers de difficulté dégressive.

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
