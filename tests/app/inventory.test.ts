import { beforeEach, describe, expect, it } from 'vitest'
import { installAppGlobals, testUser } from '../helpers/app'
import type { InventoryView } from '../../server/utils/inventory'

const { answerWith, breakNetwork, calls, reset, serve, signIn } = installAppGlobals()

const { INVENTORY_KEY, useInventory } = await import('../../composables/useInventory')

const owned: InventoryView = {
  entries: [{ spell: 'VITALITY', count: 2 }],
  discovered: ['VITALITY', 'PURGE'],
  log: [],
  received: [],
  canTargetSelf: true,
  canTargetOthers: true,
}

/**
 * Ce que le serveur rend après le lancer : un exemplaire en moins, le journal en
 * plus — et, ici, le joueur arrivé à son plafond d'effets positifs.
 */
const afterCast: InventoryView = {
  entries: [{ spell: 'VITALITY', count: 1 }],
  discovered: ['VITALITY', 'PURGE'],
  log: [{ spell: 'VITALITY', face: 'boon', targetName: 'samsagace', castAt: '2026-09-06T09:00:00.000Z' }],
  received: [],
  canTargetSelf: false,
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
    const { entries, log, cast } = await useInventory()

    await cast('VITALITY', 'self')

    expect(calls()).toEqual(['fetch POST /api/game/cast'])
    expect(entries.value).toEqual([{ spell: 'VITALITY', count: 1 }])
    expect(log.value).toHaveLength(1)
  })

  // Le pentacle lit les sorts découverts tels que le serveur les rend, au
  // lancer comme à la lecture : la Purge lancée hier y reste, sans exemplaire.
  // Voir specs/ecrans.md#sorts.
  it('lit les sorts découverts que le serveur renvoie', async () => {
    serve(INVENTORY_KEY, owned)
    answerWith(afterCast)
    const { discovered, cast } = await useInventory()

    expect(discovered.value).toEqual(['VITALITY', 'PURGE'])

    await cast('VITALITY', 'self')

    expect(discovered.value).toEqual(['VITALITY', 'PURGE'])
  })

  // Le plafond vient du serveur comme le reste : la page éteint « Sur moi »
  // dessus, elle ne recompte pas ce que le joueur porte.
  // Voir specs/bonus.md#limite-deffets-positifs.
  it('suit ce que le serveur dit du sort sur soi', async () => {
    serve(INVENTORY_KEY, owned)
    answerWith(afterCast)
    const { canTargetSelf, cast } = await useInventory()

    expect(canTargetSelf.value).toBe(true)

    await cast('VITALITY', 'self')

    expect(canTargetSelf.value).toBe(false)
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
