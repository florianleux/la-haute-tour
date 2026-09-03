# Validation des réponses

## Format de réponse

**Réponse libre** (saisie texte). Pas de QCM.

## Tolérance aux fautes

- **Distance de Levenshtein ≤ 2** par rapport à une des réponses acceptées.
- **Normalisation** avant calcul : trimming, lowercase, suppression des accents, articles, ponctuation.

## Réponses acceptées

- Chaque question porte une ou plusieurs **réponses acceptées**. Aucune n'est privilégiée : la tolérance typo s'applique à chacune, un seul cas à traiter.
- Ex. réponses acceptées "Bordeaux" et "la ville de Bordeaux" → "Bordaux" (Levenshtein 1 sur la première) validé, "la ville de Bordeaux" validé, "la ville de Bordaux" (Levenshtein 1 sur la seconde) validé.
- La **réponse affichée** (`answerLabel`) est montrée au joueur sur échec. Elle ne sert jamais au matching : elle peut être plus riche que ce qu'on attend en saisie.

## Contestation

### Quand

- Uniquement quand bloqué (3 vies perdues).
- Le joueur peut contester les **3 questions de la session en cours** (celles où il a échoué).
- **Bouton "Contester" seul**, pas de message libre.

### Effet sur le joueur

- Admin valide **pendant les 12h** de blocage → déblocage immédiat, 1 vie par contestation validée (contourne le rattrapage).
- Admin valide **après 12h** (délai dépassé) → 1 vie bonus pour le prochain essai.
- **Contestation prioritaire** sur le rattrapage : si l'admin valide dans les 12h, le rattrapage n'a pas lieu.

### Effet sur les réponses acceptées

- Si l'admin **accepte** une contestation, la réponse contestée est **ajoutée aux réponses acceptées** de la question pour **tous les joueurs**.
- Si l'admin **rejette**, la contestation est clôturée sans effet.
