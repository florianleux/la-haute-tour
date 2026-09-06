import { beforeEach, describe, expect, it } from 'vitest'
import { setDatabase } from '../../server/db/client'
import { recoveryQuestions, reservations } from '../../server/db/schema'
import { createPlayer, createQuestion, createTestDatabase, loadPlayer } from '../helpers/db'
import {
  apiRequest,
  installNitroGlobals,
  jsonRequest,
  mountHandler,
  mountRoute,
  sessionCookieFor,
} from '../helpers/nitro'
import type { Database } from '../../server/db/client'

installNitroGlobals()

const { default: listHandler } = await import('../../server/api/admin/players/index.get')
const { default: skipHandler } = await import('../../server/api/admin/players/[id]/skip-cooldown.post')
const { default: grantHandler } = await import('../../server/api/admin/players/[id]/grant-life.post')

const list = mountHandler('/players', listHandler)
const skip = mountRoute('post', '/players/:id/skip-cooldown', skipHandler)
const grant = mountRoute('post', '/players/:id/grant-life', grantHandler)

const HOUR_MS = 60 * 60 * 1000

/** Les handlers lisent l'horloge réelle : les échéances se posent par rapport à elle. */
const laterOn = (): Date => new Date(Date.now() + 6 * HOUR_MS)

describe('joueurs admin', () => {
  let db: Database
  let adminCookie: string
  let playerId: number

  beforeEach(async () => {
    db = await createTestDatabase()
    setDatabase(db)
    playerId = await createPlayer(db)
    adminCookie = await sessionCookieFor(
      await createPlayer(db, { discordId: '999', username: 'saruman', isAdmin: true }),
    )
  })

  it('reste fermé sans session, et à un joueur ordinaire', async () => {
    expect((await list(apiRequest('http://test/players'))).status).toBe(401)

    const cookie = await sessionCookieFor(playerId)
    expect((await list(apiRequest('http://test/players', cookie))).status).toBe(403)
    expect((await skip(jsonRequest(
      `http://test/players/${playerId}/skip-cooldown`,
      'POST',
      undefined,
      cookie,
    ))).status).toBe(403)
  })

  it('liste les joueurs pour l admin', async () => {
    const response = await list(apiRequest('http://test/players', adminCookie))

    expect(response.status).toBe(200)
    expect((await response.json()).players.map((card: { username: string }) => card.username))
      .toEqual(['gandalf', 'saruman'])
  })

  it('refuse un joueur qui n existe pas', async () => {
    const response = await grant(jsonRequest(
      'http://test/players/4242/grant-life',
      'POST',
      undefined,
      adminCookie,
    ))

    expect(response.status).toBe(404)
  })

  // Un identifiant qui ne peut désigner personne est une erreur du client, pas
  // une cible introuvable : le 400 ne se déguise pas en 404. Même règle que pour
  // les gestes sur un joueur test — il n'y a qu'une lecture d'identifiant.
  it.each(['0', '-3', 'gandalf'])('refuse l identifiant %s en 400', async (id) => {
    const response = await grant(jsonRequest(
      `http://test/players/${id}/grant-life`,
      'POST',
      undefined,
      adminCookie,
    ))

    expect(response.status).toBe(400)
  })

  it('passer l attente laisse une échéance dépassée, jamais nulle', async () => {
    const waiting = await createPlayer(db, {
      discordId: '555',
      username: 'radagast',
      lives: 0,
      cooldownUntil: laterOn(),
    })

    const response = await skip(jsonRequest(
      `http://test/players/${waiting}/skip-cooldown`,
      'POST',
      undefined,
      adminCookie,
    ))

    expect(response.status).toBe(200)
    const player = await loadPlayer(db, waiting)
    // Non nulle : c'est elle, dépassée, qui autorise la lecture suivante à rendre
    // les vies quand le Pool Échecs est trop petit pour un rattrapage.
    expect(player.cooldownUntil).not.toBeNull()
    expect(player.cooldownUntil!.getTime()).toBeLessThanOrEqual(Date.now())
    expect(player.lives).toBe(0)
  })

  it('rendre une vie en ajoute une au joueur qui en avait', async () => {
    await grant(jsonRequest(
      `http://test/players/${playerId}/grant-life`,
      'POST',
      undefined,
      adminCookie,
    ))

    expect((await loadPlayer(db, playerId)).lives).toBe(4)
  })

  it('rendre une vie à zéro vie annule l attente et le rattrapage tiré', async () => {
    const questionId = await createQuestion(db)
    const stuck = await createPlayer(db, {
      discordId: '777',
      username: 'radagast',
      lives: 0,
      cooldownUntil: laterOn(),
    })
    await db.insert(recoveryQuestions).values({ userId: stuck, questionId, position: 1 })
    await db.insert(reservations).values({
      userId: stuck,
      questionId,
      mode: 'recovery',
      expiresAt: laterOn(),
    })

    await grant(jsonRequest(
      `http://test/players/${stuck}/grant-life`,
      'POST',
      undefined,
      adminCookie,
    ))

    const player = await loadPlayer(db, stuck)
    expect(player).toMatchObject({ lives: 1, cooldownUntil: null })
    expect(await db.select().from(recoveryQuestions)).toHaveLength(0)
    expect(await db.select().from(reservations)).toHaveLength(0)
  })
})
