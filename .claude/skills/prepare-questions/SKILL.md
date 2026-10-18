---
name: prepare-questions
description: Transforme un export Anki TSV de questions en JSON nettoyé, avec réponse brute, libellé, variantes et codes de catégorie, et met à part les questions mal formées.
disable-model-invocation: true
---

Usage : `prepare-questions <source.txt> [runDir]`. Sans `runDir`, travailler dans le scratchpad de session.

Le pipeline sépare strictement le **déterministe** (parse, découpe, validation, assemblage : des scripts, rejouables à l'octet près) du **jugement** (une passe LLM par lots). Les sorties LLM sont conservées dans `build/out/` et traitées comme une **donnée source**, jamais régénérées : relancer l'assemblage ne coûte aucun appel.

**Règle qui structure tout le run : un lot dont la sortie existe déjà ne se rejoue jamais.** Un run de 6000 questions fait 120 lots et sera interrompu — par une limite d'API, une fermeture de session. `status.mjs` dit ce qui manque, on ne relance que ça.

Les scripts sont dans `scripts/`, le template de prompt dans `templates/`. Tous prennent le répertoire de run en argument et n'écrivent que dedans.

**Ce que la passe LLM fait, et ne fait pas.** Elle corrige l'orthographe des énoncés, met les titres d'œuvres entre guillemets droits, découpe les réponses et signale les questions mal formées. Elle ne note rien : les questions ne portent aucune difficulté, et c'est l'import qui les répartit au hasard sur les 6 étages de la tour. Voir `specs/spec.md`.

## 1. Initialiser et parser

```bash
node scripts/init.mjs <source.txt> <runDir>
node scripts/parse.mjs <runDir>
```

**Export attendu** : « Notes en texte brut » avec **« Inclure le HTML et les références aux médias » coché** et les tags inclus. Sans HTML, Anki fond les lignes de la réponse en une seule, et la queue (dates, détail) ne se sépare plus de la réponse. La colonne `guid` est acceptée ou absente.

`init` copie la source et pose `run.config.json` (taille de lot, graine). `parse` lit les en-têtes Anki pour placer les colonnes, et échoue franchement sur un export sans HTML. Il traduit chaque tag en code via `shared/utils/categories.ts` (`Géographie` → `GEOGRAPHIE`). Un tag absent de la table **arrête le run** et la liste entière s'affiche : compléter la table, relancer. Les marqueurs Anki `leech` et `marked` ne sont pas des catégories. Les guillemets `“ ”` et `« »` de l'énoncé deviennent `"`.

Publier les compteurs affichés : cartes, ids uniques, réponses mono-segment, segments de date éliminés sans LLM, segments restant à juger, catégories.

**Fini quand** : le nombre de cartes égale le nombre de lignes de données, les ids sont tous distincts, et le script n'a signalé aucun HTML résiduel.

## 2. Lots et prompt

```bash
node scripts/batch.mjs <runDir>      # mélange à graine fixe, découpe
node scripts/make-prompt.mjs <runDir>
```

Le mélange avant découpe : un export Anki est ordonné par thème, et un lot entier de questions d'Histoire installe le modèle dans un domaine — il y corrige et invente des variantes avec un a priori qu'un lot mêlé ne lui donne pas.

**Fini quand** : la somme des items des lots égale le corpus.

## 3. Lot pilote

Traiter **un seul** lot, puis `node scripts/ingest.mjs <runDir> 1`.

Montrer à l'utilisateur les énoncés modifiés, les arbitrages de variantes et les signalements. Chercher trois dérapages : des reformulations déguisées en corrections, du détail promu en variante (dates, nationalités, palmarès), et des énoncés réécrits en question au lieu d'être signalés `[pas-question]`. Ajuster `templates/enrich.md` si besoin et refaire le pilote. On itère ici, pas sur 120 lots.

**Fini quand** : `ingest.mjs` passe et la qualité du lot est jugée bonne.

## 4. Lots restants, par vagues

Boucler jusqu'à épuisement :

```bash
node scripts/status.mjs <runDir>     # liste les numéros manquants
```

Lancer un sous-agent par lot manquant, **10 au maximum par vague** — au delà, les limites d'API tuent les agents en vol. Chaque sous-agent lit `<runDir>/prompt.md` et son lot, puis **écrit lui-même** sa sortie dans `<runDir>/build/out/batch-NN.json` : passer le JSON par son message final le tronque.

Revalider après chaque vague avec `ingest.mjs`. Un lot invalide se relance ; un lot valide ne se retouche jamais.

**Fini quand** : `status.mjs` annonce « complet » et `ingest.mjs` passe sur tous les lots.

## 5. Assembler et contrôler

```bash
node scripts/assemble.mjs <runDir>
```

Le script joint sur l'`id` et génère les variantes de nom pour les réponses en `NOM (Prénom)`.

Les items signalés `[liste]` et `[pas-question]` sortent du deck et vont dans `to-review.json`, avec leur motif dans `reason`.

Lire la sortie et **ne pas livrer en silence si quelque chose cloche** : aucun HTML résiduel, aucun id dupliqué, aucune variante identique à sa réponse, aucune catégorie hors de la table.

**Fini quand** : « toutes passées », ou l'échec est expliqué à l'utilisateur.

## 6. Livrer

Envoyer `<runDir>/questions.json` et `<runDir>/to-review.json`, puis rendre compte : répartition par catégorie, énoncés corrigés, variantes produites, questions mises à part (`[liste]` : liste demandée, `[pas-question]` : énoncé qui n'est pas une question), et questions `[flou]` restées dans le deck (énoncé n'identifiant pas une réponse unique) — leur liste est dans `build/report.json`.

Rappeler où est le fichier : un répertoire de run temporaire n'est pas un endroit où le laisser.

## Référence

**Sortie** — un tableau d'objets :

```json
{
  "id": "82ea66fe046c",
  "statement": "Quel poète japonais auteur du \"Pavillon d'or\" s'est donné la mort par seppuku ?",
  "answer": "Mishima",
  "answerLabel": "MISHIMA (Yukio)",
  "variants": ["Yukio Mishima", "Mishima Yukio"],
  "categories": ["LITTERATURE"]
}
```

`to-review.json` a la même forme, plus un champ `reason` (`[liste] …` ou `[pas-question] …`).

`answer` est ce que le joueur tape, `answerLabel` ce qui s'affiche. L'ordre du tableau ne veut rien dire : l'import mélange avant de répartir.

**Config** (`run.config.json`) : `batchSize` et `seed`.

**Ce qui n'est pas garanti** : des corrections d'énoncés identiques entre deux runs sur le même fichier, la passe LLM étant stochastique.
