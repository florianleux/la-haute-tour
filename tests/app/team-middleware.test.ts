import { beforeEach, describe, expect, it } from 'vitest'
import { installAppGlobals, testUser } from '../helpers/app'

const { signIn, navigations, reset } = installAppGlobals()

const { default: teamMiddleware } = await import('../../middleware/team')

const middleware = teamMiddleware as unknown as () => Promise<unknown>

describe('garde de l équipe', () => {
  beforeEach(reset)

  it('laisse entrer un joueur qui a une équipe', async () => {
    for (const team of ['MIDI', 'TLM'] as const) {
      reset()
      signIn({ ...testUser, team })

      await middleware()

      expect(navigations()).toEqual([])
    }
  })

  it('renvoie au jeu un joueur sans équipe : pas de bannière', async () => {
    signIn({ ...testUser, team: null })

    await middleware()

    expect(navigations()).toEqual(['/'])
  })
})
