# ADR 0012 — Le camp au repos se déduit de l'ascension

**Date** : 2026-10-17
**Statut** : acceptée

## Contexte

Le camp n'était que l'attente, prolongée jusqu'au tirage du rattrapage. Hors de
là, une ascension sans question ni verdict s'affichait sur une carte de départ
(`card: 'start'` dans [`utils/phase.ts`](../../utils/phase.ts)) : à la sortie de
l'introduction, et après une attente échue quand le Pool Échecs est trop petit
pour un rattrapage.

Le playtest du 16 octobre 2026 a montré deux choses. La carte de départ est le
seul écran du parcours qui sort de l'univers illustré. Et le joueur neuf ne
découvre le camp qu'à sa première chute, sans rien savoir de ce qui s'y passe.

Le camp devient donc l'accueil du jeu : tout joueur qui n'est pas en pleine
ascension s'y tient, et c'est là que Michel lui explique l'interface (voir
[`specs/ecrans.md`](../../specs/ecrans.md#leçons-de-michel)).

## Décision

Pas de nouvelle phase. Le camp au repos est une **ascension au repos** : la
phase reste `ascent`, et c'est l'absence de question réservée et de verdict à
lire qui la met au camp. C'est la condition qui menait déjà à la carte de
départ ; elle mène désormais au camp.

`isAtCamp` côté écran et `requireCamp` côté serveur
([`server/utils/camp.ts`](../../server/utils/camp.ts)) ajoutent ce cas à
l'attente et au rattrapage non tiré. Objets et Sorts s'y ouvrent comme pendant
l'attente.

## Alternative écartée

Une phase `camp` à part entière. Plus explicite, mais elle touche la machine à
états, `phaseOf`, tous les tests de phase et le compte des sept phases dans les
specs. Et elle obligerait à écrire une transition `camp → ascent` qui n'est que
le tirage d'une question : la réservation dit déjà tout.

## Conséquences

- La carte de départ disparaît. Le bouton « Commencer l'ascension » devient la
  corde du camp, déroulée.
- Le camp dure jusqu'au clic sur la corde, et non plus jusqu'à l'échéance de
  l'attente : un joueur qui n'a pas fini de lancer ses sorts à l'échéance garde
  la main.
- Le rattrapage réussi et le palier enchaînent toujours sur l'ascension, sans
  repasser par le camp : leur bouton mène droit à la question suivante.
- Un sort lancé sur soi au repos attend son déclencheur, comme sur toute cible
  qui n'est pas en attente : aucune règle d'ancrage ne change.
