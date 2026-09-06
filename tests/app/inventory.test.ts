import { beforeEach, describe, expect, it } from 'vitest'
import { installAppGlobals, testUser } from '../helpers/app'
import type { InventoryView } from '../../server/utils/inventory'

const { answerWith, breakNetwork, calls, reset, serve, signIn } = installAppGlobals()

const { INVENTORY_KEY, useInventory } = await import('../../composables/useInventory')

const owned: InventoryView = {
  entries: [{ spell: 'VITALITY', count: 2 }],
  total: 2,
  log: [],
  received: [],
  castsLeft: 2,
  castsPerCooldown: 2,
  canTargetOthers: true,
}

/** Ce que le serveur rend après le lancer : un exemplaire en moins, le journal en plus. */
const afterCast: InventoryView = {
  entries: [{ spell: 'VITALITY', count: 1 }],
  total: 1,
  log: [{ spell: 'VITALITY', face: 'boon', targetName: 'samsagace', castAt: '2026-09-06T09:00:00.000Z' }],
  received: [],
  castsLeft: 1,
  castsPerCooldown: 2,
  canTargetOthers: true,
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

    await cast('VITALITY', 'self')

    expect(calls()).toEqual(['fetch POST /api/game/cast'])
    expect(entries.value).toEqual([{ spell: 'VITALITY', count: 1 }])
    expect(total.value).toBe(1)
    expect(log.value).toHaveLength(1)
  })

  // Le budget vient du serveur comme le reste : la page l'affiche et éteint ses
  // boutons dessus, elle ne le décompte pas d'elle-même.
  // Voir specs/bonus.md#où-et-quand.
  it('suit le budget de lancers que le serveur renvoie', async () => {
    serve(INVENTORY_KEY, owned)
    answerWith(afterCast)
    const { castsLeft, castsPerCooldown, cast } = await useInventory()

    expect(castsLeft.value).toBe(2)
    expect(castsPerCooldown.value).toBe(2)

    await cast('VITALITY', 'self')

    expect(castsLeft.value).toBe(1)
  })

  // Le joueur choisit une catégorie, jamais une personne : c'est elle qui part
  // au serveur, et c'est lui qui nomme la cible au retour.
  // Voir specs/bonus.md#tirage-de-la-cible.
  it('envoie la catégorie de cible et lit le nom qui revient', async () => {
    serve(INVENTORY_KEY, owned)
    answerWith(afterCast)
    const { log, received, canTargetOthers, cast } = await useInventory()

    expect(canTargetOthers.value).toBe(true)
    expect(received.value).toEqual([])

    await cast('VITALITY', 'ally')

    expect(calls()).toEqual(['fetch POST /api/game/cast'])
    expect(log.value[0]?.targetName).toBe('samsagace')
  })

  it('signale un lancer refusé et laisse l inventaire intact', async () => {
    serve(INVENTORY_KEY, owned)
    breakNetwork()
    const { entries, castFailed, casting, cast } = await useInventory()

    await cast('VITALITY', 'self')

    expect(castFailed.value).toBe(true)
    expect(entries.value).toEqual([{ spell: 'VITALITY', count: 2 }])
    // Relâché quoi qu'il arrive : un bouton laissé en vol ne se recliquerait plus.
    expect(casting.value).toBeNull()
  })
})
