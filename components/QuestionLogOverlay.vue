<template>
  <CampOverlay
    v-slot="{ closing, close }"
    label="Volumen"
    close-label="Fermer le Volumen"
    class="question-log-scroll-metrics"
    :lesson="lesson"
    @close="$emit('close')"
    @next="$emit('next')"
  >
    <!-- Par-dessus le camp (CampOverlay). Clic à côté du papier = fermer, y
         compris dans les vides de l'image autour des rouleaux : les deux
         couches du parchemin laissent passer le clic jusqu'à cette boîte, que
         le papier, lui, arrête.

         Le bas du parchemin — bord du papier et rouleaux — tombe sous l'écran :
         seules les poignées du haut se voient, et le papier descend jusqu'en bas
         pour laisser plus de place à la lecture. En largeur, le calque est
         rogné au ras des rouleaux : ils se posent à 4 % des bords de l'écran,
         quelle que soit la largeur. Repères du calque :
         `question-log-scroll-metrics`, dans main.css.

         Taille arrondie au pixel par `round()`, avec un repli en `calc()` :
         sans lui, un navigateur qui ignore `round()` (Chrome avant 125) donne
         une boîte de hauteur nulle — le titre seul, ni parchemin ni liste. -->
    <div
      class="relative mt-[6dvh] h-[round(calc(94dvh+var(--k)*var(--cut-b)),1px)] w-[round(92vw,1px)] not-supports-[width:round(1px,1px)]:h-[calc(94dvh+var(--k)*var(--cut-b))] not-supports-[width:round(1px,1px)]:w-[92vw] shrink-0 origin-bottom"
      :class="closing ? 'motion-safe:animate-sink [--enter-delay:0.12s]' : 'motion-safe:animate-rise'"
      data-camp-backdrop
      @click.self="close"
    >
      <!-- Le parchemin monte roulé (rise, sur cette boîte) et commence à se
           dérouler en pleine montée, bien avant d'être posé : d'où le délai
           des deux couches qui suivent.
           Le parchemin et son rouleau gauche, dévoilés de gauche à droite… -->
      <div
        class="question-log-scroll pointer-events-none absolute inset-0 [--enter-delay:0.15s]"
        :class="[closing ? 'motion-safe:animate-roll-up' : 'motion-safe:animate-unroll', shade]"
      />
      <!-- …pendant que le rouleau droit, seul, glisse depuis le gauche. Ses
           rebonds le font osciller autour de sa poignée du haut. -->
      <div
        class="question-log-scroll pointer-events-none absolute inset-0 origin-[calc(100%-var(--k)*var(--rod-r))_calc(var(--k)*var(--cap-y))] [--enter-delay:0.15s] [clip-path:inset(0_0_0_calc(100%-var(--k)*(var(--rod-r)+var(--rod-w)/2)))]"
        :class="[closing ? 'motion-safe:animate-roll-up-rod' : 'motion-safe:animate-unroll-rod', shade]"
      />

      <!-- Le papier attrape ses clics : seuls les vides autour des rouleaux
           ferment. Il couvre d'un rouleau à l'autre, du haut du papier au bas
           de la boîte. -->
      <div class="absolute inset-x-0 top-[calc(var(--k)*var(--paper-y))] bottom-0" />

      <!-- Le titre, posé au-dessus du papier entre les deux poignées, dans
           l'éclat des noms du camp. Il jaillit pendant le déroulé, quand le
           bord du papier passe sous lui, au milieu, avec le même rebond que le
           verdict juste (animate-cheer). -->
      <CampOverlayTitle :closing="closing" delay="0.3s" class="top-[calc(var(--k)*var(--paper-y))]" :class="shade">
        Volumen
      </CampOverlayTitle>

      <!-- Le papier : de quoi lire, déroulé et ré-enroulé avec lui. -->
      <div
        class="absolute inset-x-[calc(var(--k)*var(--text-x))] top-[calc(var(--k)*var(--cut-t))] bottom-[calc(var(--k)*var(--cut-b)+1.5rem)] flex flex-col p-4 sm:p-8"
        :class="closing ? 'motion-safe:animate-roll-up-text' : 'motion-safe:animate-unroll-text [--enter-delay:0.15s]'"
      >
        <!-- Chaque onglet garde sa page et sa question choisie quand on passe
             à un autre et qu'on revient. Les onglets se posent au-dessus de la
             liste, pas de la question relue. -->
        <KeepAlive>
          <QuestionLogList :key="tab" :tab="tab" :lesson="lesson" class="flex-1" @next="$emit('next')">
            <template #tabs>
              <BaseTabs v-model="tab" :tabs="tabs" parchment />
            </template>
          </QuestionLogList>
        </KeepAlive>
      </div>
    </div>
  </CampOverlay>
</template>

<script setup lang="ts">
// Le journal des questions vues, au camp et là seulement : le rattrapage tire
// dans le Pool Échecs, en lire les réponses pendant qu'il tourne serait tricher.
// Voir specs/ecrans.md#volumen.
import type { QuestionLogTab } from '~~/shared/utils/questionLog'
import type { GameState } from '~~/server/utils/game'
import type { LessonLine } from '~~/utils/lessons'

const props = defineProps<{
  /** La réplique de Michel quand il parle depuis le Volumen, à la leçon de la chute, de la Plume, de la Boule ou du Filet. */
  lesson?: LessonLine
}>()

defineEmits<{
  close: []
  /** Michel passe à sa réplique suivante. */
  next: []
}>()

// L'onglet Sangsues est celui du Filet à sangsues : le camp sait déjà si le
// joueur le porte (l'état de jeu, tenu en cache).
const { data: gameState } = useNuxtData<GameState>(GAME_STATE_KEY)
const tabs = computed((): { id: QuestionLogTab, label: string }[] => [
  { id: 'missed', label: 'À revoir' },
  ...gameState.value?.hasLeechNet ? [{ id: 'leeches' as const, label: 'Sangsues' }] : [],
  { id: 'correct', label: 'Connues' },
  { id: 'all', label: 'Toutes' },
])

// Michel choisit l'onglet dont il parle : « À revoir » peut être vide.
const tab = ref<QuestionLogTab>(props.lesson?.openingTab ?? 'missed')

// Michel montre la Boule de cristal : le parchemin passe dans l'ombre, elle non.
const shade = computed(() => (props.lesson?.spotlight === 'wikipedia' ? LESSON_SHADE : ''))
</script>
