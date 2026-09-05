import { beforeEach, describe, expect, it } from 'vitest'
import { setDatabase } from '../../server/db/client'
import { inventory } from '../../server/db/schema'
import { createPlayer, createQuestion, createTestDatabase } from '../helpers/db'
import { apiRequest, installNitroGlobals, mountHandler, sessionCookieFor } from '../helpers/nitro'
import type { Database } from '../../server/db/client'
import type { SpellId } from '../../shared/utils/spells'

installNitroGlobals()

const { default: inventoryHandler } = await import('../../server/api/game/inventory.get')

const inventoryRead = mountHandler('/inventory', inventoryHandler)

/** Un joueur en attente : c'est la seule phase où les Sorts existent. */
const IN_COOLDOWN = { lives: 0, cooldownUntil: new Date(Date.now() + 60_000) }

describe('inventaire des sorts', () => {
  let db: Database

  beforeEach(async () => {
    db = await createTestDatabase()
    setDatabase(db)
    await createQuestion(db)
  })

  /** Des coffres ouverts dans cet ordre — une seconde d'écart, comme l'horloge les compte. */
  async function loot(userId: number, ...owned: SpellId[]): Promise<void> {
    await db.insert(inventory).values(owned.map((spell, index) => ({
      userId,
      spell,
      obtainedAt: new Date((index + 1) * 1_000),
    })))
  }

  it('refuse tout sans session', async () => {
    expect((await inventoryRead(apiRequest('http://test/inventory'))).status).toBe(401)
  })

  it('liste l inventaire du joueur en attente, doublons compris', async () => {
    const userId = await createPlayer(db, IN_COOLDOWN)
    await loot(userId, 'VITALITY', 'RESPITE', 'VITALITY')

    const response = await inventoryRead(apiRequest('http://test/inventory', await sessionCookieFor(userId)))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      total: 3,
      entries: [
        { spell: 'VITALITY', count: 2 },
        { spell: 'RESPITE', count: 1 },
      ],
    })
  })

  it('garde l ordre du premier exemplaire obtenu, qu un doublon ne déplace pas', async () => {
    const userId = await createPlayer(db, IN_COOLDOWN)
    await loot(userId, 'RESPITE', 'VITALITY', 'VITALITY')

    const { entries } = await (await inventoryRead(apiRequest('http://test/inventory', await sessionCookieFor(userId)))).json()

    expect(entries).toEqual([
      { spell: 'RESPITE', count: 1 },
      { spell: 'VITALITY', count: 2 },
    ])
  })

  it('rend un inventaire vide plutôt que rien', async () => {
    const userId = await createPlayer(db, IN_COOLDOWN)

    const response = await inventoryRead(apiRequest('http://test/inventory', await sessionCookieFor(userId)))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ total: 0, entries: [] })
  })

  it('ne montre rien à un autre joueur', async () => {
    const owner = await createPlayer(db, IN_COOLDOWN)
    const other = await createPlayer(db, { ...IN_COOLDOWN, discordId: '987654321' })
    await loot(owner, 'VITALITY')

    const response = await inventoryRead(apiRequest('http://test/inventory', await sessionCookieFor(other)))

    expect(await response.json()).toEqual({ total: 0, entries: [] })
  })

  it('ferme la page hors attente, URL comprise', async () => {
    const userId = await createPlayer(db)
    await loot(userId, 'VITALITY')

    const response = await inventoryRead(apiRequest('http://test/inventory', await sessionCookieFor(userId)))

    expect(response.status).toBe(403)
  })

  it('la ferme aussi dès que l attente est finie', async () => {
    const userId = await createPlayer(db, { lives: 0, cooldownUntil: new Date(Date.now() - 60_000) })

    const response = await inventoryRead(apiRequest('http://test/inventory', await sessionCookieFor(userId)))

    expect(response.status).toBe(403)
  })
})
