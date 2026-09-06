import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { setDatabase } from '../../server/db/client'
import { pendingDisputes } from '../../server/utils/disputes'
import { focusLossTally } from '../../server/utils/focus'
import { playerRoster } from '../../server/utils/players'
import { disputes, focusLosses, users } from '../../server/db/schema'
import { createPlayer, createQuestion, createTestDatabase, markSeen } from '../helpers/db'
import {
  apiRequest,
  installNitroGlobals,
  jsonRequest,
  mountHandler,
  sessionCookieFor,
} from '../helpers/nitro'
import type { Database } from '../../server/db/client'

installNitroGlobals()

const { default: impersonateHandler } = await import('../../server/api/admin/impersonate.post')
const { default: meHandler } = await import('../../server/api/auth/me.get')
const { default: stateHandler } = await import('../../server/api/game/state.get')

const impersonate = mountHandler('/impersonate', impersonateHandler)
const me = mountHandler('/me', meHandler)
const state = mountHandler('/state', stateHandler)

describe('incarnation d un joueur test', () => {
  let db: Database
  let adminId: number
  let playerId: number
  let testPlayerId: number

  beforeEach(async () => {
    db = await createTestDatabase()
    setDatabase(db)
    await createQuestion(db)
    adminId = await createPlayer(db, { discordId: '999', username: 'saruman', isAdmin: true })
    playerId = await createPlayer(db, { discordId: '111', username: 'frodon' })
    testPlayerId = await createPlayer(db, { discordId: 'test-1', username: 'Testeur A', isTest: true })
  })

  describe('la bascule', () => {
    it('refuse tout sans session', async () => {
      const response = await impersonate(jsonRequest('http://test/impersonate', 'POST', { userId: null }))

      expect(response.status).toBe(401)
    })

    it('refuse un joueur qui n est pas admin', async () => {
      const cookie = await sessionCookieFor(playerId)

      const response = await impersonate(
        jsonRequest('http://test/impersonate', 'POST', { userId: testPlayerId }, cookie),
      )

      expect(response.status).toBe(403)
    })

    it('refuse d incarner un vrai joueur', async () => {
      const cookie = await sessionCookieFor(adminId)

      const response = await impersonate(
        jsonRequest('http://test/impersonate', 'POST', { userId: playerId }, cookie),
      )

      expect(response.status).toBe(403)
    })

    it('accepte un joueur test', async () => {
      const cookie = await sessionCookieFor(adminId)

      const response = await impersonate(
        jsonRequest('http://test/impersonate', 'POST', { userId: testPlayerId }, cookie),
      )

      expect(response.status).toBe(200)
    })
  })

  describe('ce que chacun voit pendant l incarnation', () => {
    it('rend le joueur test au jeu, et l admin aux gardes admin', async () => {
      const cookie = await sessionCookieFor(adminId, testPlayerId)

      // Le jeu ne voit que le testeur…
      const identity = await (await me(apiRequest('http://test/me', cookie))).json()
      expect(identity.user).toMatchObject({ id: testPlayerId, username: 'Testeur A', isAdmin: false })

      // …et l'admin garde ses droits, sinon il ne pourrait plus redevenir
      // lui-même : c'est le même endpoint admin qui met fin à l'incarnation.
      const back = await impersonate(
        jsonRequest('http://test/impersonate', 'POST', { userId: null }, cookie),
      )
      expect(back.status).toBe(200)
    })

    it('dit à l écran qui incarne, pour qu il puisse revenir', async () => {
      const cookie = await sessionCookieFor(adminId, testPlayerId)

      const identity = await (await me(apiRequest('http://test/me', cookie))).json()

      expect(identity.impersonator).toMatchObject({ id: adminId, isAdmin: true })
    })

    it('ne porte aucun incarnateur quand l admin est lui-même', async () => {
      const cookie = await sessionCookieFor(adminId)

      const identity = await (await me(apiRequest('http://test/me', cookie))).json()

      expect(identity.user).toMatchObject({ id: adminId, isAdmin: true })
      expect(identity.impersonator).toBeNull()
    })

    it('propose les joueurs test à l admin, et à lui seul', async () => {
      const asAdmin = await (await me(apiRequest('http://test/me', await sessionCookieFor(adminId)))).json()
      const asPlayer = await (await me(apiRequest('http://test/me', await sessionCookieFor(playerId)))).json()

      expect(asAdmin.testPlayers).toMatchObject([{ id: testPlayerId, username: 'Testeur A' }])
      expect(asPlayer.testPlayers).toEqual([])
    })

    it('sert au jeu la partie du joueur test, pas celle de l admin', async () => {
      await db.update(users).set({ lives: 1 }).where(eq(users.id, testPlayerId))
      const cookie = await sessionCookieFor(adminId, testPlayerId)

      const game = await (await state(apiRequest('http://test/state', cookie))).json()

      expect(game.lives).toBe(1)
    })
  })

  describe('une incarnation qui n a plus lieu d être', () => {
    it('ignore une cible qui n est pas un joueur test', async () => {
      const cookie = await sessionCookieFor(adminId, playerId)

      const identity = await (await me(apiRequest('http://test/me', cookie))).json()

      expect(identity.user).toMatchObject({ id: adminId })
      expect(identity.impersonator).toBeNull()
    })

    it('ignore une cible supprimée entre-temps', async () => {
      const cookie = await sessionCookieFor(adminId, testPlayerId)
      await db.delete(users).where(eq(users.id, testPlayerId))

      const identity = await (await me(apiRequest('http://test/me', cookie))).json()

      expect(identity.user).toMatchObject({ id: adminId })
    })

    it('n incarne personne quand c est un joueur qui porte le champ', async () => {
      const cookie = await sessionCookieFor(playerId, testPlayerId)

      const identity = await (await me(apiRequest('http://test/me', cookie))).json()

      expect(identity.user).toMatchObject({ id: playerId })
    })
  })

  describe('le monde scellé', () => {
    it('tient les joueurs test hors de la file de contestation', async () => {
      const questionId = await createQuestion(db, { statement: 'Ratée ?', accepted: ['oui'] })
      for (const userId of [playerId, testPlayerId]) {
        await markSeen(db, userId, questionId, { floor: 1, correct: false, submittedAnswer: 'non' })
        await db.insert(disputes).values({ userId, questionId, status: 'pending' })
      }

      const queue = await pendingDisputes(db)

      expect(queue.map(entry => entry.username)).toEqual(['frodon'])
    })

    it('tient les joueurs test hors des flags de triche', async () => {
      const questionId = await createQuestion(db, { statement: 'Perdue ?', accepted: ['oui'] })
      for (const userId of [playerId, testPlayerId]) {
        await db.insert(focusLosses).values({ userId, questionId, mode: 'ascent', lostAt: new Date() })
      }

      const tally = await focusLossTally(db)

      expect(tally.map(entry => entry.username)).toEqual(['frodon'])
    })

    it('tient les joueurs test hors des fiches joueurs', async () => {
      const roster = await playerRoster(db, new Date())

      expect(roster.map(card => card.username)).not.toContain('Testeur A')
    })
  })

})
