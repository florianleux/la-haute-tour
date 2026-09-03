import { beforeEach, describe, expect, it } from 'vitest'
import { setDatabase } from '../../server/db/client'
import { whitelist } from '../../server/db/schema'
import { createPlayer, createTestDatabase } from '../helpers/db'
import { apiRequest, installNitroGlobals, mountHandler, sessionCookieFor } from '../helpers/nitro'
import type { Database } from '../../server/db/client'

installNitroGlobals()

const { default: listHandler } = await import('../../server/api/admin/whitelist.get')
const { default: addHandler } = await import('../../server/api/admin/whitelist.post')

const list = mountHandler('/whitelist', listHandler)
const add = mountHandler('/whitelist', addHandler)

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

describe('whitelist admin', () => {
  let db: Database
  let adminCookie: string

  beforeEach(async () => {
    db = await createTestDatabase()
    setDatabase(db)
    adminCookie = await sessionCookieFor(await createPlayer(db, { isAdmin: true }))
  })

  async function playerCookie(): Promise<string> {
    const id = await createPlayer(db, { discordId: '987654321', username: 'frodo' })
    return sessionCookieFor(id)
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
    const { entries } = await response.json()
    expect(entries).toEqual([
      { discordId: '222', createdAt: '2026-09-02T10:00:00.000Z' },
      { discordId: '111', createdAt: '2026-09-01T10:00:00.000Z' },
    ])
  })

  it('refuse l ajout à un joueur sans le flag admin', async () => {
    const response = await add(addRequest({ discordId: '111' }, await playerCookie()))

    expect(response.status).toBe(403)
    expect(await db.select().from(whitelist)).toHaveLength(0)
  })

  it('ajoute un Discord ID', async () => {
    const response = await add(addRequest({ discordId: '111' }, adminCookie))

    expect(response.status).toBe(200)
    expect(await db.select().from(whitelist)).toMatchObject([{ discordId: '111' }])
  })

  it('ne crée pas de doublon pour un ID déjà présent', async () => {
    await add(addRequest({ discordId: '111' }, adminCookie))

    const response = await add(addRequest({ discordId: '111' }, adminCookie))

    expect(response.status).toBe(200)
    expect(await db.select().from(whitelist)).toHaveLength(1)
  })

  it('rejette un Discord ID vide', async () => {
    const response = await add(addRequest({ discordId: '  ' }, adminCookie))

    expect(response.status).toBe(400)
    expect(await db.select().from(whitelist)).toHaveLength(0)
  })

  it('rejette ce qui n est pas un Discord ID : un pseudo n aurait jamais matché', async () => {
    const response = await add(addRequest({ discordId: '@gandalf' }, adminCookie))

    expect(response.status).toBe(400)
    expect(await db.select().from(whitelist)).toHaveLength(0)
  })
})
