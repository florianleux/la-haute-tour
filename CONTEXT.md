# Contexte du projet

Carte d'orientation. Ce fichier ne redéfinit rien : il dit où chaque chose est
définie, une seule fois.

## Vocabulaire du domaine

Le glossaire fait foi : [`specs/spec.md`](specs/spec.md#glossaire). Sa colonne
**Nom en code** est la seule traduction autorisée d'un terme du domaine — `étage`
→ `floor`, `Pool Échecs` → `missedPool`, `rattrapage` → `recovery`, `attente` →
`cooldown`, `réservation` → `reservation`, `verdict` → `verdict`.

Un concept absent du glossaire s'y ajoute **avant** d'être codé.

## Où vit quoi

| Question | Réponse |
|---|---|
| Que dit la règle ? | [`specs/`](specs/spec.md) — mécanique, validation, anti-triche, écrans, admin |
| Combien vaut-elle ? | [`server/utils/rules.ts`](server/utils/rules.ts) — le jeu de règles, consultable par étage |
| Que devient le joueur ? | [`server/utils/mechanics.ts`](server/utils/mechanics.ts) — les décisions, sans base de données |
| Comment est-ce lu et écrit ? | [`server/utils/game.ts`](server/utils/game.ts) — lectures, écritures, réservation |
| Ce qu'affiche l'écran de jeu | [`utils/phase.ts`](utils/phase.ts) — `gameScreen()` : ce que la carte montre pour un état donné |
| Ce que porte la barre d'icônes | [`utils/nav.ts`](utils/nav.ts) — `navIcons()` : lien, page courante, ou icône éteinte |
| Ce que le joueur possède | [`server/utils/inventory.ts`](server/utils/inventory.ts) — l'inventaire, lisible en attente seulement |
| Qui peut contester, et ce qu'accepter change | [`server/utils/disputes.ts`](server/utils/disputes.ts) |
| Ce que coûte un départ de page | [`server/utils/focus.ts`](server/utils/focus.ts) et la détection dans [`composables/useQuestionRun.ts`](composables/useQuestionRun.ts) |
| Le deck vu par l'administration | [`server/utils/questions.ts`](server/utils/questions.ts) |
| Le temps et les envois du jeu | [`composables/useQuestionRun.ts`](composables/useQuestionRun.ts) — décompte, envoi, passage à la suite |
| Pourquoi ce choix ? | [`docs/adr/`](docs/adr/) |
| Comment on écrit le code | [`CLAUDE.md`](CLAUDE.md) |

## Séparation qui porte le reste

L'arbitrage est **serveur**. Le client ne calcule ni phase, ni vie, ni échéance :
il réaffiche ce que l'API renvoie. Le décompte visible n'est qu'un rendu de
l'échéance fixée à la réservation — le trafiquer ne gagne rien.
