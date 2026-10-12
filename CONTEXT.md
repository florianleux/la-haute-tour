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
| Où en est le joueur, sans rien changer ? | [`server/utils/game.ts`](server/utils/game.ts) — `readPhase()` : la phase seule, lecture pure, pour les gardes |
| Quelle question vient ensuite ? | [`server/utils/deck.ts`](server/utils/deck.ts) — `upcomingQuestions()` : l'ordre du deck, partagé par l'ascension et les gestes d'admin |
| Ce qu'affiche l'écran de jeu | [`utils/phase.ts`](utils/phase.ts) — `gameScreen()` : ce que la carte montre pour un état donné ; `playView()` : quelle carte, et ce que fait son bouton |
| Ce qu'un dialogue peut être, et ce qu'un geste y fait | [`utils/dialogue.ts`](utils/dialogue.ts) — la forme qui interdit un troisième interlocuteur, `dialogueLineup()`, `dialogueGesture()` et le défilé, sans DOM |
| Le déroulé d'un dialogue | [`composables/useDialogue.ts`](composables/useDialogue.ts) — la réplique en cours, son défilé, le geste qui avance les deux |
| Ce qu'un dialogue montre | [`components/DialogueScene.vue`](components/DialogueScene.vue) — décor, portraits, boîte ; elle rend la main par `end` et ne connaît aucune phase |
| Ce que porte la barre d'icônes | [`utils/nav.ts`](utils/nav.ts) — `navIcons()` : lien, page courante, ou icône éteinte |
| Ce que le joueur possède | [`server/utils/inventory.ts`](server/utils/inventory.ts) — l'inventaire, lisible en attente seulement |
| Ce qu'un sort lancé devient | [`server/utils/effects.ts`](server/utils/effects.ts) — lancer, ancrage sur la tentative suivante, journal, et le recalcul de l'attente qu'un Répit écourte |
| Ce qu'un état de jeu prouve | [`server/utils/achievements.ts`](server/utils/achievements.ts) — les succès qu'un fait atteint, en seuils et jamais en franchissements, et leur écriture idempotente |
| Le catalogue des succès | [`shared/utils/achievements.ts`](shared/utils/achievements.ts) — les identifiants et les paliers, dérivés les uns des autres pour qu'aucun seuil ne reste sans son succès |
| Ce que les effets changent aux règles | [`server/utils/spellbook.ts`](server/utils/spellbook.ts) — `rulesWithEffects()` : un effet module, il ne remplace pas |
| Ce que fait un sort | [`server/utils/spellbook.ts`](server/utils/spellbook.ts) — le grimoire : modulation + action instantanée, un sort = une entrée |
| Qui peut contester, et ce qu'accepter change | [`server/utils/disputes.ts`](server/utils/disputes.ts) |
| Qui est allié, qui est ennemi | [`shared/utils/teams.ts`](shared/utils/teams.ts) — `bondBetween()` : une relation, jamais stockée |
| Les joueurs test, et ce qu'on leur fait | [`server/utils/testPlayers.ts`](server/utils/testPlayers.ts) — création, gestes de réglage, monde scellé |
| Qui vise un geste d'administration | [`server/utils/players.ts`](server/utils/players.ts) — `playerFromRoute()`, et `testPlayerFromRoute()` qui ajoute la garde |
| Ce qu'une écriture du client réaffiche | [`composables/useWriteThenRead.ts`](composables/useWriteThenRead.ts) relit, [`composables/useWriteThenReplace.ts`](composables/useWriteThenReplace.ts) remplace par la réponse |
| Qui joue vraiment, sous incarnation | [`server/utils/auth.ts`](server/utils/auth.ts) — `getSessionUser()` porte les droits, `getCurrentUser()` sert le jeu |
| Ce que coûte un départ de page | [`server/utils/focus.ts`](server/utils/focus.ts) et la détection dans [`composables/useQuestionRun.ts`](composables/useQuestionRun.ts) |
| Le deck vu par l'administration | [`server/utils/questions.ts`](server/utils/questions.ts) |
| Le temps et les envois du jeu | [`composables/useQuestionRun.ts`](composables/useQuestionRun.ts) — décompte, envoi, passage à la suite |
| Les mots montrés au joueur | [`utils/`](utils/), un fichier par terme — [`spells.ts`](utils/spells.ts) (noms et effets des sorts), [`achievements.ts`](utils/achievements.ts) (noms et conditions des succès), [`teams.ts`](utils/teams.ts), [`phase.ts`](utils/phase.ts), [`nav.ts`](utils/nav.ts) |
| Pourquoi ce choix ? | [`docs/adr/`](docs/adr/) |
| Comment on écrit le code | [`CLAUDE.md`](CLAUDE.md) |

## L'identifiant est figé, le libellé ne l'est pas

Un terme du domaine a deux noms. L'**identifiant** — `RESPITE`, `CRIMSON`,
`cooldown` — est celui du glossaire : le schéma le grave, le serveur le sert, il
traverse la frontière réseau. Le **libellé** — « Répit », « Cramoisi », « En
attente » — n'est qu'un mot d'écran : il vit dans `utils/`, côté client, et
renommer ne coûte alors ni migration ni refactor.

Les descriptions suivent le libellé, pas l'identifiant : ce que fait un sort se
lit dans [`utils/spells.ts`](utils/spells.ts), jamais dans une réponse d'API.

La prose des écrans, elle, reste dans les templates : ce sont des phrases
attachées à un écran, pas des termes du catalogue.

## Séparation qui porte le reste

L'arbitrage est **serveur**. Le client ne calcule ni phase, ni vie, ni échéance :
il réaffiche ce que l'API renvoie. Le décompte visible n'est qu'un rendu de
l'échéance fixée à la réservation — le trafiquer ne gagne rien.
