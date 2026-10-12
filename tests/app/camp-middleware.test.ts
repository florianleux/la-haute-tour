import { beforeEach, describe, expect, it } from 'vitest'
import { GAME_STATE_KEY } from '../../composables/useGameState'
import { installAppGlobals } from '../helpers/app'
import type { GameState } from '../../server/utils/game'

const { serve, navigations, refresh, reset } = installAppGlobals()

const { default: campMiddleware } = await import('../../middleware/camp')

const middleware = campMiddleware as unknown as () => Promise<unknown>

function state(phase: GameState['phase']): Partial<GameState> {
  return { phase }
}

/** Le rattrapage tiré : il a ses questions, le joueur a quitté le camp. */
const DRAWN = { total: 3, played: 0, successes: 0, sealed: false, resumes: false, required: 2 }

describe('garde du camp', () => {
  beforeEach(reset)

  it('laisse entrer un joueur en attente', async () => {
    serve(GAME_STATE_KEY, state('cooldown'))

    await middleware()

    expect(navigations()).toEqual([])
  })

  it('laisse entrer après l attente, tant que le rattrapage n est pas tiré', async () => {
    serve(GAME_STATE_KEY, state('recovery'))

    await middleware()

    expect(navigations()).toEqual([])
  })

  it('renvoie au jeu une fois le rattrapage tiré', async () => {
    serve(GAME_STATE_KEY, { ...state('recovery'), recovery: DRAWN })

    await middleware()

    expect(navigations()).toEqual(['/'])
  })

  it('renvoie au jeu depuis toute autre phase', async () => {
    for (const phase of ['ascent', 'floorEnd', 'gameOver'] as const) {
      reset()
      serve(GAME_STATE_KEY, state(phase))

      await middleware()

      expect(navigations()).toEqual(['/'])
    }
  })

  it('renvoie au jeu quand l état n a pas pu être lu', async () => {
    await middleware()

    expect(navigations()).toEqual(['/'])
  })

  it('relit l état plutôt que de croire le cache', async () => {
    serve(GAME_STATE_KEY, state('cooldown'))

    await middleware()

    expect(refresh).toHaveBeenCalled()
  })
})
