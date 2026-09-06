# ADR 0005 — Le budget de lancers d'une attente, tenu en condition d'écriture

**Date** : 2026-09-06
**Statut** : acceptée

## Contexte

La règle des Sorts était « un seul exemplaire d'un même sort par attente, par
lanceur ». Elle vivait comme contrainte d'unicité sur `active_effects`
(`caster_id`, `spell`, `cast_cooldown_started_at`), et donnait l'idempotence
gratuitement : double-clic, second onglet et requête rejouée tombaient dessus.

Elle est remplacée par **deux lancers par attente, quels qu'ils soient** — le
plafond porte sur le nombre, jamais sur l'identité, pour qu'un joueur puisse
empiler deux fois le même sort (deux Répit divisent son attente par quatre) sans
attendre les équipes. Voir [`specs/bonus.md`](../../specs/bonus.md#où-et-quand).

Un plafond compté ne s'exprime plus par une clé unique.

## Décision

Le plafond est tenu **sur la consommation de l'exemplaire**, en condition du
`DELETE` de l'inventaire, jamais sur une lecture préalable :

```ts
db.delete(inventory).where(and(
  eq(inventory.id, copy.id),
  notExists(beyondBudget(db, caster.id, startedAt, rules.castsPerCooldown)),
))
```

`beyondBudget()` dit « le lancer de trop existe déjà » par un `limit(1).offset(cap - 1)`
sur les lancers de cette attente, et non par un `count(*)` : c'est ce qui permet
de le poser en sous-requête d'écriture, en passant par le query builder — donc
par la conversion d'horodatage que le schéma définit.

L'exemplaire non consommé arrête tout : rien n'est posé, rien n'est purgé.
L'unicité en base disparaît, remplacée par un simple index de lecture
(`active_effects_caster_cooldown_idx`).

## Conséquences

L'idempotence n'est plus offerte par la base. Deux clics sur **deux sorts
différents**, tirés en même temps, dépensent bien deux lancers — c'est le
comportement voulu quand c'est volontaire, et assumé sinon. Ce qui reste : le
budget affiché (`castsLeft`), les boutons éteints à zéro, et le bouton en vol
pendant l'envoi. Une même requête rejouée, elle, vise le même exemplaire : la
condition d'écriture la refuse toujours.

Le plafond devient une règle d'étage (`castsPerCooldown` dans `FloorRules`), donc
modulable comme les autres — l'écran le lit pour dire la règle plutôt que de la
recopier en dur.
