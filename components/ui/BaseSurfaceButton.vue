<template>
  <!-- Une surface entière qui fait bouton. Invisible : elle ne dessine rien,
       elle recouvre — d'où l'absence de tout habillage, contrairement à
       BaseButton et BaseCardButton qui, eux, se voient.

       Un vrai <button> plutôt qu'un div qui écoute le clic : il apporte le
       focus, Entrée, Espace et l'annonce en synthèse vocale, qu'il faudrait
       sinon réécrire à la main. Il se pose PAR-DESSUS le contenu, jamais
       autour, pour ne rien imbriquer dans un élément interactif — d'où le
       `label` obligatoire, seul texte qu'une synthèse vocale en tirera.

       Avec `to`, la surface mène à une page : un vrai lien alors, pour les
       mêmes raisons, sous les mêmes classes. -->
  <NuxtLink
    v-if="to"
    :to="to"
    :aria-label="label"
    :class="SURFACE"
  />
  <button
    v-else
    type="button"
    :aria-label="label"
    :class="SURFACE"
    @click="$emit('click')"
  />
</template>

<script setup lang="ts">
// Le geste « cliquer n'importe où » : le joueur n'a pas de cible à viser, toute
// la scène répond. Écrit ici plutôt qu'en ligne dans l'écran qui s'en sert,
// parce que CLAUDE.md l'exige — un composant métier n'écrit jamais un <button>
// brut — et parce que la prochaine surface cliquable recopierait ces classes.
//
// Elle se place en absolu : l'appelant doit donc porter `relative`, comme pour
// n'importe quel recouvrement.
defineProps<{
  /** Ce que la surface fait, pour qui ne la voit pas. Une icône n'en dirait rien. */
  label: string
  /** La page où mène la surface. Sans elle, c'est un bouton qui émet `click`. */
  to?: string
}>()

defineEmits<{ click: [] }>()

const SURFACE = 'absolute inset-0 z-30 cursor-pointer appearance-none border-0 bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70'
</script>
