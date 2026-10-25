# Équipes

Le jeu était solo, puis les Sorts l'ont ouvert aux autres. Encore faut-il savoir
qui est « l'autre » : un sort se lance sur un **allié** ou sur un **ennemi**, et
ces deux mots ne désignent personne tant qu'une appartenance n'existe pas. La
porte à deux clés d'un boss en dépend tout autant : sans équipe, personne à
attendre pour l'ouvrir. C'est tout ce que ce document apporte — la donnée dont
la magie noire et la porte du boss dépendent, et rien de plus.

## Deux équipes, assignées à la main

- **Deux équipes fixes**, et deux seulement. Pas de troisième, pas de création
  d'équipe : le catalogue des Sorts ne connaît que « les miens » et « les
  autres », et une troisième équipe n'ajouterait aucune catégorie de cible.
- **L'équipe se choisit en invitant, et obligatoirement.** C'est au moment où
  l'admin ajoute un Discord ID à la whitelist qu'il dit dans quelle équipe ce
  joueur arrivera : c'est le seul instant où l'on sait pourquoi on l'invite. Pas
  d'invitation sans équipe. Le compte créé à sa première connexion la reprend.
- **Le joueur ne la choisit pas, il la découvre.** À l'introduction, dès que le
  joueur a dit son nom et ce qu'il est, et avant ses questions, L'Inconnu lit
  sa bannière : il nomme sa guilde et la
  rivale ; leur course au sommet vient quand le joueur demande ce qu'est la Tour
  (voir [`lore.md`](./lore.md#guildes)). Rien à
  choisir, rien à recevoir.
- **Elle se change ensuite depuis la fiche joueur**, à tout moment. Rééditer la
  whitelist ne déplace personne : la fiche fait foi une fois le compte créé,
  sinon un ancien choix défarait en silence une décision plus récente.
- Pas de tirage automatique, pas d'équilibrage des effectifs : à cette échelle,
  le jugement d'un humain qui connaît les joueurs vaut mieux qu'une règle.
- **Seuls l'admin et les joueurs test peuvent être sans équipe.** L'admin n'en
  a pas ; un joueur test se place, ou non, depuis son banc. Un joueur invité en
  a toujours une : la base a été remise à zéro au moment où l'équipe est devenue
  obligatoire, si bien qu'aucun joueur n'est resté sans.

Les deux équipes sont les deux guildes de [`lore.md`](./lore.md) :

| Guilde | Identifiant | Bannière |
|---|---|---|
| Les **Méridiens** | `MIDI` | bleue, aux étoiles |
| Les **Fauteuillistes** | `TLM` | rouge, aux fauteuils |

Les noms affichés ne vivent que dans l'affichage, comme pour les Sorts, et se
renomment sans migration. Les identifiants, eux, sont gravés en base : les
premiers (`CRIMSON`, `AZURE`) ont été renommés une fois, par migration.

## Allié, ennemi : une dérivation, pas un stockage

Le statut ne se stocke jamais : il se lit de deux appartenances, au moment du
tirage.

| Le lanceur et la cible | Catégorie | Face appliquée |
|---|---|---|
| Même équipe | **Allié** | magie blanche |
| Équipes différentes | **Ennemi** | magie noire |
| Le lanceur est sa propre cible | **Soi** | magie blanche |

Rien d'autre n'entre dans ce calcul — ni l'étage, ni l'ancienneté, ni ce qui
s'est déjà lancé entre les deux joueurs. Voir [`bonus.md`](./bonus.md#catégories-de-cible).

**Une exception, et une seule : les mondes ne se mélangent pas.** Un joueur test
et un vrai joueur ne sont liés par rien, même sous la même couleur. L'équipe dit
de quel côté on est, elle ne dit pas dans quel monde on joue — et un fantôme n'a
ni allié ni ennemi parmi les vivants. La règle vit dans la relation elle-même
plutôt que dans le seul tirage : c'est le lien qu'on veut inexistant, et tout ce
qui le lira en hérite. Voir [`admin.md`](./admin.md#joueurs-test).

## Porte à deux clés

Deuxième usage de l'équipe, indépendant du ciblage des Sorts : le boss de
chaque étage est derrière une porte que deux membres d'une même équipe doivent
ouvrir, chacun posant sa clé. Un joueur sans équipe trouve la porte déjà
ouverte et affronte le boss seul dès qu'il l'atteint — même règle que pour le
PvP : personne à attendre, personne à qui il doive quelque chose.

**Deuxième fissure dans l'anonymat des coéquipiers**, du même type que le
journal des Sorts (voir plus bas) : l'écran de porte fermée, et le camp qui
l'attend, **nomment** qui a déjà posé sa clé — une action accomplie qui vous concerne, jamais une
progression que ce coéquipier n'a pas choisi de montrer. Voir
[`boss.md`](./boss.md#porte-à-deux-clés) et
[ADR 0008](../docs/adr/0008-la-porte-du-boss-nomme-qui-a-pose-sa-cle.md).
Pas encore affiché à l'écran : la porte et le camp ne montrent pour l'instant
que le nombre de clés posées.

## Le joueur sans équipe

Il existe : c'est le cas de l'admin, et des joueurs test que l'administration
n'a pas placés. Un joueur invité arrive toujours avec une équipe ; il ne la perd
que si l'admin la lui retire depuis sa fiche. Sa situation est **symétrique** — il ne touche personne, et
personne ne le touche.

- **Il ne lance que sur Soi.** Les catégories Allié et Ennemi ne lui sont pas
  proposées : sans équipe, elles ne désigneraient aucun pool.
- **Il n'est jamais tiré comme cible**, ni en allié ni en ennemi. Le tirage
  l'écarte au même titre qu'un joueur en `gameOver` : non par punition, mais
  parce qu'aucune relation ne le relie au lanceur.

C'est assumé et c'est même le but pour l'admin : il arbitre les parties, il n'a
pas à y peser. Un joueur sans équipe n'est donc pas un joueur diminué, c'est un
joueur que le PvP ne concerne pas.

## Changer d'équipe en cours de partie

L'admin peut déplacer un joueur à tout moment. **Ce qui est déjà lancé ne
bouge pas.**

- Un effet porte la **face gravée au moment du lancer**. Une malédiction reçue
  d'un ennemi reste une malédiction, même si ce lanceur passe dans l'équipe de
  sa victime le lendemain.
- Le changement d'équipe ne vaut donc que pour les **lancers à venir**.

Deux raisons, et la seconde est la plus forte. D'abord, rejouer la face à chaque
lecture demanderait de connaître l'équipe du lanceur au moment où l'effet agit,
alors que l'effet est justement ce qui survit à la situation qui l'a produit.
Ensuite, un joueur verrait le signe d'un effet s'inverser sans avoir rien fait —
et personne ne peut jouer contre une règle qui change dans son dos.

Conséquence assumée : l'administration ne peut pas dissoudre une malédiction en
déplaçant quelqu'un. C'est voulu — sinon le changement d'équipe deviendrait un
remède, et le sort du lanceur serait perdu sans qu'il l'apprenne jamais.

## Ce que l'équipe n'apporte pas

Rien d'autre que la relation. En particulier :

- **Aucun score d'équipe**, aucun cumul, aucune victoire collective.
- **Aucun classement**, ni d'équipe ni de joueur. Le serveur classe bien les
  joueurs par progression pour pondérer le tirage des cibles, mais ce classement
  **ne sort jamais du serveur** et n'est montré à personne. Voir
  [`ecrans.md`](./ecrans.md#ce-quaucun-écran-joueur-ne-montre).
- **Aucune progression d'autrui affichée** : on ne voit ni l'étage, ni les vies,
  ni l'avancement de ses coéquipiers. L'équipe dit qui peut être touché, pas où
  en sont les autres.
- **Rien de plus que deux boutons**, une fois le PvP là. Le Grimoire propose
  les catégories Allié et Ennemi à qui a une équipe, pas à qui n'en a pas — ni
  liste de coéquipiers, ni effectif, ni adversaires. Les noms n'arrivent
  qu'après un lancer, un par un, par les journaux. Les autres membres se
  découvrent en jouant, ils ne se consultent pas.
- **Sa propre guilde, oui** : le camp porte la bannière de la guilde du joueur
  (bleue pour les Méridiens, rouge pour les Fauteuillistes), qui mène aux
  Haut-faits — eux-mêmes ouverts sur cette bannière. C'est la seule couleur
  d'équipe affichée, et c'est la sienne : elle dit de quel côté il est, jamais
  qui est avec lui. Sans équipe, pas de bannière, et donc pas de Haut-faits.

L'équipe est une relation entre deux joueurs, lue au moment d'un lancer. Elle
n'est pas un camp qu'on défend, et le jeu ne propose aucune façon de la faire
gagner.

## Ce qui reste à spécifier

- ~~Les **libellés** des deux équipes~~ : Méridiens et Fauteuillistes, voir plus haut.

---

*Amende [`bonus.md`](./bonus.md) (catégories de cible, tirage) et
[`admin.md`](./admin.md) (assignation). Amendée par [`boss.md`](./boss.md)
(porte à deux clés).*
