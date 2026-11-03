<template>
  <!-- Relu au Volumen, le titre passe en tête de fiche (QuestionLogDetail). -->
  <VerdictHeadline
    v-if="!review"
    :cheer="verdict.correct"
    :class="[verdict.correct ? 'text-emerald-700' : 'text-rose-700', shade]"
  >
    {{ verdict.correct ? 'Correct !' : 'Incorrect...' }}
  </VerdictHeadline>

  <PlayText
    role="recall"
    :as="copyable ? 'button' : 'p'"
    :long="isLong('recall', verdict.statement)"
    :class="[shade, copyable && COPYABLE]"
    :title="copyable ? 'Cliquer pour copier' : undefined"
    class="text-amber-800"
    @click="copyable && copy('statement', verdict.statement)"
  >
    {{ withNonBreakingSpaces(verdict.statement) }}
  </PlayText>

  <PlayText
    role="answer"
    :as="copyable ? 'button' : 'p'"
    :long="isLong('answer', verdict.answerLabel)"
    :class="[shade, copyable && COPYABLE]"
    :title="copyable ? 'Cliquer pour copier' : undefined"
    class="text-amber-800"
    @click="copyable && copy('answer', verdict.answerLabel)"
  >
    {{ verdict.answerLabel }}
  </PlayText>

  <!-- Au Volumen, sous la réponse : ce qui vient d'être copié. La ligne tient
       sa hauteur vide, pour que la fiche ne bouge pas à la copie. -->
  <PlayText v-if="copyable" role="receipt" class="min-h-[1lh] text-[#EE4B76]" aria-live="polite">
    <Transition
      enter-active-class="motion-safe:animate-copied-pop"
      leave-active-class="motion-safe:animate-fade-out [--enter-delay:0s]"
    >
      <span v-if="copied" class="inline-block">
        {{ copied === 'statement' ? 'Question' : 'Réponse' }} copiée&nbsp;!
      </span>
    </Transition>
  </PlayText>

  <!-- Au Volumen, la fiche montre la bonne réponse, pas la saisie. -->
  <PlayText
    v-if="!review"
    role="aside"
    :class="shade"
    class="text-amber-800/80"
  >
    Ta réponse : {{ verdict.submittedAnswer || '(rien)' }}
  </PlayText>

  <!-- La réponse est partie avec la page : dit comme l'avertissement d'une
       réponse vide (EmptyAnswerNotice), à la même place sous la saisie
       (focusLossNotice). -->
  <PlayText
    v-if="!review && focusNotice"
    role="notice"
    :class="shade"
    class="text-amber-700"
  >
    {{ focusNotice }}
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
import { focusLossNotice } from '~~/utils/phase'

const props = defineProps<{
  verdict: Verdict
  disputable: boolean
  disputing: boolean
  /** La vie perdue était la dernière : la tentative s'arrête sur ce verdict. */
  lastLife?: boolean
  /**
   * Relu au Volumen plutôt que rendu en jeu : ni titre (la fiche le porte en
   * tête), ni saisie, ni contestation après coup. Voir specs/ecrans.md#volumen.
   */
  review?: boolean
  /**
   * L'énoncé et la réponse se copient d'un clic : au Volumen, pour qui porte la
   * Plume de copiste. Voir specs/ecrans.md#volumen.
   */
  copyable?: boolean
  /**
   * Michel montre « Contester », à la question d'essai : tout le verdict
   * s'assombrit, sauf lui. Voir specs/ecrans.md#leçons-de-michel.
   */
  disputeLit?: boolean
}>()

const focusNotice = computed(() => focusLossNotice(props.verdict))

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

const emit = defineEmits<{
  dispute: []
  /** Au Volumen, l'énoncé ou la réponse vient d'être copié. */
  copied: [which: 'statement' | 'answer']
}>()

// Au Volumen, l'énoncé et la réponse se copient d'un clic ; l'écran qui porte
// la fiche le dit sous la réponse, et l'écran qui la porte grave le succès
// (QuestionLogList).
const COPYABLE = 'cursor-pointer transition-colors hover:text-amber-950'

const copied = ref<'statement' | 'answer' | null>(null)
let copiedTimer: ReturnType<typeof setTimeout> | undefined

async function copy(which: 'statement' | 'answer', text: string): Promise<void> {
  // Un navigateur peut refuser le presse-papiers : rien ne s'affiche alors, la
  // copie n'a pas eu lieu.
  try {
    await navigator.clipboard.writeText(text)
  }
  catch {
    return
  }

  copied.value = which
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => (copied.value = null), 1800)
  emit('copied', which)
}

onBeforeUnmount(() => clearTimeout(copiedTimer))
</script>
