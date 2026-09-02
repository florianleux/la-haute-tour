# Validation des réponses

## Format de réponse

**Réponse libre** (saisie texte). Pas de QCM.

## Tolérance aux fautes

- **Distance de Levenshtein ≤ 2** par rapport à la réponse stricte ou à une variante.
- **Normalisation** avant calcul : trimming, lowercase, suppression des accents, articles, ponctuation.

## Variantes explicites

- Chaque question a un **dictionnaire de variantes** : réponses acceptées à 100%.
- La tolérance typo (Levenshtein ≤ 2) s'applique à la réponse stricte **et** à chaque variante.
- Ex. "Bordeaux" (stricte) + "la ville de Bordeaux" (variante) → "Bordaux" (Levenshtein 1 sur "Bordeaux") validé, "la ville de Bordeaux" validé, "la ville de Bordaux" (Levenshtein 1 sur la variante) validé.

## Contestation

### Quand

- Uniquement quand bloqué (3 vies perdues).
- Le joueur peut contester les **3 questions de la session en cours** (celles où il a échoué).
- **Bouton "Contester" seul**, pas de message libre.

### Effet sur le joueur

- Admin valide **pendant les 12h** de blocage → déblocage immédiat, 1 vie par contestation validée (contourne le rattrapage).
- Admin valide **après 12h** (délai dépassé) → 1 vie bonus pour le prochain essai.
- **Contestation prioritaire** sur le rattrapage : si l'admin valide dans les 12h, le rattrapage n'a pas lieu.

### Effet sur les variantes

- Si l'admin **accepte** une contestation, la réponse contestée est **ajoutée aux variantes** de la question pour **tous les joueurs**.
- Si l'admin **rejette**, la contestation est clôturée sans effet.
