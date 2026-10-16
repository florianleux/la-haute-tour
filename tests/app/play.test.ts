import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installAppGlobals, testUser } from '../helpers/app'
import type { GameState } from '../../server/utils/game'

const { serve, answerWith, breakNetwork, signIn, cached, payloadOf, calls, reset } = installAppGlobals()

const { GAME_STATE_KEY } = await import('../../composables/useGameState')
const { JUDGING_MS, usePlay } = await import('../../composables/usePlay')

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

/**
 * Valider joue une animation d'au moins JUDGING_MS : le verdict attend sa fin même
 * quand le serveur répond plus vite. Suivante n'attend rien, parce que le chrono
 * de la question court déjà côté serveur. Voir specs/ecrans.md.
 */
describe('l attente du jugement', () => {
  const judged: GameState = {
    ...served,
    question: null,
    verdict: { questionId: 'q1', statement: 'Capitale de la Gironde ?', correct: true, answerLabel: 'BORDEAUX', submittedAnswer: 'bordeaux', lifeLost: false },
  }

  beforeEach(() => {
    reset()
    signIn(testUser)
    serve(GAME_STATE_KEY, served)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('tient le verdict jusqu à la fin de son animation, même quand le serveur répond aussitôt', async () => {
    answerWith(judged)
    const { answer, pending } = usePlay()

    const sent = answer('bordeaux')
    await vi.advanceTimersByTimeAsync(JUDGING_MS - 1)

    expect(cached(GAME_STATE_KEY)).toEqual(served)
    expect(pending.value).toBe(true)

    await vi.advanceTimersByTimeAsync(1)
    await sent

    expect(cached(GAME_STATE_KEY)).toEqual(judged)
    expect(pending.value).toBe(false)
  })

  it('ne retient pas la question suivante', async () => {
    serve(GAME_STATE_KEY, judged)
    answerWith(served)
    const { next } = usePlay()

    await next()

    expect(cached(GAME_STATE_KEY)).toEqual(served)
  })

  it('ne retient rien quand le joueur a demandé moins d animations', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    answerWith(judged)
    const { answer } = usePlay()

    await answer('bordeaux')

    expect(cached(GAME_STATE_KEY)).toEqual(judged)
  })
})
