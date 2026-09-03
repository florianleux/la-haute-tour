import { effectScope, nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'
import { installAppGlobals, testUser } from '../helpers/app'
import type { GameState } from '../../server/utils/game'

const { payloads, calls, refresh, reset, signIn, breakFetch, respondWith } = installAppGlobals()

const { GAME_STATE_KEY } = await import('../../composables/useGameState')
const { useQuestionRun } = await import('../../composables/useQuestionRun')

type QuestionRun = Awaited<ReturnType<typeof useQuestionRun>>
type QuestionRunOptions = Parameters<typeof useQuestionRun>[0]

const NOW = new Date('2026-09-03T12:00:00.000Z').getTime()

/**
 * Dans une page, le composant possède la portée du composable et la libère en se
 * démontant. Ici c'est le test : sans ça, les watchers d'un test précédent
 * continuent de réagir à l'état partagé.
 */
let scope = effectScope()

function run(options: QuestionRunOptions): Promise<QuestionRun> {
  return scope.run(() => useQuestionRun(options)) as Promise<QuestionRun>
}

function gameState(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: 'ascent',
    floor: 1,
    lives: 3,
    started: true,
    question: null,
    verdict: null,
    cooldownUntil: null,
    recovery: null,
    ...overrides,
  }
}

function servedAt(msFromNow: number): GameState {
  return gameState({
    question: {
      id: 'q1',
      statement: 'Capitale de la Gironde ?',
      expiresAt: new Date(NOW + msFromNow).toISOString(),
    },
  })
}

describe('déroulé d une question', () => {
  beforeEach(async () => {
    // Arrêter la portée avant de vider la file : sinon un watcher du test
    // précédent s'exécute encore, sur l'état du test qui commence.
    scope.stop()
    await nextTick()
    scope = effectScope()
    reset()
    signIn(testUser)
  })

  it('décompte les secondes qui restent sur l échéance du serveur', async () => {
    payloads.set(GAME_STATE_KEY, servedAt(20_000))
    const now = ref(NOW)

    const { secondsLeft } = await run({ now })

    expect(secondsLeft.value).toBe(20)
    now.value = NOW + 12_500
    expect(secondsLeft.value).toBe(8)
  })

  it('ne décompte rien hors question', async () => {
    payloads.set(GAME_STATE_KEY, gameState({ verdict: { correct: true, answerLabel: 'BORDEAUX', submittedAnswer: 'bordeaux', lifeLost: false } }))

    const { secondsLeft } = await run({ now: ref(NOW) })

    expect(secondsLeft.value).toBeNull()
  })

  it('envoie ce qui est saisi quand le chrono tombe à zéro', async () => {
    payloads.set(GAME_STATE_KEY, servedAt(20_000))
    const now = ref(NOW)
    const { typed } = await run({ now })
    typed.value = 'bordeaux'

    now.value = NOW + 20_000
    await nextTick()

    expect(calls).toEqual(['fetch POST /api/game/answer'])
  })

  it('envoie dès l arrivée sur une question déjà expirée', async () => {
    payloads.set(GAME_STATE_KEY, servedAt(-5_000))

    console.log('AVANT run, calls =', JSON.stringify(calls))
    await run({ now: ref(NOW) })
    console.log('APRES run, calls =', JSON.stringify(calls))
    await nextTick()
    console.log('APRES tick, calls =', JSON.stringify(calls))

    expect(calls).toEqual(['fetch POST /api/game/answer'])
  })

  it('vide le champ une fois la réponse partie', async () => {
    payloads.set(GAME_STATE_KEY, servedAt(20_000))
    respondWith(gameState())
    const { typed, submit } = await run({ now: ref(NOW) })
    typed.value = 'bordeaux'

    await submit()

    expect(typed.value).toBe('')
  })

  it('garde la saisie quand l envoi est refusé', async () => {
    payloads.set(GAME_STATE_KEY, servedAt(20_000))
    breakFetch()
    const { typed, submit, actionFailed } = await run({ now: ref(NOW) })
    typed.value = 'bordeaux'

    await submit()

    expect(actionFailed.value).toBe(true)
    expect(typed.value).toBe('bordeaux')
  })

  it('relit l état quand l attente s achève sous les yeux du joueur', async () => {
    payloads.set(GAME_STATE_KEY, gameState({
      phase: 'cooldown',
      lives: 0,
      cooldownUntil: new Date(NOW + 60_000).toISOString(),
    }))
    const now = ref(NOW)
    await run({ now })
    refresh.mockClear()

    now.value = NOW + 60_000
    await nextTick()

    expect(refresh).toHaveBeenCalledOnce()
  })

  it('rend ses effets à la portée qui l a appelé', async () => {
    payloads.set(GAME_STATE_KEY, servedAt(20_000))
    const now = ref(NOW)
    await run({ now })

    scope.stop()
    now.value = NOW + 20_000
    await nextTick()

    // Le chrono est tombé à zéro, mais plus personne n'écoute.
    expect(calls).toEqual([])
  })

  it('rend le temps d attente tel qu on le lit', async () => {
    payloads.set(GAME_STATE_KEY, gameState({
      phase: 'cooldown',
      lives: 0,
      cooldownUntil: new Date(NOW + 90 * 60_000).toISOString(),
    }))

    const { waitRemaining } = await run({ now: ref(NOW) })

    expect(waitRemaining.value).toBe('1 h 30 min')
  })
})
