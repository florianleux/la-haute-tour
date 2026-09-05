import { beforeEach, describe, expect, it } from 'vitest'
import { and, eq } from 'drizzle-orm'
import { inventory, missedPool, reservations, seenQuestions, users } from '../../server/db/schema'
import { readGameState } from '../../server/utils/game'
import { rulesForFloor } from '../../server/utils/rules'
import {
  advanceTestPlayer,
  deleteTestPlayer,
  grantSpell,
  resetTestPlayer,
  rewindTestPlayer,
  sendToCooldown,
} from '../../server/utils/testPlayers'
import { setDatabase } from '../../server/db/client'
import { createPlayer, createQuestion, createTestDatabase, loadPlayer } from '../helpers/db'
import { installNitroGlobals, jsonRequest, mountHandler, mountRoute, sessionCookieFor } from '../helpers/nitro'
import type { Database } from '../../server/db/client'

installNitroGlobals()

const { default: createHandler } = await import('../../server/api/admin/test-players/index.post')
const { default: deleteHandler } = await import('../../server/api/admin/test-players/[id].delete')

const create = mountHandler('/test-players', createHandler)
const remove = mountRoute('delete', '/test-players/:id', deleteHandler)

const NOW = new Date('2026-09-05T12:00:00.000Z')
const rules = rulesForFloor(1)

describe('gestes sur un joueur test', () => {
  let db: Database
  let testPlayerId: number

  beforeEach(async () => {
    db = await createTestDatabase()
    testPlayerId = await createPlayer(db, { discordId: 'test-1', username: 'Testeur A', isTest: true })

    for (let i = 0; i < 12; i++) {
      await createQuestion(db, { statement: `Question ${i} ?`, accepted: [`reponse ${i}`] })
    }
  })

  const reload = () => loadPlayer(db, testPlayerId)
  const seen = async (): Promise<number> =>
    (await db.select().from(seenQuestions).where(eq(seenQuestions.userId, testPlayerId))).length
  const pool = async (): Promise<number> =>
    (await db.select().from(missedPool).where(eq(missedPool.userId, testPlayerId))).length

  describe('donner un sort', () => {
    it('ajoute un exemplaire à l inventaire', async () => {
      await grantSpell(db, await reload(), 'VITALITY', NOW)

      const owned = await db.select().from(inventory).where(eq(inventory.userId, testPlayerId))
      expect(owned).toHaveLength(1)
      expect(owned[0].spell).toBe('VITALITY')
    })

    it('empile les doublons, comme les coffres le font', async () => {
      await grantSpell(db, await reload(), 'VITALITY', NOW)
      await grantSpell(db, await reload(), 'VITALITY', NOW)

      expect(await db.select().from(inventory).where(eq(inventory.userId, testPlayerId))).toHaveLength(2)
    })
  })

  describe('avancer dans l étage', () => {
    it('marque N questions vues et avance le curseur', async () => {
      await advanceTestPlayer(db, await reload(), { count: 5, correct: true }, NOW)

      expect(await seen()).toBe(5)
      expect((await reload()).floorCursor).toBe(5)
    })

    it('ne remplit pas le Pool Échecs sur des réponses justes', async () => {
      await advanceTestPlayer(db, await reload(), { count: 5, correct: true }, NOW)

      expect(await pool()).toBe(0)
    })

    it('remplit le Pool Échecs sur des réponses fausses, comme en jeu', async () => {
      await advanceTestPlayer(db, await reload(), { count: 4, correct: false }, NOW)

      expect(await seen()).toBe(4)
      expect(await pool()).toBe(4)
    })

    it('reprend là où il s était arrêté plutôt que de rejouer les mêmes', async () => {
      await advanceTestPlayer(db, await reload(), { count: 3, correct: true }, NOW)
      await advanceTestPlayer(db, await reload(), { count: 3, correct: true }, NOW)

      expect(await seen()).toBe(6)
    })

    it('s arrête à ce que l étage contient encore', async () => {
      await advanceTestPlayer(db, await reload(), { count: 99, correct: true }, NOW)

      expect(await seen()).toBe(12)
    })
  })

  describe('revenir en arrière', () => {
    it('efface les dernières questions vues et recule le curseur', async () => {
      await advanceTestPlayer(db, await reload(), { count: 8, correct: true }, NOW)

      await rewindTestPlayer(db, await reload(), 3)

      expect(await seen()).toBe(5)
      expect((await reload()).floorCursor).toBe(5)
    })

    it('emporte les lignes de Pool Échecs des passages effacés', async () => {
      await advanceTestPlayer(db, await reload(), { count: 6, correct: false }, NOW)

      await rewindTestPlayer(db, await reload(), 6)

      expect(await pool()).toBe(0)
    })

    it('rend l étage intact quand on avance puis recule d autant', async () => {
      await advanceTestPlayer(db, await reload(), { count: 7, correct: true }, NOW)
      await rewindTestPlayer(db, await reload(), 7)

      expect(await seen()).toBe(0)
      expect((await reload()).floorCursor).toBe(0)
    })

    it('efface la réservation en cours, qui pointerait un passage disparu', async () => {
      await advanceTestPlayer(db, await reload(), { count: 2, correct: true }, NOW)
      const [question] = await db.select().from(seenQuestions).where(eq(seenQuestions.userId, testPlayerId))
      await db.insert(reservations).values({
        userId: testPlayerId,
        questionId: question.questionId,
        mode: 'ascent',
        expiresAt: new Date(NOW.getTime() + 60_000),
        createdAt: NOW,
      })

      await rewindTestPlayer(db, await reload(), 1)

      expect(await db.select().from(reservations).where(eq(reservations.userId, testPlayerId))).toHaveLength(0)
    })
  })

  describe('mettre en attente', () => {
    it('ouvre une attente que le jeu sait lire', async () => {
      await sendToCooldown(db, await reload(), NOW)

      const state = await readGameState(db, await reload(), NOW)
      expect(state.phase).toBe('cooldown')
      expect(state.lives).toBe(0)
    })

    it('pose l échéance que les règles disent, jamais une durée en dur', async () => {
      await sendToCooldown(db, await reload(), NOW)

      expect((await reload()).cooldownUntil?.getTime()).toBe(NOW.getTime() + rules.cooldownMs)
    })
  })

  describe('repartir de zéro', () => {
    it('efface la partie et rend un joueur neuf', async () => {
      await advanceTestPlayer(db, await reload(), { count: 6, correct: false }, NOW)
      await grantSpell(db, await reload(), 'VITALITY', NOW)
      await sendToCooldown(db, await reload(), NOW)

      await resetTestPlayer(db, await reload(), NOW)

      const fresh = await reload()
      expect(fresh.currentFloor).toBe(1)
      expect(fresh.lives).toBe(rules.lives)
      expect(fresh.cooldownUntil).toBeNull()
      expect(fresh.floorCursor).toBe(0)
      expect(await seen()).toBe(0)
      expect(await pool()).toBe(0)
      expect(await db.select().from(inventory).where(eq(inventory.userId, testPlayerId))).toHaveLength(0)
    })

    it('ne touche pas aux autres joueurs', async () => {
      const otherId = await createPlayer(db, { discordId: 'test-2', username: 'Testeur B', isTest: true })
      await advanceTestPlayer(db, await loadPlayer(db, otherId), { count: 4, correct: true }, NOW)

      await resetTestPlayer(db, await reload(), NOW)

      const theirs = await db
        .select()
        .from(seenQuestions)
        .where(and(eq(seenQuestions.userId, otherId)))
      expect(theirs).toHaveLength(4)
    })
  })

  describe('ce que le jeu voit ensuite', () => {
    it('sert la question suivante du deck après un avancement', async () => {
      await advanceTestPlayer(db, await reload(), { count: 3, correct: true }, NOW)

      const state = await readGameState(db, await reload(), NOW)

      expect(state.phase).toBe('ascent')
      expect(state.floorSeen).toBe(3)
    })

    it('mène au palier quand tout l étage a été vu', async () => {
      await advanceTestPlayer(db, await reload(), { count: 12, correct: true }, NOW)

      expect((await readGameState(db, await reload(), NOW)).phase).toBe('floorEnd')
    })
  })

  it('refuse d agir sur un joueur qui n est pas un joueur test', async () => {
    const realId = await createPlayer(db, { discordId: '42', username: 'frodon' })

    await expect(advanceTestPlayer(db, await loadPlayer(db, realId), { count: 1, correct: true }, NOW))
      .rejects.toThrow()
    await expect(resetTestPlayer(db, await loadPlayer(db, realId), NOW)).rejects.toThrow()
  })

  describe('créer et supprimer', () => {
    let adminCookie: string
    let realId: number

    beforeEach(async () => {
      setDatabase(db)
      adminCookie = await sessionCookieFor(
        await createPlayer(db, { discordId: '999', username: 'saruman', isAdmin: true }),
      )
      realId = await createPlayer(db, { discordId: '111', username: 'frodon' })
    })

    it('refuse la création à qui n est pas admin', async () => {
      const cookie = await sessionCookieFor(realId)

      expect((await create(jsonRequest('http://test/test-players', 'POST', {}, cookie))).status).toBe(403)
    })

    it('crée un joueur test nommé et marqué', async () => {
      const created = await (await create(jsonRequest('http://test/test-players', 'POST', {}, adminCookie))).json()

      const [row] = await db.select().from(users).where(eq(users.id, created.id))
      expect(row.isTest).toBe(true)
      expect(row.isAdmin).toBe(false)
      expect(created.username).toBe(row.username)
    })

    it('donne un nom libre à chaque nouveau joueur test', async () => {
      const first = await (await create(jsonRequest('http://test/test-players', 'POST', {}, adminCookie))).json()
      const second = await (await create(jsonRequest('http://test/test-players', 'POST', {}, adminCookie))).json()

      expect(first.username).not.toBe(second.username)
    })

    it('ne rend que de quoi le nommer, pas sa ligne entière', async () => {
      const created = await (await create(jsonRequest('http://test/test-players', 'POST', {}, adminCookie))).json()

      expect(Object.keys(created).sort()).toEqual(['id', 'username'])
    })

    it('supprime un joueur test', async () => {
      const response = await remove(
        jsonRequest(`http://test/test-players/${testPlayerId}`, 'DELETE', undefined, adminCookie),
      )

      expect(response.status).toBe(200)
      expect(await db.select().from(users).where(eq(users.id, testPlayerId))).toHaveLength(0)
    })

    it('refuse de supprimer un vrai joueur', async () => {
      const response = await remove(
        jsonRequest(`http://test/test-players/${realId}`, 'DELETE', undefined, adminCookie),
      )

      expect(response.status).toBe(403)
      expect(await db.select().from(users).where(eq(users.id, realId))).toHaveLength(1)
    })

    it('refuse la suppression d un vrai joueur jusque dans la fonction qui écrit', async () => {
      // La garde vit dans l'écrivain, pas dans la seule route : un appelant
      // distrait ne doit pas pouvoir effacer un compte réel.
      const [real] = await db.select().from(users).where(eq(users.id, realId))

      await expect(deleteTestPlayer(db, real)).rejects.toThrow()
    })
  })
})
