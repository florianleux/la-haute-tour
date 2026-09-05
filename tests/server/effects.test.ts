import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { activeEffects, inventory, users } from '../../server/db/schema'
import { anchorEffects, castSpell, effectsQuery, readCastLog, toEffectViews } from '../../server/utils/effects'
import { rulesForFloor } from '../../server/utils/rules'
import { createPlayer, createTestDatabase, loadPlayer } from '../helpers/db'
import { installNitroGlobals } from '../helpers/nitro'
import type { Database } from '../../server/db/client'
import type { SpellId } from '../../shared/utils/spells'

installNitroGlobals()

const NOW = new Date('2026-09-05T12:00:00.000Z')
const COOLDOWN_UNTIL = new Date('2026-09-06T00:00:00.000Z')
const rules = rulesForFloor(1)

describe('lancer et ancrage des effets', () => {
  let db: Database
  let userId: number

  beforeEach(async () => {
    db = await createTestDatabase()
    userId = await createPlayer(db, { lives: 0, cooldownUntil: COOLDOWN_UNTIL })
  })

  async function own(...spells: SpellId[]): Promise<void> {
    await db.insert(inventory).values(spells.map(spell => ({ userId, spell, obtainedAt: NOW })))
  }

  async function copies(): Promise<number> {
    return (await db.select().from(inventory).where(eq(inventory.userId, userId))).length
  }

  /** Les effets vivants du joueur, tels qu'un écran les lit. */
  async function readEffects(id: number): Promise<unknown[]> {
    const user = await loadPlayer(db, id)

    return toEffectViews(await effectsQuery(db, id), user)
  }

  async function cast(spell: SpellId, at: Date = NOW): Promise<void> {
    await castSpell(db, await loadPlayer(db, userId), spell, at)
  }

  it('consomme un exemplaire et pose un effet en attente', async () => {
    await own('VITALITY')

    await cast('VITALITY')

    expect(await copies()).toBe(0)
    expect(await readEffects(userId)).toEqual([
      { spell: 'VITALITY', face: 'boon', casterName: 'gandalf', state: 'pending' },
    ])
  })

  it('refuse un second exemplaire du même sort dans la même attente', async () => {
    await own('VITALITY', 'VITALITY')

    await cast('VITALITY')
    await cast('VITALITY')

    expect(await copies()).toBe(1)
    expect(await readEffects(userId)).toHaveLength(1)
  })

  it('rend le lancer à chaque nouvelle attente, tentative ouverte ou non', async () => {
    await own('VITALITY', 'VITALITY')
    await cast('VITALITY')

    // Un rattrapage entièrement manqué ouvre une **seconde** attente sans
    // ouvrir de tentative : rien ne s'est ancré, et pourtant le lancer revient.
    // Voir specs/mecanique.md#tentative-attente-et-rattrapage.
    const nextCooldown = new Date(COOLDOWN_UNTIL.getTime() + 4 * 60 * 60 * 1000)
    await db.update(users).set({ cooldownUntil: nextCooldown }).where(eq(users.id, userId))

    await cast('VITALITY', new Date(NOW.getTime() + 60_000))

    expect(await copies()).toBe(0)
    expect(await readEffects(userId)).toHaveLength(2)
  })

  it('laisse lancer un autre sort dans la même attente', async () => {
    await own('VITALITY', 'RESPITE')

    await cast('VITALITY')
    await cast('RESPITE')

    expect(await copies()).toBe(0)
    expect(await readEffects(userId)).toHaveLength(2)
  })

  it('ne lance rien qu on ne possède pas', async () => {
    await cast('VITALITY')

    expect(await readEffects(userId)).toEqual([])
  })

  it('ancre ce qui attendait sur la tentative qui s ouvre', async () => {
    await own('VITALITY')
    await cast('VITALITY')

    const opened = await anchorEffects(db, await loadPlayer(db, userId), NOW)

    expect(opened.lives).toBe(rules.lives + 1)
    await db.update(users).set({ attemptStartedAt: NOW, lives: opened.lives }).where(eq(users.id, userId))
    expect(await readEffects(userId)).toEqual([
      { spell: 'VITALITY', face: 'boon', casterName: 'gandalf', state: 'active' },
    ])
  })

  it('additionne deux Vitalité posées avant la même tentative', async () => {
    // La règle « un exemplaire par attente » vaut par lanceur : deux lancers
    // peuvent attendre la même tentative, et ils s'empilent.
    const other = await createPlayer(db, { discordId: '987654321', username: 'radagast' })
    await db.insert(activeEffects).values([
      { userId, casterId: userId, spell: 'VITALITY', face: 'boon', castAt: NOW, castCooldownUntil: COOLDOWN_UNTIL },
      { userId, casterId: other, spell: 'VITALITY', face: 'boon', castAt: NOW, castCooldownUntil: COOLDOWN_UNTIL },
    ])

    expect((await anchorEffects(db, await loadPlayer(db, userId), NOW)).lives).toBe(rules.lives + 2)
  })

  it('laisse mourir un effet avec la tentative sur laquelle il s est ancré', async () => {
    await own('VITALITY')
    await cast('VITALITY')
    await anchorEffects(db, await loadPlayer(db, userId), NOW)
    await db.update(users).set({ attemptStartedAt: NOW }).where(eq(users.id, userId))

    // La tentative suivante s'ouvre : l'effet d'avant ne la suit pas.
    const later = new Date(NOW.getTime() + 60_000)
    const reopened = await anchorEffects(db, await loadPlayer(db, userId), later)
    await db.update(users).set({ attemptStartedAt: later }).where(eq(users.id, userId))

    expect(reopened.lives).toBe(rules.lives)
    expect(await readEffects(userId)).toEqual([])
  })

  it('garde au journal ce qui a été lancé, et quand', async () => {
    await own('VITALITY')
    await cast('VITALITY')

    expect(await readCastLog(db, await loadPlayer(db, userId))).toEqual([
      { spell: 'VITALITY', face: 'boon', targetName: 'gandalf', castAt: NOW.toISOString() },
    ])
  })

  it('garde au journal un sort dont l effet est déjà mort', async () => {
    await own('VITALITY')
    await cast('VITALITY')
    await anchorEffects(db, await loadPlayer(db, userId), NOW)
    await db.update(users).set({ attemptStartedAt: new Date(NOW.getTime() + 60_000) }).where(eq(users.id, userId))

    expect(await readCastLog(db, await loadPlayer(db, userId))).toHaveLength(1)
    expect(await readEffects(userId)).toEqual([])
  })
})
