<template>
  <!-- Enveloppe l'icône survolée : le survol se branche ici une fois, pas dans
       chaque icône qui ouvre l'infobulle. -->
  <span
    class="inline-flex"
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
        <div class="flex items-center gap-3">
          <SpellMedallion
            :spell="effect.spell"
            :face="effect.face"
            class="w-[3.75rem] shrink-0 [filter:drop-shadow(0_2px_3px_rgb(0_0_0/0.4))]"
            fallback-class="border-2 border-amber-900/40 text-xl text-amber-900"
          />

          <div class="min-w-0">
            <p class="text-base font-bold">
              {{ spellLabel(effect.spell) }}
            </p>
            <p class="mt-1 flex flex-wrap gap-1 text-xs">
              <span
                class="rounded border px-1.5 py-px font-medium"
                :class="FACE_TONES[effect.face]"
              >{{ spellFaceLabel(effect.face) }}</span>
              <span class="rounded border border-amber-900/30 bg-amber-900/5 px-1.5 py-px">
                Lancé par {{ effect.casterName }}
              </span>
            </p>
          </div>
        </div>

        <p class="mt-3">
          {{ spellEffects(effect.spell)[effect.face] }}
        </p>

        <!-- La valeur réelle, tous effets cumulés. -->
        <p
          v-if="stake"
          class="mt-2 border-t border-amber-900/20 pt-2"
        >
          {{ stake.label }} : <span class="text-amber-900/60">{{ stake.before }}</span> → <strong>{{ stake.after }}</strong>
        </p>

        <p
          v-if="state"
          class="mt-2 italic text-amber-900/70"
        >
          {{ spellLifetime(effect, state) }}
        </p>
      </div>
    </Teleport>
  </span>
</template>

<script setup lang="ts">
// Ce qu'un effet posé sur le joueur fait, au survol de son icône : le sort, sa
// définition, la valeur qu'il change pour de vrai et jusqu'à quand. Partagée
// par le médaillon des rubans et le badge nommé de l'attente — un seul dessin.
// Voir specs/bonus.md#ce-que-voit-la-cible-et-ce-que-voit-le-lanceur.
import type { EffectView } from '~~/server/utils/effects'

const props = defineProps<{ effect: EffectView }>()

// Offert par la page : les vies et l'échéance de l'attente disent jusqu'à quand
// l'effet agit.
const state = useShownGameState()

/** L'icône survolée ; null quand rien ne l'est. */
const anchor = ref<HTMLElement | null>(null)

const FACE_TONES: Record<EffectView['face'], string> = {
  boon: 'border-sky-500/50 bg-sky-100 text-sky-800',
  curse: 'border-violet-700/40 bg-violet-100 text-violet-900',
}

const WIDTH = 288
const GAP = 8

// Chiffrée par le serveur ; rien pour un effet qui n'agit pas encore.
const stake = computed(() => (props.effect.stake ? spellStake(props.effect.stake) : null))

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
