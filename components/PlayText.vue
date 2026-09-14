<template>
  <component
    :is="as"
    :class="ROLES[role]"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
// Une ligne du panneau de jeu. Le rôle dit la taille, jamais l'écran : la même
// question se lit à la même échelle en ascension et en rattrapage, et régler
// l'une règle l'autre. C'est le partage que CardButton fait déjà pour les
// boutons illustrés et EffectBadge pour les badges.
//
// Tout est en cqw du **panneau**, qui est lui-même un @container (voir
// PlayFrame) : le texte occupe la même fraction de la page écrite quelle que
// soit la taille de la fenêtre, et la même des deux côtés. Mesuré sur le cadre,
// il dépendait de la boîte de l'illustration — or le cadre de la tour laisse
// 52% de sa largeur au texte et le parchemin 82%, si bien que la même valeur
// donnait deux tailles. Les valeurs sont celles de l'ascension, qui sert de
// référence, converties dans cette unité.
//
// La couleur n'est pas ici : le vert du juste, le rouge du faux et l'ambre du
// parchemin disent quelque chose de l'état, pas du rôle de la ligne. Elle
// arrive par `class` depuis l'appelant, que Vue fusionne sur la racine.
type Role =
  // Le décompte de progression, à l'échelle des libellés des rubans.
  | 'progress'
  // L'énoncé d'une question en cours : la ligne que le joueur lit d'abord.
  | 'statement'
  // Le même énoncé rappelé sous un verdict, où il n'est plus l'essentiel.
  | 'recall'
  // « Correct ! » / « Incorrect... », et les titres de palier et de fin.
  | 'headline'
  // La bonne réponse, en capitales.
  | 'answer'
  // Ce que le joueur avait tapé, et les explications qui suivent un titre.
  | 'aside'
  // Une annonce brève : coffre gagné, question loot, sort du rattrapage.
  | 'notice'
  // Un geste écrit en toutes lettres : contester.
  | 'link'
  // Le chrono dans le médaillon.
  | 'timer'
  // Le ✓ ou le ✗ dans le médaillon.
  | 'mark'

const ROLES: Record<Role, string> = {
  progress: 'text-[4cqw] font-bold uppercase tracking-widest sm:text-[2.1cqw]',
  statement: 'text-[7.1cqw] leading-relaxed sm:text-[4.8cqw]',
  recall: 'text-[6.2cqw] sm:text-[3.5cqw]',
  headline: 'text-[8.3cqw] font-bold sm:text-[4.8cqw]',
  answer: 'text-[4.5cqw] font-bold uppercase sm:text-[4.2cqw]',
  aside: 'text-[3.9cqw] sm:text-[2.7cqw]',
  notice: 'text-[3.6cqw] font-semibold sm:text-[2.5cqw]',
  link: 'text-[3.3cqw] font-semibold underline underline-offset-2 sm:text-[2.5cqw]',
  // Ces deux-là vivent dans le médaillon, qui est son propre @container (voir
  // PlayFrame) : leur `cqw` se mesure donc sur le médaillon et non sur le
  // cadre. Sans ça, deux médaillons de tailles différentes portaient le même
  // texte en pixels, et le chiffre débordait du plus petit.
  timer: 'text-[12cqw] font-bold tabular-nums',
  mark: 'text-[18cqw] font-bold',
}

withDefaults(defineProps<{
  role: Role
  /** La balise rendue : un paragraphe sauf quand la ligne est un geste. */
  as?: 'p' | 'span' | 'button'
}>(), { as: 'p' })
</script>
