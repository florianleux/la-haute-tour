import { beforeEach, describe, expect, it } from 'vitest'
import { installAppGlobals, testUser } from '../helpers/app'
import type { GameState } from '../../server/utils/game'

const { serve, answerWith, breakNetwork, signIn, cached, payloadOf, calls, reset } = installAppGlobals()

const { GAME_STATE_KEY } = await import('../../composables/useGameState')
const { usePlay } = await import('../../composables/usePlay')

const served: GameState = {
  phase: 'ascent',
  floor: 1,
  lives: 3,
  maxLives: 3,
  started: true,
  question: {
    id: 'q1',
    statement: 'Capitale de la Gironde ?',
    expiresAt: '2026-09-03T12:00:20.000Z',
    focusGraceMs: 1_000,
    lootQuestion: false,
  },
  verdict: null,
  cooldownUntil: null,
  recovery: null,
  floorSeen: 0,
  floorTotal: 0,
  attemptSeen: 0,
  seenTotal: 0,
  chest: null,
  maintenance: false,
  effects: [],
  unlocked: [],
}

describe('actions du joueur', () => {
  beforeEach(() => {
    reset()
    signIn(testUser)
  })

  it('remplace l état lu par celui que l action renvoie, sans le recalculer', async () => {
    answerWith(served)
    const { next } = usePlay()

    await next()

    expect(calls()).toEqual(['fetch POST /api/game/next'])
    expect(cached(GAME_STATE_KEY)).toEqual(served)
  })

  // Le payload est ce que relit chaque nouvel appel à useGameState() : resté
  // sur la dernière lecture, il ramenait une page montée après le coup à un
  // état périmé — une chute déjà lue se rouvrait sous le Volumen.
  it('recopie l état renvoyé dans le payload que relit chaque nouvelle lecture', async () => {
    answerWith(served)
    const { next } = usePlay()

    await next()

    expect(payloadOf(GAME_STATE_KEY)).toEqual(served)
  })

  it('envoie la réponse saisie', async () => {
    answerWith({ ...served, question: null, verdict: { correct: true, answerLabel: 'BORDEAUX', submittedAnswer: 'bordeaux', lifeLost: false } })
    const { answer } = usePlay()

    await answer('bordeaux')

    expect(calls()).toEqual(['fetch POST /api/game/answer'])
    expect((cached(GAME_STATE_KEY) as GameState).verdict).toMatchObject({ correct: true })
  })

  it('signale une action refusée et ne touche pas à l état', async () => {
    serve(GAME_STATE_KEY, served)
    breakNetwork()
    const { next, failed } = usePlay()

    await next()

    expect(failed.value).toBe(true)
    expect(cached(GAME_STATE_KEY)).toEqual(served)
    expect(payloadOf(GAME_STATE_KEY)).toBeNull()
  })
})
