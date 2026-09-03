import { beforeEach, describe, expect, it } from 'vitest'
import { installAppGlobals, testUser } from '../helpers/app'
import type { GameState } from '../../server/utils/game'

const { payloads, calls, reset, signIn, breakFetch, respondWith } = installAppGlobals()

const { GAME_STATE_KEY } = await import('../../composables/useGameState')
const { usePlay } = await import('../../composables/usePlay')

const served: GameState = {
  phase: 'ascent',
  floor: 1,
  lives: 3,
  started: true,
  question: { id: 'q1', statement: 'Capitale de la Gironde ?', expiresAt: '2026-09-03T12:00:20.000Z' },
  verdict: null,
  cooldownUntil: null,
}

describe('actions du joueur', () => {
  beforeEach(() => {
    reset()
    signIn(testUser)
  })

  it('remplace l état lu par celui que l action renvoie, sans le recalculer', async () => {
    respondWith(served)
    const { next } = usePlay()

    await next()

    expect(calls).toEqual(['fetch POST /api/game/next'])
    expect(payloads.get(GAME_STATE_KEY)).toEqual(served)
  })

  it('envoie la réponse saisie', async () => {
    respondWith({ ...served, question: null, verdict: { correct: true, answerLabel: 'BORDEAUX', submittedAnswer: 'bordeaux', lifeLost: false } })
    const { answer } = usePlay()

    await answer('bordeaux')

    expect(calls).toEqual(['fetch POST /api/game/answer'])
    expect((payloads.get(GAME_STATE_KEY) as GameState).verdict).toMatchObject({ correct: true })
  })

  it('signale une action refusée et ne touche pas à l état', async () => {
    payloads.set(GAME_STATE_KEY, served)
    breakFetch()
    const { next, failed } = usePlay()

    await next()

    expect(failed.value).toBe(true)
    expect(payloads.get(GAME_STATE_KEY)).toEqual(served)
  })
})
