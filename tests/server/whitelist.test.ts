import { beforeEach, describe, expect, it } from 'vitest'
import { setDatabase } from '../../server/db/client'
import { whitelist } from '../../server/db/schema'
import { createPlayer, createTestDatabase, loadPlayer } from '../helpers/db'
import {
  apiRequest,
  installNitroGlobals,
  mountHandler,
  mountRoute,
  sessionCookieFor,
} from '../helpers/nitro'
import type { Database } from '../../server/db/client'

installNitroGlobals()

const { default: listHandler } = await import('../../server/api/admin/whitelist/index.get')
const { default: addHandler } = await import('../../server/api/admin/whitelist/index.post')
const { default: dropHandler } = await import('../../server/api/admin/whitelist/[discordId].delete')
const { default: meHandler } = await import('../../server/api/auth/me.get')

const list = mountHandler('/whitelist', listHandler)
const add = mountHandler('/whitelist', addHandler)
const drop = mountRoute('delete', '/whitelist/:discordId', dropHandler)
const me = mountHandler('/me', meHandler)

const ADMIN_ID = '111000111'
const PLAYER_ID = '987654321'

function addRequest(body: unknown, cookie?: string): Request {
  return new Request('http://test/whitelist', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  })
}

function dropRequest(discordId: string, cookie?: string): Request {
  return new Request(`http://test/whitelist/${discordId}`, {
    method: 'DELETE',
    headers: cookie ? { cookie } : {},
  })
}

describe('whitelist admin', () => {
  let db: Database
  let adminCookie: string

  beforeEach(async () => {
    db = await createTestDatabase()
    setDatabase(db)
    adminCookie = await sessionCookieFor(
      await createPlayer(db, { discordId: ADMIN_ID, isAdmin: true }),
    )
  })

  async function playerCookie(): Promise<string> {
    const id = await createPlayer(db, { discordId: PLAYER_ID, username: 'frodo' })
    return sessionCookieFor(id)
  }

  /**
   * Les Discord ID invités, ceux des comptes que le test monte exclus : un joueur
   * réel est dans la whitelist parce qu'il y est passé, pas parce que l'endpoint
   * l'y a mis. Voir tests/helpers/db.ts, createPlayer().
   */
  async function invited(): Promise<string[]> {
    const rows = await db.select().from(whitelist)

    return rows
      .map(row => row.discordId)
      .filter(id => id !== ADMIN_ID && id !== PLAYER_ID)
  }

  it('refuse la lecture sans session', async () => {
    const response = await list(apiRequest('http://test/whitelist'))

    expect(response.status).toBe(401)
  })

  it('refuse la lecture à un joueur sans le flag admin', async () => {
    const response = await list(apiRequest('http://test/whitelist', await playerCookie()))

    expect(response.status).toBe(403)
  })

  it('liste les Discord IDs autorisés, le dernier ajouté en tête', async () => {
    await db.insert(whitelist).values([
      { discordId: '111', createdAt: new Date('2026-09-01T10:00:00.000Z') },
      { discordId: '222', createdAt: new Date('2026-09-02T10:00:00.000Z') },
    ])

    const response = await list(apiRequest('http://test/whitelist', adminCookie))

    expect(response.status).toBe(200)
    const { entries } = await response.json() as { entries: { discordId: string }[] }
    expect(entries.filter(entry => entry.discordId !== ADMIN_ID)).toEqual([
      { discordId: '222', team: null, createdAt: '2026-09-02T10:00:00.000Z' },
      { discordId: '111', team: null, createdAt: '2026-09-01T10:00:00.000Z' },
    ])
  })

  it('refuse l ajout à un joueur sans le flag admin', async () => {
    const response = await add(addRequest({ discordId: '111', team: 'MIDI' }, await playerCookie()))

    expect(response.status).toBe(403)
    expect(await invited()).toEqual([])
  })

  it('ajoute un Discord ID', async () => {
    const response = await add(addRequest({ discordId: '111', team: 'MIDI' }, adminCookie))

    expect(response.status).toBe(200)
    expect(await invited()).toEqual(['111'])
  })

  it('ne crée pas de doublon pour un ID déjà présent', async () => {
    await add(addRequest({ discordId: '111', team: 'MIDI' }, adminCookie))

    const response = await add(addRequest({ discordId: '111', team: 'MIDI' }, adminCookie))

    expect(response.status).toBe(200)
    expect(await invited()).toEqual(['111'])
  })

  it('rejette un Discord ID vide', async () => {
    const response = await add(addRequest({ discordId: '  ', team: 'MIDI' }, adminCookie))

    expect(response.status).toBe(400)
    expect(await invited()).toEqual([])
  })

  it('rejette un ajout sans équipe : un joueur invité a toujours sa guilde', async () => {
    const response = await add(addRequest({ discordId: '111' }, adminCookie))

    expect(response.status).toBe(400)
    expect(await invited()).toEqual([])
  })

  it('rejette ce qui n est pas un Discord ID : un pseudo n aurait jamais matché', async () => {
    const response = await add(addRequest({ discordId: '@gandalf', team: 'MIDI' }, adminCookie))

    expect(response.status).toBe(400)
    expect(await invited()).toEqual([])
  })

  describe('retrait', () => {
    it('reste fermé sans session, et à un joueur ordinaire', async () => {
      await add(addRequest({ discordId: '111', team: 'MIDI' }, adminCookie))

      expect((await drop(dropRequest('111'))).status).toBe(401)
      expect((await drop(dropRequest('111', await playerCookie()))).status).toBe(403)
      expect(await invited()).toEqual(['111'])
    })

    it('retire un Discord ID de la liste', async () => {
      await add(addRequest({ discordId: '111', team: 'MIDI' }, adminCookie))

      const response = await drop(dropRequest('111', adminCookie))

      expect(response.status).toBe(200)
      expect(await invited()).toEqual([])
    })

    it('répond 404 sur un ID que la liste ne porte pas', async () => {
      const response = await drop(dropRequest('404404404', adminCookie))

      expect(response.status).toBe(404)
    })

    it('refuse à l admin de se retirer lui-même : il se verrouillerait dehors', async () => {
      const response = await drop(dropRequest(ADMIN_ID, adminCookie))

      expect(response.status).toBe(409)

      const stillThere = await db.select().from(whitelist)
      expect(stillThere.map(row => row.discordId)).toContain(ADMIN_ID)
    })
  })
})

/**
 * Ce que le retrait ferme, et quand. La whitelist se relit à chaque requête et
 * pas seulement à la connexion : sans ça, une session d'un an survivrait à la
 * désinvitation. Voir server/utils/auth.ts, loadUser().
 */
describe('accès après retrait de la whitelist', () => {
  let db: Database
  let playerId: number
  let cookie: string

  beforeEach(async () => {
    db = await createTestDatabase()
    setDatabase(db)
    playerId = await createPlayer(db, { discordId: PLAYER_ID, currentFloor: 4, lives: 2 })
    cookie = await sessionCookieFor(playerId)
  })

  async function servedUserId(sessionCookie: string): Promise<number | null> {
    const response = await me(apiRequest('http://test/me', sessionCookie))
    const { user } = await response.json() as { user: { id: number } | null }

    return user?.id ?? null
  }

  it('sert le joueur tant qu il est invité', async () => {
    expect(await servedUserId(cookie)).toBe(playerId)
  })

  it('ne sert plus le joueur retiré, avec la session qu il avait déjà', async () => {
    await db.delete(whitelist)

    expect(await servedUserId(cookie)).toBeNull()
  })

  it('le ré-invite sur sa partie intacte', async () => {
    await db.delete(whitelist)
    await db.insert(whitelist).values({ discordId: PLAYER_ID })

    expect(await servedUserId(cookie)).toBe(playerId)

    const player = await loadPlayer(db, playerId)
    expect(player.currentFloor).toBe(4)
    expect(player.lives).toBe(2)
  })

  it('sert un joueur test, qu aucune whitelist ne portera jamais', async () => {
    // Son identifiant est synthétique : le chercher dans la whitelist ferait
    // tomber l'incarnation, qui passe par le même chargement.
    const adminId = await createPlayer(db, { discordId: '111000111', isAdmin: true })
    const testPlayerId = await createPlayer(db, {
      discordId: 'test-abc',
      username: 'Testeur A',
      isTest: true,
    })

    expect(await servedUserId(await sessionCookieFor(adminId, testPlayerId))).toBe(testPlayerId)
  })
})
