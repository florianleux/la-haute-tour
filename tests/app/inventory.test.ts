import { beforeEach, describe, expect, it } from 'vitest'
import { installAppGlobals, testUser } from '../helpers/app'
import type { InventoryView } from '../../server/utils/inventory'

const { answerWith, breakNetwork, calls, reset, serve, signIn } = installAppGlobals()

const { INVENTORY_KEY, useInventory } = await import('../../composables/useInventory')

const owned: InventoryView = {
  entries: [{ spell: 'VITALITY', count: 2 }],
  total: 2,
  log: [],
}

/** Ce que le serveur rend après le lancer : un exemplaire en moins, le journal en plus. */
const afterCast: InventoryView = {
  entries: [{ spell: 'VITALITY', count: 1 }],
  total: 1,
  log: [{ spell: 'VITALITY', face: 'boon', targetName: 'gandalf', castAt: '2026-09-06T09:00:00.000Z' }],
}

describe('inventaire du joueur', () => {
  beforeEach(() => {
    reset()
    signIn(testUser)
  })

  // Le lancer rend l'inventaire tel qu'il est ensuite : la page réaffiche cette
  // réponse-là, elle ne retire pas l'exemplaire de son côté.
  it('remplace l inventaire par celui que le lancer renvoie', async () => {
    serve(INVENTORY_KEY, owned)
    answerWith(afterCast)
    const { entries, total, log, cast } = await useInventory()

    await cast('VITALITY')

    expect(calls()).toEqual(['fetch POST /api/game/cast'])
    expect(entries.value).toEqual([{ spell: 'VITALITY', count: 1 }])
    expect(total.value).toBe(1)
    expect(log.value).toHaveLength(1)
  })

  it('signale un lancer refusé et laisse l inventaire intact', async () => {
    serve(INVENTORY_KEY, owned)
    breakNetwork()
    const { entries, castFailed, casting, cast } = await useInventory()

    await cast('VITALITY')

    expect(castFailed.value).toBe(true)
    expect(entries.value).toEqual([{ spell: 'VITALITY', count: 2 }])
    // Relâché quoi qu'il arrive : un bouton laissé en vol ne se recliquerait plus.
    expect(casting.value).toBeNull()
  })
})
