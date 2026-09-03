import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'
import { installAppGlobals, testAdmin, testUser } from '../helpers/app'

const { signIn, navigations, reset } = installAppGlobals()

const { default: authMiddleware } = await import('../../middleware/auth.global')

const MIDDLEWARE_DIR = fileURLToPath(new URL('../../middleware', import.meta.url))

interface RouteStub {
  meta: { public?: boolean, admin?: boolean }
}

const middleware = authMiddleware as unknown as (to: RouteStub) => Promise<unknown>

describe('middleware d authentification', () => {
  beforeEach(reset)

  it('renvoie sur la connexion quand une page fermée est atteinte sans session', async () => {
    await middleware({ meta: {} })

    expect(navigations()).toEqual(['/login'])
  })

  it('laisse passer une page ouverte sans session', async () => {
    await middleware({ meta: { public: true } })

    expect(navigations()).toEqual([])
  })

  it('laisse passer un joueur connecté sur une page fermée', async () => {
    signIn(testUser)

    await middleware({ meta: {} })

    expect(navigations()).toEqual([])
  })

  it('écarte un joueur sans le flag admin d une page admin', async () => {
    signIn(testUser)

    await middleware({ meta: { admin: true } })

    expect(navigations()).toEqual(['/'])
  })

  it('laisse passer un admin sur une page admin', async () => {
    signIn(testAdmin)

    await middleware({ meta: { admin: true } })

    expect(navigations()).toEqual([])
  })

  it('renvoie sur la connexion un visiteur anonyme sur une page admin', async () => {
    await middleware({ meta: { admin: true } })

    expect(navigations()).toEqual(['/login'])
  })

  it('tourne sur toutes les routes : Nuxt n applique que les fichiers *.global', () => {
    const globals = readdirSync(MIDDLEWARE_DIR).filter(file => file.endsWith('.global.ts'))

    expect(globals).toContain('auth.global.ts')
  })
})
