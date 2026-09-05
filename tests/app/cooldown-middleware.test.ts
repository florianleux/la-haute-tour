import { beforeEach, describe, expect, it } from 'vitest'
import { GAME_STATE_KEY } from '../../composables/useGameState'
import { installAppGlobals } from '../helpers/app'
import type { GameState } from '../../server/utils/game'

const { serve, navigations, refresh, reset } = installAppGlobals()

const { default: cooldownMiddleware } = await import('../../middleware/cooldown')

const middleware = cooldownMiddleware as unknown as () => Promise<unknown>

function state(phase: GameState['phase']): Partial<GameState> {
  return { phase }
}

describe('garde de l attente', () => {
  beforeEach(reset)

  it('laisse entrer un joueur en attente', async () => {
    serve(GAME_STATE_KEY, state('cooldown'))

    await middleware()

    expect(navigations()).toEqual([])
  })

  it('renvoie au jeu depuis toute autre phase', async () => {
    for (const phase of ['ascent', 'recovery', 'floorEnd', 'gameOver'] as const) {
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
