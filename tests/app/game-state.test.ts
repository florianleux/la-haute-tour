import { beforeEach, describe, expect, it } from 'vitest'
import { installAppGlobals } from '../helpers/app'

const { payloads, errors, reset } = installAppGlobals()

const { GAME_STATE_KEY, useGameState } = await import('../../composables/useGameState')

describe('lecture de l état de jeu', () => {
  beforeEach(reset)

  it('rend ce que le serveur a répondu', async () => {
    payloads.set(GAME_STATE_KEY, { floor: 3, lives: 2 })

    const { state, failed } = await useGameState()

    expect(state.value).toEqual({ floor: 3, lives: 2 })
    expect(failed.value).toBe(false)
  })

  it('n invente aucun état quand le serveur ne répond pas', async () => {
    errors.set(GAME_STATE_KEY, new Error('injoignable'))

    const { state, failed } = await useGameState()

    expect(state.value).toBeNull()
    expect(failed.value).toBe(true)
  })
})
