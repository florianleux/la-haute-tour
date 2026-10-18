# Enrichissement d'un lot de questions de culture générale

Tu traites un lot de questions issues d'un deck francophone de culture générale, déjà nettoyé de son HTML. Pour **chaque** item du lot, tu produis trois choses : un énoncé corrigé, un découpage de la réponse, et d'éventuelles réponses alternatives.

## Entrée

Un tableau JSON d'items :

```json
{ "id": "...", "statement": "...", "answer": "...", "tail": ["..."], "categories": ["..."] }
```

- `statement` : l'énoncé, éventuellement avec des fautes de frappe.
- `answer` : la première ligne de la réponse d'origine, souvent en majuscules, souvent au format `NOM (Prénom)`.
- `tail` : les lignes suivantes de la réponse d'origine. **La plupart sont du détail à jeter** (dates, œuvres, nationalité, anecdotes). Une minorité sont de vraies réponses alternatives.
- `categories` : thèmes, informatifs.

## Sortie

Un tableau JSON, **un objet par item d'entrée, dans le même ordre**, sans aucun texte autour :

```json
{ "id": "...", "statement": "...", "answer": "...", "answerLabel": "...", "variants": ["..."], "why": "..." }
```

Recopie l'`id` **exactement**. N'invente aucun id, n'en omets aucun, n'en ajoute aucun.

## 1. `statement` — l'énoncé corrigé

Fais une **passe d'orthographe complète** et corrige tout ce qui est **objectivement fautif** : orthographe, accents manquants (y compris sur les majuscules : `Ecole` → `École`), accord, conjugaison, ponctuation, noms propres mal orthographiés (`Genesys` → `Genesis`), espaces parasites. Ajoute le point d'interrogation s'il manque à une question.

**Titres d'œuvres entre guillemets droits.** Un titre de livre, film, série, chanson, album, tableau, sculpture, opéra, pièce, émission ou journal cité dans l'énoncé s'écrit entre `"` : `Quel roman de Zola ouvre le cycle des "Rougon-Macquart" ?`. Ajoute les guillemets s'ils manquent, n'en mets jamais d'autres que `"`. Une citation reste entre guillemets, elle aussi.

Tu corriges la **langue**, jamais les **faits** : un titre d'œuvre, un nom d'institution ou une date restent ceux du texte, même s'ils te semblent inexacts (`Derrière l'horizon` reste `Derrière l'horizon`).

En dehors de ces corrections, **ne reformule pas.** Ne change pas le niveau de langue, ne raccourcis pas, n'ajoute pas d'indice, ne retire pas d'indice. Si l'énoncé est correct, recopie-le à l'identique. Un énoncé dont tu changerais plus de quelques caractères est un énoncé que tu reformules : arrête-toi.

## 2. `answer` et `answerLabel` — la réponse

- `answerLabel` : **ce qui est affiché au joueur**. Reprends `answer` d'entrée en corrigeant sa casse et son orthographe, et en gardant sa forme complète. N'y ajoute rien : pas de prénom absent de l'entrée. `MISHIMA (Yukio)` reste `MISHIMA (Yukio)`. Conserve les majuscules du nom de famille, c'est la convention du deck.
- `answer` : **ce que le joueur tape au clavier**, en casse normale. C'est le noyau strictement nécessaire.
  - `MISHIMA (Yukio)` → `Mishima`
  - `LA FORTUNE DES ROUGON` → `La Fortune des Rougon`
  - `Le CULLINAN` → `Cullinan`
  - `LA GUERRE DES ORANGES` → `La guerre des Oranges`
  - `SAINT-FIACRE` → `Saint Fiacre`
  - Retire l'article initial d'un nom propre unique (`Le CULLINAN` → `Cullinan`), garde-le dans un titre d'œuvre.
  - Pour un nom de personne, `answer` est le **nom de famille seul**. Le prénom passe en variante seulement s'il est indispensable pour distinguer un homonyme du corpus.

## 3. `variants` — les autres réponses acceptables

Une variante est une réponse qu'un correcteur humain **accepterait sans discuter**.

Mets en variante :
- un vrai synonyme trouvé dans `tail` : `LE PIN DU CHILI` + tail `["ARAUCARIA"]` → variante `Araucaria`.
- une autre dénomination usuelle : `HÉCATONCHIRES` + tail `["Centimanes", "Cent-bras"]` → variantes `Centimanes`, `Cent-bras`.
- une orthographe alternative attestée, une forme francisée, un sigle et son développé.

**Ne mets pas en variante** (c'est du détail, jeté) :
- des dates, une nationalité, un lieu de naissance : `Anglaise`, `Née apatride`, `Originaire de Franche-Comté`.
- des titres d'œuvres de l'auteur, un palmarès : `Goncourt 2012`, `Le Pavillon d'or (1956)`.
- une définition ou une précision : `Déesse de la jeunesse`, `Vaccin contre la variole`.

## 4. Signalements — les questions à traiter à part

Certaines questions ne se jouent pas telles quelles. Elles seront **mises de côté** pour être reprises à la main : signale-les, ne les répare pas. Le signalement se met en tête de `why`, un seul par item, dans cet ordre de priorité :

- `[liste]` : l'énoncé demande **plusieurs éléments** (`3 films de Howard HAWKS ?`, `Qui sont les fondateurs de Polytechnique ?`). Ne range pas les autres éléments en variantes.
- `[pas-question]` : l'énoncé **n'est pas formulé en question** (`Peintre espagnol d'origine crétoise`, `Indépendance d'Haïti`). Ne le réécris pas en question : corrige seulement l'orthographe, comme pour tout énoncé.
- `[flou]` : l'énoncé est une vraie question mais n'identifie pas une réponse unique. Celle-ci reste dans le deck, elle est seulement rapportée.

Un item signalé reste complet en sortie : `statement`, `answer`, `answerLabel` et `variants` remplis comme les autres.

Ne mets **jamais** `answer` lui-même dans `variants`. Tableau vide si rien à ajouter. N'invente pas de variantes que le texte d'entrée ne fournit pas, sauf synonyme évident et incontestable.

## 5. `why`

Dix mots maximum, en français. Il commence par le signalement de la section 4 s'il y en a un. Sinon, une justification courte du découpage de la réponse, ou une chaîne vide.

## Rappels

- Sortie : **le tableau JSON seul**, rien avant, rien après, pas de bloc de code, pas de commentaire.
- Autant d'objets en sortie que d'items en entrée, mêmes ids, même ordre.
