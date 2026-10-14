import { beforeEach, describe, expect, it } from 'vitest'
import { setDatabase } from '../../server/db/client'
import { inventory } from '../../server/db/schema'
import { readGameState, readMissedPool, readQuestionLog, serveNextQuestion, submitAnswer } from '../../server/utils/game'
import { castFromInventory, readInventory } from '../../server/utils/inventory'
import { createPlayer, createQuestion, createTestDatabase, loadPlayer } from '../helpers/db'
import { installNitroGlobals } from '../helpers/nitro'
import type { Database } from '../../server/db/client'
import type { User } from '../../server/db/schema'

installNitroGlobals()

/**
 * La base est distante en production : chaque aller-retour réseau est mesuré à
 * ~135 ms. Ces budgets empêchent un N+1 de revenir s'installer sur les chemins
 * que le joueur emprunte à chaque question.
 *
 * On compte les allers-retours, pas les requêtes : un lot en fait un seul, quel
 * que soit le nombre de requêtes qu'il transporte, et c'est ce qui se paie.
 */
function countQueries(db: Database): () => number {
  let count = 0
  // Le client libSQL sous Drizzle : c'est lui qui part sur le réseau, une fois
  // par `execute` et une fois par `batch`, quel que soit le contenu du lot.
  const client = (db as unknown as { $client: Record<'execute' | 'batch', (...args: unknown[]) => unknown> }).$client

  for (const method of ['execute', 'batch'] as const) {
    const original = client[method].bind(client)
    Object.assign(client, {
      [method]: (...args: unknown[]) => {
        count++
        return original(...args)
      },
    })
  }

  return () => {
    const seen = count
    count = 0
    return seen
  }
}

/**
 * Le SQL réellement parti, mis à plat. Les allers-retours disent la latence ;
 * ceci dit la facture — la base compte les **lignes lues**, et un `count(*)`
 * parcourt tout ce qu'il compte.
 */
function captureSql(db: Database): () => string {
  const statements: string[] = []
  const client = (db as unknown as { $client: Record<'execute' | 'batch', (...args: unknown[]) => unknown> }).$client

  const record = (arg: unknown): void => {
    if (Array.isArray(arg)) {
      arg.forEach(record)
      return
    }
    if (typeof arg === 'string') {
      statements.push(arg)
      return
    }
    const sql = (arg as { sql?: unknown })?.sql
    if (typeof sql === 'string') {
      statements.push(sql)
    }
  }

  for (const method of ['execute', 'batch'] as const) {
    const original = client[method].bind(client)
    Object.assign(client, {
      [method]: (...args: unknown[]) => {
        args.forEach(record)
        return original(...args)
      },
    })
  }

  return () => {
    const seen = statements.join('\n').toLowerCase()
    statements.length = 0
    return seen
  }
}

const NOW = new Date('2026-09-03T12:00:00.000Z')

describe('budget de requêtes des chemins chauds', () => {
  let db: Database
  let player: User
  let queries: () => number

  beforeEach(async () => {
    db = await createTestDatabase()
    const id = await createPlayer(db)
    for (let i = 0; i < 5; i++) {
      await createQuestion(db, { statement: `Question ${i} ?`, accepted: ['Bordeaux'] })
    }
    player = await loadPlayer(db, id)
    queries = countQueries(db)
  })

  it('lit l état de jeu en deux requêtes', async () => {
    await serveNextQuestion(db, player, NOW)
    queries()

    await readGameState(db, player, NOW)

    expect(queries()).toBeLessThanOrEqual(2)
  })

  it('sert la question suivante sans relire ce qu elle vient d écrire', async () => {
    await serveNextQuestion(db, player, NOW)
    await submitAnswer(db, player, 'Bordeaux', NOW)
    queries()

    await serveNextQuestion(db, player, NOW)

    expect(queries()).toBeLessThanOrEqual(5)
  })

  it('résout une réponse sans relire l état', async () => {
    await serveNextQuestion(db, player, NOW)
    queries()

    await submitAnswer(db, player, 'Toulouse', NOW)

    expect(queries()).toBeLessThanOrEqual(7)
  })

  /**
   * La page Sorts n'est pas un chemin chaud — on l'ouvre en attente, pas à
   * chaque question — mais elle affiche trois listes, et trois listes servies
   * l'une après l'autre feraient trois allers-retours de plus qu'il n'en faut.
   * Le lancer, lui, tire une cible : ce tirage doit rester une requête, jamais
   * une par joueur de l'équipe. Voir specs/bonus.md#tirage-de-la-cible.
   */
  // Une page du Volumen se lit à chaque clic de pagination : la page et son
  // total partent dans le même lot. Voir specs/ecrans.md#volumen.
  it('lit une page du Volumen en un aller-retour, total compris', async () => {
    await readMissedPool(db, player, { limit: 20, offset: 0 })
    expect(queries()).toBe(1)

    await readQuestionLog(db, player, { limit: 20, offset: 0, filter: 'all' })
    expect(queries()).toBe(1)
  })

  // Le total d'un onglet ne bouge pas d'une page à l'autre : il se compte en
  // page 1, l'écran le garde ensuite. Compter, c'est lire chaque ligne comptée —
  // tout ce que le joueur a vu, à chaque clic. Voir specs/ecrans.md#volumen.
  it('ne recompte pas le Volumen au-delà de la première page', async () => {
    const counting = /count\(\*\)/
    const sql = captureSql(db)

    sql()
    await readQuestionLog(db, player, { limit: 20, offset: 0, filter: 'all' })
    expect(sql()).toMatch(counting)

    const later = await readQuestionLog(db, player, { limit: 20, offset: 20, filter: 'all' })
    const missed = await readMissedPool(db, player, { limit: 20, offset: 20 })
    expect(sql()).not.toMatch(counting)
    expect(later.total).toBeNull()
    expect(missed.total).toBeNull()
  })

  describe('la page Sorts et le lancer', () => {
    const IN_COOLDOWN = { lives: 0, cooldownUntil: new Date(NOW.getTime() + 60_000) }

    beforeEach(async () => {
      setDatabase(db)
    })

    /** Un joueur en attente, avec des coéquipiers et des adversaires à toucher. */
    async function caster(): Promise<User> {
      const id = await createPlayer(db, { ...IN_COOLDOWN, discordId: 'caster', team: 'TLM', floorSeen: 1 })

      for (let i = 0; i < 6; i++) {
        await createPlayer(db, {
          discordId: `mate-${i}`,
          username: `mate-${i}`,
          team: i % 2 === 0 ? 'TLM' : 'MIDI',
          floorSeen: 1,
        })
      }

      await db.insert(inventory).values([
        { userId: id, spell: 'VITALITY' as const, obtainedAt: NOW },
        { userId: id, spell: 'VITALITY' as const, obtainedAt: NOW },
      ])

      return loadPlayer(db, id)
    }

    it('ouvre la page en trois allers-retours, quoi qu elle affiche', async () => {
      const player = await caster()
      queries()

      await readInventory(db, player, NOW)

      expect(queries()).toBeLessThanOrEqual(3)
    })

    it('ne paie pas le tirage à la cible : le pool tient en une requête', async () => {
      const player = await caster()
      queries()

      await castFromInventory(db, player, 'VITALITY', 'ally', NOW)

      // Phase, inventaire lu, exemplaire consommé, cible tirée, saturés écartés,
      // effet posé, puis la page rendue. Une cible de plus dans l'équipe n'en
      // ajoute aucun.
      expect(queries()).toBeLessThanOrEqual(8)
    })

    // Le tirage écarte les saturés, d'effets négatifs chez l'ennemi comme de
    // positifs chez l'allié : ce filtre est une requête pour tout le pool,
    // jamais une par cible. Voir specs/bonus.md#limite-deffets-négatifs et
    // specs/bonus.md#limite-deffets-positifs.
    it('ne paie pas le filtre des saturés à la cible', async () => {
      const player = await caster()
      queries()

      await castFromInventory(db, player, 'VITALITY', 'foe', NOW)

      expect(queries()).toBeLessThanOrEqual(8)
    })
  })

  /**
   * Le cœur du problème : servir une question ne doit rien compter. Un
   * `count(*)` parcourt les lignes qu'il compte — l'étage entier pour sa taille,
   * tout ce que le joueur a déjà vu pour sa progression — et la base facture
   * chacune. Ces trois nombres-là sont portés, jamais comptés.
   * Voir server/db/schema.ts et server/utils/deck.ts.
   */
  describe('ne compte rien sur le chemin du joueur', () => {
    const counting = /count\(\*\)\s+from\s+["`']?(questions|seen_questions)/
    // Le palmarès se lit sur le joueur, jamais dans la table : une ligne par
    // succès acquis, à chaque requête, se payait jusque sur les chemins qui
    // n'attribuent rien. L'écriture d'un succès neuf, elle, a le droit de
    // partir — ce qu'on refuse ici est la lecture. Voir server/db/schema.ts.
    const selectsAchievements = /select[^;]*from\s+["`']?achievements/

    it('en servant la question suivante', async () => {
      const sql = captureSql(db)
      sql()

      await serveNextQuestion(db, player, NOW)

      const seen = sql()
      expect(seen).toContain('select')
      expect(seen).not.toMatch(counting)
      expect(seen).not.toMatch(selectsAchievements)
    })

    it('en lisant l état de jeu', async () => {
      await serveNextQuestion(db, player, NOW)
      const sql = captureSql(db)
      sql()

      await readGameState(db, await loadPlayer(db, player.id), NOW)

      const seen = sql()
      expect(seen).not.toMatch(counting)
      expect(seen).not.toMatch(selectsAchievements)
    })

    it('en résolvant une réponse', async () => {
      await serveNextQuestion(db, player, NOW)
      const fresh = await loadPlayer(db, player.id)
      const sql = captureSql(db)
      sql()

      await submitAnswer(db, fresh, 'Bordeaux', NOW)

      const seen = sql()
      expect(seen).not.toMatch(counting)
      expect(seen).not.toMatch(selectsAchievements)
    })
  })
})
