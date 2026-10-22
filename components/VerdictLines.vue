<template>
  <!-- Le juste jaillit, juste après le tampon du médaillon, et lâche une
       gerbe d'étincelles à son plus gros. Le faux, lui, secoue la tête. Relu
       au Volumen, rien ne bouge : la question est jugée depuis longtemps. -->
  <PlayText
    role="headline"
    :class="[
      verdict.correct ? 'relative text-emerald-700' : 'text-rose-700',
      review ? '' : verdict.correct ? 'motion-safe:animate-cheer [--enter-delay:0.1s]' : 'motion-safe:animate-shake [--enter-delay:0.1s]',
      shade,
    ]"
  >
    {{ headline }}
    <SparkleSpray
      v-if="verdict.correct && !review"
      :sparks="CHEER_SPRAY"
      class="drop-shadow-[0_0_4px_#6ee7b7]"
    />
  </PlayText>

  <PlayText
    role="recall"
    :long="isLong('recall', verdict.statement)"
    :class="shade"
    class="text-amber-800"
  >
    {{ withNonBreakingSpaces(verdict.statement) }}
  </PlayText>

  <PlayText
    role="answer"
    :long="isLong('answer', verdict.answerLabel)"
    :class="shade"
    class="text-amber-800"
  >
    {{ verdict.answerLabel }}
  </PlayText>

  <!-- Au Volumen, une question connue n'a rien à corriger : sa saisie se tait. -->
  <PlayText
    v-if="!(review && verdict.correct)"
    role="aside"
    :class="shade"
    class="text-amber-800/80"
  >
    Ta réponse : {{ verdict.submittedAnswer || '(rien)' }}
  </PlayText>

  <!-- La vie perdue, le cas échéant : les rubans montrent le compte d'après,
       pas le fait qu'on vienne d'en perdre une. Voir specs/ecrans.md#ascent--verdict.
       Toujours faux en rattrapage, qui ne coûte aucune vie — la ligne s'efface
       donc d'elle-même de ce côté. Voir server/utils/game.ts. -->
  <PlayText
    v-if="verdict.lifeLost"
    role="notice"
    :class="shade"
    class="text-rose-700"
  >
    {{ lastLife ? "C'était ta dernière vie ! Cette tentative s'arrête là !" : 'Tu perds une vie !' }}
  </PlayText>

  <!-- Voir specs/validation.md : la contestation se propose là où le désaccord
       naît, en ascension comme en rattrapage. Sur un faux en jeu, sa ligne est
       tenue dès l'arrivée du verdict, invisible tant que la liste des
       contestables relue après la réponse ne l'a pas confirmé (pages/index.vue) :
       sinon elle pousse toute la carte une seconde plus tard. Une fois la
       contestation partie, la même ligne en accuse réception, et jaillit
       comme le « Correct ! » : le geste a porté. -->
  <PlayText
    v-if="sent"
    role="receipt"
    :class="shade"
    class="text-emerald-700 motion-safe:animate-cheer"
  >
    Contestation envoyée&nbsp;!
  </PlayText>
  <PlayText
    v-else-if="canDispute || disputeHeld"
    role="link"
    as="button"
    type="button"
    :disabled="disputing"
    :class="{ invisible: !canDispute }"
    class="cursor-pointer text-amber-700 transition hover:text-amber-900 disabled:cursor-not-allowed disabled:opacity-60"
    @click="$emit('dispute')"
  >
    Contester cette question
  </PlayText>
</template>

<script setup lang="ts">
// Ce que dit un verdict : juste ou faux, l'énoncé rappelé, la bonne réponse, ce
// que le joueur avait tapé, la vie perdue, et le geste de contestation. Voir
// specs/ecrans.md#ascent--verdict.
//
// Écrit une fois : l'ascension et le rattrapage rendent exactement les mêmes
// lignes, et CLAUDE.md demande le composant partagé avant la deuxième copie. Ce
// qui suit ces lignes diffère d'un écran à l'autre — coffre gagné d'un côté,
// sort du rattrapage de l'autre — et reste donc chez l'appelant.
import type { Verdict } from '~~/server/utils/game'

const props = defineProps<{
  verdict: Verdict
  disputable: boolean
  disputing: boolean
  /** La vie perdue était la dernière : la tentative s'arrête sur ce verdict. */
  lastLife?: boolean
  /**
   * Relu au Volumen plutôt que rendu en jeu : « Connue » ou « À revoir », sans
   * animation, et la saisie d'une question connue tue. Voir specs/ecrans.md#volumen.
   */
  review?: boolean
  /**
   * Michel montre « Contester », à la question d'essai : tout le verdict
   * s'assombrit, sauf lui. Voir specs/ecrans.md#leçons-de-michel.
   */
  disputeLit?: boolean
}>()

const shade = computed(() => (props.disputeLit ? LESSON_SHADE : ''))

// Une réponse jugée juste ne se conteste pas, même quand la question reste
// contestable ailleurs : au rattrapage, l'erreur d'origine est encore au pool.
// Voir specs/validation.md#quand.
const canDispute = computed(() => props.disputable && !props.verdict.correct)

// Au Volumen, la fiche dit elle-même où en est la contestation.
const { isSent } = useDisputes()
const sent = computed(() => !props.review && isSent(props.verdict.questionId))

// Seul un faux avec une saisie peut devenir contestable : un vide ne l'est
// jamais (server/utils/disputes.ts). Au Volumen, rien n'arrive après coup.
const disputeHeld = computed(() =>
  !props.review && !props.verdict.correct && props.verdict.submittedAnswer !== '',
)

const headline = computed(() => {
  if (props.review) {
    return props.verdict.correct ? 'Connue' : 'À revoir'
  }
  return props.verdict.correct ? 'Correct !' : 'Incorrect...'
})

defineEmits<{ dispute: [] }>()

/**
 * La gerbe du « Correct ! » : huit étincelles sur une ellipse plus large que
 * haute, comme le mot. Lancées quand il atteint son plus gros (30 % de
 * `animate-cheer`, plus son délai), une sur deux plus loin et plus grosse pour
 * casser la régularité — même recette que la gerbe du coffre (ChestCard).
 * Distances en cqw du panneau, qui est un @container (voir PlayFrame).
 */
const CHEER_SPRAY = Array.from({ length: 8 }, (_, index) => {
  const angle = ((index * 45 + 20) * Math.PI) / 180
  const reach = index % 2 ? 0.8 : 1

  return {
    dx: `${Math.round(Math.cos(angle) * 34 * reach)}cqw`,
    dy: `${Math.round(Math.sin(angle) * 9 * reach)}cqw`,
    size: index % 2 ? '2.4cqw' : '3.6cqw',
    delay: `${(0.28 + (index % 3) * 0.04).toFixed(2)}s`,
  }
})
</script>
