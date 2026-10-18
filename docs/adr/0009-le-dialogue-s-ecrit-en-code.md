# ADR 0009 — Le dialogue s'écrit en code, jamais en base

**Date** : 2026-09-17
**Statut** : acceptée

## Contexte

Le module de dialogue (#51) sert d'abord l'introduction d'un boss : apparition,
nom, répliques, une seule fois par boss (voir `boss.md#introduction-et-animations`).

Le contenu du boss, lui, est déjà tranché dans l'autre sens : ses 10 épreuves par
combat sont « choisies à la main, une fois, **en base** » (`boss.md#contenu-des-épreuves`),
et les drapeaux de l'étage 1 ont leur table dédiée. Un lecteur qui voit les
épreuves d'un boss en base s'attend à y trouver ses répliques.

Deux lectures :

- **En base**, comme les épreuves : une table `dialogues`/`lines`, un endpoint,
  et la forme du dialogue partagée entre les deux côtés (`shared/utils/`).
- **En code**, comme le catalogue des Succès et celui des Reliques : « catalogue
  fixe écrit dans le code, jamais administrable » (`succes.md`, `boss.md#récompense`).

## Décision

**En code, côté écran.** Le dialogue vit dans `utils/`, avec les mots des Succès
et des Sorts, pas dans `shared/utils/` ni en base.

Ce qui tranche n'est pas la commodité mais qui a besoin d'en connaître le
contenu : **personne d'autre que l'écran**. Une épreuve de boss est en base parce
que le serveur l'arbitre — il tire l'ordre, compare la réponse, retire un PV. Une
réplique n'est arbitrée par personne : le serveur n'a jamais à savoir ce qu'un
boss raconte, seulement **qu'une** introduction a déjà été vue. C'est la même
frontière que le repo trace déjà entre `shared/utils/spells.ts` (les
identifiants, que le schéma grave et que le serveur arbitre) et `utils/spells.ts`
(les libellés, qui ne traversent rien).

## Conséquences

Écrire un dialogue est un commit, pas une écriture en base : pas de migration, pas
d'écran d'administration, pas de validation Zod à la frontière réseau — il n'y a
pas de frontière. Corriger une faute de frappe passe par un déploiement, ce qui
est le prix assumé, le même que pour renommer un succès.

Le jour où un dialogue devrait être administrable, la bascule est un vrai
chantier : type déplacé dans `shared/`, table, endpoint, et le catalogue à
transvaser. C'est ce qui rend cette décision digne d'être écrite.

Ce que la décision ne tranche pas : retenir qu'une introduction a déjà été jouée
reste un fait de partie, donc du serveur. Il vivra dans le ticket qui câble le
dialogue sur `bossDoor` (#39), pas ici.
