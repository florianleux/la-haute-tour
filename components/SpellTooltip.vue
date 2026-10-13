<template>
  <!-- Enveloppe l'icône survolée : le survol se branche ici une fois, pas dans
       chaque icône qui ouvre l'infobulle. Ne fait que ça — la mise en page
       appartient à ce qu'elle enveloppe. -->
  <span
    class="inline-block"
    @mouseenter="anchor = $event.currentTarget as HTMLElement"
    @mouseleave="anchor = null"
  >
    <slot />
    <!-- Téléportée : les panneaux de parchemin sont en overflow-hidden (ils ne
         défilent pas), une infobulle posée dedans y serait coupée. Desktop
         seulement — le survol n'existe pas au doigt. -->
    <Teleport to="body">
      <div
        v-if="anchor"
        class="pointer-events-none fixed z-50 hidden w-72 rounded-md border-2 border-amber-500 bg-amber-50 p-3 text-left text-sm leading-snug text-amber-950 shadow-[inset_2px_2px_0_rgb(255_255_255/0.8),inset_-2px_-2px_0_rgb(120_53_15/0.35),0_10px_24px_rgb(0_0_0/0.45)] sm:block"
        :style="position"
        role="tooltip"
      >
        <SpellDetails :subject="subject" />
      </div>
    </Teleport>
  </span>
</template>

<script setup lang="ts">
// Ce qu'un effet posé sur le joueur fait, au survol de son icône : le dessin
// est SpellDetails, partagé avec la page droite du Grimoire ; ici, seulement le
// survol et la position. Partagée par EffectPip (rubans), SpellMention
// (parchemins, coffre) et EffectBadge (thème sombre). Sans effet, c'est un sort
// en poche (le résultat d'un coffre). Voir specs/bonus.md#linfobulle-dun-sort et
// specs/bonus.md#ce-que-voit-la-cible-et-ce-que-voit-le-lanceur.
import type { SpellSubject } from '~~/utils/spells'

defineProps<{ subject: SpellSubject }>()

/** L'icône survolée ; null quand rien ne l'est. */
const anchor = ref<HTMLElement | null>(null)

const WIDTH = 288
const GAP = 8

// Du côté où il y a de la place : à gauche d'une icône posée dans la moitié
// droite de l'écran (les rubans), à droite sinon. Lu au survol, l'icône ne
// bougeant pas tant que la souris est dessus.
const position = computed(() => {
  if (!anchor.value) {
    return {}
  }

  const rect = anchor.value.getBoundingClientRect()
  const opensLeft = rect.left + rect.width / 2 > window.innerWidth / 2
  const left = opensLeft ? rect.left - WIDTH - GAP : rect.right + GAP
  // Sa hauteur n'est pas connue avant rendu : dans la moitié basse de l'écran,
  // elle s'aligne sur le bas de l'icône et grandit vers le haut.
  const opensUp = rect.top + rect.height / 2 > window.innerHeight / 2

  return {
    left: `${Math.max(GAP, Math.min(left, window.innerWidth - WIDTH - GAP))}px`,
    ...(opensUp
      ? { bottom: `${Math.max(GAP, window.innerHeight - rect.bottom)}px` }
      : { top: `${Math.max(GAP, rect.top)}px` }),
  }
})
</script>
