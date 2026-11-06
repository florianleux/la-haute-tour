import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { setDatabase } from '../../server/db/client'
import { achievements, activeEffects, items, users } from '../../server/db/schema'
import { soberUp } from '../../server/utils/journey'
import { mushroomGrows } from '../../server/utils/mechanics'
import { readGameState, serveNextQuestion, submitAnswer } from '../../server/utils/game'
import { resetPlayer } from '../../server/utils/players'
import { createPlayer, createQuestion, createTestDatabase, loadPlayer } from '../helpers/db'
import { installNitroGlobals, jsonRequest, mountHandler, sessionCookieFor } from '../helpers/nitro'
import type { Database } from '../../server/db/client'

installNitroGlobals()

const { default: pickHandler } = await import('../../server/api/game/items/pick.post')
const { default: useHandler } = await import('../../server/api/game/items/use.post')

const pick = mountHandler('/pick', pickHandler)
const use = mountHandler('/use', useHandler)

const DAY_MS = 24 * 60 * 60 * 1000

async function bagOf(db: Database, userId: number): Promise<string[]> {
  const rows = await db.select({ item: items.item }).from(items).where(eq(items.userId, userId))
  return rows.map(row => row.item)
}

async function earnedBy(db: Database, userId: number): Promise<string[]> {
  const rows = await db.select().from(achievements).where(eq(achievements.userId, userId))
  return rows.map(row => row.achievement)
}

// Voir specs/champignon.md.
describe('Champignon appétissant', () => {
  let db: Database
  let playerId: number

  const pickIt = async (): Promise<Response> =>
    pick(jsonRequest('http://test/pick', 'POST', {}, await sessionCookieFor(playerId)))
  const eat = async (): Promise<Response> =>
    use(jsonRequest('http://test/use', 'POST', { item: 'MUSHROOM' }, await sessionCookieFor(playerId)))
  const carry = (): Promise<unknown> =>
    db.insert(items).values({ userId: playerId, item: 'MUSHROOM', obtainedAt: new Date(1_000) })

  beforeEach(async () => {
    db = await createTestDatabase()
    setDatabase(db)
    await createQuestion(db)
    playerId = await createPlayer(db)
  })

  describe('la repousse', () => {
    const now = new Date(100 * DAY_MS)

    it('pousse pour qui n en a jamais mangé', () => {
      expect(mushroomGrows({ eatenAt: null, carried: false }, now)).toBe(true)
    })

    it('ne pousse pas tant qu un champignon est au sac', () => {
      expect(mushroomGrows({ eatenAt: null, carried: true }, now)).toBe(false)
    })

    it('repousse 7 jours glissants après le repas, pas avant', () => {
      expect(mushroomGrows({ eatenAt: new Date(now.getTime() - 7 * DAY_MS + 1), carried: false }, now)).toBe(false)
      expect(mushroomGrows({ eatenAt: new Date(now.getTime() - 7 * DAY_MS), carried: false }, now)).toBe(true)
    })
  })

  describe('la cueillette', () => {
    it('le fait passer du décor au sac, et grave le succès', async () => {
      expect((await readGameState(db, await loadPlayer(db, playerId), new Date())).mushroomGrown).toBe(true)

      const response = await pickIt()
      const state = await response.json()

      expect(response.status).toBe(200)
      expect(state.mushroomGrown).toBe(false)
      expect(state.unlocked).toEqual(['MUSHROOM_PICKED'])
      expect(await bagOf(db, playerId)).toEqual(['MUSHROOM'])
    })

    it('refuse un second champignon : un seul à la fois', async () => {
      await pickIt()

      expect((await pickIt()).status).toBe(409)
      expect(await bagOf(db, playerId)).toEqual(['MUSHROOM'])
    })

    it('refuse tant que le délai court', async () => {
      await db.update(users).set({ mushroomEatenAt: new Date() }).where(eq(users.id, playerId))

      expect((await pickIt()).status).toBe(409)
      expect(await bagOf(db, playerId)).toEqual([])
    })

    it('refuse hors du camp', async () => {
      await serveNextQuestion(db, await loadPlayer(db, playerId), new Date())

      expect((await pickIt()).status).toBe(403)
    })
  })

  describe('le manger', () => {
    beforeEach(carry)

    // Ascension au repos : seule l'intoxication.
    it('au repos, intoxique sans toucher aux vies, et grave le succès', async () => {
      await db.update(users).set({ lives: 2 }).where(eq(users.id, playerId))

      const response = await eat()
      const player = await loadPlayer(db, playerId)

      expect((await response.json()).unlocked).toEqual(['MUSHROOM_EATEN'])
      expect(player.intoxicated).toBe(true)
      expect(player.lives).toBe(2)
      expect(player.mushroomEatenAt).not.toBeNull()
      expect(await bagOf(db, playerId)).toEqual([])
    })

    it('date la mise en garde, sans le commentaire de Michel qui reste à jouer', async () => {
      await eat()
      const player = await loadPlayer(db, playerId)

      expect(player.mushroomLessonAt).not.toBeNull()
      expect(player.mushroomEatenLessonAt).toBeNull()
    })

    it('pendant l attente, la fait échoir sans rattrapage : vies pleines, ascension', async () => {
      await db.update(users).set({
        lives: 0,
        cooldownUntil: new Date(Date.now() + DAY_MS),
        cooldownStartedAt: new Date(),
      }).where(eq(users.id, playerId))

      await eat()
      const player = await loadPlayer(db, playerId)
      const state = await readGameState(db, player, new Date())

      expect(player.lives).toBeGreaterThan(0)
      expect(player.cooldownUntil).toBeNull()
      expect(player.intoxicated).toBe(true)
      expect(state.phase).toBe('ascent')
    })

    it('sur une attente échue, saute le rattrapage', async () => {
      await db.update(users).set({
        lives: 0,
        cooldownUntil: new Date(Date.now() - 1000),
        cooldownStartedAt: new Date(Date.now() - DAY_MS),
      }).where(eq(users.id, playerId))

      await eat()
      const player = await loadPlayer(db, playerId)

      expect(player.cooldownUntil).toBeNull()
      expect(player.lives).toBeGreaterThan(0)
      expect((await readGameState(db, player, new Date())).phase).toBe('ascent')
    })

    // Les sorts liés à l'attente meurent avec elle : l'identité d'une attente est
    // son début. Voir docs/adr/0004-les-sorts-lies-a-l-attente.md.
    it('fait échoir l attente malgré un Répit', async () => {
      const startedAt = new Date()
      await db.update(users).set({
        lives: 0,
        cooldownUntil: new Date(Date.now() + DAY_MS),
        cooldownStartedAt: startedAt,
      }).where(eq(users.id, playerId))
      await db.insert(activeEffects).values({
        userId: playerId,
        casterId: playerId,
        spell: 'RESPITE',
        face: 'boon',
        castAt: startedAt,
        castCooldownStartedAt: startedAt,
      })

      await eat()

      expect((await loadPlayer(db, playerId)).cooldownUntil).toBeNull()
    })

    it('refuse sans champignon au sac', async () => {
      await db.delete(items)

      expect((await eat()).status).toBe(409)
      expect((await loadPlayer(db, playerId)).intoxicated).toBe(false)
    })
  })

  describe('le retour au camp', () => {
    it('dégrise et grave le succès, une fois', async () => {
      await db.update(users).set({ intoxicated: true }).where(eq(users.id, playerId))

      await soberUp(db, await loadPlayer(db, playerId), new Date())
      await soberUp(db, await loadPlayer(db, playerId), new Date())

      expect((await loadPlayer(db, playerId)).intoxicated).toBe(false)
      expect(await earnedBy(db, playerId)).toEqual(['MUSHROOM_SOBER'])
    })
  })

  // Les trois retours au camp, par le vrai chemin du jeu.
  describe('les retours au camp du jeu', () => {
    beforeEach(() => db.update(users).set({ intoxicated: true }).where(eq(users.id, playerId)))

    // Le toast attend l'arrivée au camp : voir server/utils/notices.ts.
    it('la chute dégrise, sans annoncer le succès sur le verdict', async () => {
      await createQuestion(db)
      await db.update(users).set({ lives: 1 }).where(eq(users.id, playerId))
      await serveNextQuestion(db, await loadPlayer(db, playerId), new Date())

      const state = await submitAnswer(db, await loadPlayer(db, playerId), 'faux', new Date())

      expect(state.intoxicated).toBe(false)
      expect(state.unlocked).not.toContain('MUSHROOM_SOBER')
      expect(await earnedBy(db, playerId)).toContain('MUSHROOM_SOBER')
    })

    it('une bonne réponse ne dégrise pas', async () => {
      await serveNextQuestion(db, await loadPlayer(db, playerId), new Date())

      const state = await submitAnswer(db, await loadPlayer(db, playerId), 'bordeaux', new Date())

      expect(state.intoxicated).toBe(true)
    })
  })

  it('la remise à zéro efface tout : sac, délai, intoxication, leçon', async () => {
    await carry()
    await db.update(users).set({ intoxicated: true, mushroomEatenAt: new Date(), mushroomLessonAt: new Date(), mushroomEatenLessonAt: new Date() }).where(eq(users.id, playerId))

    await resetPlayer(db, await loadPlayer(db, playerId), new Date())
    const player = await loadPlayer(db, playerId)

    expect(await bagOf(db, playerId)).toEqual([])
    expect(player.intoxicated).toBe(false)
    expect(player.mushroomEatenAt).toBeNull()
    expect(player.mushroomLessonAt).toBeNull()
    expect(player.mushroomEatenLessonAt).toBeNull()
    expect(await earnedBy(db, playerId)).toEqual([])
  })
})
