# ADR 0011 — Plus de budget de lancers : un plafond d'effets positifs

**Date** : 2026-10-14
**Statut** : acceptée — remplace l'[ADR 0005](./0005-le-budget-de-lancers-tenu-a-l-ecriture.md)

## Contexte

Un joueur lançait au plus **deux sorts par attente** (`castsPerCooldown`), tenus
en condition d'écriture sur la consommation de l'exemplaire (ADR 0005).

Ce budget gênait le jeu sans le protéger là où il fallait. À deux coffres par
tentative, il mordait rarement ; il ne bornait vraiment que le joueur qui avait
fait des réserves. Et il était, de fait, **la seule borne des magies blanches** :
les négatives avaient déjà leur plafond par cible (`maxCurses`), les positives
non. Le retirer seul aurait laissé empiler sans fin :

- Répit sur soi, jusqu'à effacer l'attente — la mécanique centrale du rythme ;
- Chronomancie, jusqu'à laisser le temps de chercher les réponses ;
- Vitalité, additive, jusqu'à rendre une tentative imperdable ;
- Purge, jusqu'à vider son Pool Échecs d'un coup et annuler le rattrapage.

## Décision

**Le budget de lancers disparaît. Un plafond d'effets positifs portés le remplace,
symétrique de celui des négatifs** : un joueur ne porte jamais plus de deux magies
blanches à la fois (`maxBoons` dans `FloorRules`).

- Une magie blanche occupe une place tant qu'elle **n'a pas encore agi** — elle
  attend la tentative suivante — ou qu'elle **agit sur l'attente en cours**
  (`countsTowardMaxBoons`). Une magie blanche ancrée rend sa place, même si elle
  court encore jusqu'au bout de sa tentative. C'est plus étroit qu'`isBorneBy`,
  que gardent les négatives : lue comme une malédiction, une Vitalité ancrée sur la
  tentative N bloquerait toute l'attente qui suit N.
- Répit, Indulgence et Purge occupent leur place pendant toute l'attente où elles
  sont parties, Purge comprise bien qu'elle agisse à l'instant : c'est ce qui
  empêche d'effacer l'attente ou de vider le Pool Échecs d'un coup.
- Un **allié** saturé sort du tirage, silencieusement — le même filtre que pour
  l'ennemi, `unsaturated(db, candidates, face)`, lu une fois pour tout le pool.
- **Sur soi**, la cible est connue d'avance : le lancer est refusé **avant** la
  consommation, l'exemplaire reste en poche. L'inventaire dit `canTargetSelf` et
  le Grimoire éteint « Sur moi » en disant pourquoi.
- La consommation garde sa condition d'écriture (`delete … where id = ?`) : le
  double-clic sur le même bouton ne dépense toujours qu'un exemplaire.

## Conséquences

- Un joueur lance autant de sorts qu'il en a en poche. Les plafonds par cible,
  négatifs comme positifs, bornent ce que chacun encaisse.
- Le plafond se tient **par une lecture**, pas en condition d'écriture : des
  lancers envoyés au même instant — deux onglets, deux alliés sur la même cible —
  peuvent tous passer. Assumé : le Grimoire n'envoie qu'un lancer à la fois, et le
  dépassement reste d'un ou deux effets, pas un empilement sans fin.
- Un joueur qui a des réserves peut saturer d'un coup tous ses ennemis, deux
  malédictions chacun, là où le budget étalait ces lancers sur plusieurs attentes.
- Une Purge blanche sur un allié **hors attente** ne se porte pas (faute d'attente
  à laquelle la rattacher) : elle échappe au plafond. Porte connue, laissée
  ouverte tant qu'elle ne pose pas de problème en jeu.
- `active_effects.cast_cooldown_started_at` et son index ne servent plus au
  budget. La colonne est gardée — elle dit dans quelle attente un sort est parti,
  et la retirer demanderait une migration prod. L'index, lui, peut tomber à la
  prochaine migration.
