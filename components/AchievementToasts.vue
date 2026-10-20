<template>
  <!-- La bande (BaseToastStack) laisse passer les clics : un succès ne se ferme
       plus à la main, il n'a rien de cliquable. Montée tant qu'un succès est
       là ou en train de partir : c'est à son montage qu'elle passe par-dessus
       une boîte de dialogue déjà ouverte. -->
  <BaseToastStack v-if="mounted" edge>
    <TransitionGroup
      appear
      enter-active-class="motion-safe:animate-toast-in"
      leave-active-class="motion-safe:animate-toast-out"
    >
      <!-- Le ruban de la guilde du joueur, collé au bord droit. Son bout coupé
           reste hors de l'écran (-mr-8), même au plus loin du rebond.
           `role="status"` et non `alert` : un succès n'interrompt rien. -->
      <div
        v-for="toast in toasts"
        :key="toast.key"
        class="relative -mr-8 aspect-[794/195] w-[min(27rem,76.5vw)] bg-contain bg-no-repeat"
        :style="{ backgroundImage: `url(${RIBBONS[team]})` }"
        role="status"
      >
        <!-- Entre l'encoche, à gauche, et ce qui sort de l'écran, à droite. -->
        <div class="absolute inset-y-[14%] left-[15%] right-[calc(2rem+4%)] flex items-center gap-[0.675rem]">
          <AchievementImage :id="toast.id" class="aspect-square h-[80%] w-auto shrink-0 rounded-sm" />
          <!-- Le nom en gras, puis ce qu'il a fallu faire : le succès se
               découvre ici, il était secret jusque-là. À l'encre de la guilde
               assombrie : le blanc ne tenait pas sur les clairs du ruban, et
               l'encre seule pas sur le rouge. Assombrie de moitié, elle tient
               4,5:1 (AA) partout où le texte se pose, sur les deux rubans. -->
          <span class="min-w-0 flex-1 text-[color-mix(in_srgb,var(--team-ink)_55%,black)]">
            <span class="block truncate text-[1.35rem] font-bold leading-tight">{{ achievementLabel(toast.id) }}</span>
            <span class="mt-0.5 line-clamp-2 block text-[0.9rem] leading-snug">{{ achievementCondition(toast.id) }}</span>
          </span>
        </div>
      </div>
    </TransitionGroup>
  </BaseToastStack>
</template>

<script setup lang="ts">
// Monté une fois dans le layout : la file vit au-dessus des pages, sinon une
// navigation pendant l'annonce l'effacerait.
import type { TeamId } from '~~/shared/utils/teams'

const toasts = useAchievementToasts()

/** Le ruban de chaque guilde : bleu des Méridiens, rouge des Fauteuillistes. */
const RIBBONS: Record<TeamId, string> = {
  MIDI: '/images/achievement-toast-midi.webp',
  TLM: '/images/achievement-toast-tlm.webp',
}

const { user } = await useCurrentUser()

const team = computed<TeamId>(() => displayTeam(user.value?.team ?? null))

/** La sortie d'un ruban (toast-out, assets/css/main.css). */
const LEAVE_MS = 450

// La bande se monte avec le premier ruban, et reste le temps que le dernier
// sorte : démontée avec lui, elle l'emporterait avant son animation.
const mounted = ref(false)

watch(() => toasts.value.length, (count) => {
  if (count) {
    mounted.value = true
    return
  }

  setTimeout(() => {
    mounted.value = toasts.value.length > 0
  }, LEAVE_MS)
})
</script>
