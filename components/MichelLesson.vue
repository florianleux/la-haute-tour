<template>
  <!-- Michel en leçon, au coin bas-droit de l'écran, la bulle au-dessus de lui :
       à côté, elle recouvrait la page de détail de l'Inventaire. Bras tendu
       quand il montre quelque chose, neutre sinon (michel-talking.webp,
       michel.webp : même cadrage, l'un remplace l'autre sans bouger).

       La place du buste est tenue même avant qu'il n'arrive : « HÉ ! », bulle
       seule, crie déjà d'où il va surgir. Puis il surgit du bas, s'étire et
       rebondit (camp-rise), et sa bulle éclot ensuite. Le buste est coupé au
       ras du bas : il descend un peu sous l'écran, et son rebond ne le décolle
       jamais du bord (--rise-lift nul, il s'étire à la place), sinon on
       verrait la coupe.

       Au-dessus du camp et de son poster (z-15), et de ce qu'ils portent. Dans
       une boîte du camp, posé dans la boîte même : une boîte modale passe
       devant tout ce qui n'est pas en elle. -->
  <div class="pointer-events-none fixed bottom-0 right-[2vw] z-[25] aspect-[903/786] h-[min(38dvh,30vw)]">
    <img
      v-if="!line.bubbleOnly"
      :src="line.spotlight ? '/images/michel-talking.webp' : '/images/michel.webp'"
      alt=""
      class="size-full origin-bottom translate-y-[4%] motion-safe:animate-camp-rise [--rise-lift:0dvh] [--rise-stretch:1.12]"
    >

    <!-- La bulle. Remontée à l'arrivée de Michel (`key`) : elle éclot après
         lui. « HÉ ! » est plus gros, tremble à son éclosion, et pointe à
         droite, vers où Michel va surgir ; les autres pointent vers sa tête,
         en bas. -->
    <div
      :key="line.bubbleOnly ? 'shout' : 'michel'"
      ref="bubble"
      class="pointer-events-auto absolute bottom-[92%] right-0 rounded-3xl bg-stone-100/95 px-6 py-4 text-[max(1.1rem,2.4dvh)] leading-snug text-stone-800 shadow-2xl ring-1 ring-black/10"
      :class="line.bubbleOnly
        ? 'origin-right motion-safe:animate-shout'
        : 'w-[min(26rem,45vw)] origin-bottom-left motion-safe:animate-bubble-in [--enter-delay:0.6s]'"
      role="status"
    >
      <span
        class="absolute size-5 rotate-45 bg-stone-100/95"
        :class="line.bubbleOnly ? '-right-2 top-1/2 -translate-y-1/2' : '-bottom-2 right-[65%]'"
      />
      <p :class="line.bubbleOnly && 'px-4 text-[3em] font-black tracking-wide'">
        {{ line.text }}
      </p>

      <template v-if="onBubble">
        <p class="mt-1 text-right text-[0.6em] italic text-stone-500">
          Clique pour continuer
        </p>
        <BaseSurfaceButton label="Continuer" class="rounded-3xl" @click="advance" />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
// La bulle de Michel pendant une leçon.
// Une réplique avance au clic, à Entrée ou aux flèches bas et droite ; quand
// Michel attend un geste (cliquer ce qu'il montre, utiliser le Fromage, refermer
// une boîte), seul ce geste fait passer à la suite. Le clic sur sa dernière
// réplique lance l'ascension (`ascent`). Voir specs/ecrans.md#leçons-de-michel.
import { DIALOGUE_KEYS } from '~~/utils/keyboard'
import type { LessonLine } from '~~/utils/lessons'

const props = defineProps<{ line: LessonLine }>()

const emit = defineEmits<{ next: [], ascent: [] }>()

/** La bulle elle-même fait avancer : la réplique n'attend aucun autre geste. */
const onBubble = computed(() => advancesOnBubble(props.line))

// La bulle saute à chaque réplique : le dialogue garde du rythme. Michel, lui,
// ne bouge pas. Pas à son arrivée : la bulle y est remontée (`key`), et c'est
// bubble-in qui joue.
//
// En JS (element.animate) et non en classe de main.css comme les autres
// animations : une animation CSS ne se rejoue qu'en remontant l'élément, et
// remonter la bulle à chaque réplique rejouerait aussi son éclosion.
const bubble = useTemplateRef<HTMLElement>('bubble')

const BUMP: Keyframe[] = [
  { transform: 'none' },
  { transform: 'translateY(-10px) scale(1.04, 0.97)', offset: 0.35 },
  { transform: 'translateY(2px) scale(0.99, 1.02)', offset: 0.7 },
  { transform: 'none' },
]

watch(() => props.line, () => {
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    bubble.value?.animate(BUMP, { duration: 320, easing: 'ease-out' })
  }
})

function advance(): void {
  if (props.line.awaits === 'ascent') {
    emit('ascent')
  }
  else {
    emit('next')
  }
}

useAdvanceOnEnter(advance, onBubble, DIALOGUE_KEYS)
</script>
