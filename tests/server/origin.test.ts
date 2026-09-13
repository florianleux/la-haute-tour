import { createApp, createRouter, defineEventHandler, toWebHandler } from 'h3'
import { beforeEach, describe, expect, it } from 'vitest'
import { setDatabase } from '../../server/db/client'
import { isForeignOrigin } from '../../server/utils/origin'
import { createPlayer, createTestDatabase, loadPlayer } from '../helpers/db'
import { installNitroGlobals, sessionCookieFor } from '../helpers/nitro'
import type { Database } from '../../server/db/client'

installNitroGlobals()

const { default: originGuard } = await import('../../server/middleware/origin')
const { default: resetHandler } = await import('../../server/api/admin/players/[id]/reset.post')

const SITE = 'http://test'

/**
 * Le garde-fou suivi d'un endroit où écrire. Le middleware passe avant la route,
 * comme Nitro le pose : ce qui est refusé n'atteint pas le handler.
 */
function guarded(): (request: Request) => Promise<Response> {
  const router = createRouter()
  router.post('/players/:id/reset', resetHandler)
  router.post('/echo', defineEventHandler(() => ({ written: true })))
  router.get('/echo', defineEventHandler(() => ({ read: true })))

  const app = createApp()
  app.use(originGuard)
  app.use(router)

  return toWebHandler(app)
}

function request(method: 'GET' | 'POST', path: string, origin?: string, cookie?: string): Request {
  return new Request(`${SITE}${path}`, {
    method,
    headers: {
      // Un client réel le pose toujours ; sans lui h3 retombe sur `localhost`,
      // et le test mesurerait cette retombée plutôt que la règle.
      host: 'test',
      ...(origin ? { origin } : {}),
      ...(cookie ? { cookie } : {}),
    },
  })
}

describe('origine d\'une requête', () => {
  it('laisse passer ce qui n\'écrit pas, d\'où que ça vienne', () => {
    // Le retour OAuth de Discord est exactement ce cas-là.
    expect(isForeignOrigin('GET', 'https://discord.com', 'test')).toBe(false)
    expect(isForeignOrigin('HEAD', 'https://ailleurs.example', 'test')).toBe(false)
    expect(isForeignOrigin('OPTIONS', 'https://ailleurs.example', 'test')).toBe(false)
  })

  it('refuse une écriture annoncée depuis un autre hôte', () => {
    expect(isForeignOrigin('POST', 'https://ailleurs.example', 'test')).toBe(true)
    expect(isForeignOrigin('PUT', 'https://ailleurs.example', 'test')).toBe(true)
    expect(isForeignOrigin('DELETE', 'https://ailleurs.example', 'test')).toBe(true)
  })

  it('accepte une écriture annoncée depuis le site', () => {
    expect(isForeignOrigin('POST', 'https://test', 'test')).toBe(false)
    expect(isForeignOrigin('POST', 'http://test', 'test')).toBe(false)
  })

  it('compte le port dans l\'hôte', () => {
    expect(isForeignOrigin('POST', 'http://test:3001', 'test:3000')).toBe(true)
    expect(isForeignOrigin('POST', 'http://test:3000', 'test:3000')).toBe(false)
  })

  it('laisse passer une écriture qui n\'annonce rien', () => {
    // Aucun navigateur n'omet l'en-tête sur une écriture : ce qui reste est un
    // client sans cookie de victime à détourner.
    expect(isForeignOrigin('POST', undefined, 'test')).toBe(false)
  })

  it('refuse une origine opaque', () => {
    // `null` est ce qu'envoie une iframe bac à sable ou un document `data:`.
    expect(isForeignOrigin('POST', 'null', 'test')).toBe(true)
  })
})

describe('garde-fou d\'origine', () => {
  let db: Database
  let adminCookie: string
  let playerId: number

  beforeEach(async () => {
    db = await createTestDatabase()
    setDatabase(db)
    playerId = await createPlayer(db, { currentFloor: 4, lives: 1 })
    adminCookie = await sessionCookieFor(
      await createPlayer(db, { discordId: '999', username: 'saruman', isAdmin: true }),
    )
  })

  it('refuse une écriture venue d\'ailleurs sans que le handler l\'apprenne', async () => {
    const response = await guarded()(
      request('POST', `/players/${playerId}/reset`, 'https://ailleurs.example', adminCookie),
    )

    expect(response.status).toBe(403)

    // Le geste n'a pas eu lieu : c'est ça qu'on protège, pas le code de retour.
    const player = await loadPlayer(db, playerId)
    expect(player.currentFloor).toBe(4)
    expect(player.lives).toBe(1)
  })

  it('laisse l\'écriture du site aboutir', async () => {
    const response = await guarded()(
      request('POST', `/players/${playerId}/reset`, SITE, adminCookie),
    )

    expect(response.status).toBe(200)
    expect((await loadPlayer(db, playerId)).currentFloor).toBe(1)
  })

  it('laisse passer une lecture venue d\'ailleurs', async () => {
    const response = await guarded()(request('GET', '/echo', 'https://discord.com'))

    expect(response.status).toBe(200)
  })

  it('laisse passer une écriture sans en-tête d\'origine', async () => {
    const response = await guarded()(request('POST', '/echo'))

    expect(response.status).toBe(200)
  })

  it('prend l\'hôte du proxy, pas celui de l\'en-tête brut', async () => {
    // En prod Netlify sert derrière un proxy : le `host` brut ne porte pas le
    // domaine public, et le lire ferait tout refuser.
    const response = await guarded()(new Request(`${SITE}/echo`, {
      method: 'POST',
      headers: {
        'host': 'interne.netlify',
        'x-forwarded-host': 'lahautetour.example',
        'origin': 'https://lahautetour.example',
      },
    }))

    expect(response.status).toBe(200)
  })
})
