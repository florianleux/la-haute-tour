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

Corrige uniquement ce qui est **objectivement fautif** : orthographe, accents manquants, accord, ponctuation, noms propres mal orthographiés (`Genesys` → `Genesis`), espaces parasites. Ajoute le point d'interrogation s'il manque à une question.

**Ne reformule pas.** Ne change pas le niveau de langue, ne raccourcis pas, n'ajoute pas d'indice, ne retire pas d'indice. Si l'énoncé est correct, recopie-le à l'identique. Un énoncé dont tu changerais plus de quelques caractères est un énoncé que tu reformules : arrête-toi.

## 2. `answer` et `answerLabel` — la réponse

- `answerLabel` : **ce qui est affiché au joueur**. Reprends `answer` d'entrée en corrigeant sa casse et son orthographe, et en gardant sa forme complète. `MISHIMA (Yukio)` reste `MISHIMA (Yukio)`. Conserve les majuscules du nom de famille, c'est la convention du deck.
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

Cas particulier : si `tail` contient les **autres éléments d'une réponse multiple** (l'énoncé demande « 3 films de… » et `answer` + `tail` en donnent trois), mets les autres éléments en variantes et **signale-le** en commençant `why` par `[multi]`.

Si l'énoncé n'identifie pas une réponse unique (par exemple `Skieur américain`, sans autre indice), commence `why` par `[flou]`.

Ne mets **jamais** `answer` lui-même dans `variants`. Tableau vide si rien à ajouter. N'invente pas de variantes que le texte d'entrée ne fournit pas, sauf synonyme évident et incontestable.

## 4. `why`

Dix mots maximum, en français. Ce champ ne porte que les **signalements** décrits ci-dessus : il commence par `[multi]` quand la réponse est multiple, par `[flou]` quand l'énoncé n'identifie pas une réponse unique. Pour tout le reste, une justification courte du découpage de la réponse, ou une chaîne vide.

## Rappels

- Sortie : **le tableau JSON seul**, rien avant, rien après, pas de bloc de code, pas de commentaire.
- Autant d'objets en sortie que d'items en entrée, mêmes ids, même ordre.
