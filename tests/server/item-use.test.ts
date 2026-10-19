import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { setDatabase } from '../../server/db/client'
import { items, recoveryQuestions, users } from '../../server/db/schema'
import { createPlayer, createQuestion, createTestDatabase } from '../helpers/db'
import { installNitroGlobals, jsonRequest, mountHandler, sessionCookieFor } from '../helpers/nitro'
import type { Database } from '../../server/db/client'

installNitroGlobals()

const { default: useHandler } = await import('../../server/api/game/items/use.post')

const useItem = mountHandler('/use', useHandler)

function useRequest(body: unknown, cookie?: string): Request {
  return jsonRequest('http://test/use', 'POST', body, cookie)
}

async function itemsOf(db: Database, userId: number): Promise<string[]> {
  const rows = await db.select({ item: items.item }).from(items).where(eq(items.userId, userId))
  return rows.map(row => row.item)
}

// Une seule route pour utiliser un Objet, quel qu'il soit : l'Objet quitte le
// sac, et ce qu'il fait dépend de lui. Voir specs/spec.md (glossaire, « Utiliser »).
describe('utiliser un Objet', () => {
  let db: Database
  let playerId: number

  beforeEach(async () => {
    db = await createTestDatabase()
    setDatabase(db)
    await createQuestion(db)
    // Au camp au repos, à la sortie de l'introduction, le Fromage en poche.
    playerId = await createPlayer(db)
    await db.insert(items).values({ userId: playerId, item: 'CHEESE', obtainedAt: new Date(1_000) })
  })

  it('refuse tout sans session', async () => {
    expect((await useItem(useRequest({ item: 'CHEESE' }))).status).toBe(401)
  })

  it('refuse un Objet qui n existe pas', async () => {
    const response = await useItem(useRequest({ item: 'EPEE' }, await sessionCookieFor(playerId)))

    expect(response.status).toBe(400)
  })

  // Donner le Fromage à Michel, c'est l'utiliser. Voir specs/ecrans.md#leçons-de-michel.
  it('retire le Fromage du sac, et rend le sac qui reste', async () => {
    const response = await useItem(useRequest({ item: 'CHEESE' }, await sessionCookieFor(playerId)))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ items: [] })
    expect(await itemsOf(db, playerId)).toEqual([])
  })

  it('refuse un Objet absent du sac', async () => {
    await db.delete(items)

    const response = await useItem(useRequest({ item: 'CHEESE' }, await sessionCookieFor(playerId)))

    expect(response.status).toBe(409)
  })

  it('ne retire qu un exemplaire', async () => {
    await db.insert(items).values({ userId: playerId, item: 'CHEESE', obtainedAt: new Date(2_000) })

    await useItem(useRequest({ item: 'CHEESE' }, await sessionCookieFor(playerId)))

    expect(await itemsOf(db, playerId)).toEqual(['CHEESE'])
  })

  // Le Fromage ne se donne qu'à la leçon du camp : passée, Michel n'en veut plus.
  it('refuse le Fromage une fois la leçon du camp vue', async () => {
    await db.update(users).set({ campLessonAt: new Date() }).where(eq(users.id, playerId))

    const response = await useItem(useRequest({ item: 'CHEESE' }, await sessionCookieFor(playerId)))

    expect(response.status).toBe(409)
    expect(await itemsOf(db, playerId)).toEqual(['CHEESE'])
  })

  // Le sac ne s'ouvre qu'au camp. Voir specs/spec.md (glossaire, « Inventaire »).
  it('refuse hors du camp', async () => {
    await db.update(users).set({ lives: 0, cooldownUntil: new Date(Date.now() - 60_000) }).where(eq(users.id, playerId))
    await db.insert(recoveryQuestions).values({ userId: playerId, questionId: await createQuestion(db), position: 0 })

    const response = await useItem(useRequest({ item: 'CHEESE' }, await sessionCookieFor(playerId)))

    expect(response.status).toBe(403)
    expect(await itemsOf(db, playerId)).toEqual(['CHEESE'])
  })

  it('ne touche pas au sac d un autre joueur', async () => {
    const other = await createPlayer(db, { discordId: 'other' })
    await db.insert(items).values({ userId: other, item: 'CHEESE', obtainedAt: new Date(1_000) })

    await useItem(useRequest({ item: 'CHEESE' }, await sessionCookieFor(playerId)))

    expect(await itemsOf(db, other)).toEqual(['CHEESE'])
  })
})
