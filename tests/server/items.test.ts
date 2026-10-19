import { beforeEach, describe, expect, it } from 'vitest'
import { setDatabase } from '../../server/db/client'
import { items, pocketSpells, recoveryQuestions } from '../../server/db/schema'
import { createPlayer, createQuestion, createTestDatabase } from '../helpers/db'
import { apiRequest, installNitroGlobals, mountHandler, sessionCookieFor } from '../helpers/nitro'
import type { Database } from '../../server/db/client'

installNitroGlobals()

const { default: itemsHandler } = await import('../../server/api/game/items.get')

const itemsRead = mountHandler('/items', itemsHandler)

/** Un joueur en attente : il est au camp, où le sac s'ouvre. */
const IN_COOLDOWN = { lives: 0, cooldownUntil: new Date(Date.now() + 60_000) }

// L'Inventaire montre les Objets du joueur, et rien des sorts.
// Voir specs/ecrans.md#inventaire.
describe('l Inventaire', () => {
  let db: Database

  beforeEach(async () => {
    db = await createTestDatabase()
    setDatabase(db)
    await createQuestion(db)
  })

  it('refuse tout sans session', async () => {
    expect((await itemsRead(apiRequest('http://test/items'))).status).toBe(401)
  })

  it('montre le Fromage du joueur au camp, et aucun de ses sorts', async () => {
    const userId = await createPlayer(db, IN_COOLDOWN)
    await db.insert(items).values({ userId, item: 'CHEESE', obtainedAt: new Date(1_000) })
    await db.insert(pocketSpells).values({ userId, spell: 'VITALITY', obtainedAt: new Date(2_000) })

    const response = await itemsRead(apiRequest('http://test/items', await sessionCookieFor(userId)))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ items: ['CHEESE'] })
  })

  it('montre un sac vide au joueur qui n a rien', async () => {
    const userId = await createPlayer(db, IN_COOLDOWN)

    const response = await itemsRead(apiRequest('http://test/items', await sessionCookieFor(userId)))

    expect(await response.json()).toEqual({ items: [] })
  })

  it('ne montre pas les Objets d un autre joueur', async () => {
    const userId = await createPlayer(db, IN_COOLDOWN)
    const other = await createPlayer(db, { ...IN_COOLDOWN, discordId: 'other' })
    await db.insert(items).values({ userId: other, item: 'CHEESE', obtainedAt: new Date(1_000) })

    const response = await itemsRead(apiRequest('http://test/items', await sessionCookieFor(userId)))

    expect(await response.json()).toEqual({ items: [] })
  })

  // Consultable au camp seulement. Voir specs/spec.md (glossaire, « Inventaire »).
  it('se ferme hors du camp', async () => {
    const userId = await createPlayer(db, { lives: 0, cooldownUntil: new Date(Date.now() - 60_000) })
    const questionId = await createQuestion(db)
    await db.insert(recoveryQuestions).values({ userId, questionId, position: 0 })

    const response = await itemsRead(apiRequest('http://test/items', await sessionCookieFor(userId)))

    expect(response.status).toBe(403)
  })
})
