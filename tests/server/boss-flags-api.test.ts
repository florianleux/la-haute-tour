import { beforeEach, describe, expect, it } from 'vitest'
import { setDatabase } from '../../server/db/client'
import { seedFlags } from '../../scripts/seed-flags'
import { createPlayer, createTestDatabase } from '../helpers/db'
import { apiRequest, installNitroGlobals, mountHandler, sessionCookieFor } from '../helpers/nitro'
import type { BossFlagsResponse } from '../../server/api/admin/boss-flags.get'

installNitroGlobals()

const { default: handler } = await import('../../server/api/admin/boss-flags.get')

const flags = mountHandler('/boss-flags', handler)

// Les réponses du boss ne quittent le serveur que pour l'admin : la page du banc
// les importait, et elles partaient dans le JS public. Voir docs/revue-de-securite.md.
describe('drapeaux du banc du boss', () => {
  let playerId: number
  let adminCookie: string

  beforeEach(async () => {
    const db = await createTestDatabase()
    setDatabase(db)
    await seedFlags(db, [
      { slug: 'katanga', image: 'd24d7cb77092d3a8', bossAttemptNumber: 1, answerLabel: 'Katanga', acceptedAnswers: ['Katanga'] },
      { slug: 'japan', image: '0123456789abcdef', bossAttemptNumber: 6, answerLabel: 'Japon', acceptedAnswers: ['Japon'] },
    ])
    playerId = await createPlayer(db)
    adminCookie = await sessionCookieFor(
      await createPlayer(db, { discordId: '999', username: 'saruman', isAdmin: true }),
    )
  })

  it('reste fermé sans session, et pour un joueur ordinaire', async () => {
    expect((await flags(apiRequest('http://test/boss-flags'))).status).toBe(401)
    expect((await flags(apiRequest('http://test/boss-flags', await sessionCookieFor(playerId)))).status).toBe(403)
  })

  it('sert à l admin les drapeaux du premier combat, réponses comprises', async () => {
    const response = await flags(apiRequest('http://test/boss-flags', adminCookie))

    expect(response.status).toBe(200)
    const body: BossFlagsResponse = await response.json()
    expect(body.flags).toEqual([{ image: 'd24d7cb77092d3a8', answerLabel: 'Katanga', acceptedAnswers: ['Katanga'] }])
  })
})
