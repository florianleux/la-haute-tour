---
name: patchnote
description: Write a short player-facing patch note, in French, from the commits merged into main today. Use when the user asks for a patch note, or the changes of the day.
---

Produce the patch note of the day, for the players of La Haute Tour. An optional argument gives another period (`hier`, `2026-11-06`, `depuis lundi`).

## Steps

1. Read the commits. Fetch first: what counts is what reached `main`, not the local checkout.

   ```bash
   git fetch -q origin main
   git log origin/main --since="$(date '+%Y-%m-%d') 00:00" --no-merges --format='%s%n%b'
   ```

2. Keep what a player can see. Drop `chore`, `refactor`, `test`, `docs`, CI, and anything internal. Merge the commits of one feature into a single line, its fixes included.
3. Write the note in the format below, and print it in the chat. Do not write a file, and do not post it anywhere.

If nothing a player can see was merged, say so in one line instead of inventing a note.

## Format

```
**Patch note du jour**

- Nouveau : un drôle de champignon pousse au camp
- Nouveaux décors du camp, de jour comme de nuit
- De nouveaux Haut-faits à découvrir
- Bouton OK plus lisible quand on obtient un objet
- Couleurs corrigées sur les vieux ordis, et petits correctifs divers
```

## Rules

- Title: « Patch note du jour », never the date. With another period, name that period in words.
- Five bullets at most, one short line each, biggest change first, small fixes last and grouped.
- French, plain words for players. No emoji, no commit type, no issue number, no technical term: « vieux ordis », not « Chrome 109 ».
- No spoilers. Haut-faits are secret: never give their name, their condition, or how many were added. Do not explain how a new mechanic works either; hint at it.
- Do not mention what was removed.
- No warning or joke of your own, such as « à vos risques et périls ». Say what changed, and stop.
