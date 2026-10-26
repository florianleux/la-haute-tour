<template>
  <div class="contents">
    <!-- Nuit bleue par-dessus le ciel de PlayFrame : le combat n'a pas de décor. -->
    <div class="fixed inset-0 z-1 bg-[#070d24]" />

    <!-- Le boss, à gauche, posé au bas de l'écran et un peu coupé par le bord. Il encaisse chaque bonne
         réponse. -->
    <img
      :src="BOSS_IMAGE"
      alt=""
      class="pointer-events-none fixed -left-[5vw] bottom-0 z-5 h-[62dvh] w-auto"
      :class="hurt === 'boss' && 'motion-safe:animate-hit'"
    >

    <!-- Le joueur, à droite, plus petit que le boss et retourné pour lui faire
         face. Il encaisse chaque faute, et rougit le temps du coup. -->
    <div
      class="pointer-events-none fixed bottom-0 right-[4vw] z-5 h-[38dvh]"
      :class="hurt === 'player' && 'motion-safe:animate-hit'"
    >
      <img
        :src="portrait"
        alt=""
        class="h-full w-auto -scale-x-100 transition-[filter] duration-300"
        :class="hurt === 'player' && 'drop-shadow-[0_0_1.5rem_rgb(220_38_38)]'"
      >
    </div>

    <!-- La vie du joueur, en trois cases, à la hauteur de celle du boss. -->
    <HealthBar
      :name="user?.displayName ?? ''"
      :value="lives"
      :max="rules.lives"
      segmented
      class="fixed bottom-[5dvh] right-[4vw] z-20 w-[20vw] text-right text-2xl"
    />

    <!-- La vie du boss : une longue barre qui part de dessus le boss et
         s'arrête avant le joueur. Un septième part à chaque bonne réponse. -->
    <HealthBar
      name="Julien le perse"
      :value="bossHp"
      :max="FULL_BOSS_HP"
      class="fixed bottom-[5dvh] left-[3vw] right-[31vw] z-20 text-[2rem]"
    />

    <!-- Au milieu, le cadre de l'ascension sans ses rubans : le drapeau, le
         champ, puis le verdict. Le drapeau prend toute la hauteur que le champ
         lui laisse : c'est lui qu'il faut lire. -->
    <PlayFrame skin="ascent">
      <template #medallion>
        <PlayText
          v-if="verdict === null"
          role="timer"
          as="span"
          class="text-amber-600"
        >
          {{ secondsLeft }}
        </PlayText>
        <VerdictMark
          v-else
          :correct="verdict"
        />
      </template>

      <template v-if="verdict === null">
        <img
          :src="`/images/boss/1/flags/${flag.slug}.webp`"
          alt="Le drapeau à reconnaître"
          class="mb-[3cqw] min-h-0 w-full flex-1 object-contain drop-shadow-md"
        >
        <BaseParchmentInput
          :key="flag.slug"
          v-model="typed"
          @submit="answer"
        />
      </template>

      <template v-else>
        <PlayText
          role="headline"
          :class="headline.ink"
        >
          {{ headline.text }}
        </PlayText>
        <PlayText
          role="answer"
          class="text-amber-800"
        >
          {{ flag.answerLabel }}
        </PlayText>
      </template>

      <template #action>
        <BaseCardButton
          :label="verdict === null ? 'Valider' : over ? 'Rejouer' : 'Suivant'"
          anchor="card-bottom"
          @click="verdict === null ? answer() : next()"
        />
      </template>
    </PlayFrame>
  </div>
</template>

<script setup lang="ts">
// Banc du combat contre le boss de l'étage 1 : le boss à gauche, le joueur à
// droite, les drapeaux au milieu. Tout se joue dans la page, sans partie
// réelle — le combat n'existe pas encore côté serveur (#34 à #44). Les
// drapeaux sont ceux du premier combat, mélangés, lus à l'API admin et jamais
// importés : un import partirait dans le JS public, réponses comprises.
// Admin seulement. Voir specs/boss.md et specs/boss-etage1-drapeaux.md.
import type { BossFlag, BossFlagsResponse } from '~~/server/api/admin/boss-flags.get'
// Le juge du jeu, partagé : même tolérance qu'une question d'ascension.
import { isAnswerAccepted } from '~~/shared/utils/answers'
// Le jeu de règles, seul à connaître les vies. Un module pur, sans base ni
// requête : le banc le lit tel quel, faute de partie servie.
import { rulesForFloor } from '~~/server/utils/rules'

definePageMeta({ admin: true })

const rules = rulesForFloor(1)
// ponytail: les PV du boss et le chrono d'une épreuve ne sont pas encore dans
// le jeu de règles — le chrono est propre à chaque boss (specs/boss.md). Ils y
// entrent avec le vrai combat (#34 à #44) ; ce banc les lira alors comme les vies.
const FULL_BOSS_HP = 7
/**
 * Julien le perse. Le banc est propre à l'étage 1 : l'illustration se nomme
 * ici, comme les drapeaux, sans passer par le catalogue des introductions.
 */
const BOSS_IMAGE = '/images/boss/1/boss-julien.webp'
const SECONDS = 30
/** Le temps d'un coup encaissé : la secousse (`animate-hit`) et le halo. */
const HURT_MS = 900

const { data: fight } = await useAsyncData(
  'boss-bench-flags',
  () => $fetch<BossFlagsResponse>('/api/admin/boss-flags', useApiFetchOptions()),
)

function shuffled(): BossFlag[] {
  return (fight.value?.flags ?? [])
    .map(entry => ({ entry, key: Math.random() }))
    .sort((a, b) => a.key - b.key)
    .map(({ entry }) => entry)
}

const { user } = await useCurrentUser()
const portrait = computed(() => playerPortrait(user.value?.gender ?? null))

// `useState` : tiré une fois au rendu serveur et repris tel quel au client —
// deux tirages donneraient deux écrans à l'hydratation.
const order = useState('boss-bench-order', shuffled)
const index = ref(0)
const bossHp = ref(FULL_BOSS_HP)
const lives = ref(rules.lives)
const typed = ref('')
/** Null tant que le drapeau attend sa réponse, puis juste ou faux. */
const verdict = ref<boolean | null>(null)
const secondsLeft = ref(SECONDS)
const hurt = ref<'boss' | 'player' | null>(null)

const flag = computed(() => order.value[index.value])
const over = computed(() => bossHp.value === 0 || lives.value === 0)

const headline = computed(() => {
  if (bossHp.value === 0) {
    return { text: 'Victoire !', ink: 'text-emerald-700' }
  }
  if (lives.value === 0) {
    return { text: 'Défaite...', ink: 'text-rose-700' }
  }
  return verdict.value
    ? { text: 'Correct !', ink: 'text-emerald-700' }
    : { text: 'Incorrect...', ink: 'text-rose-700' }
})

function answer(): void {
  if (verdict.value !== null) {
    return
  }

  verdict.value = isAnswerAccepted(typed.value, [flag.value.answer, ...flag.value.variants])
  if (verdict.value) {
    bossHp.value--
  }
  else {
    lives.value--
  }

  hurt.value = verdict.value ? 'boss' : 'player'
  setTimeout(() => {
    hurt.value = null
  }, HURT_MS)
}

function next(): void {
  if (over.value) {
    order.value = shuffled()
    index.value = 0
    bossHp.value = FULL_BOSS_HP
    lives.value = rules.lives
  }
  else {
    index.value++
  }

  typed.value = ''
  verdict.value = null
  secondsLeft.value = SECONDS
}

// Le chrono ne court que pendant la question, et répond à la place du joueur
// quand il tombe à zéro : un champ vide est une faute.
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  timer = setInterval(() => {
    if (verdict.value !== null) {
      return
    }
    secondsLeft.value--
    if (secondsLeft.value === 0) {
      answer()
    }
  }, 1000)
})
onBeforeUnmount(() => {
  if (timer) {
    clearInterval(timer)
  }
})
</script>
