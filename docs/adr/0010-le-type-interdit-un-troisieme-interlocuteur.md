# ADR 0010 — La forme d'un dialogue interdit un troisième interlocuteur

**Date** : 2026-09-17
**Statut** : acceptée

## Contexte

Une scène de dialogue (#51) montre un ou deux interlocuteurs : deux de part et
d'autre, ou un seul au milieu. Jamais trois — la boîte de dialogue couvre le bas
de la scène, et un troisième portrait n'aurait nulle part où se poser.

La première écriture déduisait l'affiche des répliques : un tableau de répliques,
chacune portant son interlocuteur et son côté, et une fonction `dialogueStage`
qui donnait chaque côté au premier interlocuteur rencontré. Un troisième
personnage était donc **écarté en silence** — ses répliques s'affichaient sous le
nom de quelqu'un dont le portrait n'était pas là. Aucun test ne pouvait attraper
ça : le comportement était correct, c'est la donnée qui était fausse.

## Décision

**Le dialogue déclare sa distribution, et le type refuse le reste.**

```ts
type Dialogue = { background: string, revealMs?: number } & (
  | { left: Speaker, right: Speaker, center?: never, lines: DialogueLine<'left' | 'right'>[] }
  | { center: Speaker, left?: never, right?: never, lines: DialogueLine<'center'>[] }
)
```

Une réplique qui parle depuis une place que le dialogue ne remplit pas ne compile
pas. `dialogueStage` disparaît : l'affiche n'est plus déduite, elle est écrite.

Les `?: never` ne sont pas de la décoration, et c'est la raison la moins évidente
de tout ce fichier : **le contrôle des propriétés en trop est permissif sur une
union.** TypeScript accepte une propriété dès qu'elle existe dans *n'importe
lequel* des membres, si bien que sans eux `{ left, right, center, lines }`
compile — le troisième interlocuteur passe, et son portrait ne s'affiche
simplement jamais. Mesuré avant d'être écrit ici, pas supposé. Chaque `?: never`
ferme cette porte pour le membre d'en face.

Le prix est un type qu'on ne lit pas d'un coup d'œil ; retirer un `?: never` en
le prenant pour du bruit rouvre exactement le trou que ce fichier documente.

Ce qui rend ce choix payant, c'est [ADR 0009](./0009-le-dialogue-s-ecrit-en-code.md) :
les dialogues sont des littéraux TypeScript, donc `nuxt typecheck` les vérifie
tous, un par un, à chaque CI. La même union sur des données venues du réseau ne
prouverait rien — il faudrait un schéma Zod à la frontière.

## Conséquences

Un invariant quitte le runtime pour le compilateur. Les quatre tests qui
décrivaient le comportement de `dialogueStage` disparaissent avec elle ; ce
qu'ils gardaient est désormais tenu par `@ts-expect-error` dans
`tests/app/dialogue.test.ts`, que `nuxt typecheck` fait échouer si l'union se
relâche.

Le prix : trois personnages à l'écran demanderont de rouvrir le type, pas
d'ajouter une ligne à un tableau. C'est voulu — ça force à décider où le
troisième se tient, question qu'un tableau laissait sans réponse.

Le décor et les portraits, eux, restent des chaînes libres (chemin public ou data
URI) : Tailwind ne génère ses classes que depuis les littéraux du source, une
image de dialogue est une donnée, et aucune union ne changerait ça.
