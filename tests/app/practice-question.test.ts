import { effectScope, nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installAppGlobals } from '../helpers/app'
import { practiceLesson, practiceVerdictLesson } from '../../utils/lessons'
import type { Verdict } from '../../server/utils/game'

const { answerWith, breakNetwork, calls, reset } = installAppGlobals()

// Les auto-imports dont le composable se sert, que Vitest ne pose pas.
Object.assign(globalThis, { practiceLesson, practiceVerdictLesson })

const { usePracticeQuestion } = await import('../../composables/usePracticeQuestion')

type Practice = ReturnType<typeof usePracticeQuestion>

const NOW = new Date('2026-09-03T12:00:00.000Z').getTime()
const TIMER_MS = 60_000
const QUESTION = { id: 'practice', statement: 'De quelle couleur était le cheval blanc d\'Henri IV ?', lootQuestion: false, timerMs: TIMER_MS }

function verdict(correct: boolean): Verdict {
  return { questionId: 'practice', statement: QUESTION.statement, correct, answerLabel: 'Blanc', submittedAnswer: 'x', lifeLost: false }
}

let scope = effectScope()
const now = ref(NOW)
/** La vraie question tirée : vrai quand elle l'est. */
const advance = vi.fn(async (): Promise<boolean> => true)

/** L'essai lancé, Michel sur sa première réplique. */
async function started(): Promise<Practice> {
  const practice = scope.run(() => usePracticeQuestion({ now, advance })) as Practice
  answerWith(QUESTION)
  await practice.start()
  return practice
}

/** Michel s'est tu : le joueur répond. */
async function answering(): Promise<Practice> {
  const practice = await started()
  while (practice.line.value) {
    practice.next()
  }
  await nextTick()
  return practice
}

// Voir specs/ecrans.md#leçons-de-michel (Camp, 5 et 6).
describe('la question d essai, côté écran', () => {
  beforeEach(async () => {
    scope.stop()
    await nextTick()
    scope = effectScope()
    reset()
    now.value = NOW
    advance.mockReset()
    advance.mockImplementation(async () => true)
  })

  it('lit sa question au serveur, et Michel commence à parler', async () => {
    const practice = await started()

    expect(calls()).toEqual(['fetch GET /api/game/practice'])
    expect(practice.question.value).toEqual(QUESTION)
    expect(practice.line.value).toEqual(practiceLesson()[0])
  })

  it('garde le chrono figé tant que Michel parle', async () => {
    const practice = await started()
    now.value = NOW + 30_000
    await nextTick()

    expect(practice.secondsLeft.value).toBe(60)
  })

  it('lance le chrono quand Michel se tait', async () => {
    const practice = await answering()
    now.value += 15_000
    await nextTick()

    expect(practice.secondsLeft.value).toBe(45)
  })

  it('envoie la réponse au serveur et montre son verdict, avec les répliques qui vont avec', async () => {
    const practice = await answering()
    practice.typed.value = 'Noir'
    answerWith(verdict(false))
    await practice.submit()

    expect(calls().at(-1)).toBe('fetch POST /api/game/practice')
    expect(practice.verdict.value).toEqual(verdict(false))
    expect(practice.line.value).toEqual(practiceVerdictLesson({ correct: false })[0])
  })

  it('envoie ce qui est saisi quand le chrono tombe à zéro, une seule fois', async () => {
    const practice = await answering()
    answerWith(verdict(false))
    now.value += TIMER_MS
    await nextTick()
    now.value += 1_000
    await nextTick()
    await vi.waitFor(() => expect(practice.verdict.value).not.toBeNull())

    expect(calls().filter(call => call === 'fetch POST /api/game/practice')).toHaveLength(1)
  })

  it('ne laisse pas répondre pendant que Michel parle', async () => {
    const practice = await started()
    await practice.submit()

    expect(calls()).not.toContain('fetch POST /api/game/practice')
  })

  it('tire la première vraie question à « Suivant », une fois Michel tu', async () => {
    const practice = await answering()
    answerWith(verdict(true))
    await practice.submit()

    await practice.leave()
    expect(advance).not.toHaveBeenCalled()

    while (practice.line.value) {
      practice.next()
    }
    await practice.leave()

    expect(advance).toHaveBeenCalledOnce()
    expect(practice.question.value).toBeNull()
    expect(practice.verdict.value).toBeNull()
  })

  it('ne lit la question qu une fois, même au double clic sur l au revoir', async () => {
    const practice = scope.run(() => usePracticeQuestion({ now, advance })) as Practice
    answerWith(QUESTION)
    await Promise.all([practice.start(), practice.start()])

    expect(calls()).toEqual(['fetch GET /api/game/practice'])
  })

  /** Michel tu sur le verdict : « Suivant » se clique. */
  async function onVerdict(): Promise<Practice> {
    const practice = await answering()
    answerWith(verdict(true))
    await practice.submit()
    while (practice.line.value) {
      practice.next()
    }
    return practice
  }

  it('garde le verdict à l écran tant que la vraie question n est pas tirée, et ne la tire qu une fois', async () => {
    const practice = await onVerdict()
    let land = (): void => {}
    advance.mockImplementation(() => new Promise((resolve) => {
      land = () => resolve(true)
    }))

    const first = practice.leave()
    await practice.leave()
    expect(practice.verdict.value).not.toBeNull()

    land()
    await first
    expect(advance).toHaveBeenCalledOnce()
    expect(practice.verdict.value).toBeNull()
  })

  it('reste sur le verdict quand la vraie question ne se tire pas', async () => {
    const practice = await onVerdict()
    advance.mockImplementation(async () => false)
    await practice.leave()

    expect(practice.verdict.value).not.toBeNull()
  })

  it('dit qu une réponse refusée n est pas partie, et la laisse saisie', async () => {
    const practice = await answering()
    practice.typed.value = 'Blanc'
    breakNetwork()
    await practice.submit()

    expect(practice.failed.value).toBe(true)
    expect(practice.verdict.value).toBeNull()
    expect(practice.typed.value).toBe('Blanc')
  })

  it('passe droit à la vraie question si la question d essai ne se lit pas', async () => {
    breakNetwork()
    const practice = scope.run(() => usePracticeQuestion({ now, advance })) as Practice
    await practice.start()

    expect(advance).toHaveBeenCalledOnce()
    expect(practice.question.value).toBeNull()
  })
})
