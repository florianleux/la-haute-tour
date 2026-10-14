import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { setDatabase } from '../../server/db/client'
import { inventory, recoveryQuestions, reservations } from '../../server/db/schema'
import { rulesForFloor } from '../../server/utils/rules'
import { createPlayer, createQuestion, createTestDatabase, loadPlayer } from '../helpers/db'
import { apiRequest, installNitroGlobals, jsonRequest, mountHandler, sessionCookieFor } from '../helpers/nitro'
import type { Database } from '../../server/db/client'
import type { SpellId } from '../../shared/utils/spells'

installNitroGlobals()

const { default: inventoryHandler } = await import('../../server/api/game/inventory.get')
const { default: castHandler } = await import('../../server/api/game/cast.post')

const inventoryRead = mountHandler('/inventory', inventoryHandler)
const cast = mountHandler('/cast', castHandler)

/** Un joueur en attente : c'est la seule phase où les Sorts existent. */
const IN_COOLDOWN = { lives: 0, cooldownUntil: new Date(Date.now() + 60_000) }

describe('inventaire des sorts', () => {
  let db: Database

  beforeEach(async () => {
    db = await createTestDatabase()
    setDatabase(db)
    await createQuestion(db)
  })

  /** Des coffres ouverts dans cet ordre — une seconde d'écart, comme l'horloge les compte. */
  async function loot(userId: number, ...owned: SpellId[]): Promise<void> {
    await db.insert(inventory).values(owned.map((spell, index) => ({
      userId,
      spell,
      obtainedAt: new Date((index + 1) * 1_000),
    })))
  }

  it('refuse tout sans session', async () => {
    expect((await inventoryRead(apiRequest('http://test/inventory'))).status).toBe(401)
  })

  it('liste l inventaire du joueur en attente, doublons compris', async () => {
    const userId = await createPlayer(db, IN_COOLDOWN)
    await loot(userId, 'VITALITY', 'RESPITE', 'VITALITY')

    const response = await inventoryRead(apiRequest('http://test/inventory', await sessionCookieFor(userId)))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      entries: [
        { spell: 'VITALITY', count: 2 },
        { spell: 'RESPITE', count: 1 },
      ],
      log: [],
      // Le plafond d'effets positifs voyage avec l'inventaire : l'écran éteint
      // « Sur moi » sans recompter. Voir specs/bonus.md#limite-deffets-positifs.
      canTargetSelf: true,
    })
  })

  // La page ne propose la catégorie Allié qu'à qui a une équipe : sans elle,
  // elle ne désignerait aucun pool. Voir specs/equipes.md#le-joueur-sans-équipe.
  it('dit si le joueur peut viser un allié, sans jamais dire qui', async () => {
    const alone = await createPlayer(db, IN_COOLDOWN)
    const teamed = await createPlayer(db, { ...IN_COOLDOWN, discordId: 'teamed', team: 'MIDI' })

    const withoutTeam = await inventoryRead(apiRequest('http://test/inventory', await sessionCookieFor(alone)))
    const withTeam = await inventoryRead(apiRequest('http://test/inventory', await sessionCookieFor(teamed)))

    expect((await withoutTeam.json()).canTargetOthers).toBe(false)

    // Le classement de progression ne sort jamais du serveur : la page ne porte
    // que ce qui la remplit. Voir specs/ecrans.md#ce-quaucun-écran-joueur-ne-montre.
    expect(Object.keys(await withTeam.json()).sort()).toEqual([
      'canTargetOthers',
      'canTargetSelf',
      'discovered',
      'entries',
      'log',
      'received',
    ])
  })

  it('garde l ordre du premier exemplaire obtenu, qu un doublon ne déplace pas', async () => {
    const userId = await createPlayer(db, IN_COOLDOWN)
    await loot(userId, 'RESPITE', 'VITALITY', 'VITALITY')

    const { entries } = await (await inventoryRead(apiRequest('http://test/inventory', await sessionCookieFor(userId)))).json()

    expect(entries).toEqual([
      { spell: 'RESPITE', count: 1 },
      { spell: 'VITALITY', count: 2 },
    ])
  })

  it('rend un inventaire vide plutôt que rien', async () => {
    const userId = await createPlayer(db, IN_COOLDOWN)

    const response = await inventoryRead(apiRequest('http://test/inventory', await sessionCookieFor(userId)))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ entries: [], log: [] })
  })

  it('ne montre rien à un autre joueur', async () => {
    const owner = await createPlayer(db, IN_COOLDOWN)
    const other = await createPlayer(db, { ...IN_COOLDOWN, discordId: '987654321' })
    await loot(owner, 'VITALITY')

    const response = await inventoryRead(apiRequest('http://test/inventory', await sessionCookieFor(other)))

    expect(await response.json()).toMatchObject({ entries: [], log: [] })
  })

  it('ferme la page hors attente, URL comprise', async () => {
    const userId = await createPlayer(db)
    await loot(userId, 'VITALITY')

    const response = await inventoryRead(apiRequest('http://test/inventory', await sessionCookieFor(userId)))

    expect(response.status).toBe(403)
  })

  // Le camp dure jusqu'au tirage du rattrapage : l'attente échue, le joueur
  // y est encore. Voir specs/spec.md#glossaire (Camp).
  it('la laisse ouverte après l attente, tant que le rattrapage n est pas tiré', async () => {
    const userId = await createPlayer(db, { lives: 0, cooldownUntil: new Date(Date.now() - 60_000) })

    const response = await inventoryRead(apiRequest('http://test/inventory', await sessionCookieFor(userId)))

    expect(response.status).toBe(200)
  })

  it('la ferme une fois le rattrapage tiré', async () => {
    const userId = await createPlayer(db, { lives: 0, cooldownUntil: new Date(Date.now() - 60_000) })
    const questionId = await createQuestion(db)
    await db.insert(recoveryQuestions).values({ userId, questionId, position: 0 })

    const response = await inventoryRead(apiRequest('http://test/inventory', await sessionCookieFor(userId)))

    expect(response.status).toBe(403)
  })

  // La garde lit la phase, elle ne joue pas la partie : une réservation dont le
  // chrono est tombé reste à résoudre par l'écran de jeu. Ouvrir cette page-ci ne
  // doit coûter ni vie ni question. Voir server/utils/game.ts, readPhase().
  it('ne résout pas la question expirée du joueur qui l ouvre', async () => {
    const userId = await createPlayer(db)
    const questionId = await createQuestion(db)
    await db.insert(reservations).values({
      userId,
      questionId,
      mode: 'ascent',
      expiresAt: new Date(Date.now() - 60_000),
    })

    const response = await inventoryRead(apiRequest('http://test/inventory', await sessionCookieFor(userId)))

    expect(response.status).toBe(403)
    const [held] = await db.select().from(reservations).where(eq(reservations.userId, userId))
    expect(held.resolvedAt).toBeNull()
    expect((await loadPlayer(db, userId)).lives).toBe(rulesForFloor(1).lives)
  })

  // Le pentacle montre le médaillon d'un sort déjà obtenu, même sans exemplaire
  // en poche : un sort lancé quitte l'inventaire, pas la mémoire du joueur.
  // Voir specs/ecrans.md#sorts.
  describe('sorts découverts', () => {
    async function discovered(userId: number): Promise<SpellId[]> {
      return (await (await inventoryRead(apiRequest('http://test/inventory', await sessionCookieFor(userId)))).json()).discovered
    }

    it('compte un sort en poche, dans l ordre du catalogue', async () => {
      const userId = await createPlayer(db, IN_COOLDOWN)
      await loot(userId, 'PURGE', 'VITALITY', 'PURGE')

      expect(await discovered(userId)).toEqual(['VITALITY', 'PURGE'])
    })

    it('garde un sort lancé, même sans exemplaire en poche', async () => {
      const userId = await createPlayer(db, IN_COOLDOWN)
      await loot(userId, 'RESPITE')

      const response = await cast(jsonRequest('http://test/cast', 'POST', { spell: 'RESPITE', target: 'self' }, await sessionCookieFor(userId)))

      expect((await response.json()).discovered).toEqual(['RESPITE'])
    })

    // Le lancer compte par son lanceur, quelle que soit la cible : un autre
    // joueur, ou personne quand le tirage n'a trouvé aucun allié.
    it('garde un sort lancé sur un ennemi', async () => {
      await createQuestion(db)
      const userId = await createPlayer(db, { ...IN_COOLDOWN, team: 'TLM', floorSeen: 1 })
      await createPlayer(db, { discordId: 'foe', username: 'saroumane', team: 'MIDI', floorSeen: 1 })
      await loot(userId, 'VITALITY')

      const response = await cast(jsonRequest('http://test/cast', 'POST', { spell: 'VITALITY', target: 'foe' }, await sessionCookieFor(userId)))

      expect((await response.json()).discovered).toEqual(['VITALITY'])
    })

    it('garde un sort parti sans trouver personne', async () => {
      const userId = await createPlayer(db, { ...IN_COOLDOWN, team: 'TLM' })
      await loot(userId, 'VITALITY')

      const response = await cast(jsonRequest('http://test/cast', 'POST', { spell: 'VITALITY', target: 'ally' }, await sessionCookieFor(userId)))
      const page = await response.json()

      expect(page.log).toMatchObject([{ spell: 'VITALITY', targetName: null }])
      expect(page.discovered).toEqual(['VITALITY'])
    })

    it('ne compte pas un sort jamais obtenu', async () => {
      const userId = await createPlayer(db, IN_COOLDOWN)

      expect(await discovered(userId)).toEqual([])
    })

    it('ne compte pas le lancer d un autre joueur', async () => {
      const caster = await createPlayer(db, IN_COOLDOWN)
      const other = await createPlayer(db, { ...IN_COOLDOWN, discordId: '987654321' })
      await loot(caster, 'VITALITY')
      await cast(jsonRequest('http://test/cast', 'POST', { spell: 'VITALITY', target: 'self' }, await sessionCookieFor(caster)))

      expect(await discovered(other)).toEqual([])
    })
  })

  describe('lancer', () => {
    it('refuse tout sans session', async () => {
      const response = await cast(jsonRequest('http://test/cast', 'POST', { spell: 'VITALITY', target: 'self' }))

      expect(response.status).toBe(401)
    })

    it('consomme l exemplaire et rend l inventaire à jour', async () => {
      const userId = await createPlayer(db, IN_COOLDOWN)
      const cookie = await sessionCookieFor(userId)
      await loot(userId, 'VITALITY', 'VITALITY')

      const response = await cast(jsonRequest('http://test/cast', 'POST', { spell: 'VITALITY', target: 'self' }, cookie))

      expect(response.status).toBe(200)
      const page = await response.json()
      expect(page.entries).toEqual([{ spell: 'VITALITY', count: 1 }])
      expect(page.log).toMatchObject([{ spell: 'VITALITY', face: 'boon', targetName: 'gandalf' }])
    })

    it('accepte un second lancer du même sort, et le dit dans l état rendu', async () => {
      const userId = await createPlayer(db, IN_COOLDOWN)
      const cookie = await sessionCookieFor(userId)
      await loot(userId, 'VITALITY', 'VITALITY')

      await cast(jsonRequest('http://test/cast', 'POST', { spell: 'VITALITY', target: 'self' }, cookie))
      const response = await cast(jsonRequest('http://test/cast', 'POST', { spell: 'VITALITY', target: 'self' }, cookie))

      expect(response.status).toBe(200)
      const page = await response.json()
      expect(page.entries).toEqual([])
      expect(page.log).toHaveLength(2)
      expect(page.canTargetSelf).toBe(false)
    })

    // Au plafond d'effets positifs, le sort sur soi ne part pas et l'exemplaire
    // reste en poche. Sans erreur : l'écran a déjà éteint le bouton, celui qui
    // insiste est en retard, pas fautif. Voir specs/bonus.md#limite-deffets-positifs.
    it('refuse un troisième sort sur soi sans erreur, en rendant l état courant', async () => {
      const userId = await createPlayer(db, IN_COOLDOWN)
      const cookie = await sessionCookieFor(userId)
      await loot(userId, 'VITALITY', 'VITALITY', 'RESPITE')

      await cast(jsonRequest('http://test/cast', 'POST', { spell: 'VITALITY', target: 'self' }, cookie))
      await cast(jsonRequest('http://test/cast', 'POST', { spell: 'VITALITY', target: 'self' }, cookie))
      const response = await cast(jsonRequest('http://test/cast', 'POST', { spell: 'RESPITE', target: 'self' }, cookie))

      expect(response.status).toBe(200)
      const page = await response.json()
      expect(page.entries).toEqual([{ spell: 'RESPITE', count: 1 }])
      expect(page.log).toHaveLength(2)
      expect(page.canTargetSelf).toBe(false)
    })

    it('ne lance rien hors attente, URL comprise', async () => {
      const userId = await createPlayer(db)
      const cookie = await sessionCookieFor(userId)
      await loot(userId, 'VITALITY')

      const response = await cast(jsonRequest('http://test/cast', 'POST', { spell: 'VITALITY', target: 'self' }, cookie))

      expect(response.status).toBe(403)
    })

    it('rejette une catégorie de cible qui n existe pas', async () => {
      const userId = await createPlayer(db, IN_COOLDOWN)
      const cookie = await sessionCookieFor(userId)
      await loot(userId, 'VITALITY')

      const response = await cast(jsonRequest('http://test/cast', 'POST', { spell: 'VITALITY', target: 'everyone' }, cookie))

      expect(response.status).toBe(400)
    })

    // La face suit la catégorie : noire sur un ennemi, sans que le client ait
    // rien à en dire. Voir specs/bonus.md#catégories-de-cible.
    it('applique la face noire sur un ennemi', async () => {
      await createQuestion(db)
      await createQuestion(db)
      const userId = await createPlayer(db, { ...IN_COOLDOWN, team: 'TLM', floorSeen: 1 })
      await createPlayer(db, {
        discordId: 'foe',
        username: 'saroumane',
        team: 'MIDI',
        floorSeen: 1,
      })
      const cookie = await sessionCookieFor(userId)
      await loot(userId, 'VITALITY')

      const response = await cast(jsonRequest('http://test/cast', 'POST', { spell: 'VITALITY', target: 'foe' }, cookie))

      expect(response.status).toBe(200)
      expect((await response.json()).log)
        .toMatchObject([{ spell: 'VITALITY', face: 'curse', targetName: 'saroumane' }])
    })

    it('révèle la cible tirée au retour du lancer, et la dit à la cible', async () => {
      // Un étage qui a encore de quoi jouer : sinon le palier primerait sur
      // l'attente, et la page des Sorts se fermerait.
      await createQuestion(db)
      await createQuestion(db)
      const userId = await createPlayer(db, { ...IN_COOLDOWN, team: 'TLM', floorSeen: 1 })
      const allyId = await createPlayer(db, {
        discordId: 'ally',
        username: 'samsagace',
        team: 'TLM',
        floorSeen: 1,
        ...IN_COOLDOWN,
      })
      const cookie = await sessionCookieFor(userId)
      await loot(userId, 'VITALITY')

      const response = await cast(jsonRequest('http://test/cast', 'POST', { spell: 'VITALITY', target: 'ally' }, cookie))

      expect(response.status).toBe(200)
      expect((await response.json()).log).toMatchObject([{ spell: 'VITALITY', targetName: 'samsagace' }])

      const seen = await inventoryRead(apiRequest('http://test/inventory', await sessionCookieFor(allyId)))
      expect((await seen.json()).received).toMatchObject([{ spell: 'VITALITY', casterName: 'gandalf' }])
    })

    it('rejette un sort qui n existe pas au catalogue', async () => {
      const userId = await createPlayer(db, IN_COOLDOWN)
      const cookie = await sessionCookieFor(userId)

      const response = await cast(jsonRequest('http://test/cast', 'POST', { spell: 'FIREBALL', target: 'self' }, cookie))

      expect(response.status).toBe(400)
    })
  })
})
