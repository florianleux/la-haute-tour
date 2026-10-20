import type { Ref } from 'vue'
import type { Verdict } from '~~/server/utils/game'
import type { PracticeQuestion } from '~~/server/utils/practice'
import type { LessonLine } from '~~/utils/lessons'

export interface Practice {
  /** La question d'essai en cours, null hors essai. */
  question: Ref<PracticeQuestion | null>
  /** Son verdict, rendu par le serveur ; null tant que le joueur n'a pas répondu. */
  verdict: Ref<Verdict | null>
  /** La réplique de Michel en cours, null quand il s'est tu. */
  line: Ref<LessonLine | null>
  /** Ce que le joueur a tapé. */
  typed: Ref<string>
  /** Secondes restantes, pleines tant que Michel parle ; null hors essai. */
  secondsLeft: Ref<number | null>
  /** La réponse est en vol. */
  submitting: Ref<boolean>
  /** La dernière réponse envoyée a été refusée : elle reste saisie, à renvoyer. */
  failed: Ref<boolean>
  /** Lit la question au serveur, et Michel commence. */
  start: () => Promise<void>
  /** Passe à la réplique suivante de Michel. */
  next: () => void
  /** Envoie la réponse, une fois, et seulement quand Michel s'est tu pour la laisser. */
  submit: () => Promise<void>
  /** « Suivant » : la première vraie question est tirée, et l'essai s'arrête. */
  leave: () => Promise<void>
}

export interface PracticeOptions {
  /** L'horloge du chrono, en millisecondes : celle des vraies questions (useQuestionRun). */
  now: Ref<number>
  /** Tire la vraie question suivante ; vrai quand elle l'est. */
  advance: () => Promise<boolean>
}

/**
 * La question d'essai de la leçon du camp : le même écran qu'une vraie, jugé
 * par le serveur, mais rien de la partie n'en dépend — elle vit ici, pas dans
 * l'état de jeu. Le chrono reste figé tant que Michel parle ; à zéro, la
 * réponse saisie part, comme une vraie. Voir specs/ecrans.md#leçons-de-michel.
 */
export function usePracticeQuestion(options: PracticeOptions): Practice {
  const { now, advance } = options
  const question = ref<PracticeQuestion | null>(null)
  const verdict = ref<Verdict | null>(null)
  const lines = ref<LessonLine[]>([])
  const index = ref(0)
  const typed = ref('')
  const submitting = ref(false)
  const failed = ref(false)
  /** Quand Michel s'est tu : le chrono court depuis là. */
  const runningSince = ref<number | null>(null)
  /** La lecture de la question, ou le tirage de la vraie, est en vol : un second clic n'y ajoute rien. */
  let busy = false

  const line = computed(() => lines.value[index.value] ?? null)

  function say(said: LessonLine[]): void {
    lines.value = said
    index.value = 0
  }

  const secondsLeft = computed<number | null>(() => {
    if (!question.value) {
      return null
    }
    const elapsed = runningSince.value === null ? 0 : now.value - runningSince.value
    return Math.max(0, Math.ceil((question.value.timerMs - elapsed) / 1000))
  })

  async function start(): Promise<void> {
    if (busy || question.value) {
      return
    }
    busy = true
    try {
      question.value = await $fetch<PracticeQuestion>('/api/game/practice')
      say(practiceLesson())
    }
    catch {
      // L'essai ne se lit pas : il ne compte pas, la partie continue sans lui.
      await advance()
    }
    finally {
      busy = false
    }
  }

  function next(): void {
    index.value += 1
  }

  // Michel s'est tu sur la question : le chrono part.
  watch(line, (said) => {
    if (!said && question.value && !verdict.value) {
      runningSince.value = now.value
    }
  })

  async function submit(): Promise<void> {
    if (!question.value || line.value || verdict.value || submitting.value) {
      return
    }
    submitting.value = true
    failed.value = false
    try {
      verdict.value = await $fetch<Verdict>('/api/game/practice', { method: 'POST', body: { answer: typed.value } })
      say(practiceVerdictLesson({ correct: verdict.value.correct }))
    }
    catch {
      // Refusée — réseau ou session : la réponse reste saisie, la page le dit.
      failed.value = true
    }
    finally {
      submitting.value = false
    }
  }

  watch(secondsLeft, (left) => {
    if (left === 0) {
      void submit()
    }
  })

  async function leave(): Promise<void> {
    if (!verdict.value || line.value || busy) {
      return
    }
    busy = true
    // Le verdict reste à l'écran le temps que la vraie question arrive : sans
    // ça, le camp s'afficherait entre les deux. Refusée, il y reste.
    const drawn = await advance()
    busy = false
    if (drawn) {
      question.value = null
      verdict.value = null
      typed.value = ''
      runningSince.value = null
    }
  }

  return { question, verdict, line, typed, secondsLeft, submitting, failed, start, next, submit, leave }
}
