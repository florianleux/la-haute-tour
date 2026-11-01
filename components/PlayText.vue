<template>
  <component
    :is="as"
    :class="(long && LONG_ROLES[role]) || (large && LARGE_ROLES[role]) || ROLES[role]"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
import type { LONG_CHARS } from '~~/utils/typography'

// Une ligne du panneau de jeu. Le rôle dit la taille, jamais l'écran : la même
// question se lit à la même échelle en ascension et en rattrapage, et régler
// l'une règle l'autre. C'est le partage que BaseCardButton fait déjà pour les
// boutons illustrés.
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
  // Ce qui situe la bonne réponse, à la ligne sous elle : entre elle et l'aparté.
  | 'detail'
  // Ce que le joueur avait tapé, et les explications qui suivent un titre.
  | 'aside'
  // Une annonce brève : coffre gagné, question loot, sort du rattrapage.
  | 'notice'
  // Un geste écrit en toutes lettres : contester.
  | 'link'
  // Ce qui remplace un geste fait, à sa taille pour ne rien décaler : la
  // contestation envoyée.
  | 'receipt'
  // Le chrono dans le médaillon.
  | 'timer'
  // Le ✓ ou le ✗ dans le médaillon.
  | 'mark'

const ROLES: Record<Role, string> = {
  progress: 'text-[3cqw] font-bold uppercase tracking-widest sm:text-[2.8cqw]',
  statement: 'text-[7.1cqw] leading-relaxed sm:text-[4.8cqw]',
  recall: 'text-[6.2cqw] sm:text-[3.5cqw]',
  headline: 'text-[8.3cqw] font-bold sm:text-[4.8cqw]',
  answer: 'text-[4.5cqw] font-bold uppercase sm:text-[4.2cqw]',
  detail: 'text-[3.9cqw] sm:text-[3.2cqw]',
  aside: 'text-[3.9cqw] sm:text-[2.7cqw]',
  notice: 'text-[3.6cqw] font-semibold sm:text-[2.5cqw]',
  link: 'text-[3.3cqw] font-semibold underline underline-offset-2 sm:text-[2.5cqw]',
  receipt: 'text-[3.3cqw] font-semibold sm:text-[2.5cqw]',
  // Ces deux-là vivent dans le médaillon, dont chaque habillage fixe la taille
  // de texte (`medallionInk`, voir PlayFrame) : les deux dessins n'ont pas le
  // même disque, et c'est le disque qui doit porter le même chiffre. Le ✓/✗ se
  // compte en em sur ce chiffre.
  timer: 'font-bold tabular-nums',
  mark: 'text-[1.5em] font-bold',
}

// Les tailles réduites, pour un texte trop long pour tenir à la sienne : le
// panneau ne défile pas. L'appelant dit si c'est le cas (`long`), avec les
// seuils de LONG_CHARS (utils/typography.ts), mesurés contre ces tailles : une
// taille sans seuil ou un seuil sans taille ne compile pas. Desktop seulement :
// chaque entrée recopie le reste de son rôle dans ROLES, à garder en phase.
const LONG_ROLES: Partial<Record<Role, string>> = {
  statement: 'text-[7.1cqw] leading-relaxed sm:text-[3.8cqw]',
  recall: 'text-[6.2cqw] sm:text-[2.7cqw]',
  answer: 'text-[4.5cqw] font-bold uppercase sm:text-[3.4cqw]',
} satisfies Record<keyof typeof LONG_CHARS, string>

// Les tailles agrandies d'un cinquième, pour le verdict d'une carte plus étroite
// que le panneau de l'ascension : celle de l'épreuve du boss (BossFlagTrial).
// Desktop seulement, comme LONG_ROLES : le reste du rôle recopié de ROLES.
const LARGE_ROLES: Partial<Record<Role, string>> = {
  headline: 'text-[8.3cqw] font-bold sm:text-[5.76cqw]',
  answer: 'text-[4.5cqw] font-bold uppercase sm:text-[5.04cqw]',
  detail: 'text-[3.9cqw] sm:text-[3.84cqw]',
  aside: 'text-[3.9cqw] sm:text-[3.24cqw]',
}

withDefaults(defineProps<{
  role: Role
  /** La balise rendue : un paragraphe sauf quand la ligne est un geste. */
  as?: 'p' | 'span' | 'button'
  /** Trop long pour la taille du rôle : la taille réduite, s'il en a une. */
  long?: boolean
  /** Agrandi d'un cinquième, s'il a une taille agrandie (LARGE_ROLES). */
  large?: boolean
}>(), { as: 'p' })
</script>
